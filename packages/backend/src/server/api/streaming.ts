import * as http from 'node:http';
import { EventEmitter } from 'events';
import { ParsedUrlQuery } from 'querystring';
import * as websocket from 'websocket';

import { subscriber as redisClient } from '@/db/redis.js';
import { Users } from '@/models/index.js';
import MainStreamConnection from './stream/index.js';
import authenticate from './authenticate.js';
import { registerStreamHandlers } from './stream/handlers/index.js';

/**
 * WebSocket server configuration
 */
export interface StreamServerConfig {
	httpServer: http.Server;
	authenticator?: (authorization: string | undefined, token: string | undefined) => Promise<[any, any]>;
	onConnection?: (connection: websocket.connection, user: any, app: any) => void;
	onClose?: (connection: websocket.connection) => void;
}

/**
 * WebSocket server manager
 */
export class StreamServer {
	private wsServer: websocket.server;
	private connections: Map<string, { 
		connection: websocket.connection, 
		user: any, 
		eventEmitter: EventEmitter,
		mainConnection: MainStreamConnection,
		intervalId?: NodeJS.Timeout
	}> = new Map();
	private plugins: Array<(server: StreamServer) => void> = [];

	constructor(private config: StreamServerConfig) {
		this.wsServer = new websocket.server({
			httpServer: config.httpServer,
		});
		
		this.wsServer.on('request', this.handleRequest.bind(this));
	}

	/**
	 * Register a plugin to extend functionality
	 */
	public registerPlugin(plugin: (server: StreamServer) => void): void {
		this.plugins.push(plugin);
		plugin(this);
	}

	/**
	 * Register multiple plugins at once
	 */
	public registerPlugins(plugins: Array<(server: StreamServer) => void>): void {
		for (const plugin of plugins) {
			this.registerPlugin(plugin);
		}
	}

	/**
	 * Handle WebSocket connection request
	 */
	private async handleRequest(request: websocket.request): Promise<void> {
		const q = request.resourceURL.query as ParsedUrlQuery;

		const authenticator = this.config.authenticator || authenticate;
		
		try {
			const [user, app] = await authenticator(request.httpRequest.headers.authorization, q.i as string);
			
			if (typeof user === 'undefined') {
				request.reject(403, 'Authentication failed');
				return;
			}

			if (user?.isSuspended) {
				request.reject(400, 'User is suspended');
				return;
			}

			const connection = request.accept();
			const ev = new EventEmitter();

			// Function to handle Redis messages
			const onRedisMessage = (_: string, data: string) => {
				const parsed = JSON.parse(data);
				ev.emit(parsed.channel, parsed.message);
			};

			// Register Redis message handler
			redisClient.on('message', onRedisMessage);

			// Create main connection instance
			const main = new MainStreamConnection(connection, ev, user, app);

			// Generate unique connection ID
			const connectionId = `${user?.id || 'anonymous'}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
			
			// Set up user activity tracking interval if user is authenticated
			const intervalId = user ? setInterval(() => {
				Users.update(user.id, {
					lastActiveDate: new Date(),
				});
			}, 1000 * 60 * 5) : undefined;
			
			// Update user's last active date immediately if authenticated
			if (user) {
				Users.update(user.id, {
					lastActiveDate: new Date(),
				});
			}

			// Store connection information
			this.connections.set(connectionId, {
				connection,
				user,
				eventEmitter: ev,
				mainConnection: main,
				intervalId
			});

			// Call onConnection hook if provided
			if (this.config.onConnection) {
				this.config.onConnection(connection, user, app);
			}

			// Set up connection close handler
			connection.once('close', () => {
				this.handleConnectionClose(connectionId);
			});

			// Set up message handler for ping/pong
			connection.on('message', async (data) => {
				if (data.type === 'utf8' && data.utf8Data === 'ping') {
					connection.send('pong');
				}
			});
		} catch (err) {
			request.reject(403, err.message);
		}
	}

	/**
	 * Handle connection close
	 */
	private handleConnectionClose(connectionId: string): void {
		const connectionInfo = this.connections.get(connectionId);
		if (!connectionInfo) return;

		const { connection, eventEmitter, mainConnection, intervalId } = connectionInfo;

		// Clean up resources
		eventEmitter.removeAllListeners();
		mainConnection.dispose();
		redisClient.off('message', connectionInfo.eventEmitter.listeners('message')[0]);
		if (intervalId) clearInterval(intervalId);

		// Call onClose hook if provided
		if (this.config.onClose) {
			this.config.onClose(connection);
		}

		// Remove connection from map
		this.connections.delete(connectionId);
	}

	/**
	 * Get all active connections
	 */
	public getConnections(): Map<string, { connection: websocket.connection, user: any }> {
		return new Map(
			Array.from(this.connections.entries()).map(([id, info]) => [id, { connection: info.connection, user: info.user }])
		);
	}

	/**
	 * Get active connections for a specific user
	 */
	public getUserConnections(userId: string): { connection: websocket.connection, user: any }[] {
		return Array.from(this.connections.values())
			.filter(info => info.user?.id === userId)
			.map(info => ({ connection: info.connection, user: info.user }));
	}

	/**
	 * Broadcast a message to all connections
	 */
	public broadcast(type: string, data: any): void {
		for (const info of this.connections.values()) {
			info.connection.send(JSON.stringify({ type, body: data }));
		}
	}

	/**
	 * Close all connections
	 */
	public close(): void {
		for (const connectionId of this.connections.keys()) {
			this.handleConnectionClose(connectionId);
		}
		this.wsServer.shutDown();
	}
}

// Singleton instance
let streamServer: StreamServer | null = null;

/**
 * Initialize the streaming server
 */
export const initializeStreamingServer = (server: http.Server): StreamServer => {
	if (streamServer) {
		return streamServer;
	}

	streamServer = new StreamServer({ httpServer: server });
	
	// Register built-in handler plugins
	registerStreamHandlers(streamServer);

	return streamServer;
};

/**
 * Get the stream server instance
 */
export const getStreamServer = (): StreamServer | null => {
	return streamServer;
};

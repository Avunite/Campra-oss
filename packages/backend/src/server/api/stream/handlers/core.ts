import { StreamServer } from '../../streaming.js';
import { publishInternalEvent } from '@/services/stream.js';

/**
 * Core functionality handler for the streaming server
 * Handles basic server-wide events and functionality
 */
export function CoreHandler(server: StreamServer): void {
  // Example of extending the StreamServer with custom methods
  const originalBroadcast = server.broadcast.bind(server);
  
  // Extend broadcast to also log events
  server.broadcast = (type: string, data: any): void => {
    // Call original method
    originalBroadcast(type, data);
    
    // Log event (in development environment, you could add more detailed logging)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[StreamServer] Broadcast: ${type}`, data);
    }
  };
  
  // Setup server stats publication (useful for admin interfaces)
  setInterval(() => {
    const connectionCount = server.getConnections().size;
    
    // Publish server stats as an internal event
    publishInternalEvent('serverStats', {
      connections: connectionCount,
      timestamp: Date.now(),
    });
  }, 1000 * 60); // Every minute
} 
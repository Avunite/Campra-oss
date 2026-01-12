import { StreamServer } from '../../streaming.js';
import { CoreHandler } from './core.js';
import { NotesHandler } from './notes.js';
import { UserHandler } from './user.js';
import { ChannelHandler } from './channel.js';
import { AntennaHandler } from './antenna.js';
import { MessagingHandler } from './messaging.js';
import { AdminHandler } from './admin.js';

/**
 * Register all built-in stream handlers
 */
export function registerStreamHandlers(server: StreamServer): void {
  // Register core functionality
  server.registerPlugin(CoreHandler);
  
  // Register feature-specific handlers
  server.registerPlugins([
    NotesHandler,
    UserHandler,
    ChannelHandler,
    AntennaHandler,
    MessagingHandler,
    AdminHandler,
  ]);
} 
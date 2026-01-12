# WebSocket Streaming Server

This module provides a flexible, pluggable WebSocket server for real-time communication between the backend and clients.

## Architecture Overview

The WebSocket server is designed with a plugin-based architecture that makes it easy to extend and maintain:

```
StreamServer (core)
├── Core Handler
├── Notes Handler
├── User Handler
├── Channel Handler
├── Antenna Handler
├── Messaging Handler
└── Admin Handler
```

Each handler is responsible for a specific domain of functionality, keeping the code organized and separated by concern.

## How to Use

### Initializing the Server

The server is initialized in `server/index.ts` like this:

```typescript
import { initializeStreamingServer } from './api/streaming.js';

// ...

const server = http.createServer(app);
initializeStreamingServer(server);
```

### Accessing the Server Instance

You can access the server instance anywhere in your code:

```typescript
import { getStreamServer } from './api/streaming.js';

const server = getStreamServer();
if (server) {
  // Do something with the server
}
```

## Creating Custom Plugins

You can create custom plugins to extend the functionality of the WebSocket server:

```typescript
import { StreamServer } from './api/streaming.js';

export function MyCustomPlugin(server: StreamServer): void {
  // Add custom methods to the server
  server.myCustomMethod = (param1, param2) => {
    // Implementation
  };
  
  // Track state specific to this plugin
  const myPluginState = new Map();
  
  // Clean up when a connection closes
  const originalOnConnectionClose = server.onConnectionClose;
  server.onConnectionClose = (connectionId) => {
    // Call the original handler first
    if (originalOnConnectionClose) {
      originalOnConnectionClose(connectionId);
    }
    
    // Clean up plugin-specific state
    myPluginState.delete(connectionId);
  };
}
```

Then register your plugin:

```typescript
import { getStreamServer } from './api/streaming.js';
import { MyCustomPlugin } from './my-custom-plugin.js';

const server = getStreamServer();
if (server) {
  server.registerPlugin(MyCustomPlugin);
}
```

## WebSocket Messages

The WebSocket server listens for and responds to messages from clients. Messages should be JSON objects with a `type` field that indicates the action to perform.

### Example Client Code

```typescript
const ws = new WebSocket(`ws://example.com/streaming?i=${token}`);

// Send a message to subscribe to a channel
ws.send(JSON.stringify({
  type: 'connect',
  channel: 'homeTimeline',
  id: 'unique-id',
  params: {}
}));

// Listen for messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.body);
};
```

## Available Handlers

### Core Handler

Provides core functionality like server stats and debugging.

### Notes Handler

Manages note subscriptions, caching, and reading status.

### User Handler

Tracks user state like following, muting, and blocking.

### Channel Handler

Manages channel subscriptions and typing status.

### Antenna Handler

Handles antenna subscriptions and note matching.

### Messaging Handler

Manages messaging channels and typing status.

### Admin Handler

Provides admin-specific functionality like abuse report notifications.

## Development

When extending the WebSocket server, follow these guidelines:

1. Keep functionality in domain-specific handlers
2. Use clean interfaces between handlers
3. Store connection-specific state with connection IDs as keys
4. Always clean up state when connections close
5. Log important events in development mode
6. Use TypeScript for better type safety

## Debugging

To enable debug logging, set the environment variable:

```
DEBUG=websocket:*
```

For more specific debugging:

```
DEBUG=websocket:notes,websocket:messaging
``` 
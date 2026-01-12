import { StreamServer } from '../../streaming.js';
import { User } from '@/models/entities/user.js';
import { UserGroup } from '@/models/entities/user-group.js';
import { publishMessagingStream, publishGroupMessagingStream } from '@/services/stream.js';

/**
 * Handles messaging-related events in the streaming server
 */
export function MessagingHandler(server: StreamServer): void {
  // Map to keep track of active messaging channels per connection
  const activeMessagingChannels = new Map<string, Set<string>>();
  
  // Map to keep track of typing status per channel
  const typingUsers = new Map<string, {
    userId: User['id'];
    lastTyped: number;
  }[]>();
  
  // Typing timeout in milliseconds
  const TYPING_TIMEOUT = 5000;
  
  // Helper to get or create active channels set for a connection
  const getConnectionChannels = (connectionId: string): Set<string> => {
    if (!activeMessagingChannels.has(connectionId)) {
      activeMessagingChannels.set(connectionId, new Set());
    }
    return activeMessagingChannels.get(connectionId)!;
  };
  
  // Register typing status for a user in direct messaging
  server.registerTypingInMessaging = (userId: User['id'], partnerId: User['id']): void => {
    const channelId = `messaging:${userId}-${partnerId}`;
    
    if (!typingUsers.has(channelId)) {
      typingUsers.set(channelId, []);
    }
    
    const typingList = typingUsers.get(channelId)!;
    const existingIndex = typingList.findIndex(entry => entry.userId === userId);
    
    const now = Date.now();
    
    if (existingIndex > -1) {
      // Update timestamp for existing user
      typingList[existingIndex].lastTyped = now;
    } else {
      // Add new typing user
      typingList.push({ userId, lastTyped: now });
      
      // Notify partner that user is typing
      publishMessagingStream(partnerId, userId, 'typing', userId);
    }
    
    // Cleanup old typing statuses
    setTimeout(() => {
      if (!typingUsers.has(channelId)) return;
      
      const outdatedIndex = typingList.findIndex(entry => 
        entry.userId === userId && now - entry.lastTyped >= TYPING_TIMEOUT
      );
      
      if (outdatedIndex > -1) {
        typingList.splice(outdatedIndex, 1);
        
        // If list is empty, delete the channel entry
        if (typingList.length === 0) {
          typingUsers.delete(channelId);
        }
      }
    }, TYPING_TIMEOUT);
  };
  
  // Register typing status for a user in group messaging
  server.registerTypingInGroupMessaging = (userId: User['id'], groupId: UserGroup['id']): void => {
    const channelId = `messaging:${groupId}`;
    
    if (!typingUsers.has(channelId)) {
      typingUsers.set(channelId, []);
    }
    
    const typingList = typingUsers.get(channelId)!;
    const existingIndex = typingList.findIndex(entry => entry.userId === userId);
    
    const now = Date.now();
    
    if (existingIndex > -1) {
      // Update timestamp for existing user
      typingList[existingIndex].lastTyped = now;
    } else {
      // Add new typing user
      typingList.push({ userId, lastTyped: now });
      
      // Notify group that user is typing
      publishGroupMessagingStream(groupId, 'typing', userId);
    }
    
    // Cleanup old typing statuses
    setTimeout(() => {
      if (!typingUsers.has(channelId)) return;
      
      const outdatedIndex = typingList.findIndex(entry => 
        entry.userId === userId && now - entry.lastTyped >= TYPING_TIMEOUT
      );
      
      if (outdatedIndex > -1) {
        typingList.splice(outdatedIndex, 1);
        
        // If list is empty, delete the channel entry
        if (typingList.length === 0) {
          typingUsers.delete(channelId);
        }
      }
    }, TYPING_TIMEOUT);
  };
  
  // Register a messaging channel connection
  server.connectMessagingChannel = (connectionId: string, userId: User['id'], partnerId: User['id']): void => {
    const channels = getConnectionChannels(connectionId);
    channels.add(`messaging:${userId}-${partnerId}`);
  };
  
  // Register a group messaging channel connection
  server.connectGroupMessagingChannel = (connectionId: string, groupId: UserGroup['id']): void => {
    const channels = getConnectionChannels(connectionId);
    channels.add(`messaging:${groupId}`);
  };
  
  // Clean up when connection closes
  server.onConnectionClose = (connectionId: string): void => {
    activeMessagingChannels.delete(connectionId);
  };
} 
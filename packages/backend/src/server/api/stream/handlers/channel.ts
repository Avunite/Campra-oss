import { StreamServer } from '../../streaming.js';
import { Channel } from '@/models/entities/channel.js';
import { User } from '@/models/entities/user.js';
import { ChannelFollowings } from '@/models/index.js';
import { publishChannelStream } from '@/services/stream.js';

/**
 * Handles channel-related events in the streaming server
 */
export function ChannelHandler(server: StreamServer): void {
  // Map to track active channel subscriptions per connection
  const activeChannels = new Map<string, Set<Channel['id']>>();
  
  // Map to track typing status in channels
  const typingUsersInChannel = new Map<Channel['id'], {
    userId: User['id'];
    lastTyped: number;
  }[]>();
  
  // Typing timeout in milliseconds
  const TYPING_TIMEOUT = 5000;
  
  // Helper to get or create active channels set for a connection
  const getConnectionChannels = (connectionId: string): Set<Channel['id']> => {
    if (!activeChannels.has(connectionId)) {
      activeChannels.set(connectionId, new Set());
    }
    return activeChannels.get(connectionId)!;
  };
  
  // Initialize channel following state for a user
  server.initializeChannelFollowing = async (connectionId: string, userId: User['id']): Promise<void> => {
    if (!userId) return;
    
    const followings = await ChannelFollowings.find({
      where: { followerId: userId },
      select: ['followeeId'],
    });
    
    const channels = getConnectionChannels(connectionId);
    followings.forEach(following => channels.add(following.followeeId));
  };
  
  // Register a channel subscription
  server.subscribeToChannel = (connectionId: string, channelId: Channel['id']): void => {
    const channels = getConnectionChannels(connectionId);
    channels.add(channelId);
  };
  
  // Unregister a channel subscription
  server.unsubscribeFromChannel = (connectionId: string, channelId: Channel['id']): void => {
    const channels = getConnectionChannels(connectionId);
    channels.delete(channelId);
  };
  
  // Register typing status for a user in a channel
  server.registerTypingInChannel = (userId: User['id'], channelId: Channel['id']): void => {
    if (!typingUsersInChannel.has(channelId)) {
      typingUsersInChannel.set(channelId, []);
    }
    
    const typingList = typingUsersInChannel.get(channelId)!;
    const existingIndex = typingList.findIndex(entry => entry.userId === userId);
    
    const now = Date.now();
    
    if (existingIndex > -1) {
      // Update timestamp for existing user
      typingList[existingIndex].lastTyped = now;
    } else {
      // Add new typing user
      typingList.push({ userId, lastTyped: now });
      
      // Notify channel that user is typing
      publishChannelStream(channelId, 'typing', userId);
    }
    
    // Cleanup old typing statuses
    setTimeout(() => {
      if (!typingUsersInChannel.has(channelId)) return;
      
      const list = typingUsersInChannel.get(channelId)!;
      const outdatedIndex = list.findIndex(entry => 
        entry.userId === userId && now - entry.lastTyped >= TYPING_TIMEOUT
      );
      
      if (outdatedIndex > -1) {
        list.splice(outdatedIndex, 1);
        
        // If list is empty, delete the channel entry
        if (list.length === 0) {
          typingUsersInChannel.delete(channelId);
        }
      }
    }, TYPING_TIMEOUT);
  };
  
  // Clean up when connection closes
  server.onConnectionClose = (connectionId: string): void => {
    activeChannels.delete(connectionId);
  };
} 
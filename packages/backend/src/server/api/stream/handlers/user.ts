import { StreamServer } from '../../streaming.js';
import { User } from '@/models/entities/user.js';
import { Followings, Mutings, Blockings, UserProfiles } from '@/models/index.js';

/**
 * Handles user-related events in the streaming server
 */
export function UserHandler(server: StreamServer): void {
  // Store user-related data keyed by connection ID
  const userState = new Map<string, {
    following: Set<User['id']>;
    muting: Set<User['id']>;
    blocking: Set<User['id']>;
    followingChannels: Set<string>;
    userProfile: any;
  }>();

  // Initialize user state on connection
  server.initializeUserState = async (connectionId: string, userId: User['id']): Promise<void> => {
    if (!userId) return;

    // Create default empty state
    const state = {
      following: new Set<User['id']>(),
      muting: new Set<User['id']>(),
      blocking: new Set<User['id']>(),
      followingChannels: new Set<string>(),
      userProfile: null,
    };
    
    // Update following
    const following = await Followings.find({
      where: { followerId: userId },
      select: ['followeeId'],
    });
    following.forEach(follow => state.following.add(follow.followeeId));

    // Update muting
    const muting = await Mutings.find({
      where: { muterId: userId },
      select: ['muteeId'],
    });
    muting.forEach(mute => state.muting.add(mute.muteeId));

    // Update blocking
    const blocking = await Blockings.find({
      where: { blockeeId: userId },
      select: ['blockerId'],
    });
    blocking.forEach(block => state.blocking.add(block.blockerId));

    // Get user profile
    const userProfile = await UserProfiles.findOneBy({ userId });
    state.userProfile = userProfile;

    // Save state
    userState.set(connectionId, state);
  };

  // Get user state for a connection
  server.getUserState = (connectionId: string): any => {
    return userState.get(connectionId);
  };

  // Update a specific aspect of user state
  server.updateUserState = async (connectionId: string, userId: User['id'], field: string, add?: string, remove?: string): Promise<void> => {
    if (!userId) return;

    const state = userState.get(connectionId);
    if (!state) return;

    if (field === 'following' && add) {
      state.following.add(add);
    } else if (field === 'following' && remove) {
      state.following.delete(remove);
    } else if (field === 'muting' && add) {
      state.muting.add(add);
    } else if (field === 'muting' && remove) {
      state.muting.delete(remove);
    } else if (field === 'blocking' && add) {
      state.blocking.add(add);
    } else if (field === 'blocking' && remove) {
      state.blocking.delete(remove);
    } else if (field === 'followingChannels' && add) {
      state.followingChannels.add(add);
    } else if (field === 'followingChannels' && remove) {
      state.followingChannels.delete(remove);
    } else if (field === 'userProfile') {
      state.userProfile = await UserProfiles.findOneBy({ userId });
    }
  };

  // Clean up user state when connection closes
  server.onConnectionClose = (connectionId: string): void => {
    userState.delete(connectionId);
  };
} 
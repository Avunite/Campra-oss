import { publishMainStream, publishUserEvent } from '@/services/stream.js';
import { webhookDeliver } from '@/queue/index.js';
import { User } from '@/models/entities/user.js';
import { Users, FollowRequests, Followings } from '@/models/index.js';
import { decrementFollowing } from './delete.js';
import { getActiveWebhooks } from '@/misc/webhook-cache.js';

type LocalUser = {
    id: User['id'];
};

/**
 * API following/request/reject
 */
export async function rejectFollowRequest(user: LocalUser, follower: LocalUser) {
    await removeFollowRequest(user, follower);
    publishUnfollow(user, follower);
}

/**
 * API following/reject
 */
export async function rejectFollow(user: LocalUser, follower: LocalUser) {
    await removeFollow(user, follower);
    publishUnfollow(user, follower);
}

/**
 * Remove follow request record
 */
async function removeFollowRequest(followee: LocalUser, follower: LocalUser) {
    const request = await FollowRequests.findOneBy({
        followeeId: followee.id,
        followerId: follower.id,
    });

    if (!request) return;

    await FollowRequests.delete(request.id);
}

/**
 * Remove follow record
 */
async function removeFollow(followee: LocalUser, follower: LocalUser) {
    const following = await Followings.findOneBy({
        followeeId: followee.id,
        followerId: follower.id,
    });

    if (!following) return;

    await Followings.delete(following.id);
    decrementFollowing(follower, followee);
}

/**
 * Publish unfollow to local
 */
async function publishUnfollow(followee: LocalUser, follower: LocalUser) {
    const packedFollowee = await Users.pack(followee.id, follower, {
        detail: true,
    });

    publishUserEvent(follower.id, 'unfollow', packedFollowee);
    publishMainStream(follower.id, 'unfollow', packedFollowee);

    const webhooks = (await getActiveWebhooks()).filter(x => x.userId === follower.id && x.on.includes('unfollow'));
    for (const webhook of webhooks) {
        webhookDeliver(webhook, 'unfollow', {
            user: packedFollowee,
        });
    }
}

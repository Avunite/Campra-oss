import { publishMainStream, publishUserEvent } from '@/services/stream.js';
import Logger from '../logger.js';
import { User } from '@/models/entities/user.js';
import { Followings, Users } from '@/models/index.js';
import { perUserFollowingChart } from '@/services/chart/index.js';
import { getActiveWebhooks } from '@/misc/webhook-cache.js';
import { webhookDeliver } from '@/queue/index.js';

const logger = new Logger('following/delete');

export default async function(follower: { id: User['id'] }, followee: { id: User['id'] }, silent = false) {
    const following = await Followings.findOneBy({
        followerId: follower.id,
        followeeId: followee.id,
    });

    if (following == null) {
        logger.warn('フォロー解除がリクエストされましたがフォローしていませんでした');
        return;
    }

    await Followings.delete(following.id);

    decrementFollowing(follower, followee);

    if (!silent) {
        Users.pack(followee.id, follower, {
            detail: true,
        }).then(async packed => {
            publishUserEvent(follower.id, 'unfollow', packed);
            publishMainStream(follower.id, 'unfollow', packed);

            const webhooks = (await getActiveWebhooks()).filter(x => x.userId === follower.id && x.on.includes('unfollow'));
            for (const webhook of webhooks) {
                webhookDeliver(webhook, 'unfollow', {
                    user: packed,
                });
            }
        });
    }
}

export async function decrementFollowing(follower: { id: User['id'] }, followee: { id: User['id'] }) {
    await Promise.all([
        Users.decrement({ id: follower.id }, 'followingCount', 1),
        Users.decrement({ id: followee.id }, 'followersCount', 1),
    ]);

    perUserFollowingChart.update(follower, followee, false);
}

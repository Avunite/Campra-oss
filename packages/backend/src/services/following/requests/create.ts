import { publishMainStream } from '@/services/stream.js';
import { User } from '@/models/entities/user.js';
import { Blockings, FollowRequests, Users } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import { createNotification } from '../../create-notification.js';

export default async function(follower: { id: User['id'] }, followee: { id: User['id'] }) {
    if (follower.id === followee.id) return;

    // check blocking
    const [blocking, blocked] = await Promise.all([
        Blockings.findOneBy({
            blockerId: follower.id,
            blockeeId: followee.id,
        }),
        Blockings.findOneBy({
            blockerId: followee.id,
            blockeeId: follower.id,
        }),
    ]);

    if (blocking != null) throw new Error('blocking');
    if (blocked != null) throw new Error('blocked');

    const followRequest = await FollowRequests.insert({
        id: genId(),
        createdAt: new Date(),
        followerId: follower.id,
        followeeId: followee.id,
    }).then(x => FollowRequests.findOneByOrFail(x.identifiers[0]));

    Users.pack(follower.id, followee).then(packed => 
        publishMainStream(followee.id, 'receiveFollowRequest', packed)
    );

    Users.pack(followee.id, followee, {
        detail: true,
    }).then(packed => 
        publishMainStream(followee.id, 'meUpdated', packed)
    );

    createNotification(followee.id, 'receiveFollowRequest', {
        notifierId: follower.id,
        followRequestId: followRequest.id,
    });
}

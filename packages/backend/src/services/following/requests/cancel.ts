import { publishMainStream } from '@/services/stream.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { User } from '@/models/entities/user.js';
import { Users, FollowRequests } from '@/models/index.js';

export default async function(followee: { id: User['id'] }, follower: { id: User['id'] }) {
    const request = await FollowRequests.findOneBy({
        followeeId: followee.id,
        followerId: follower.id,
    });

    if (request == null) {
        throw new IdentifiableError('17447091-ce07-46dd-b331-c1fd4f15b1e7', 'request not found');
    }

    await FollowRequests.delete({
        followeeId: followee.id,
        followerId: follower.id,
    });

    Users.pack(followee.id, followee, {
        detail: true,
    }).then(packed => publishMainStream(followee.id, 'meUpdated', packed));
}

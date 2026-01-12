import { publishMainStream } from '@/services/stream.js';
import { insertFollowingDoc } from '../create.js';
import { User } from '@/models/entities/user.js';
import { FollowRequests, Users } from '@/models/index.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';

export default async function(followee: { id: User['id'] }, follower: { id: User['id'] }) {
    const request = await FollowRequests.findOneBy({
        followeeId: followee.id,
        followerId: follower.id,
    });

    if (request == null) {
        throw new IdentifiableError('8884c2dd-5795-4ac9-b27e-6a01d38190f9', 'No follow request.');
    }

    await insertFollowingDoc(followee, follower);

    Users.pack(followee.id, followee, {
        detail: true,
    }).then(packed => publishMainStream(followee.id, 'meUpdated', packed));
}

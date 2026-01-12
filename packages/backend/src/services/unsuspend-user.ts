import { User } from '@/models/entities/user.js';
import { Users, Followings } from '@/models/index.js';
import { Not, IsNull } from 'typeorm';
import { publishInternalEvent } from '@/services/stream.js';

export async function doPostUnsuspend(user: User) {
	publishInternalEvent('userChangeSuspendedState', { id: user.id, isSuspended: false });

	if (Users.isLocalUser(user)) {

		const queue: string[] = [];

		const followings = await Followings.find({
			where: [
				{ followerSharedInbox: Not(IsNull()) },
				{ followeeSharedInbox: Not(IsNull()) },
			],
			select: ['followerSharedInbox', 'followeeSharedInbox'],
		});

		const inboxes = followings.map(x => x.followerSharedInbox || x.followeeSharedInbox);

		for (const inbox of inboxes) {
			if (inbox != null && !queue.includes(inbox)) queue.push(inbox);
		}
	}
}

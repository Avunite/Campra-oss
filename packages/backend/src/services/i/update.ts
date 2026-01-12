import { Users } from '@/models/index.js';
import { User } from '@/models/entities/user.js';

export async function publishToFollowers(userId: User['id']) {
	const user = await Users.findOneBy({ id: userId });
	if (user == null) throw new Error('user not found');

	return;
}

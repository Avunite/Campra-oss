import { db } from '@/db/postgre.js';
import { ChannelInvitation } from '@/models/entities/channel-invitation.js';
import { Channels } from '../index.js';

export const ChannelInvitationRepository = db.getRepository(ChannelInvitation).extend({
	async pack(
		src: ChannelInvitation['id'] | ChannelInvitation,
	) {
		const invitation = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		return {
			id: invitation.id,
			channel: await Channels.pack(invitation.channel || invitation.channelId),
		};
	},

	packMany(
		invitations: any[],
	) {
		return Promise.all(invitations.map(x => this.pack(x)));
	},
});
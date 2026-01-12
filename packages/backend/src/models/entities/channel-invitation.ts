import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.js';
import { Channel } from './channel.js';
import { id } from '../id.js';

@Entity()
@Index(['inviteeId', 'channelId'], { unique: true })
export class ChannelInvitation {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the ChannelInvitation.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The inviter user ID.',
	})
	public inviterId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public inviter: User | null;

	@Index()
	@Column({
		...id(),
		comment: 'The invitee user ID.',
	})
	public inviteeId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public invitee: User | null;

	@Index()
	@Column({
		...id(),
		comment: 'The channel ID.',
	})
	public channelId: Channel['id'];

	@ManyToOne(type => Channel, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public channel: Channel | null;
}
import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.js';
import { Channel } from './channel.js';
import { id } from '../id.js';

@Entity()
@Index(['requesterId', 'channelId'], { unique: true })
export class ChannelInviteRequest {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the ChannelInviteRequest.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The requester user ID.',
	})
	public requesterId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public requester: User | null;

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

	@Column('varchar', {
		length: 16,
		default: 'pending',
		comment: 'The status of the invite request.',
	})
	public status: 'pending' | 'approved' | 'denied';

	@Column({
		...id(),
		nullable: true,
		comment: 'The user who reviewed this request.',
	})
	public reviewedBy: User['id'] | null;

	@ManyToOne(type => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public reviewer: User | null;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The date when this request was reviewed.',
	})
	public reviewedAt: Date | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'Optional message from the requester.',
	})
	public message: string | null;
}
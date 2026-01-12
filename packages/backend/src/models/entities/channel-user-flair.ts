import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { Channel } from './channel.js';
import { User } from './user.js';
import { id } from '../id.js';

@Entity()
export class ChannelUserFlair {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the ChannelUserFlair.',
	})
	public createdAt: Date;

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
		length: 128,
		comment: 'The name of the flair.',
	})
	public name: string;

	@Column('varchar', {
		length: 64,
		comment: 'The display text of the flair.',
	})
	public text: string;

	@Column('varchar', {
		length: 7,
		default: '#99aab5',
		comment: 'The color of the flair in hex format.',
	})
	public color: string;

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'Optional emoji for the flair.',
	})
	public emoji: string | null;

	@Column({
		...id(),
		comment: 'The user who created this flair.',
	})
	public createdBy: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public creator: User | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether this flair can only be assigned by moderators.',
	})
	public isModeratorOnly: boolean;

	@Column('boolean', {
		default: true,
		comment: 'Whether this flair is currently active.',
	})
	public isActive: boolean;
}
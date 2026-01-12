import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { Channel } from './channel.js';
import { User } from './user.js';

import { id } from '../id.js';

@Entity()
@Index(['channelId', 'userId', 'roleId'], { unique: true })
export class ChannelMemberRole {
	@PrimaryColumn(id())
	public id: string;

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

	@Index()
	@Column({
		...id(),
		comment: 'The user ID.',
	})
	public userId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Index()
	@Column({
		...id(),
		comment: 'The role ID.',
	})
	public roleId: string;

	@ManyToOne('ChannelRole', {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public role: any;

	@Column('timestamp with time zone', {
		comment: 'The date when this role was assigned.',
	})
	public assignedAt: Date;

	@Column({
		...id(),
		nullable: true,
		comment: 'The user who assigned this role.',
	})
	public assignedBy: User['id'] | null;

	@ManyToOne(type => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public assigner: User | null;
}
import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Channel } from './channel.js';
import { User } from './user.js';
import { ChannelPermission } from './channel-permission.js';
import { id } from '../id.js';

@Entity()
export class ChannelRole {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the ChannelRole.',
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
		comment: 'The name of the role.',
	})
	public name: string;

	@Column('varchar', {
		length: 7,
		default: '#99aab5',
		comment: 'The color of the role in hex format.',
	})
	public color: string;

	@Index()
	@Column('integer', {
		default: 0,
		comment: 'The position of the role in the hierarchy (higher = more permissions).',
	})
	public position: number;

	@Column('boolean', {
		default: false,
		comment: 'Whether this is the default role for new members.',
	})
	public isDefault: boolean;

	@Column('boolean', {
		default: true,
		comment: 'Whether this role is mentionable.',
	})
	public isMentionable: boolean;

	@Column({
		...id(),
		nullable: true,
		comment: 'The user who created this role.',
	})
	public createdBy: User['id'] | null;

	@ManyToOne(type => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public creator: User | null;

	@OneToMany(type => ChannelPermission, permission => permission.role)
	public permissions: ChannelPermission[];
}
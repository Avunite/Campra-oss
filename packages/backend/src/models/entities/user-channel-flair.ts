import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.js';
import { Channel } from './channel.js';
import { id } from '../id.js';

@Entity()
@Index(['userId', 'channelId'], { unique: true })
export class UserChannelFlair {
	@PrimaryColumn(id())
	public id: string;

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
		comment: 'The channel ID.',
	})
	public channelId: Channel['id'];

	@ManyToOne(type => Channel, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public channel: Channel | null;

	@Column({
		...id(),
		comment: 'The flair ID.',
	})
	public flairId: string;

	@ManyToOne('ChannelUserFlair', {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public flair: any;

	@Column('varchar', {
		length: 64,
		nullable: true,
		comment: 'Custom text for user-customized flairs.',
	})
	public customText: string | null;

	@Column('timestamp with time zone', {
		comment: 'The date when this flair was assigned.',
	})
	public assignedAt: Date;

	@Column({
		...id(),
		nullable: true,
		comment: 'The user who assigned this flair (null if self-assigned).',
	})
	public assignedBy: User['id'] | null;

	@ManyToOne(type => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public assigner: User | null;
}
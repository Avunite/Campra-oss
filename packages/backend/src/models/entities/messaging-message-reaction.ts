import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne, Unique } from 'typeorm';
import { User } from './user.js';
import { MessagingMessage } from './messaging-message.js';
import { id } from '../id.js';

@Entity()
@Unique(['userId', 'messageId', 'reaction'])
export class MessagingMessageReaction {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the MessagingMessageReaction.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The user ID who reacted.',
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
		comment: 'The message ID that was reacted to.',
	})
	public messageId: MessagingMessage['id'];

	@ManyToOne(type => MessagingMessage, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public message: MessagingMessage | null;

	@Index()
	@Column('varchar', {
		length: 256,
		comment: 'The reaction emoji or name.',
	})
	public reaction: string;
}

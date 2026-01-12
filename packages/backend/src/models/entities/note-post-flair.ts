import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { Note } from './note.js';
import { User } from './user.js';
import { id } from '../id.js';

@Entity()
@Index(['noteId', 'flairId'], { unique: true })
export class NotePostFlair {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The note ID.',
	})
	public noteId: Note['id'];

	@ManyToOne(type => Note, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note: Note | null;

	@Column({
		...id(),
		comment: 'The flair ID.',
	})
	public flairId: string;

	@ManyToOne('ChannelPostFlair', {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public flair: any;

	@Column('timestamp with time zone', {
		comment: 'The date when this flair was assigned.',
	})
	public assignedAt: Date;

	@Column({
		...id(),
		comment: 'The user who assigned this flair.',
	})
	public assignedBy: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public assigner: User | null;
}
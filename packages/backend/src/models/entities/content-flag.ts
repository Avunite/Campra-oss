import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

@Entity('content_flags')
export class ContentFlag {
	@PrimaryColumn(id())
	public id: string;

	@CreateDateColumn({
		comment: 'The created date of the ContentFlag.',
	})
	public createdAt: Date;

	@Index()
	@Column('varchar', {
		length: 32,
		comment: 'Type of content being flagged.',
	})
	public contentType: string;

	@Index()
	@Column('varchar', {
		length: 32,
		comment: 'ID of the content being flagged.',
	})
	public contentId: string;

	@Index()
	@Column('varchar', {
		length: 32,
		nullable: false,
		default: 'moderate',
		comment: 'Type of flag/violation.',
	})
	public flagType: string;

	@Index()
	@Column('decimal', {
		precision: 3,
		scale: 2,
		nullable: true,
		comment: 'Confidence score from AI analysis.',
	})
	public confidence: number | null;

	@Index()
	@Column('varchar', {
		length: 32,
		default: 'iffy',
		comment: 'Source of the flag.',
	})
	public source: string;

	@Column('jsonb', {
		default: {},
		comment: 'Additional metadata about the flag.',
	})
	public metadata: Record<string, any>;

	@Index()
	@Column('varchar', {
		length: 32,
		default: 'pending',
		comment: 'Current status of the flag.',
	})
	public status: string;

	@Index()
	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the flag was reviewed.',
	})
	public reviewedAt: Date | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'User who reviewed the flag.',
	})
	public reviewedByUserId: User['id'] | null;

	@ManyToOne(() => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public reviewedByUser: User | null;

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'Action taken based on the flag.',
	})
	public action: string | null;

	// Relations
	@OneToMany('ModerationEscalation', 'contentFlag')
	public escalations: any[];

	constructor(data: Partial<ContentFlag>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

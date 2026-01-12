import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

@Entity()
export class ModerationEscalation {
	@PrimaryColumn(id())
	public id: string;

	@CreateDateColumn({
		comment: 'The created date of the ModerationEscalation.',
	})
	public createdAt: Date;

	@Column({
		...id(),
		comment: 'The content flag this escalation is related to.',
	})
	public contentFlagId: string;

	@ManyToOne('ContentFlag', 'escalations', {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public contentFlag: any;

	@Index()
	@Column('varchar', {
		length: 32,
		comment: 'Reason for escalation.',
	})
	public reason: string;

	@Column('text', {
		nullable: true,
		comment: 'Additional details about the escalation.',
	})
	public details: string | null;

	@Index()
	@Column('varchar', {
		length: 32,
		default: 'pending',
		comment: 'Current status of the escalation.',
	})
	public status: string;

	@Column({
		...id(),
		nullable: true,
		comment: 'User who created the escalation.',
	})
	public escalatedByUserId: User['id'] | null;

	@ManyToOne(() => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public escalatedByUser: User | null;

	@Index()
	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the escalation was resolved.',
	})
	public resolvedAt: Date | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'User who resolved the escalation.',
	})
	public resolvedByUserId: User['id'] | null;

	@ManyToOne(() => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public resolvedByUser: User | null;

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'Resolution action taken.',
	})
	public resolution: string | null;

	constructor(data: Partial<ModerationEscalation>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

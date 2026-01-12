import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.js';
import { id } from '../id.js';

@Entity()
export class AbuseUserReport {
	@PrimaryColumn(id())
	public id!: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the AbuseUserReport.',
	})
	public createdAt!: Date;

	@Index()
	@Column(id())
	public targetUserId!: string;

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public targetUser!: User;

	@Index()
	@Column(id())
	public reporterId!: string;

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public reporter!: User;

	@Column(id(), {
		nullable: true,
	})
	public assigneeId!: string | null;

	@ManyToOne(type => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public assignee!: User | null;

	@Index()
	@Column('boolean', {
		default: false,
	})
	public resolved!: boolean;

	@Column('boolean', {
		default: false,
	})
	public forwarded!: boolean;

	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether this report was generated automatically by the moderation system',
	})
	public isGenerated!: boolean;

	@Column('varchar', {
		length: 2048,
	})
	public comment!: string;

	//#region Denormalized fields
	@Index()
	@Column('varchar', {
		length: 128, nullable: true,
		comment: '[Denormalized]',
	})
	public targetUserHost!: string | null;

	@Index()
	@Column('varchar', {
		length: 128, nullable: true,
		comment: '[Denormalized]',
	})
	public reporterHost!: string | null;
	//#endregion

	constructor(data: Partial<AbuseUserReport>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}

		if (data.createdAt) {
			this.createdAt = new Date(data.createdAt);
		}
	}
}

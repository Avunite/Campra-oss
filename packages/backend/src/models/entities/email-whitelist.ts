import { Entity, Column, Index, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { id } from '../id.js';
import { School } from './school.js';

@Entity('email_whitelists')
@Index(['schoolId', 'email'], { unique: true })
export class EmailWhitelist {
	@PrimaryColumn(id())
	public id: string;

	@CreateDateColumn({
		comment: 'The created date of the whitelist entry.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The school ID.',
	})
	public schoolId: School['id'];

	@ManyToOne(() => School, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public school: School | null;

	@Index()
	@Column('varchar', {
		length: 256,
		comment: 'Whitelisted email address (lowercase).',
	})
	public email: string;

	@Column('varchar', {
		length: 100,
		nullable: true,
		comment: 'Optional name associated with the email.',
	})
	public name: string | null;

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'Grade level for pre-assignment (e.g., "Freshman", "Sophomore", "9", "10").',
	})
	public gradeLevel: string | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether an invitation email has been sent.',
	})
	public invitationSent: boolean;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the invitation was sent.',
	})
	public invitationSentAt: Date | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether the user has registered using this whitelist entry.',
	})
	public registered: boolean;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the user registered.',
	})
	public registeredAt: Date | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The user ID if they have registered.',
	})
	public userId: string | null;

	@Column('varchar', {
		length: 32,
		comment: 'Who added this whitelist entry.',
	})
	public addedBy: string;

	@Column('varchar', {
		length: 256,
		nullable: true,
		comment: 'Optional notes about this whitelist entry.',
	})
	public notes: string | null;

	constructor(data: Partial<EmailWhitelist>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

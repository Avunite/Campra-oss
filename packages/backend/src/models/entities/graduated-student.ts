import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';
import { School } from './school.js';

@Entity('graduated_students')
export class GraduatedStudent {
	@PrimaryColumn(id())
	public id: string;

	@CreateDateColumn({
		comment: 'The created date of the GraduatedStudent.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The graduated user ID.',
	})
	public userId: User['id'];

	@ManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Index()
	@Column({
		...id(),
		comment: 'The school ID.',
	})
	public schoolId: School['id'];

	@ManyToOne(() => School, school => school.graduates, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public school: School | null;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'Date of graduation.',
	})
	public graduationDate: Date;

	@Column('varchar', {
		length: 256,
		nullable: true,
		comment: 'Degree obtained.',
	})
	public degree: string | null;

	@Column('varchar', {
		length: 256,
		nullable: true,
		comment: 'Field of study/major.',
	})
	public major: string | null;

	@Column('decimal', {
		precision: 3,
		scale: 2,
		nullable: true,
		comment: 'Grade Point Average.',
	})
	public gpa: number | null;

	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'Academic honors received.',
	})
	public honors: string | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'URL to transcript or verification document.',
	})
	public transcriptUrl: string | null;

	@Index()
	@Column('varchar', {
		length: 32,
		default: 'pending',
		comment: 'Verification status of graduation.',
	})
	public verificationStatus: string;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When graduation was verified.',
	})
	public verifiedAt: Date | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'User who verified the graduation.',
	})
	public verifiedByUserId: User['id'] | null;

	@ManyToOne(() => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn({ name: 'verifiedByUserId' })
	public verifiedByUser: User | null;

	@Column('varchar', {
		length: 32,
		default: 'graduated',
		comment: 'Current alumni status.',
	})
	public alumniStatus: string;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'Last contact with alumni.',
	})
	public lastContactDate: Date | null;

	@Index()
	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the grace period ends and account will be deleted.',
	})
	public gracePeriodEndsAt: Date | null;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When data export was requested.',
	})
	public dataExportRequestedAt: Date | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'URL to exported data file.',
	})
	public dataExportUrl: string | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether the student was notified about upcoming deletion.',
	})
	public notifiedAboutDeletion: boolean;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the deletion notification was sent.',
	})
	public notifiedAt: Date | null;

	constructor(data: Partial<GraduatedStudent>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

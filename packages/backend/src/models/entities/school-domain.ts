import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { id } from '../id.js';
import { School } from './school.js';

@Entity('school_domains')
export class SchoolDomain {
	@PrimaryColumn(id())
	public id: string;

	@CreateDateColumn({
		comment: 'The created date of the SchoolDomain.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The school ID.',
	})
	public schoolId: School['id'];

	@ManyToOne(() => School, school => school.domains, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public school: School | null;

	@Index()
	@Column('varchar', {
		length: 128,
		comment: 'The domain name.',
	})
	public domain: string;

	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether the domain has been verified.',
	})
	public isVerified: boolean;

	@Column('varchar', {
		length: 64,
		nullable: true,
		comment: 'Token used for domain verification.',
	})
	public verificationToken: string | null;

	@Column('varchar', {
		length: 32,
		default: 'dns',
		comment: 'Method used for domain verification.',
	})
	public verificationMethod: string;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the domain was verified.',
	})
	public verifiedAt: Date | null;

	constructor(data: Partial<SchoolDomain>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

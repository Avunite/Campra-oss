import { Entity, PrimaryColumn, Column, Index, CreateDateColumn } from 'typeorm';
import { id } from '../id.js';

@Entity('school_admin_verifications')
export class SchoolAdminVerification {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The school ID.',
	})
	public schoolId: string;

	@Column('varchar', {
		length: 128,
		comment: 'Admin email address.',
	})
	public email: string;

	@Index({ unique: true })
	@Column('varchar', {
		length: 64,
		comment: 'Verification token.',
	})
	public token: string;

	@Column('timestamp with time zone', {
		comment: 'Token expiration date.',
	})
	public expiresAt: Date;

	@Column('boolean', {
		default: false,
		comment: 'Whether verification is complete.',
	})
	public verified: boolean;

	@CreateDateColumn({
		comment: 'The created date of the verification request.',
	})
	public createdAt: Date;

	constructor(data: Partial<SchoolAdminVerification>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}
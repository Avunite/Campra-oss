import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { id } from '../id.js';
import { School } from './school.js';
import { User } from './user.js';

@Entity('campus_blocks')
@Index(['schoolId', 'blockedSchoolId'], { unique: true })
export class CampusBlock {
	@PrimaryColumn(id())
	public id: string;

	@CreateDateColumn({
		comment: 'The created date of the CampusBlock.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The school implementing the block.',
	})
	public schoolId: School['id'];

	@ManyToOne(() => School, school => school.campusBlocks, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public school: School | null;

	@Index()
	@Column({
		...id(),
		comment: 'The school being blocked.',
	})
	public blockedSchoolId: School['id'];

	@ManyToOne(() => School, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'blockedSchoolId' })
	public blockedSchool: School | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'Reason for the block.',
	})
	public reason: string | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'User who created the block.',
	})
	public createdByUserId: User['id'] | null;

	@ManyToOne(() => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public createdByUser: User | null;

	constructor(data: Partial<CampusBlock>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { id } from '../id.js';
import { School } from './school.js';

@Entity('school_billing')
export class SchoolBilling {
	@PrimaryColumn(id())
	public id: string;

	@CreateDateColumn({
		type: 'timestamp with time zone',
		comment: 'The created date of the SchoolBilling.',
	})
	public createdAt: Date;

	@UpdateDateColumn({
		type: 'timestamp with time zone',
		comment: 'The updated date of the SchoolBilling.',
	})
	public updatedAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The school being billed.',
	})
	public schoolId: School['id'];

	@ManyToOne(() => School, school => school.billing, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public school: School | null;

	@Column('varchar', {
		length: 32,
		default: 'monthly',
		comment: 'Billing cycle frequency.',
	})
	public billingCycle: string;

	@Index()
	@Column('varchar', {
		length: 32,
		default: 'active',
		comment: 'Current billing status.',
	})
	public status: string;

	@Column('timestamp with time zone', {
		comment: 'Start of current billing period.',
	})
	public currentPeriodStart: Date;

	@Column('timestamp with time zone', {
		comment: 'End of current billing period.',
	})
	public currentPeriodEnd: Date;

	@Column('integer', {
		default: 0,
		comment: 'Number of students being billed for.',
	})
	public studentCount: number;

	@Column('decimal', {
		precision: 10,
		scale: 2,
		comment: 'Price per student.',
	})
	public pricePerStudent: number;

	@Column('decimal', {
		precision: 10,
		scale: 2,
		comment: 'Total amount for current period.',
	})
	public totalAmount: number;

	@Column('varchar', {
		length: 3,
		default: 'USD',
		comment: 'Currency code.',
	})
	public currency: string;

	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'Stripe customer ID.',
	})
	public stripeCustomerId: string | null;

	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'Stripe subscription ID.',
	})
	public stripeSubscriptionId: string | null;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'Last successful payment date.',
	})
	public lastPaymentDate: Date | null;

	@Index()
	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'Next scheduled payment date.',
	})
	public nextPaymentDate: Date | null;

	@Column('jsonb', {
		nullable: true,
		comment: 'Payment method information.',
	})
	public paymentMethod: Record<string, any> | null;

	@Column('jsonb', {
		default: {},
		comment: 'Additional billing metadata.',
	})
	public metadata: Record<string, any>;

	// Billing Mode Fields (Prepaid Cap Support)
	@Index()
	@Column('varchar', {
		length: 32,
		default: 'per_student',
		comment: 'Billing calculation method: per_student or prepaid_cap.',
	})
	public billingMode: string;

	@Column('integer', {
		nullable: true,
		comment: 'The student cap that was billed for in prepaid model.',
	})
	public billedStudentCap: number | null;

	constructor(data: Partial<SchoolBilling>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

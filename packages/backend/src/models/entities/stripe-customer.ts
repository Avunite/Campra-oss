import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

@Entity('stripe_customers')
export class StripeCustomer {
	@PrimaryColumn(id())
	public id: string;

	@CreateDateColumn({
		comment: 'The created date of the StripeCustomer.',
	})
	public createdAt: Date;

	@UpdateDateColumn({
		comment: 'The updated date of the StripeCustomer.',
	})
	public updatedAt: Date;

	@Index({ unique: true })
	@Column('varchar', {
		length: 128,
		comment: 'Stripe customer ID.',
	})
	public stripeCustomerId: string;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The school ID for school-based customers.',
	})
	public schoolId: string | null;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The user ID for individual customers.',
	})
	public userId: User['id'] | null;

	@ManyToOne('User', {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: any;

	@Column('varchar', {
		length: 256,
		comment: 'Customer email address.',
	})
	public email: string;

	@Column('varchar', {
		length: 256,
		nullable: true,
		comment: 'Customer name.',
	})
	public name: string | null;

	@Index()
	@Column('varchar', {
		length: 32,
		default: 'individual',
		comment: 'Type of customer (individual, school).',
	})
	public customerType: string;

	@Column('jsonb', {
		nullable: true,
		comment: 'Billing address information.',
	})
	public billingAddress: Record<string, any> | null;

	@Column('jsonb', {
		nullable: true,
		comment: 'Tax information.',
	})
	public taxInfo: Record<string, any> | null;

	@Column('jsonb', {
		default: {},
		comment: 'Additional customer metadata.',
	})
	public metadata: Record<string, any>;

	@Column('boolean', {
		default: true,
		comment: 'Whether the customer is active.',
	})
	public isActive: boolean;

	constructor(data: Partial<StripeCustomer>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

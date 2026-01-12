import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

@Entity('pricing_history')
export class PricingHistory {
	@PrimaryColumn(id())
	public id: string;

	@CreateDateColumn({
		comment: 'The created date of the PricingHistory.',
	})
	public createdAt: Date;

	@Index()
	@Column('varchar', {
		length: 32,
		comment: 'Type of entity (school, subscription, etc.).',
	})
	public entityType: string;

	@Index()
	@Column('varchar', {
		length: 32,
		comment: 'ID of the entity.',
	})
	public entityId: string;

	@Column('varchar', {
		length: 32,
		comment: 'Type of price change.',
	})
	public priceType: string;

	@Column('decimal', {
		precision: 10,
		scale: 2,
		nullable: true,
		comment: 'Previous price.',
	})
	public oldPrice: number | null;

	@Column('decimal', {
		precision: 10,
		scale: 2,
		comment: 'New price.',
	})
	public newPrice: number;

	@Column('varchar', {
		length: 3,
		default: 'USD',
		comment: 'Currency code.',
	})
	public currency: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'When the price change takes effect.',
	})
	public effectiveDate: Date;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'Reason for the price change.',
	})
	public reason: string | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'User who made the price change.',
	})
	public createdByUserId: User['id'] | null;

	@ManyToOne(() => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public createdByUser: User | null;

	constructor(data: Partial<PricingHistory>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

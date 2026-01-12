import { Entity, PrimaryColumn, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.js';
import { App } from './app.js';
import { id } from '../id.js';

@Entity()
@Index(['token'])
@Index(['session'])
@Index(['userId', 'token'])
export class AccessToken {
	@PrimaryColumn(id())
	public id!: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the AccessToken.',
	})
	public createdAt!: Date;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public lastUsedAt!: Date | null;

	@Column('varchar', {
		length: 128,
	})
	public token!: string;

	@Column('varchar', {
		length: 128,
		nullable: true,
	})
	public session!: string | null;

	@Column('varchar', {
		length: 128,
	})
	public hash!: string;

	@Index()
	@Column(id())
	public userId!: string;

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user!: User;

	@Column({
		...id(),
		nullable: true,
	})
	public appId!: string | null;

	@ManyToOne(type => App, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public app!: App | null;

	@Column('varchar', {
		length: 128,
		nullable: true,
	})
	public name!: string | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
	})
	public description!: string | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
	})
	public iconUrl!: string | null;

	@Column('varchar', {
		array: true,
		length: 64,
		default: '{}',
	})
	public permission!: string[];

	@Column('boolean', {
		default: false,
	})
	public fetched!: boolean;
	
	@Column('varchar', {
		array: true,
		length: 64,
		default: '{}',
		comment: 'The scopes of the OAuth2 token.',
	})
	public scope!: string[];

	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'The refresh token for OAuth2.',
	})
	public refreshToken!: string | null;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The expiration date of the OAuth2 token.',
	})
	public expiresAt!: Date | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether this is a refresh token for OAuth2.',
	})
	public isRefreshToken!: boolean;

	constructor(data: Partial<AccessToken>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}

		if (data.createdAt) {
			this.createdAt = new Date(data.createdAt);
		}
		if (data.lastUsedAt) {
			this.lastUsedAt = new Date(data.lastUsedAt);
		}
		if (data.expiresAt) {
			this.expiresAt = new Date(data.expiresAt);
		}
	}
}

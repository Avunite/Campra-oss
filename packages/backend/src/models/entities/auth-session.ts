import { Entity, PrimaryColumn, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.js';
import { App } from './app.js';
import { id } from '../id.js';

@Entity()
export class AuthSession {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the AuthSession.',
	})
	public createdAt: Date;

	@Index()
	@Column('varchar', {
		length: 128,
	})
	public token: string;

	@Column({
		...id(),
		nullable: true,
	})
	public userId: User['id'] | null;

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
		nullable: true,
	})
	@JoinColumn()
	public user: User | null;

	@Column(id())
	public appId: App['id'];

	@ManyToOne(type => App, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public app: App | null;

	// OAuth2 specific fields
	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'The redirect URI for the OAuth2 authorization.',
	})
	public redirectUri: string | null;

	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'The code challenge for PKCE in OAuth2.',
	})
	public codeChallenge: string | null;

	@Column('varchar', {
		length: 10,
		nullable: true,
		comment: 'The code challenge method for PKCE in OAuth2.',
	})
	public codeChallengeMethod: string | null;

	@Column('varchar', {
		array: true,
		length: 64,
		default: '{}',
		comment: 'The scopes requested for the OAuth2 authorization.',
	})
	public scope: string[];

	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'The authorization code for OAuth2 authorization code flow.',
	})
	public authorizationCode: string | null;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The expiration date of the authorization code.',
	})
	public authorizationCodeExpiresAt: Date | null;
}

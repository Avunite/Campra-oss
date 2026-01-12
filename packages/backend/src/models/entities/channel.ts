import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.js';
import { id } from '../id.js';
import { DriveFile } from './drive-file.js';

@Entity()
export class Channel {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the Channel.',
	})
	public createdAt: Date;

	@Index()
	@Column('timestamp with time zone', {
		nullable: true,
	})
	public lastNotedAt: Date | null;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The owner ID.',
	})
	public userId: User['id'] | null;

	@ManyToOne(type => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public user: User | null;

	@Column('varchar', {
		length: 128,
		comment: 'The name of the Channel.',
	})
	public name: string;

	@Column('varchar', {
		length: 2048, nullable: true,
		comment: 'The description of the Channel.',
	})
	public description: string | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of banner Channel.',
	})
	public bannerId: DriveFile['id'] | null;

	@ManyToOne(type => DriveFile, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public banner: DriveFile | null;

	@Index()
	@Column('integer', {
		default: 0,
		comment: 'The count of notes.',
	})
	public notesCount: number;

	@Index()
	@Column('integer', {
		default: 0,
		comment: 'The count of users.',
	})
	public usersCount: number;

	@Column('jsonb', {
		default: [],
	})
	public moderators: {
		id: string;
	}[];

	@Column('jsonb', {
		default: [],
	})
	public admins: {
		id: string;
	}[];

	@Column('boolean', {
		default: false,
	})
	public archive: boolean;

	@Column('jsonb', {
		default: [],
	})
	public banned: {
		id: string;
	}[];

	// Privacy and access control fields
	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether the channel is private (hidden from public listings).',
	})
	public isPrivate: boolean;

	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether the channel is invite-only.',
	})
	public isInviteOnly: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the channel allows invite requests from non-members.',
	})
	public allowInviteRequests: boolean;

	// School affiliation
	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of the school this channel belongs to.',
	})
	public schoolId: string | null;

	// Form and application settings
	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of the application form for this channel.',
	})
	public applicationFormId: string | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether an application form is required to join this channel.',
	})
	public requireApplicationForm: boolean;

	// Flair settings
	@Column('jsonb', {
		default: {
			enabled: false,
			allowUserCreated: false,
			allowUserAssignment: false,
		},
		comment: 'User flair settings for this channel.',
	})
	public userFlairSettings: {
		enabled: boolean;
		allowUserCreated: boolean;
		allowUserAssignment: boolean;
	};

	@Column('jsonb', {
		default: {
			enabled: false,
			required: false,
		},
		comment: 'Post flair settings for this channel.',
	})
	public postFlairSettings: {
		enabled: boolean;
		required: boolean;
	};
}

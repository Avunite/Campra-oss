import { Entity, PrimaryColumn, Column, Index, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';
import { SchoolDomain } from './school-domain.js';
import { CampusBlock } from './campus-block.js';
import { SchoolBilling } from './school-billing.js';
import { GraduatedStudent } from './graduated-student.js';

@Entity('schools')
export class School {
	@PrimaryColumn(id())
	public id: string;

	@CreateDateColumn({
		comment: 'The created date of the School.',
	})
	public createdAt: Date;

	@UpdateDateColumn({
		comment: 'The updated date of the School.',
	})
	public updatedAt: Date;

	@Column('varchar', {
		length: 256,
		comment: 'The name of the school.',
	})
	public name: string;

	@Index({ unique: true })
	@Column('varchar', {
		length: 128,
		comment: 'The primary domain of the school.',
	})
	public domain: string;

	@Index()
	@Column('varchar', {
		length: 32,
		default: 'university',
		comment: 'The type of educational institution.',
	})
	public type: string;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'The physical location of the school.',
	})
	public location: string | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'Description of the school.',
	})
	public description: string | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'URL to the school logo.',
	})
	public logoUrl: string | null;

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'Drive file ID for the school logo.',
	})
	public logoId: string | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'Official website URL.',
	})
	public websiteUrl: string | null;

	@Index()
	@Column('boolean', {
		default: true,
		comment: 'Whether the school is active and accepting students.',
	})
	public isActive: boolean;

	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether the school is a demo school for super admin previews.',
	})
	public isDemo: boolean;

	@Column('integer', {
		nullable: true,
		comment: 'Maximum number of students allowed.',
	})
	public maxStudents: number | null;

	@Column('integer', {
		array: true,
		default: [5, 12],
		comment: 'Months when graduation typically occurs.',
	})
	public graduationMonths: number[];

	@Column('integer', {
		default: 9,
		comment: 'Month when academic year starts (1-12).',
	})
	public academicYearStart: number;

	@Column('varchar', {
		length: 64,
		default: 'UTC',
		comment: 'School timezone.',
	})
	public timezone: string;

	@Column('jsonb', {
		default: {},
		comment: 'Additional school configuration settings.',
	})
	public settings: Record<string, any>;

	@Index()
	@Column('varchar', {
		length: 32,
		default: 'inactive',
		comment: 'Current subscription status of the school.',
	})
	public subscriptionStatus: string;

	@Column('jsonb', {
		default: {},
		comment: 'Additional subscription and admin metadata.',
	})
	public metadata: {
		adminOverride?: boolean;
		freeActivation?: boolean;
		paidSubscriptionDespiteFree?: boolean;
		deletion?: {
			deleted_at: string;
			deleted_by: string;
			reason: string;
			deleted_counts: Record<string, number>;
		};
		lms?: {
			type: 'blackboard' | 'blackbaud' | 'canvas' | 'powerschool' | 'oneroster';
			name?: string;
			apiUrl: string;
			clientId: string;
			clientSecret: string;
			accessToken?: string;
			refreshToken?: string;
			expiresAt?: string;
			connectionStatus: 'active' | 'disconnected' | 'error';
			autoSync?: boolean;
			syncFrequency?: 'hourly' | 'daily' | 'weekly';
			lastSyncAt?: string;
		};
	};

	// Student Cap Fields (Prepaid Billing)
	@Column('integer', {
		nullable: true,
		comment: 'Maximum number of students allowed before blocking registration (prepaid model).',
	})
	public studentCap: number | null;

	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether student cap limits are actively enforced.',
	})
	public studentCapEnforced: boolean;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the student cap was last modified.',
	})
	public studentCapSetAt: Date | null;

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'User ID who last modified the student cap.',
	})
	public studentCapSetBy: string | null;

	// School Admin Enhancement Fields
	@Column('jsonb', {
		default: {
			allowDomainSignups: false,
			requireInvitation: true,
			autoGraduationEnabled: true,
			allowStudentsChooseUsername: true,
			requireLMSValidation: false
		},
		comment: 'School registration and management settings.',
	})
	public registrationSettings: {
		allowDomainSignups: boolean;
		requireInvitation: boolean;
		autoGraduationEnabled: boolean;
		allowStudentsChooseUsername: boolean;
		requireLMSValidation: boolean;
	};

	@Column('point', {
		nullable: true,
		comment: 'Geographic coordinates for location-based features.',
	})
	public coordinates: { x: number; y: number } | null;

	// Relations
	@OneToMany(() => User, user => user.school)
	public users: User[];

	@OneToMany(() => SchoolDomain, domain => domain.school)
	public domains: SchoolDomain[];

	@OneToMany(() => CampusBlock, block => block.school)
	public campusBlocks: CampusBlock[];

	@OneToMany(() => SchoolBilling, billing => billing.school)
	public billing: SchoolBilling[];

	@OneToMany(() => GraduatedStudent, graduate => graduate.school)
	public graduates: GraduatedStudent[];

	constructor(data: Partial<School>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

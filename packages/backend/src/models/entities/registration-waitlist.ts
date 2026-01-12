import { Entity, PrimaryColumn, Column, Index, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { id } from '../id.js';
import { School } from './school.js';

@Entity('registration_waitlist')
export class RegistrationWaitlist {
    @PrimaryColumn(id())
    public id: string;

    @Index()
    @Column({
        ...id(),
        comment: 'The school this waitlist entry belongs to.',
    })
    public schoolId: string;

    @ManyToOne(() => School, {
        onDelete: 'CASCADE',
    })
    @JoinColumn()
    public school: School | null;

    @Index()
    @Column('varchar', {
        length: 256,
        comment: 'Email address of the student.',
    })
    public email: string;

    @Column('varchar', {
        length: 128,
        nullable: true,
        comment: 'Name of the student (optional).',
    })
    public name: string | null;

    @Index()
    @Column('varchar', {
        length: 32,
        comment: 'Reason why registration was blocked.',
    })
    public blockedReason:
        | 'LMS_VALIDATION_FAILED'
        | 'LMS_NOT_CONFIGURED'
        | 'NOT_ENROLLED_IN_LMS'
        | 'SCHOOL_REGISTRATION_CLOSED'
        | 'STUDENT_CAP_REACHED'
        | 'SCHOOL_SUBSCRIPTION_REQUIRED';

    @Column('boolean', {
        default: false,
        comment: 'Whether the student has been notified.',
    })
    public notified: boolean;

    @Column('timestamp with time zone', {
        nullable: true,
        comment: 'When the notification email was sent.',
    })
    public notifiedAt: Date | null;

    @Index()
    @Column('boolean', {
        default: false,
        comment: 'Whether the student has successfully registered.',
    })
    public registered: boolean;

    @Column('timestamp with time zone', {
        nullable: true,
        comment: 'When the student completed registration.',
    })
    public registeredAt: Date | null;

    @CreateDateColumn({
        comment: 'When this waitlist entry was created.',
    })
    public createdAt: Date;

    @Column('jsonb', {
        nullable: true,
        comment: 'Additional metadata about the waitlist entry.',
    })
    public metadata: {
        userAgent?: string;
        attemptCount?: number;
    } | null;
}

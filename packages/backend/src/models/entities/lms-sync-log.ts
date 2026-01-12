import { Entity, PrimaryColumn, Column, Index, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { id } from '../id.js';
import { School } from './school.js';

@Entity('lms_sync_logs')
export class LMSSyncLog {
    @PrimaryColumn(id())
    public id: string;

    @Index()
    @Column({
        ...id(),
        comment: 'The school this sync log belongs to.',
    })
    public schoolId: string;

    @ManyToOne(() => School, {
        onDelete: 'CASCADE',
    })
    @JoinColumn()
    public school: School | null;

    @Column('varchar', {
        length: 32,
        comment: 'Type of sync operation.',
    })
    public syncType: 'manual' | 'scheduled' | 'oauth_callback';

    @Index()
    @Column('varchar', {
        length: 32,
        comment: 'Current status of the sync.',
    })
    public status: 'started' | 'completed' | 'failed' | 'partial';

    @Column('integer', {
        default: 0,
        comment: 'Total number of records processed.',
    })
    public recordsProcessed: number;

    @Column('integer', {
        default: 0,
        comment: 'Number of records successfully updated.',
    })
    public recordsUpdated: number;

    @Column('integer', {
        default: 0,
        comment: 'Number of records that failed to update.',
    })
    public recordsFailed: number;

    @Column('jsonb', {
        nullable: true,
        comment: 'Detailed error information if sync failed.',
    })
    public errorDetails: {
        message?: string;
        stack?: string;
        failedRecords?: Array<{
            email: string;
            error: string;
        }>;
    } | null;

    @CreateDateColumn({
        comment: 'When the sync started.',
    })
    public createdAt: Date;

    @Column('timestamp with time zone', {
        nullable: true,
        comment: 'When the sync completed.',
    })
    public completedAt: Date | null;
}

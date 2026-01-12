import { Notes } from '@/models/index.js';
import Logger from '@/services/logger.js';
import { LessThan } from 'typeorm';

const logger = new Logger('approve-pending-content');

/**
 * Automatically approve content that has been pending moderation for too long
 * This prevents content from being stuck in pending state if Iffy doesn't respond
 */
export default async function(job: any): Promise<void> {
    logger.info('Checking for pending content to auto-approve...');
    
    try {
        // Find notes that have been pending moderation for more than 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        const pendingNotes = await Notes.createQueryBuilder('note')
            .where('note."iffyScanResult" IS NOT NULL')
            .andWhere("note.\"iffyScanResult\"->>'pendingModeration' = 'true'")
            .andWhere("note.\"iffyScanResult\"->>'submittedAt' < :cutoff", { cutoff: fiveMinutesAgo.toISOString() })
            .getMany();
        
        logger.info(`Found ${pendingNotes.length} notes pending moderation for over 5 minutes`);
        
        for (const note of pendingNotes) {
            try {
                const scanResult = note.iffyScanResult as any;
                const originalVisibility = scanResult.originalVisibility || 'public';
                
                // Restore to original visibility
                await Notes.update(
                    { id: note.id },
                    {
                        visibility: originalVisibility,
                        visibleUserIds: originalVisibility === 'specified' ? [] : [],
                        iffyScanResult: {
                            ...scanResult,
                            autoApproved: true,
                            autoApprovedAt: new Date(),
                            pendingModeration: false,
                            reason: 'Auto-approved after timeout'
                        }
                    }
                );
                
                logger.info(`Auto-approved pending note ${note.id} after timeout`);
                
            } catch (error) {
                logger.error(`Failed to auto-approve note ${note.id}:`, error);
            }
        }
        
        logger.info(`Auto-approval check completed. Approved ${pendingNotes.length} notes.`);
        
    } catch (error) {
        logger.error('Failed to check pending content:', error);
        throw error;
    }
}
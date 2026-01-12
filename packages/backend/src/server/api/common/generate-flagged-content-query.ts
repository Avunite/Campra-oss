import { User } from '@/models/entities/user.js';
import { ContentFlags } from '@/models/index.js';
import { SelectQueryBuilder } from 'typeorm';

export function generateFlaggedContentQuery(q: SelectQueryBuilder<any>, me?: { id: User['id']; isAdmin?: boolean; isModerator?: boolean } | null) {
	// Don't filter for admin/moderator users - they should see all content
	if (!me || me.isAdmin || me.isModerator) return;
	
	const flaggedQuery = ContentFlags.createQueryBuilder('flagged')
		.select('flagged.contentId')
		.where('flagged.contentType = :contentType', { contentType: 'note' })
		.andWhere('flagged.status IN (:...statuses)', { statuses: ['flagged', 'hidden'] });

	q.andWhere(`note.id NOT IN (${flaggedQuery.getQuery()})`);
	q.setParameters(flaggedQuery.getParameters());
}

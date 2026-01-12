import define from '../../define.js';
import { Notes, Users } from '@/models/index.js';
import { ApiError } from '../../error.js';
import deleteNote from '@/services/note/delete.js';

export const meta = {
	tags: ['school'],
	requireCredential: true,
	description: 'Delete a post as a school admin.',
	errors: {
		noSuchPost: {
			message: 'No such post.',
			code: 'NO_SUCH_POST',
			id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
		},
		permissionDenied: {
			message: 'Permission denied.',
			code: 'PERMISSION_DENIED',
			id: 'b9737a88-b703-4425-9365-3848b89e324d',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		postId: { type: 'string', format: 'campra:id' },
	},
	required: ['postId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	if (!me.isSchoolAdmin || !me.adminForSchoolId) {
		throw new ApiError(meta.errors.permissionDenied);
	}

	const post = await Notes.findOneBy({ id: ps.postId });

	if (!post) {
		throw new ApiError(meta.errors.noSuchPost);
	}

	const postAuthor = await Users.findOneBy({ id: post.userId });

	if (!postAuthor || postAuthor.schoolId !== me.adminForSchoolId) {
		throw new ApiError(meta.errors.permissionDenied);
	}

	// Use the proper delete service to handle cascading deletes and stream updates
	await deleteNote(postAuthor, post);

	return {};
});

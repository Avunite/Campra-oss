import RE2 from 're2';
import * as mfm from 'mfm-js';
import { publishMainStream, publishUserEvent } from '@/services/stream.js';
import acceptAllFollowRequests from '@/services/following/requests/accept-all.js';
import { publishToFollowers } from '@/services/i/update.js';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';
import { extractHashtags } from '@/misc/extract-hashtags.js';
import { updateUsertags } from '@/services/update-hashtag.js';
import { Users, DriveFiles, UserProfiles, Pages } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { UserProfile } from '@/models/entities/user-profile.js';
import { Decorations } from '@/models/index.js';
import { notificationTypes } from '@/types.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { langmap } from '@/misc/langmap.js';
import { ApiError } from '../../error.js';
import define from '../../define.js';
import { sanitizeCss } from '@/misc/sanitize-css.js';
import { In } from 'typeorm';
import { ProfileContentModerator } from '@/services/profile-content-moderator.js';
import Logger from '@/services/logger.js';

const logger = new Logger('profile-update');

export const meta = {
	tags: ['account'],

	requireCredential: true,

	kind: 'write:account',

	errors: {
		noSuchAvatar: {
			message: 'No such avatar file.',
			code: 'NO_SUCH_AVATAR',
			id: '539f3a45-f215-4f81-a9a8-31293640207f',
		},

		noSuchBanner: {
			message: 'No such banner file.',
			code: 'NO_SUCH_BANNER',
			id: '0d8f5629-f210-41c2-9433-735831a58595',
		},

		avatarNotAnImage: {
			message: 'The file specified as an avatar is not an image.',
			code: 'AVATAR_NOT_AN_IMAGE',
			id: 'f419f9f8-2f4d-46b1-9fb4-49d3a2fd7191',
		},

		bannerNotAnImage: {
			message: 'The file specified as a banner is not an image.',
			code: 'BANNER_NOT_AN_IMAGE',
			id: '75aedb19-2afd-4e6d-87fc-67941256fa60',
		},

		noSuchPage: {
			message: 'No such page.',
			code: 'NO_SUCH_PAGE',
			id: '8e01b590-7eb9-431b-a239-860e086c408e',
		},

		invalidRegexp: {
			message: 'Invalid Regular Expression.',
			code: 'INVALID_REGEXP',
			id: '0d786918-10df-41cd-8f33-8dec7d9a89a5',
		},

		notPlusUser: {
			message: 'Only Plus users can set custom CSS.',
			code: 'NOT_PLUS_USER',
			id: '56c06af2-8bd7-4956-b955-9ff49ac82d43',
		},

		invalidCss: {
			message: 'The provided CSS is invalid or contains disallowed properties.',
			code: 'INVALID_CSS',
			id: '0b39ba64-6f99-4fe3-af6e-dc3b8b7bf9af',
		},

		noSuchDecoration: {
            message: 'No such decoration.',
            code: 'NO_SUCH_DECORATION',
            id: '8e01b590-7eb9-431b-a239-860e086c408f',
        },

        tooManyDecorations: {
            message: 'You can only have up to 5 avatar decorations.',
            code: 'TOO_MANY_DECORATIONS',
            id: '8e01b590-7eb9-431b-a239-860e086c410f',
        },
		
        cannotUsePlusDecoration: {
            message: 'You cannot use Plus-only decorations.',
            code: 'CANNOT_USE_PLUS_DECORATION',
            id: '8e01b590-7eb9-431b-a239-860e086c411f',
        },

		usernameTaken: {
			message: 'Username is already taken.',
			code: 'USERNAME_TAKEN',
			id: 'ac3ed8a6-9fc4-4d70-8d10-8d0ae809f2a9',
		},

		sameUsername: {
			message: 'This is already your current username.',
			code: 'SAME_USERNAME',
			id: 'b84f6b43-7a3c-4920-8654-4c0e8ffe7a2f',
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'MeDetailed',
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { ...Users.nameSchema, nullable: true },
		description: { ...Users.descriptionSchema, nullable: true },
		location: { ...Users.locationSchema, nullable: true },
		birthday: { ...Users.birthdaySchema, nullable: true },
		lang: { type: 'string', enum: [null, ...Object.keys(langmap)], nullable: true },
		avatarId: { type: 'string', format: 'campra:id', nullable: true },
		bannerId: { type: 'string', format: 'campra:id', nullable: true },
		fields: {
			type: 'array',
			minItems: 0,
			maxItems: 16,
			items: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					value: { type: 'string' },
				},
				required: ['name', 'value'],
			},
		},
		isLocked: { type: 'boolean' },
		isExplorable: { type: 'boolean' },
		hideOnlineStatus: { type: 'boolean' },
		publicReactions: { type: 'boolean' },
		carefulBot: { type: 'boolean' },
		autoAcceptFollowed: { type: 'boolean' },
		noCrawle: { type: 'boolean' },
		isBot: { type: 'boolean' },
		isCat: { type: 'boolean' },
		showTimelineReplies: { type: 'boolean' },
		injectFeaturedNote: { type: 'boolean' },
		receiveAnnouncementEmail: { type: 'boolean' },
		alwaysMarkNsfw: { type: 'boolean' },
		autoSensitive: { type: 'boolean' },
		ffVisibility: { type: 'string', enum: ['public', 'followers', 'private'] },
		pinnedPageId: { type: 'string', format: 'campra:id', nullable: true },
		mutedWords: { type: 'array' },
		mutedInstances: { type: 'array', items: {
			type: 'string',
		} },
		mutingNotificationTypes: { type: 'array', items: {
			type: 'string', enum: notificationTypes,
		} },
		emailNotificationTypes: { type: 'array', items: {
			type: 'string',
		} },
		avatarDecorations: {
            type: 'array',
            maxItems: 5,
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'campra:id' },
                    angle: { type: 'number', nullable: true },
                    flipH: { type: 'boolean', nullable: true },
                    offsetX: { type: 'number', nullable: true },
                    offsetY: { type: 'number', nullable: true },
                },
                required: ['id'],
            },
        },
		username: { 
			type: 'string', 
			minLength: 1,
			maxLength: 20,
			pattern: '^[a-zA-Z0-9_]+$'
		},
	},
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, _user, token) => {
	const user = await Users.findOneByOrFail({ id: _user.id });
	const isSecure = token == null;

	const updates = {} as Partial<User>;
	const profileUpdates = {} as Partial<UserProfile>;

	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });
	
	if (ps.username !== undefined) {
		if (ps.username === user.username) {
			throw new ApiError(meta.errors.sameUsername);
		}

		const exists = await Users.findOne({
			where: [
				{ usernameLower: ps.username.toLowerCase() },
				{ usernameLower: ps.username }
			]
		});

		if (exists) {
			throw new ApiError(meta.errors.usernameTaken);
		}

		updates.username = ps.username;
		updates.usernameLower = ps.username.toLowerCase();
	}

	if (ps.name !== undefined) updates.name = ps.name;
	if (ps.description !== undefined) profileUpdates.description = ps.description;
	if (ps.lang !== undefined) profileUpdates.lang = ps.lang;
	if (ps.location !== undefined) profileUpdates.location = ps.location;
	if (ps.birthday !== undefined) profileUpdates.birthday = ps.birthday;
	if (ps.ffVisibility !== undefined) profileUpdates.ffVisibility = ps.ffVisibility;
	if (ps.avatarId !== undefined) updates.avatarId = ps.avatarId;
	if (ps.bannerId !== undefined) updates.bannerId = ps.bannerId;
	if (ps.mutedWords !== undefined) {
		// Validate regular expression syntax
		ps.mutedWords.filter(x => !Array.isArray(x)).forEach(x => {
			const regexp = x.match(/^\/(.+)\/(.*)$/);
			if (!regexp) throw new ApiError(meta.errors.invalidRegexp);

			try {
				new RE2(regexp[1], regexp[2]);
			} catch (err) {
				throw new ApiError(meta.errors.invalidRegexp);
			}
		});

		profileUpdates.mutedWords = ps.mutedWords;
		profileUpdates.enableWordMute = ps.mutedWords.length > 0;
	}
	if (ps.mutedInstances !== undefined) profileUpdates.mutedInstances = ps.mutedInstances;
	if (ps.mutingNotificationTypes !== undefined) profileUpdates.mutingNotificationTypes = ps.mutingNotificationTypes as typeof notificationTypes[number][];
	if (typeof ps.isLocked === 'boolean') updates.isLocked = ps.isLocked;
	if (typeof ps.isExplorable === 'boolean') updates.isExplorable = ps.isExplorable;
	if (typeof ps.hideOnlineStatus === 'boolean') updates.hideOnlineStatus = ps.hideOnlineStatus;
	if (typeof ps.publicReactions === 'boolean') profileUpdates.publicReactions = ps.publicReactions;
	if (typeof ps.isBot === 'boolean') updates.isBot = ps.isBot;
	if (typeof ps.showTimelineReplies === 'boolean') updates.showTimelineReplies = ps.showTimelineReplies;
	if (typeof ps.carefulBot === 'boolean') profileUpdates.carefulBot = ps.carefulBot;
	if (typeof ps.autoAcceptFollowed === 'boolean') profileUpdates.autoAcceptFollowed = ps.autoAcceptFollowed;
	if (typeof ps.noCrawle === 'boolean') profileUpdates.noCrawle = ps.noCrawle;
	if (typeof ps.isCat === 'boolean') updates.isCat = ps.isCat;
	if (typeof ps.injectFeaturedNote === 'boolean') profileUpdates.injectFeaturedNote = ps.injectFeaturedNote;
	if (typeof ps.receiveAnnouncementEmail === 'boolean') profileUpdates.receiveAnnouncementEmail = ps.receiveAnnouncementEmail;
	if (typeof ps.alwaysMarkNsfw === 'boolean') profileUpdates.alwaysMarkNsfw = ps.alwaysMarkNsfw;
	if (typeof ps.autoSensitive === 'boolean') profileUpdates.autoSensitive = ps.autoSensitive;
	if (ps.emailNotificationTypes !== undefined) profileUpdates.emailNotificationTypes = ps.emailNotificationTypes;

	if (ps.avatarId) {
		const avatar = await DriveFiles.findOneBy({ id: ps.avatarId });

		if (avatar == null || avatar.userId !== user.id) throw new ApiError(meta.errors.noSuchAvatar);
		if (!avatar.type.startsWith('image/')) throw new ApiError(meta.errors.avatarNotAnImage);
	}

	if (ps.bannerId) {
		const banner = await DriveFiles.findOneBy({ id: ps.bannerId });

		if (banner == null || banner.userId !== user.id) throw new ApiError(meta.errors.noSuchBanner);
		if (!banner.type.startsWith('image/')) throw new ApiError(meta.errors.bannerNotAnImage);
	}

	if (ps.pinnedPageId) {
		const page = await Pages.findOneBy({ id: ps.pinnedPageId });

		if (page == null || page.userId !== user.id) throw new ApiError(meta.errors.noSuchPage);

		profileUpdates.pinnedPageId = page.id;
	} else if (ps.pinnedPageId === null) {
		profileUpdates.pinnedPageId = null;
	}

	if (ps.fields) {
		profileUpdates.fields = ps.fields
			.filter(x => typeof x.name === 'string' && x.name !== '' && typeof x.value === 'string' && x.value !== '')
			.map(x => {
				return { name: x.name, value: x.value };
			});
	}




	// Emojis and tags
	let emojis = [] as string[];
	let tags = [] as string[];

	const newName = updates.name === undefined ? user.name : updates.name;
	const newDescription = profileUpdates.description === undefined ? profile.description : profileUpdates.description;

	if (newName != null) {
		const tokens = mfm.parseSimple(newName);
		emojis = emojis.concat(extractCustomEmojisFromMfm(tokens));
	}

	if (newDescription != null) {
		const tokens = mfm.parse(newDescription);
		emojis = emojis.concat(extractCustomEmojisFromMfm(tokens));
		tags = extractHashtags(tokens).map(tag => normalizeForSearch(tag)).splice(0, 32);
	}

	updates.emojis = emojis;
	updates.tags = tags;

	if (ps.avatarDecorations !== undefined) {
        if (ps.avatarDecorations.length > 5) {
            throw new ApiError(meta.errors.tooManyDecorations);
        }

        const decorationIds = ps.avatarDecorations.map(d => d.id);
        const allDecorations = await Decorations.find();
        const decorations = allDecorations.filter(d => decorationIds.includes(d.id));

        if (decorations.length !== decorationIds.length) {
            throw new ApiError(meta.errors.noSuchDecoration);
        }

        for (const deco of decorations) {
            if (deco.isPlus && !(user.isPlus || user.isStaff) || (deco.isMPlus && !(user.isMPlus || user.isStaff ||user.isPlus))) {
                throw new ApiError(meta.errors.cannotUsePlusDecoration);
            }
        }

        updates.avatarDecorations = ps.avatarDecorations.map(d => ({
            id: d.id,
            angle: d.angle ?? 0,
            flipH: d.flipH ?? false,
            offsetX: d.offsetX ?? 0,
            offsetY: d.offsetY ?? 0,
        }));
	}

	// Update hashtags
	updateUsertags(user, tags);

	// Moderate profile content before applying updates
	if (updates.name !== undefined || profileUpdates.description !== undefined || profileUpdates.fields !== undefined) {
		try {
			const moderationResult = await ProfileContentModerator.moderateProfileUpdate(user.id, {
				name: updates.name,
				description: profileUpdates.description,
				fields: profileUpdates.fields,
			});

			if (moderationResult.needsReview) {
				logger.info(`Profile update flagged for moderation for user ${user.id}:`, {
					userId: user.id,
					username: user.username,
					schoolId: user.schoolId,
					blockedFields: moderationResult.blockedFields,
					details: moderationResult.details,
				});
			}

			// Remove blocked content from updates
			if (moderationResult.blockedContent.name) {
				delete updates.name;
				logger.warn(`Blocked inappropriate name update for user ${user.id}: ${ps.name}`);
			}
			
			if (moderationResult.blockedContent.description) {
				delete profileUpdates.description;
				logger.warn(`Blocked inappropriate description update for user ${user.id}: ${ps.description}`);
			}
			
			if (moderationResult.blockedContent.fields && profileUpdates.fields) {
				// Filter out blocked fields
				profileUpdates.fields = profileUpdates.fields.filter((_, index) => 
					!moderationResult.blockedContent.fields![index]
				);
				logger.warn(`Blocked ${moderationResult.blockedContent.fields.filter(Boolean).length} inappropriate field(s) for user ${user.id}`);
			}

		} catch (error) {
			logger.warn(`Profile moderation failed for user ${user.id}, proceeding with update:`, { error: error instanceof Error ? error.message : String(error) });
		}
	}

	if (Object.keys(updates).length > 0) await Users.update(user.id, updates);
	if (Object.keys(profileUpdates).length > 0) await UserProfiles.update(user.id, profileUpdates);

	const iObj = await Users.pack<true, true>(user.id, user, {
		detail: true,
		includeSecrets: isSecure,
	});

	// Publish meUpdated event
	publishMainStream(user.id, 'meUpdated', iObj);
	publishUserEvent(user.id, 'updateUserProfile', await UserProfiles.findOneBy({ userId: user.id }));

	// If account is unlocked, accept all follow requests
	if (user.isLocked && ps.isLocked === false) {
		acceptAllFollowRequests(user);
	}

	// Publish update to followers
	publishToFollowers(user.id);

	return iObj;
});
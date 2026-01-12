import { Schools, Notes, Users } from '@/models/index.js';
import { School } from '@/models/entities/school.js';
import { Note } from '@/models/entities/note.js';
import { User } from '@/models/entities/user.js';
import { Brackets } from 'typeorm';
import { makePaginationQuery } from '@/server/api/common/make-pagination-query.js';
import { generateVisibilityQuery } from '@/server/api/common/generate-visibility-query.js';
import { generateMutedUserQuery } from '@/server/api/common/generate-muted-user-query.js';
import { generateMutedNoteQuery } from '@/server/api/common/generate-muted-note-query.js';
import { generateBlockedUserQuery } from '@/server/api/common/generate-block-query.js';
import { generateFlaggedContentQuery } from '@/server/api/common/generate-flagged-content-query.js';
import { generateChannelQuery } from '@/server/api/common/generate-channel-query.js';
import Logger from './logger.js';

const logger = new Logger('location-timeline');

export interface TimelineOptions {
	limit?: number;
	sinceId?: string;
	untilId?: string;
	sinceDate?: number;
	untilDate?: number;
	withFiles?: boolean;
}

/**
 * Location-based timeline service for school posts
 */
export class LocationTimelineService {
	/**
	 * Get schools within specified radius (in miles) using PostGIS
	 */
	public static async getNearbySchools(
		schoolId: string,
		radiusMiles: number = 50
	): Promise<School[]> {
		const school = await Schools.findOneBy({ id: schoolId });
		if (!school || !school.coordinates) {
			return [];
		}

		// Convert miles to meters (1 mile = 1609.34 meters)
		const radiusMeters = radiusMiles * 1609.34;

		// Use PostGIS ST_DWithin for spatial query
		const nearbySchools = await Schools.createQueryBuilder('school')
			.where('school.id != :schoolId', { schoolId })
			.andWhere('school.coordinates IS NOT NULL')
			.andWhere(
				`ST_DWithin(
					school.coordinates::geography,
					ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
					:radius
				)`,
				{
					longitude: school.coordinates.x,
					latitude: school.coordinates.y,
					radius: radiusMeters,
				}
			)
			.orderBy(
				`ST_Distance(
					school.coordinates::geography,
					ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
				)`,
				'ASC'
			)
			.setParameters({
				longitude: school.coordinates.x,
				latitude: school.coordinates.y,
			})
			.getMany();

		logger.info(`Found ${nearbySchools.length} schools within ${radiusMiles} miles of school ${schoolId}`);
		return nearbySchools;
	}

	/**
	 * Get school-only timeline for a specific school
	 */
	public static async getSchoolTimeline(
		schoolId: string,
		userId: string,
		options: TimelineOptions = {}
	): Promise<Note[]> {
		const {
			limit = 20,
			sinceId,
			untilId,
			sinceDate,
			untilDate,
			withFiles = false,
		} = options;

		const user = await Users.findOneBy({ id: userId });
		if (!user) {
			throw new Error('User not found');
		}

		// Build query for school-only posts
		const query = makePaginationQuery(
			Notes.createQueryBuilder('note'),
			sinceId,
			untilId,
			sinceDate,
			untilDate
		)
			.innerJoin('note.user', 'user')
			.andWhere('user.schoolId = :schoolId', { schoolId })
			.innerJoinAndSelect('note.user', 'noteUser')
			.leftJoinAndSelect('noteUser.avatar', 'avatar')
			.leftJoinAndSelect('noteUser.banner', 'banner')
			.leftJoinAndSelect('note.reply', 'reply')
			.leftJoinAndSelect('note.renote', 'renote')
			.leftJoinAndSelect('reply.user', 'replyUser')
			.leftJoinAndSelect('replyUser.avatar', 'replyUserAvatar')
			.leftJoinAndSelect('replyUser.banner', 'replyUserBanner')
			.leftJoinAndSelect('renote.user', 'renoteUser')
			.leftJoinAndSelect('renoteUser.avatar', 'renoteUserAvatar')
			.leftJoinAndSelect('renoteUser.banner', 'renoteUserBanner');

		// Apply standard filters
		generateVisibilityQuery(query, user);
		generateMutedUserQuery(query, user);
		generateMutedNoteQuery(query, user);
		generateBlockedUserQuery(query, user);
		generateFlaggedContentQuery(query, user);
		generateChannelQuery(query, user);

		// Filter for files if requested
		if (withFiles) {
			query.andWhere('note.fileIds != \'{}\'');
		}

		const timeline = await query.take(limit).getMany();
		
		logger.info(`Retrieved ${timeline.length} posts for school ${schoolId} timeline`);
		return timeline;
	}

	/**
	 * Get timeline with nearby schools included
	 */
	public static async getSchoolTimelineWithNearby(
		schoolId: string,
		userId: string,
		options: TimelineOptions = {},
		radiusMiles: number = 50
	): Promise<Note[]> {
		const {
			limit = 20,
			sinceId,
			untilId,
			sinceDate,
			untilDate,
			withFiles = false,
		} = options;

		const user = await Users.findOneBy({ id: userId });
		if (!user) {
			throw new Error('User not found');
		}

		// Get nearby schools
		const nearbySchools = await this.getNearbySchools(schoolId, radiusMiles);
		const allSchoolIds = [schoolId, ...nearbySchools.map(s => s.id)];

		// Build query for posts from current school and nearby schools
		const query = makePaginationQuery(
			Notes.createQueryBuilder('note'),
			sinceId,
			untilId,
			sinceDate,
			untilDate
		)
			.innerJoin('note.user', 'user')
			.andWhere('user.schoolId IN (:...schoolIds)', { schoolIds: allSchoolIds })
			.innerJoinAndSelect('note.user', 'noteUser')
			.leftJoinAndSelect('noteUser.avatar', 'avatar')
			.leftJoinAndSelect('noteUser.banner', 'banner')
			.leftJoinAndSelect('note.reply', 'reply')
			.leftJoinAndSelect('note.renote', 'renote')
			.leftJoinAndSelect('reply.user', 'replyUser')
			.leftJoinAndSelect('replyUser.avatar', 'replyUserAvatar')
			.leftJoinAndSelect('replyUser.banner', 'replyUserBanner')
			.leftJoinAndSelect('renote.user', 'renoteUser')
			.leftJoinAndSelect('renoteUser.avatar', 'renoteUserAvatar')
			.leftJoinAndSelect('renoteUser.banner', 'renoteUserBanner');

		// Apply standard filters
		generateVisibilityQuery(query, user);
		generateMutedUserQuery(query, user);
		generateMutedNoteQuery(query, user);
		generateBlockedUserQuery(query, user);
		generateFlaggedContentQuery(query, user);
		generateChannelQuery(query, user);

		// Filter for files if requested
		if (withFiles) {
			query.andWhere('note.fileIds != \'{}\'');
		}

		const timeline = await query.take(limit).getMany();
		
		// Boost posts from the user's own school
		const boostedTimeline = this.boostSchoolPosts(timeline, schoolId);
		
		logger.info(`Retrieved ${timeline.length} posts for school ${schoolId} timeline with nearby schools`);
		return boostedTimeline;
	}

	/**
	 * Boost posts from nearby schools in timeline algorithm
	 */
	public static boostNearbyPosts(posts: Note[], userSchoolId: string): Note[] {
		// This is a simple implementation - in a real system you might want more sophisticated scoring
		return posts.sort((a, b) => {
			const aIsFromUserSchool = a.user?.schoolId === userSchoolId;
			const bIsFromUserSchool = b.user?.schoolId === userSchoolId;

			// Prioritize posts from user's own school
			if (aIsFromUserSchool && !bIsFromUserSchool) return -1;
			if (!aIsFromUserSchool && bIsFromUserSchool) return 1;

			// Otherwise sort by creation date (newest first)
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	}

	/**
	 * Boost posts from the user's own school
	 */
	private static boostSchoolPosts(posts: Note[], schoolId: string): Note[] {
		return posts.sort((a, b) => {
			const aIsFromSchool = a.user?.schoolId === schoolId;
			const bIsFromSchool = b.user?.schoolId === schoolId;

			// Prioritize posts from the user's school
			if (aIsFromSchool && !bIsFromSchool) return -1;
			if (!aIsFromSchool && bIsFromSchool) return 1;

			// Otherwise maintain chronological order
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	}

	/**
	 * Get cached nearby schools (with simple in-memory caching)
	 */
	private static nearbySchoolsCache = new Map<string, { schools: School[]; timestamp: number }>();
	private static readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

	public static async getCachedNearbySchools(
		schoolId: string,
		radiusMiles: number = 50
	): Promise<School[]> {
		const cacheKey = `${schoolId}-${radiusMiles}`;
		const cached = this.nearbySchoolsCache.get(cacheKey);

		if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
			logger.debug(`Using cached nearby schools for ${schoolId}`);
			return cached.schools;
		}

		const schools = await this.getNearbySchools(schoolId, radiusMiles);
		this.nearbySchoolsCache.set(cacheKey, {
			schools,
			timestamp: Date.now(),
		});

		logger.debug(`Cached nearby schools for ${schoolId}`);
		return schools;
	}

	/**
	 * Clear nearby schools cache for a specific school
	 */
	public static clearNearbySchoolsCache(schoolId: string): void {
		const keysToDelete = Array.from(this.nearbySchoolsCache.keys())
			.filter(key => key.startsWith(`${schoolId}-`));
		
		keysToDelete.forEach(key => this.nearbySchoolsCache.delete(key));
		logger.debug(`Cleared nearby schools cache for ${schoolId}`);
	}

	/**
	 * Clear all nearby schools cache
	 */
	public static clearAllNearbySchoolsCache(): void {
		this.nearbySchoolsCache.clear();
		logger.debug('Cleared all nearby schools cache');
	}

	/**
	 * Get school statistics for timeline
	 */
	public static async getSchoolTimelineStats(schoolId: string): Promise<{
		totalPosts: number;
		postsToday: number;
		activeUsers: number;
		nearbySchoolsCount: number;
	}> {
		const school = await Schools.findOneBy({ id: schoolId });
		if (!school) {
			throw new Error('School not found');
		}

		// Get total posts from school users
		const totalPosts = await Notes.createQueryBuilder('note')
			.innerJoin('note.user', 'user')
			.where('user.schoolId = :schoolId', { schoolId })
			.getCount();

		// Get posts from today
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const postsToday = await Notes.createQueryBuilder('note')
			.innerJoin('note.user', 'user')
			.where('user.schoolId = :schoolId', { schoolId })
			.andWhere('note.createdAt >= :today', { today })
			.getCount();

		// Get active users (posted in last 30 days)
		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const activeUsers = await Notes.createQueryBuilder('note')
			.innerJoin('note.user', 'user')
			.where('user.schoolId = :schoolId', { schoolId })
			.andWhere('note.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
			.select('COUNT(DISTINCT user.id)', 'count')
			.getRawOne()
			.then(result => parseInt(result.count) || 0);

		// Get nearby schools count
		const nearbySchools = await this.getCachedNearbySchools(schoolId);
		const nearbySchoolsCount = nearbySchools.length;

		return {
			totalPosts,
			postsToday,
			activeUsers,
			nearbySchoolsCount,
		};
	}

	/**
	 * Check if school has location set for timeline features
	 */
	public static async hasLocationSet(schoolId: string): Promise<boolean> {
		const school = await Schools.findOneBy({ id: schoolId });
		return !!(school?.coordinates);
	}
}
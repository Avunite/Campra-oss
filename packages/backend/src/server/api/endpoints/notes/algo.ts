import { Brackets, In, MoreThan, Not, IsNull } from 'typeorm';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Followings, Notes, Users, NoteReactions } from '@/models/index.js';
import type { User as UserEntity } from '@/models/entities/user.js';
import { activeUsersChart } from '@/services/chart/index.js';
import Logger from '@/services/logger.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { makePaginationQuery } from '../../common/make-pagination-query.js';
import { generateVisibilityQuery } from '../../common/generate-visibility-query.js';
import { generateMutedUserQuery } from '../../common/generate-muted-user-query.js';
import { generateBlockedUserQuery } from '../../common/generate-block-query.js';
import { generateRepliesQuery } from '../../common/generate-replies-query.js';
import { generateMutedNoteQuery } from '../../common/generate-muted-note-query.js';
import { generateChannelQuery } from '../../common/generate-channel-query.js';
import { getOrCreateModel } from '@/misc/algo-cache.js';
import { LocationTimelineService } from '@/services/location-timeline.js';
import * as brain from 'brain.js';

const logger = new Logger('algo-proximity');

export const meta = {
  tags: ['notes'],
  requireCredential: true,
  res: {
    type: 'array',
    optional: false, nullable: false,
    items: {
      type: 'object',
      optional: false, nullable: false,
      ref: 'Note',
    },
  },
  errors: {
    stlDisabled: {
      message: 'Hybrid timeline has been disabled.',
      code: 'STL_DISABLED',
      id: '620763f4-f621-4533-ab33-0577a1a3c342',
    },
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
    sinceId: { type: 'string', format: 'campra:id' },
    untilId: { type: 'string', format: 'campra:id' },
    sinceDate: { type: 'integer' },
    untilDate: { type: 'integer' },
    includeMyRenotes: { type: 'boolean', default: true },
    includeRenotedMyNotes: { type: 'boolean', default: true },
    includeLocalRenotes: { type: 'boolean', default: true },
    withFiles: {
      type: 'boolean',
      default: false,
      description: 'Only show notes that have attached files.',
    },
  },
  required: [],
} as const;

class User {
  id: string;
  host: string;
  username: string;
  speed: number;
  speedOrder: number;
  manualScore: number;
  manualScoreAvailable: boolean;
  recommendationOrder: number;
  application: string;

  constructor(id: string, host: string, username: string, speed: number, application: string) {
    this.id = id;
    this.host = host;
    this.username = username;
    this.speed = speed;
    this.application = application;
  }
}

function applySoftUserLimit(posts: any[], limit: number, maxPostsPerUser: number): any[] {
  const userPostCounts = new Map<string, number>();
  const limitedPosts = [];
  const overflowPosts = [];

  for (const post of posts) {
    const count = userPostCounts.get(post.userId) || 0;
    if (count < maxPostsPerUser) {
      limitedPosts.push(post);
      userPostCounts.set(post.userId, count + 1);
    } else {
      overflowPosts.push(post);
    }
  }

  let overflowIndex = 0;
  while (limitedPosts.length < limit && overflowIndex < overflowPosts.length) {
    limitedPosts.push(overflowPosts[overflowIndex]);
    overflowIndex++;
  }

  return limitedPosts;
}

async function getTimelinePosts(user: UserEntity, ps: any) {
  const followingQuery = Followings.createQueryBuilder('following')
    .select('following.followeeId')
    .where('following.followerId = :followerId', { followerId: user.id });

  let query = makePaginationQuery(Notes.createQueryBuilder('note'),
    ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate);

  // Apply 7-day limit only if sinceId is provided
  if (ps.sinceId) {
    const sinceNote = await Notes.findOne({ where: { id: ps.sinceId } });
    if (sinceNote) {
      const dateLimit = new Date(sinceNote.createdAt.getTime() - 7 * 24 * 60 * 60 * 1000);
      query = query.andWhere('note.createdAt > :dateLimit', { dateLimit });
    }
  }

  query = query
    .andWhere(new Brackets(qb => {
      qb.where(`(note.userId IN (${followingQuery.getQuery()}))`, { ...followingQuery.getParameters() })
        .orWhere('note.userId = :meId', { meId: user.id })
        .orWhere('(note.visibility = :public AND note.userHost IS NULL)', { public: 'public' });
    }))
    .innerJoinAndSelect('note.user', 'user')
    .leftJoinAndSelect('user.avatar', 'avatar')
    .leftJoinAndSelect('user.banner', 'banner')
    .leftJoinAndSelect('note.reply', 'reply')
    .leftJoinAndSelect('note.renote', 'renote')
    .leftJoinAndSelect('reply.user', 'replyUser')
    .leftJoinAndSelect('replyUser.avatar', 'replyUserAvatar')
    .leftJoinAndSelect('replyUser.banner', 'replyUserBanner')
    .leftJoinAndSelect('renote.user', 'renoteUser')
    .leftJoinAndSelect('renoteUser.avatar', 'renoteUserAvatar')
    .leftJoinAndSelect('renoteUser.banner', 'renoteUserBanner');

  query = applyCommonFilters(query, user);
  generateRepliesQuery(query, user);
  generateChannelQuery(query, user);

  if (!ps.includeMyRenotes) {
    query.andWhere(new Brackets(qb => {
      qb.orWhere('note.userId != :meId', { meId: user.id });
      qb.orWhere('note.renoteId IS NULL');
      qb.orWhere('note.text IS NOT NULL');
      qb.orWhere('note.fileIds != :emptyArray', { emptyArray: '{}' });
    }));
  }

  if (!ps.includeRenotedMyNotes) {
    query.andWhere(new Brackets(qb => {
      qb.orWhere('note.renoteUserId != :meId', { meId: user.id });
      qb.orWhere('note.renoteId IS NULL');
      qb.orWhere('note.text IS NOT NULL');
      qb.orWhere('note.fileIds != :emptyArray', { emptyArray: '{}' });
    }));
  }

  if (!ps.includeLocalRenotes) {
    query.andWhere(new Brackets(qb => {
      qb.orWhere('note.renoteUserHost IS NOT NULL');
      qb.orWhere('note.renoteId IS NULL');
      qb.orWhere('note.text IS NOT NULL');
      qb.orWhere('note.fileIds != :emptyArray', { emptyArray: '{}' });
    }));
  }

  if (ps.withFiles) {
    query.andWhere('note.fileIds != :emptyArray', { emptyArray: '{}' });
  }

  return await query.take(ps.limit * 2).getMany();
}

function applyCommonFilters(query: any, user: UserEntity) {
  generateVisibilityQuery(query, user);
  generateMutedUserQuery(query, user);
  generateMutedNoteQuery(query, user);
  generateBlockedUserQuery(query, user);
  return query;
}

async function getRecommendedPosts(user: UserEntity, limit: number, referenceDate: Date) {
  const dateLimit = new Date(referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get nearby schools if user has a school
  let nearbySchoolIds: string[] = [];
  if (user.schoolId) {
    try {
      const nearbySchools = await LocationTimelineService.getCachedNearbySchools(user.schoolId, 50);
      nearbySchoolIds = nearbySchools.map(school => school.id);
    } catch (error) {
      logger.warn('Failed to get nearby schools for recommendations:', { error: String(error) });
    }
  }

  // Get user's recent interactions
  const userReactions = await NoteReactions.find({
    where: {
      userId: user.id,
      createdAt: MoreThan(dateLimit)
    },
    relations: ['note']
  });

  const userReplies = await Notes.find({
    where: {
      userId: user.id,
      replyId: Not(IsNull()),
      createdAt: MoreThan(dateLimit)
    },
    relations: ['reply']
  });

  const userRenotes = await Notes.find({
    where: {
      userId: user.id,
      renoteId: Not(IsNull()),
      createdAt: MoreThan(dateLimit)
    },
    relations: ['renote']
  });

  // Get posts from followed users
  const followingPosts = await Notes.createQueryBuilder('note')
    .where(`note.userId IN (
      SELECT "followeeId" FROM following 
      WHERE "followerId" = :userId
    )`, { userId: user.id })
    .andWhere('note.createdAt > :dateLimit', { dateLimit })
    .andWhere('note.createdAt <= :referenceDate', { referenceDate })
    .take(1000)
    .getMany();

  // Get posts that users you follow have interacted with
  const followingInteractions = await Notes.createQueryBuilder('note')
    .where(`note.id IN (
      SELECT "noteId" FROM note_reaction
      WHERE "userId" IN (
        SELECT "followeeId" FROM following
        WHERE "followerId" = :userId
      )
    )`, { userId: user.id })
    .andWhere('note.createdAt > :dateLimit', { dateLimit })
    .andWhere('note.createdAt <= :referenceDate', { referenceDate })
    .take(1000)
    .getMany();

  const allPosts = Array.from(new Set([
    ...followingPosts,
    ...followingInteractions,
    ...userReactions.map(r => r.note),
    ...userReplies.map(n => n.reply),
    ...userRenotes.map(n => n.renote)
  ]));

  if (allPosts.length === 0) {
    return [];
  }

  // Create feature vectors with more meaningful data
  const trainingData = allPosts.map(post => {
    // Normalize text length (0-1)
    const textLength = post.text ? Math.min(post.text.length / 1000, 1) : 0;
    
    // Calculate engagement metrics
    const reactionCount = post.reactions?.length || 0;
    const replyCount = post.replies?.length || 0;
    const renoteCount = post.renotes?.length || 0;
    
    // Normalize engagement metrics
    const maxReactions = Math.max(...allPosts.map(p => p.reactions?.length || 0));
    const maxReplies = Math.max(...allPosts.map(p => p.replies?.length || 0));
    const maxRenotes = Math.max(...allPosts.map(p => p.renotes?.length || 0));
    
    const normalizedReactions = maxReactions > 0 ? reactionCount / maxReactions : 0;
    const normalizedReplies = maxReplies > 0 ? replyCount / maxReplies : 0;
    const normalizedRenotes = maxRenotes > 0 ? renoteCount / maxRenotes : 0;
    
    // Calculate time-based features
    const timeSinceCreation = (referenceDate.getTime() - post.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000);
    const timeScore = Math.max(0, 1 - timeSinceCreation);

    // User interaction features
    const isFromFollowedUser = followingPosts.some(p => p.id === post.id) ? 1 : 0;
    const isInteractedByFollowed = followingInteractions.some(p => p.id === post.id) ? 1 : 0;
    const isUserReacted = userReactions.some(r => r.note.id === post.id) ? 1 : 0;
    const isUserReplied = userReplies.some(n => n.reply.id === post.id) ? 1 : 0;
    const isUserRenoted = userRenotes.some(n => n.renote.id === post.id) ? 1 : 0;

    // Proximity feature: check if post is from user's school or nearby schools
    let proximityScore = 0;
    if (post.user?.schoolId) {
      if (post.user.schoolId === user.schoolId) {
        proximityScore = 1.0; // Same school gets highest boost
      } else if (nearbySchoolIds.includes(post.user.schoolId)) {
        proximityScore = 0.7; // Nearby schools get moderate boost
      }
    }

    return {
      input: new Float32Array([
        textLength,           // Normalized text length
        normalizedReactions, // Normalized reaction count
        normalizedReplies,   // Normalized reply count
        normalizedRenotes,   // Normalized renote count
        timeScore,          // Time-based score
        isFromFollowedUser, // Is from followed user
        isInteractedByFollowed, // Is interacted with by followed users
        isUserReacted,      // User has reacted
        isUserReplied,      // User has replied
        isUserRenoted,      // User has renoted
        proximityScore,     // School proximity score
      ]),
      output: new Float32Array([1])  // Positive training example
    };
  });

  // Add negative examples (posts from same time period but not interacted with)
  const negativePosts = await Notes.createQueryBuilder('note')
    .where('note.visibility = :visibility', { visibility: 'public' })
    .andWhere('note.userHost IS NULL')
    .andWhere('note.createdAt > :dateLimit', { dateLimit })
    .andWhere('note.createdAt <= :referenceDate', { referenceDate })
    .andWhere('note.userId != :userId', { userId: user.id })
    .andWhere('note.id NOT IN (:...positiveIds)', { 
      positiveIds: allPosts.map(p => p.id) 
    })
    .take(1000)
    .getMany();

  const negativeTrainingData = negativePosts.map(post => {
    const textLength = post.text ? Math.min(post.text.length / 1000, 1) : 0;
    const reactionCount = post.reactions?.length || 0;
    const replyCount = post.replies?.length || 0;
    const renoteCount = post.renotes?.length || 0;
    
    const maxReactions = Math.max(...allPosts.map(p => p.reactions?.length || 0));
    const maxReplies = Math.max(...allPosts.map(p => p.replies?.length || 0));
    const maxRenotes = Math.max(...allPosts.map(p => p.renotes?.length || 0));
    
    const normalizedReactions = maxReactions > 0 ? reactionCount / maxReactions : 0;
    const normalizedReplies = maxReplies > 0 ? replyCount / maxReplies : 0;
    const normalizedRenotes = maxRenotes > 0 ? renoteCount / maxRenotes : 0;
    
    const timeSinceCreation = (referenceDate.getTime() - post.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000);
    const timeScore = Math.max(0, 1 - timeSinceCreation);

    // Calculate proximity score for negative examples too
    let proximityScore = 0;
    if (post.user?.schoolId) {
      if (post.user.schoolId === user.schoolId) {
        proximityScore = 1.0; // Same school gets highest boost
      } else if (nearbySchoolIds.includes(post.user.schoolId)) {
        proximityScore = 0.7; // Nearby schools get moderate boost
      }
    }

    return {
      input: new Float32Array([
        textLength,
        normalizedReactions,
        normalizedReplies,
        normalizedRenotes,
        timeScore,
        0, // isFromFollowedUser
        0, // isInteractedByFollowed
        0, // isUserReacted
        0, // isUserReplied
        0, // isUserRenoted
        proximityScore, // School proximity score
      ]),
      output: new Float32Array([0])  // Negative training example
    };
  });

  const model = await getOrCreateModel(user.id, async () => {
    const net = new brain.NeuralNetwork<Float32Array, Float32Array>({
      hiddenLayers: [18, 10, 6],  // Adjusted hidden layers for 11 input features (including proximity)
      activation: 'sigmoid',
      learningRate: 0.1,
      iterations: 2000,       // More iterations for better learning
      errorThresh: 0.005
    });
    
    // Combine positive and negative examples
    const combinedTrainingData = [...trainingData, ...negativeTrainingData];
    net.train(combinedTrainingData);
    return net;
  });

  const candidates = await Notes.createQueryBuilder('note')
    .where('note.visibility = :visibility', { visibility: 'public' })
    .andWhere('note.userHost IS NULL')
    .andWhere('note.createdAt > :dateLimit', { dateLimit })
    .andWhere('note.createdAt <= :referenceDate', { referenceDate })
    .andWhere('note.id NOT IN (:...seenIds)', { 
      seenIds: [...allPosts, ...negativePosts].map(p => p.id) 
    })
    .take(2000)
    .getMany();

  if (candidates.length === 0) {
    return [];
  }

  const scoredCandidates = candidates.map(post => {
    const textLength = post.text ? Math.min(post.text.length / 1000, 1) : 0;
    const reactionCount = post.reactions?.length || 0;
    const replyCount = post.replies?.length || 0;
    const renoteCount = post.renotes?.length || 0;
    
    const maxReactions = Math.max(...allPosts.map(p => p.reactions?.length || 0));
    const maxReplies = Math.max(...allPosts.map(p => p.replies?.length || 0));
    const maxRenotes = Math.max(...allPosts.map(p => p.renotes?.length || 0));
    
    const normalizedReactions = maxReactions > 0 ? reactionCount / maxReactions : 0;
    const normalizedReplies = maxReplies > 0 ? replyCount / maxReplies : 0;
    const normalizedRenotes = maxRenotes > 0 ? renoteCount / maxRenotes : 0;
    
    const timeSinceCreation = (referenceDate.getTime() - post.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000);
    const timeScore = Math.max(0, 1 - timeSinceCreation);

    const isFromFollowedUser = followingPosts.some(p => p.id === post.id) ? 1 : 0;
    const isInteractedByFollowed = followingInteractions.some(p => p.id === post.id) ? 1 : 0;
    const isUserReacted = userReactions.some(r => r.note.id === post.id) ? 1 : 0;
    const isUserReplied = userReplies.some(n => n.reply.id === post.id) ? 1 : 0;
    const isUserRenoted = userRenotes.some(n => n.renote.id === post.id) ? 1 : 0;

    // Calculate proximity score for candidates
    let proximityScore = 0;
    if (post.user?.schoolId) {
      if (post.user.schoolId === user.schoolId) {
        proximityScore = 1.0; // Same school gets highest boost
      } else if (nearbySchoolIds.includes(post.user.schoolId)) {
        proximityScore = 0.7; // Nearby schools get moderate boost
      }
    }

    return {
      post,
      score: model.run(new Float32Array([
        textLength,
        normalizedReactions,
        normalizedReplies,
        normalizedRenotes,
        timeScore,
        isFromFollowedUser,
        isInteractedByFollowed,
        isUserReacted,
        isUserReplied,
        isUserRenoted,
        proximityScore,
      ]))[0]
    };
  });

  return scoredCandidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(candidate => candidate.post);
}

async function getSecondDegreeConnectionPosts(user: UserEntity, limit: number, referenceDate: Date) {
  const dateLimit = new Date(referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  return await Notes.createQueryBuilder('note')
    .where(`note.userId IN (
      SELECT DISTINCT "followeeId" FROM following AS firstDegree
      WHERE firstDegree."followerId" IN (
        SELECT DISTINCT "followeeId" FROM following AS secondDegree
        WHERE secondDegree."followerId" = :userId
      )
    )`, { userId: user.id })
    .andWhere('note.userId != :userId', { userId: user.id })
    .andWhere('note.createdAt > :dateLimit', { dateLimit })
    .andWhere('note.createdAt <= :referenceDate', { referenceDate })
    .andWhere('note.visibility = :visibility', { visibility: 'public' })
    .orderBy('RANDOM()')
    .take(limit)
    .getMany();
}

async function applyProximityBoost(posts: any[], user: UserEntity): Promise<any[]> {
  // Check if proximity boost is enabled globally
  const meta = await fetchMeta();
  if (!meta.enableSchoolProximityBoost) {
    return posts; // Proximity boost disabled
  }

  if (!user.schoolId) {
    return posts; // No school, no proximity boost
  }

  try {
    // Get nearby schools
    const nearbySchools = await LocationTimelineService.getCachedNearbySchools(user.schoolId, 50);
    const nearbySchoolIds = new Set(nearbySchools.map(school => school.id));
    
    // Sort posts with proximity boost
    return posts.sort((a, b) => {
      const aProximityScore = getProximityScore(a, user.schoolId!, nearbySchoolIds);
      const bProximityScore = getProximityScore(b, user.schoolId!, nearbySchoolIds);
      
      // If proximity scores are different, prioritize higher proximity
      if (aProximityScore !== bProximityScore) {
        return bProximityScore - aProximityScore;
      }
      
      // Otherwise maintain chronological order
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } catch (error) {
    logger.warn('Failed to apply proximity boost:', { error: String(error) });
    return posts;
  }
}

function getProximityScore(post: any, userSchoolId: string, nearbySchoolIds: Set<string>): number {
  if (!post.user?.schoolId) {
    return 0; // No school data
  }
  
  if (post.user.schoolId === userSchoolId) {
    return 2; // Same school gets highest priority
  }
  
  if (nearbySchoolIds.has(post.user.schoolId)) {
    return 1; // Nearby schools get medium priority
  }
  
  return 0; // Other schools get no boost
}

export default define(meta, paramDef, async (ps, user) => {
  const m = await fetchMeta();
  if (m.disableLocalTimeline && (!user.isAdmin && !user.isModerator)) {
    throw new ApiError(meta.errors.stlDisabled);
  }

  const timeline = await getTimelinePosts(user, ps);

  // For recommended posts and second degree posts, we'll use the oldest post from the timeline as a reference
  const oldestTimelinePost = timeline.reduce((oldest, current) => 
    current.createdAt < oldest.createdAt ? current : oldest
  , timeline[0]);

  const recommendedPosts = await getRecommendedPosts(user, Math.floor(ps.limit * 0.4), oldestTimelinePost.createdAt);
  const secondDegreePosts = Math.random() < 0.15 ? 
    await getSecondDegreeConnectionPosts(user, Math.floor(ps.limit * 0.15), oldestTimelinePost.createdAt) : [];

  const allPosts = [...timeline, ...recommendedPosts, ...secondDegreePosts];
  const uniquePosts = Array.from(new Map(allPosts.map(post => [post.id, post])).values());

  // Apply proximity boost for schools
  const proximityBoostedPosts = await applyProximityBoost(uniquePosts, user);

  const maxPostsPerUser = Math.max(1, Math.floor(ps.limit * 0.2));
  const limitedPosts = applySoftUserLimit(proximityBoostedPosts, ps.limit, maxPostsPerUser);

  const shuffledPosts = limitedPosts.sort(() => 0.5 - Math.random());
  const finalPosts = shuffledPosts.slice(0, ps.limit);

  process.nextTick(() => {
    activeUsersChart.read(user);
  });

  return await Notes.packMany(finalPosts, user);
});
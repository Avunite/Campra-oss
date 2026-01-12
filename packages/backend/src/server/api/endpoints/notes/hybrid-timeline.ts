import { Brackets, In } from 'typeorm';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Followings, Notes, Users, NoteReactions } from '@/models/index.js';
import { activeUsersChart } from '@/services/chart/index.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { makePaginationQuery } from '../../common/make-pagination-query.js';
import { generateVisibilityQuery } from '../../common/generate-visibility-query.js';
import { generateMutedUserQuery } from '../../common/generate-muted-user-query.js';
import { generateBlockedUserQuery } from '../../common/generate-block-query.js';
import { generateRepliesQuery } from '../../common/generate-replies-query.js';
import { generateMutedNoteQuery } from '../../common/generate-muted-note-query.js';
import { generateChannelQuery } from '../../common/generate-channel-query.js';
import { generateFlaggedContentQuery } from '../../common/generate-flagged-content-query.js';
import { getOrCreateModel } from '@/misc/algo-cache.js';
import * as brain from 'brain.js';

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

async function getTimelinePosts(user: User, ps: any) {
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

function applyCommonFilters(query: any, user: User) {
  generateVisibilityQuery(query, user);
  generateMutedUserQuery(query, user);
  generateMutedNoteQuery(query, user);
  generateBlockedUserQuery(query, user);
  generateFlaggedContentQuery(query, user);
  return query;
}

async function getRecommendedPosts(user: User, limit: number, referenceDate: Date) {
  const dateLimit = new Date(referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const followingPosts = await Notes.createQueryBuilder('note')
    .where(`note.userId IN (
      SELECT "followeeId" FROM following 
      WHERE "followerId" = :userId
    )`, { userId: user.id })
    .andWhere('note.createdAt > :dateLimit', { dateLimit })
    .andWhere('note.createdAt <= :referenceDate', { referenceDate })
    .take(1000)
    .getMany();

  const reactedPosts = await Notes.createQueryBuilder('note')
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

  const allPosts = Array.from(new Set([...followingPosts, ...reactedPosts]));

  if (allPosts.length === 0) {
    return [];
  }

  const trainingData = allPosts.map(post => ({
    input: {
      text: post.text || '',
      userId: post.userId,
      replyId: post.replyId || '',
      renoteId: post.renoteId || '',
    },
    output: { interesting: 1 }
  }));

  const model = await getOrCreateModel(user.id, async () => {
    const net = new brain.NeuralNetwork();
    net.train(trainingData);
    return net;
  });

  const candidates = await Notes.createQueryBuilder('note')
    .where('note.visibility = :visibility', { visibility: 'public' })
    .andWhere('note.userHost IS NULL')
    .andWhere('note.createdAt > :dateLimit', { dateLimit })
    .andWhere('note.createdAt <= :referenceDate', { referenceDate })
    .take(2000)
    .getMany();

  if (candidates.length === 0) {
    return [];
  }

  const scoredCandidates = candidates.map(post => ({
    post,
    score: model.run({
      text: post.text || '',
      userId: post.userId,
      replyId: post.replyId || '',
      renoteId: post.renoteId || '',
    }).interesting
  }));

  return scoredCandidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(candidate => candidate.post);
}

async function getSecondDegreeConnectionPosts(user: User, limit: number, referenceDate: Date) {
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

  const maxPostsPerUser = Math.max(1, Math.floor(ps.limit * 0.2));
  const limitedPosts = applySoftUserLimit(uniquePosts, ps.limit, maxPostsPerUser);

  const shuffledPosts = limitedPosts.sort(() => 0.5 - Math.random());
  const finalPosts = shuffledPosts.slice(0, ps.limit);

  process.nextTick(() => {
    activeUsersChart.read(user);
  });

  return await Notes.packMany(finalPosts, user);
});
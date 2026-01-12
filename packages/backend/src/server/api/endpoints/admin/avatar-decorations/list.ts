import define from '../../../define.js';
import { Decorations } from '@/models/index.js';
import { makePaginationQuery } from '../../../common/make-pagination-query.js';
import { Decoration } from '@/models/entities/decoration.js';

export const meta = {
  tags: ['admin'],
  requireCredential: true,
  requireModerator: true,
  res: {
    type: 'array',
    optional: false, nullable: false,
    items: {
      type: 'object',
      optional: false, nullable: false,
      properties: {
        id: {
          type: 'string',
          optional: false, nullable: false,
          format: 'id',
        },
        aliases: {
          type: 'array',
          optional: false, nullable: false,
          items: {
            type: 'string',
            optional: false, nullable: false,
          },
        },
        name: {
          type: 'string',
          optional: false, nullable: false,
        },
        category: {
          type: 'string',
          optional: false, nullable: true,
        },
        host: {
          type: 'null',
          optional: false,
          description: 'The local host is represented with `null`. The field exists for compatibility with other API endpoints that return files.',
        },
        url: {
          type: 'string',
          optional: false, nullable: false,
        },
        isPlus: {
          type: 'boolean',
          optional: false,
        },
        isMPlus: {
          type: 'boolean',
          optional: false,
        }
      },
    },
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    query: { type: 'string', nullable: true, default: null },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
    sinceId: { type: 'string', format: 'campra:id' },
    untilId: { type: 'string', format: 'campra:id' },
  },
  required: [],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps) => {
  const q = makePaginationQuery(Decorations.createQueryBuilder('decoration'), ps.sinceId, ps.untilId)
    .andWhere(`decoration.host IS NULL`);

  let decorations: Decoration[];

  if (ps.query) {
    decorations = await q.getMany();
    decorations = decorations.filter(decoration =>
      decoration.name.includes(ps.query!) ||
      decoration.aliases.some(a => a.includes(ps.query!)) ||
      decoration.category?.includes(ps.query!));
    decorations.splice(ps.limit + 1);
  } else {
    decorations = await q.take(ps.limit).getMany();
  }

  // Manually include isPlus in the returned data
  const packedDecorations = await Decorations.packMany(decorations);
  return packedDecorations.map(packed => ({
    ...packed,
    isPlus: decorations.find(d => d.id === packed.id)?.isPlus ?? false
  }));
});
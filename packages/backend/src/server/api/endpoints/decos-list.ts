import define from './../define.js';
import { Decorations } from '@/models/index.js';
import { makePaginationQuery } from './../common/make-pagination-query.js';
import { Decoration } from '@/models/entities/decoration.js';
import { In } from 'typeorm';

export const meta = {
  tags: ['account'],
  requireCredential: false,
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
        name: {
          type: 'string',
          optional: false, nullable: false,
        },
        url: {
          type: 'string',
          optional: false, nullable: false,
        },
        isPlus: {
          type: 'boolean',
          optional: false, nullable: false,
        },
        isMPlus: {
          type: 'boolean',
          optional: false, nullable: false,
        },
      },
    },
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    query: { type: 'string', nullable: true, default: null },
    id: { type: 'string', nullable: true, default: null },
    limit: { type: 'integer', minimum: 1, maximum: 250, default: 250 },
    sinceId: { type: 'string', format: 'campra:id' },
    untilId: { type: 'string', format: 'campra:id' },
  },
  required: [],
} as const;

export default define(meta, paramDef, async (ps) => {
  const query = makePaginationQuery(Decorations.createQueryBuilder('decoration'), ps.sinceId, ps.untilId);

  if (ps.id) {
    query.andWhere('decoration.id = :id', { id: ps.id });
  }

  let decorations: Decoration[];

  if (ps.query) {
    decorations = await query.getMany();
    decorations = decorations.filter(decoration =>
      decoration.name.toLowerCase().includes(ps.query!.toLowerCase())
    );
    decorations.splice(ps.limit);
  } else {
    decorations = await query.take(ps.limit).getMany();
  }

  return Decorations.packMany(decorations);
});
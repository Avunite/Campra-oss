import define from '../../../define.js';
import { Decorations, DriveFiles } from '@/models/index.js';
import { ApiError } from '../../../error.js';
import { insertModerationLog } from '@/services/insert-moderation-log.js';
import { publishBroadcastStream } from '@/services/stream.js';
import { db } from '@/db/postgre.js';

export const meta = {
  tags: ['admin'],
  requireCredential: true,
  requireModerator: true,
  errors: {
    noSuchDecoration: {
      message: 'No such decoration.',
      code: 'NO_SUCH_DECORATION',
      id: '0c944d51-a5d6-4d2d-9000-4e62fd7f9d02',
    },
    noSuchFile: {
      message: 'No such file.',
      code: 'NO_SUCH_FILE',
      id: 'fc46b5a4-6b92-4c33-ac66-b806659bb5cf',
    },
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'campra:id' },
    name: { type: 'string', nullable: true },
    category: { type: 'string', nullable: true },
    aliases: { type: 'array', items: { type: 'string' }, nullable: true },
    fileId: { type: 'string', format: 'campra:id', nullable: true },
    isPlus: { type: 'boolean', nullable: true },
    isMPlus: { type: 'boolean', nullable: true },
  },
  required: ['id'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
  const decoration = await Decorations.findOneBy({ id: ps.id });
  if (decoration == null) throw new ApiError(meta.errors.noSuchDecoration);

  let file = null;
  if (ps.fileId) {
    file = await DriveFiles.findOneBy({ id: ps.fileId });
    if (file == null) throw new ApiError(meta.errors.noSuchFile);
  }

  await Decorations.update(decoration.id, {
    updatedAt: new Date(),
    name: ps.name ?? decoration.name,
    category: ps.category ?? decoration.category,
    aliases: ps.aliases ?? decoration.aliases,
    originalUrl: file ? (await DriveFiles.getSecureUrl(file, false) ?? file.url) : decoration.originalUrl,
    publicUrl: file ? (await DriveFiles.getSecureUrl(file, false) ?? file.url) : decoration.publicUrl,
    type: file ? (file.webpublicType ?? file.type) : decoration.type,
    isPlus: ps.isPlus ?? decoration.isPlus,
    isMPlus: ps.isMPlus ?? decoration.isMPlus,
  });

  await db.queryResultCache!.remove(['meta_decorations']);

  const updatedDecoration = await Decorations.findOneByOrFail({ id: decoration.id });

  publishBroadcastStream('decorationUpdated', {
    decoration: await Decorations.pack(updatedDecoration.id),
  });

  insertModerationLog(me, 'updateDecoration', {
    decorationId: decoration.id,
    before: decoration,
    after: updatedDecoration,
  });

  return await Decorations.pack(updatedDecoration.id);
});
import define from '../../../define.js';
import { Decorations, DriveFiles } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import { insertModerationLog } from '@/services/insert-moderation-log.js';
import { ApiError } from '../../../error.js';
import rndstr from 'rndstr';
import { publishBroadcastStream } from '@/services/stream.js';
import { db } from '@/db/postgre.js';

export const meta = {
    tags: ['admin'],
    requireCredential: true,
    requireModerator: true,
    errors: {
        noSuchFile: {
            message: 'No such file.',
            code: 'MO_SUCH_FILE',
            id: 'fc46b5a4-6b92-4c33-ac66-b806659bb5cf',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        fileId: { type: 'string', format: 'campra:id' },
        isPlus: { type: 'boolean' },
        isMPlus: { type: 'boolean' },
        credit: { type: 'string', format: 'campra:id' }, 
    },
    required: ['fileId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
    const file = await DriveFiles.findOneBy({ id: ps.fileId });
    if (file == null) throw new ApiError(meta.errors.noSuchFile);

    const name = file.name.split('.')[0].match(/^[a-z0-9_]+$/) ? file.name.split('.')[0] : `_${rndstr('a-z0-9', 8)}_`;

    const decorations = await Decorations.insert({
        id: genId(),
        updatedAt: new Date(),
        name: name,
        category: null,
        host: null,
        aliases: [],
        originalUrl: await DriveFiles.getSecureUrl(file, false) ?? file.url,
        publicUrl: await DriveFiles.getSecureUrl(file, false) ?? file.url,
        type: file.webpublicType ?? file.type,
        isPlus: ps.isPlus ?? false,
        isMPlus: ps.isMPlus ?? false,
        credit: ps.credit ?? null, 
    }).then(x => Decorations.findOneByOrFail(x.identifiers[0]));

    await db.queryResultCache!.remove(['meta_decorations']);

    publishBroadcastStream('decorationsAdded', {
        decorations: await Decorations.pack(decorations.id),
    });

    insertModerationLog(me, 'addDecorations', {
        decorationsId: decorations.id,
    });

    return {
        id: decorations.id,
    };
});
import { FindOptionsWhere, In, IsNull } from 'typeorm';
import { Users } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';

export const meta = {
    tags: ['users'],

    requireCredential: false,
    requireCredentialPrivateMode: false,

    description: 'Show the properties of a user.',

    res: {
        optional: false, nullable: false,
        oneOf: [
            {
                type: 'object',
                ref: 'UserDetailed',
            },
            {
                type: 'array',
                items: {
                    type: 'object',
                    ref: 'UserDetailed',
                },
            },
        ],
    },

    errors: {
        noSuchUser: {
            message: 'No such user.',
            code: 'NO_SUCH_USER',
            id: '4362f8dc-731f-4ad8-a694-be5a88922a24',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    anyOf: [
        {
            properties: {
                userId: { type: 'string', format: 'campra:id' },
            },
            required: ['userId'],
        },
        {
            properties: {
                userIds: { type: 'array', uniqueItems: true, items: {
                    type: 'string', format: 'campra:id',
                } },
            },
            required: ['userIds'],
        },
        {
            properties: {
                username: { type: 'string' },
            },
            required: ['username'],
        },
    ],
} as const;

export default define(meta, paramDef, async (ps, me) => {
    let user;

    const isAdminOrModerator = me && (me.isAdmin || me.isModerator);

    if (ps.userIds) {
        if (ps.userIds.length === 0) {
            return [];
        }

        const users = await Users.findBy(isAdminOrModerator ? {
            id: In(ps.userIds),
        } : {
            id: In(ps.userIds),
            isSuspended: false,
        });

        // Sort according to the request
        const _users: User[] = [];
        for (const id of ps.userIds) {
            _users.push(users.find(x => x.id === id)!);
        }

        return await Promise.all(_users.map(u => Users.pack(u, me, {
            detail: true,
        })));
    } else {
        const q: FindOptionsWhere<User> = ps.userId != null
            ? { id: ps.userId }
            : { usernameLower: ps.username!.toLowerCase(), host: IsNull() };

        user = await Users.findOneBy(q);

        if (user == null) {
            throw new ApiError(meta.errors.noSuchUser);
        }

        return await Users.pack(user, me, {
            detail: true,
        });
    }
});

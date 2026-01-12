import * as mfm from 'mfm-js';
import es from '../../db/elasticsearch.js';
import { publishMainStream, publishNotesStream } from '@/services/stream.js';
import config from '@/config/index.js';
import { updateHashtags } from '../update-hashtag.js';
import { concat } from '@/prelude/array.js';
import { insertNoteUnread } from '@/services/note/unread.js';
import { extractMentions } from '@/misc/extract-mentions.js';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';
import { extractHashtags } from '@/misc/extract-hashtags.js';
import { Note, IMentionedRemoteUsers } from '@/models/entities/note.js';
import { Mutings, Users, NoteWatchings, Notes, Instances, UserProfiles, Antennas, Followings, MutedNotes, Channels, ChannelFollowings, Blockings, NoteThreadMutings } from '@/models/index.js';
import { DriveFile } from '@/models/entities/drive-file.js';
import { App } from '@/models/entities/app.js';
import { Not, In } from 'typeorm';
import { User, ILocalUser, IRemoteUser } from '@/models/entities/user.js';
import { contentAutoModerator } from '@/services/content-auto-moderator.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { genId } from '@/misc/gen-id.js';
import { notesChart, perUserNotesChart, activeUsersChart, instanceChart } from '@/services/chart/index.js';
import { Poll, IPoll } from '@/models/entities/poll.js';
import { createNotification } from '../create-notification.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import { checkHitAntenna } from '@/misc/check-hit-antenna.js';
import { checkWordMute } from '@/misc/check-word-mute.js';
import { addNoteToAntenna } from '../add-note-to-antenna.js';
import { countSameRenotes } from '@/misc/count-same-renotes.js';
import { Channel } from '@/models/entities/channel.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { getAntennas } from '@/misc/antenna-cache.js';
import { endedPollNotificationQueue } from '@/queue/queues.js';
import { webhookDeliver } from '@/queue/index.js';
import { Cache } from '@/misc/cache.js';
import { UserProfile } from '@/models/entities/user-profile.js';
import { db } from '@/db/postgre.js';
import { getActiveWebhooks } from '@/misc/webhook-cache.js';

const mutedWordsCache = new Cache<{ userId: UserProfile['userId']; mutedWords: UserProfile['mutedWords']; }[]>(1000 * 60 * 5);

type NotificationType = 'reply' | 'renote' | 'quote' | 'mention';

class NotificationManager {
	private notifier: { id: User['id']; };
	private note: Note;
	private queue: {
		target: ILocalUser['id'];
		reason: NotificationType;
	}[];

	constructor(notifier: { id: User['id']; }, note: Note) {
		this.notifier = notifier;
		this.note = note;
		this.queue = [];
	}

	public push(notifiee: ILocalUser['id'], reason: NotificationType) {
		// 自分自身へは通知しない
		if (this.notifier.id === notifiee) return;

		const exist = this.queue.find(x => x.target === notifiee);

		if (exist) {
			// 「メンションされているかつ返信されている」場合は、メンションとしての通知ではなく返信としての通知にする
			if (reason !== 'mention') {
				exist.reason = reason;
			}
		} else {
			this.queue.push({
				reason: reason,
				target: notifiee,
			});
		}
	}

	public async deliver() {
		for (const x of this.queue) {
			// ミュート情報を取得
			const mentioneeMutes = await Mutings.findBy({
				muterId: x.target,
			});

			const mentioneesMutedUserIds = mentioneeMutes.map(m => m.muteeId);

			// 通知される側のユーザーが通知する側のユーザーをミュートしていない限りは通知する
			if (!mentioneesMutedUserIds.includes(this.notifier.id)) {
				createNotification(x.target, x.reason, {
					notifierId: this.notifier.id,
					noteId: this.note.id,
					note: this.note,
				});
			}
		}
	}
}

type MinimumUser = {
	id: User['id'];
	username: User['username'];
};

type Option = {
    createdAt?: Date | null;
    name?: string | null;
    text?: string | null;
    campraFor?: string | null;
    reply?: Note | null;
    renote?: Note | null;
    files?: DriveFile[] | null;
    poll?: IPoll | null;
    localOnly?: boolean | null;
    cw?: string | null;
    visibility?: string;
    visibleUsers?: MinimumUser[] | null;
    channel?: Channel | null;
    app?: App | null;
};

export default async (user: { id: User['id']; username: User['username']; host: User['host']; isSilenced: User['isSilenced']; createdAt: User['createdAt']; }, data: Option, silent = false) => new Promise<Note>(async (res, rej) => {
	// If you reply outside the channel, match the scope of the target.
	// TODO (I think it's a process that could be done on the client side, but it's server side for now.)
	if (data.reply && data.channel && data.reply.channelId !== data.channel.id) {
		if (data.reply.channelId) {
			data.channel = await Channels.findOneBy({ id: data.reply.channelId });
		} else {
			data.channel = null;
		}
	}

	// When you reply in a channel, match the scope of the target
	// TODO (I think it's a process that could be done on the client side, but it's server side for now.)
	if (data.reply && (data.channel == null) && data.reply.channelId) {
		data.channel = await Channels.findOneBy({ id: data.reply.channelId });
	}

	if (data.createdAt == null) data.createdAt = new Date();
	if (data.visibility == null) data.visibility = 'public';
	if (data.localOnly == null) data.localOnly = false;
	if (data.channel != null) data.visibility = 'public';
	if (data.channel != null) data.visibleUsers = [];
	if (data.channel != null) data.localOnly = true;

	// enforce silent clients on server
	if (user.isSilenced && data.visibility === 'public' && data.channel == null) {
		data.visibility = 'home';
	}

	// Reject if the target of the renote is a public range other than "Home or Entire".
	if (data.renote && data.renote.visibility !== 'public' && data.renote.visibility !== 'home' && data.renote.userId !== user.id) {
		return rej('Renote target is not public or home');
	}

	// If the target of the renote is not public, make it home.
	if (data.renote && data.renote.visibility !== 'public' && data.visibility === 'public') {
		data.visibility = 'home';
	}

	// If the target of Renote is followers, make it followers.
	if (data.renote && data.renote.visibility === 'followers') {
		data.visibility = 'followers';
	}

	// If the reply target is not public, make it home.
	if (data.reply && data.reply.visibility !== 'public' && data.visibility === 'public') {
		data.visibility = 'home';
	}

	// Renote local only if you Renote local only.
	if (data.renote && data.renote.localOnly && data.channel == null) {
		data.localOnly = true;
	}

	// If you reply to local only, make it local only.
	if (data.reply && data.reply.localOnly && data.channel == null) {
		data.localOnly = true;
	}

	if (data.text) {
		data.text = data.text.trim();
	} else {
		data.text = null;
	}
	
	// Parse MFM to extract tokens
	const tokens = data.text ? mfm.parse(data.text)! : [];
	const cwTokens = data.cw ? mfm.parse(data.cw)! : [];
	const choiceTokens = data.poll && data.poll.choices
		? concat(data.poll.choices.map(choice => mfm.parse(choice)!))
		: [];
	
	// Combine all tokens
	const combinedTokens = tokens.concat(cwTokens).concat(choiceTokens);
	
	// Extract hashtags, emojis, and mentioned users
	let tags = extractHashtags(combinedTokens);
	let emojis = extractCustomEmojisFromMfm(combinedTokens);
	let mentionedUsers = await extractMentionedUsers(user, combinedTokens);
	
	// Filter tags to ensure they are valid
	tags = tags.filter(tag => Array.from(tag || '').length <= 128).splice(0, 32);
	
	// Add the reply user to mentioned users if necessary
	if (data.reply && (user.id !== data.reply.userId) && !mentionedUsers.some(u => u.id === data.reply!.userId)) {
		mentionedUsers.push(await Users.findOneByOrFail({ id: data.reply!.userId }));
	}
	
	// Handle specified visibility
	if (data.visibility === 'specified') {
		if (data.visibleUsers == null) throw new Error('invalid param');
	
		for (const u of data.visibleUsers) {
			if (!mentionedUsers.some(x => x.id === u.id)) {
				mentionedUsers.push(u);
			}
		}
	
		if (data.reply && !data.visibleUsers.some(x => x.id === data.reply!.userId)) {
			data.visibleUsers.push(await Users.findOneByOrFail({ id: data.reply!.userId }));
		}
	}

	const note = await insertNote(user, data, tags, emojis, mentionedUsers);

	res(note);

	// 統計を更新
	notesChart.update(note, true);
	perUserNotesChart.update(user, note, true);

	// ハッシュタグ更新
	if (data.visibility === 'public' || data.visibility === 'home') {
		updateHashtags(user, tags);
	}

	// Increment notes count (user)
	incNotesCountOfUser(user);

	// Word mute
	mutedWordsCache.fetch(null, () => UserProfiles.find({
		where: {
			enableWordMute: true,
		},
		select: ['userId', 'mutedWords'],
	})).then(us => {
		for (const u of us) {
			checkWordMute(note, { id: u.userId }, u.mutedWords).then(shouldMute => {
				if (shouldMute) {
					MutedNotes.insert({
						id: genId(),
						userId: u.userId,
						noteId: note.id,
						reason: 'word',
					});
				}
			});
		}
	});

	// Antenna
	for (const antenna of (await getAntennas())) {
		checkHitAntenna(antenna, note, user).then(hit => {
			if (hit) {
				addNoteToAntenna(antenna, note, user);
			}
		});
	}

	// Channel
	if (note.channelId) {
		ChannelFollowings.findBy({ followeeId: note.channelId }).then(followings => {
			for (const following of followings) {
				insertNoteUnread(following.followerId, note, {
					isSpecified: false,
					isMentioned: false,
				});
			}
		});
	}

	if (data.reply) {
		saveReply(data.reply, note);
	}

	// この投稿を除く指定したユーザーによる指定したノートのリノートが存在しないとき
	if (data.renote && (await countSameRenotes(user.id, data.renote.id, note.id) === 0)) {
		incRenoteCount(data.renote);
	}

	if (data.poll && data.poll.expiresAt) {
		const delay = data.poll.expiresAt.getTime() - Date.now();
		endedPollNotificationQueue.add({
			noteId: note.id,
		}, {
			delay,
			removeOnComplete: true,
		});
	}

	if (!silent) {
		if (Users.isLocalUser(user)) activeUsersChart.write(user);

		// 未読通知を作成
		if (data.visibility === 'specified') {
			if (data.visibleUsers == null) throw new Error('invalid param');

			for (const u of data.visibleUsers) {
				// ローカルユーザーのみ
				if (!Users.isLocalUser(u)) continue;

				insertNoteUnread(u.id, note, {
					isSpecified: true,
					isMentioned: false,
				});
			}
		} else {
			for (const u of mentionedUsers) {
				// ローカルユーザーのみ
				if (!Users.isLocalUser(u)) continue;

				insertNoteUnread(u.id, note, {
					isSpecified: false,
					isMentioned: true,
				});
			}
		}

		publishNotesStream(note);

		const webhooks = await getActiveWebhooks().then(webhooks => webhooks.filter(x => x.userId === user.id && x.on.includes('note')));

		for (const webhook of webhooks) {
			webhookDeliver(webhook, 'note', {
				note: await Notes.pack(note, user),
			});
		}

		const nm = new NotificationManager(user, note);
		const nmRelatedPromises = [];

		await createMentionedEvents(mentionedUsers, note, nm);

		// If has in reply to note
		if (data.reply) {
			// Fetch watchers
			nmRelatedPromises.push(notifyToWatchersOfReplyee(data.reply, user, nm));

			// 通知
			if (data.reply.userHost === null) {
				const threadMuted = await NoteThreadMutings.findOneBy({
					userId: data.reply.userId,
					threadId: data.reply.threadId || data.reply.id,
				});

				if (!threadMuted) {
					nm.push(data.reply.userId, 'reply');

					const packedReply = await Notes.pack(note, { id: data.reply.userId });
					publishMainStream(data.reply.userId, 'reply', packedReply);

					const webhooks = (await getActiveWebhooks()).filter(x => x.userId === data.reply!.userId && x.on.includes('reply'));
					for (const webhook of webhooks) {
						webhookDeliver(webhook, 'reply', {
							note: packedReply,
						});
					}
				}
			}
		}

		// If it is renote
		if (data.renote) {
			const type = data.text ? 'quote' : 'renote';

			// Notify
			if (data.renote.userHost === null) {
				const threadMuted = await NoteThreadMutings.findOneBy({
					userId: data.renote.userId,
					threadId: data.renote.threadId || data.renote.id,
				});
				
				if (!threadMuted) {
					nm.push(data.renote.userId, type);
				}
			}

			// Fetch watchers
			nmRelatedPromises.push(notifyToWatchersOfRenotee(data.renote, user, nm, type));

			// Publish event
			if ((user.id !== data.renote.userId) && data.renote.userHost === null) {
				const packedRenote = await Notes.pack(note, { id: data.renote.userId });
				publishMainStream(data.renote.userId, 'renote', packedRenote);

				const webhooks = (await getActiveWebhooks()).filter(x => x.userId === data.renote!.userId && x.on.includes('renote'));
				for (const webhook of webhooks) {
					webhookDeliver(webhook, 'renote', {
						note: packedRenote,
					});
				}
			}
		}

		Promise.all(nmRelatedPromises).then(() => {
			nm.deliver();
		});

	}

	if (data.channel) {
		Channels.increment({ id: data.channel.id }, 'notesCount', 1);
		Channels.update(data.channel.id, {
			lastNotedAt: new Date(),
		});

		const count = await Notes.countBy({
			userId: user.id,
			channelId: data.channel.id,
		}).then(count => {
			// この処理が行われるのはノート作成後なので、ノートが一つしかなかったら最初の投稿だと判断できる
			// TODO: とはいえノートを削除して何回も投稿すればその分だけインクリメントされる雑さもあるのでどうにかしたい
			if (count === 1) {
				Channels.increment({ id: data.channel!.id }, 'usersCount', 1);
			}
		});
	}

	// Register to search database
	index(note);
});

function incRenoteCount(renote: Note) {
	Notes.createQueryBuilder().update()
		.set({
			renoteCount: () => '"renoteCount" + 1',
			score: () => '"score" + 1',
		})
		.where('id = :id', { id: renote.id })
		.execute();
}

async function insertNote(user: { id: User['id']; }, data: Option, tags: string[], emojis: string[], mentionedUsers: MinimumUser[]) {
    const noteId = genId(data.createdAt!);
    const meta = await fetchMeta();
    
    // Don't pre-filter content - let Iffy decide via webhook
    // Content will be visible initially and only hidden if Iffy flags it
    let initialVisibility = data.visibility as any;

    const insert = new Note({
        id: noteId,
        createdAt: data.createdAt!,
        fileIds: data.files ? data.files.map(file => file.id) : [],
        replyId: data.reply ? data.reply.id : null,
        renoteId: data.renote ? data.renote.id : null,
        channelId: data.channel ? data.channel.id : null,
        threadId: data.reply
            ? data.reply.threadId
                ? data.reply.threadId
                : data.reply.id
            : null,
        name: data.name,
        text: data.text,
        campraFor: data.campraFor || null,
        hasPoll: data.poll != null,
        cw: data.cw == null ? null : data.cw,
        tags: tags.map(tag => normalizeForSearch(tag)),
        emojis,
        userId: user.id,
        localOnly: data.localOnly!,
        visibility: initialVisibility,
        visibleUserIds: data.visibility === 'specified'
            ? data.visibleUsers
                ? data.visibleUsers.map(u => u.id)
                : []
            : [],
        attachedFileTypes: data.files ? data.files.map(file => file.type) : [],
        replyUserId: data.reply ? data.reply.userId : null,
        renoteUserId: data.renote ? data.renote.userId : null,
        
        // Store moderation state
        iffyScanResult: data.text && contentAutoModerator.isAvailable() ? { 
            submitted: true, 
            submittedAt: new Date(),
            pendingModeration: false, // Don't pre-hide content
            originalVisibility: null,
            originalVisibleUserIds: null
        } : null,
    });

    // Submit content to Iffy for moderation (async - results come via webhook)
    if (data.text && contentAutoModerator.isAvailable()) {
        // Don't await this - let it happen in background
        contentAutoModerator.moderatePost(noteId, data.text, user.id).catch(error => {
            console.log('Content moderation submission failed:', error);
        });
    }

    // Append mentions data
    if (mentionedUsers.length > 0) {
        insert.mentions = mentionedUsers.map(u => u.id);
    }

    // Insert the note
    try {
        if (insert.hasPoll) {
            await db.transaction(async transactionalEntityManager => {
                await transactionalEntityManager.insert(Note, insert);

                const poll = new Poll({
                    noteId: insert.id,
                    choices: data.poll!.choices,
                    expiresAt: data.poll!.expiresAt,
                    multiple: data.poll!.multiple,
                    votes: new Array(data.poll!.choices.length).fill(0),
                    noteVisibility: insert.visibility,
                    userId: user.id,
                });

                await transactionalEntityManager.insert(Poll, poll);
            });
        } else {
            await Notes.insert(insert);
        }

        return insert;
    } catch (e) {
        if (isDuplicateKeyValueError(e)) {
            const err = new Error('Duplicated note');
            err.name = 'duplicated';
            throw err;
        }

        console.error(e);
        throw e;
    }
}

function index(note: Note) {
	if (note.text == null || config.elasticsearch == null) return;

	es!.index({
		index: config.elasticsearch.index || 'campra_note',
		id: note.id.toString(),
		body: {
			text: normalizeForSearch(note.text),
			userId: note.userId,
			userHost: note.userHost,
		},
	});
}

async function notifyToWatchersOfRenotee(renote: Note, user: { id: User['id']; }, nm: NotificationManager, type: NotificationType) {
	const watchers = await NoteWatchings.findBy({
		noteId: renote.id,
		userId: Not(user.id),
	});

	for (const watcher of watchers) {
		nm.push(watcher.userId, type);
	}
}

async function notifyToWatchersOfReplyee(reply: Note, user: { id: User['id']; }, nm: NotificationManager) {
	const watchers = await NoteWatchings.findBy({
		noteId: reply.id,
		userId: Not(user.id),
	});

	for (const watcher of watchers) {
		nm.push(watcher.userId, 'reply');
	}
}

async function createMentionedEvents(mentionedUsers: MinimumUser[], note: Note, nm: NotificationManager) {
    for (const u of mentionedUsers) {
        const threadMuted = await NoteThreadMutings.findOneBy({
            userId: u.id,
            threadId: note.threadId || note.id,
        });

        if (threadMuted) {
            continue;
        }

        // Publish mention event
        const detailPackedNote = await Notes.pack(note, u, {
            detail: true,
        });

        publishMainStream(u.id, 'mention', detailPackedNote);

        const webhooks = (await getActiveWebhooks()).filter(x => x.userId === u.id && x.on.includes('mention'));
        for (const webhook of webhooks) {
            webhookDeliver(webhook, 'mention', {
                note: detailPackedNote,
            });
        }

        // Create notification
        nm.push(u.id, 'mention');
    }
}

function saveReply(reply: Note, note: Note) {
	Notes.increment({ id: reply.id }, 'repliesCount', 1);
}

function incNotesCountOfUser(user: { id: User['id']; }) {
	Users.createQueryBuilder().update()
		.set({
			updatedAt: new Date(),
			notesCount: () => '"notesCount" + 1',
		})
		.where('id = :id', { id: user.id })
		.execute();
}

async function extractMentionedUsers(user: { id: User['id']; }, tokens: mfm.MfmNode[]): Promise<User[]> {
    if (tokens == null) return [];

    const mentions = extractMentions(tokens);

    // Only resolve local users
    const mentionedUsers = (await Promise.all(mentions.map(m =>
        Users.findOneBy({ username: m.username, host: null }).catch(() => null)
    ))).filter(x => x != null) as User[];

    // Drop duplicate users
    return mentionedUsers.filter((u, i, self) =>
        i === self.findIndex(u2 => u.id === u2.id)
    );
}

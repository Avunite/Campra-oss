import { User } from '@/models/entities/user.js';
import { UserGroup } from '@/models/entities/user-group.js';
import { DriveFile } from '@/models/entities/drive-file.js';
import { MessagingMessages, UserGroupJoinings, Mutings, Users } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import { MessagingMessage } from '@/models/entities/messaging-message.js';
import { publishMessagingStream, publishMessagingIndexStream, publishMainStream, publishGroupMessagingStream } from '@/services/stream.js';
import { pushNotification } from '@/services/push-notification.js';
import { contentAutoModerator } from '@/services/content-auto-moderator.js';
import { Not } from 'typeorm';

export async function createMessage(
    user: { id: User['id'] }, 
    recipientUser: { id: User['id'] } | undefined, 
    recipientGroup: UserGroup | undefined, 
    text: string | null | undefined, 
    file: DriveFile | null,
    replyId: string | null = null
) {
    const message = {
        id: genId(),
        createdAt: new Date(),
        fileId: file ? file.id : null,
        recipientId: recipientUser ? recipientUser.id : null,
        groupId: recipientGroup ? recipientGroup.id : null,
        text: text ? text.trim() : null,
        userId: user.id,
        isRead: false,
        reads: [] as any[],
        replyId: replyId,
    } as MessagingMessage;

    await MessagingMessages.insert(message);

    // Auto-moderate message content if enabled and text exists
    if (message.text) {
        try {
            await contentAutoModerator.moderateMessage(message.id, message.text, user.id);
        } catch (error) {
            // Log error but don't prevent message creation
            console.log('Message content moderation failed:', error);
        }
    }

    const messageObj = await MessagingMessages.pack(message);

    if (recipientUser) {
        // User's stream
        publishMessagingStream(message.userId, recipientUser.id, 'message', messageObj);
        publishMessagingIndexStream(message.userId, 'message', messageObj);
        publishMainStream(message.userId, 'messagingMessage', messageObj);

        // Recipient's stream
        publishMessagingStream(recipientUser.id, message.userId, 'message', messageObj);
        publishMessagingIndexStream(recipientUser.id, 'message', messageObj);
        publishMainStream(recipientUser.id, 'messagingMessage', messageObj);
    } else if (recipientGroup) {
        // Group stream
        publishGroupMessagingStream(recipientGroup.id, 'message', messageObj);

        // Members' streams
        const joinings = await UserGroupJoinings.findBy({ userGroupId: recipientGroup.id });
        for (const joining of joinings) {
            publishMessagingIndexStream(joining.userId, 'message', messageObj);
            publishMainStream(joining.userId, 'messagingMessage', messageObj);
        }
    }

    // Send unread notification after 2 seconds if message remains unread
    setTimeout(async () => {
        const freshMessage = await MessagingMessages.findOneBy({ id: message.id });
        if (freshMessage == null) return;

        if (recipientUser) {
            if (freshMessage.isRead) return;

            const mute = await Mutings.findBy({
                muterId: recipientUser.id,
            });
            if (mute.map(m => m.muteeId).includes(user.id)) return;

            publishMainStream(recipientUser.id, 'unreadMessagingMessage', messageObj);
            pushNotification(recipientUser.id, 'unreadMessagingMessage', messageObj);
        } else if (recipientGroup) {
            const joinings = await UserGroupJoinings.findBy({ userGroupId: recipientGroup.id, userId: Not(user.id) });
            for (const joining of joinings) {
                if (freshMessage.reads.includes(joining.userId)) return;
                publishMainStream(joining.userId, 'unreadMessagingMessage', messageObj);
                pushNotification(joining.userId, 'unreadMessagingMessage', messageObj);
            }
        }
    }, 2000);

    return messageObj;
}

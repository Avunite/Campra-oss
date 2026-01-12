import { MessagingMessages, Users } from '@/models/index.js';
import { MessagingMessage } from '@/models/entities/messaging-message.js';
import { publishGroupMessagingStream, publishMessagingStream } from '@/services/stream.js';

export async function deleteMessage(message: MessagingMessage) {
    await MessagingMessages.delete(message.id);
    postDeleteMessage(message);
}

async function postDeleteMessage(message: MessagingMessage) {
    if (message.recipientId) {
        const user = await Users.findOneByOrFail({ id: message.userId });
        const recipient = await Users.findOneByOrFail({ id: message.recipientId });

        publishMessagingStream(message.userId, message.recipientId, 'deleted', message.id);
        publishMessagingStream(message.recipientId, message.userId, 'deleted', message.id);
    } else if (message.groupId) {
        publishGroupMessagingStream(message.groupId, 'deleted', message.id);
    }
}

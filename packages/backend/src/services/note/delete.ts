import { Brackets } from 'typeorm';
import { publishNoteStream } from '@/services/stream.js';
import { User } from '@/models/entities/user.js';
import { Note } from '@/models/entities/note.js';
import { Notes, Users } from '@/models/index.js';
import { notesChart, perUserNotesChart } from '@/services/chart/index.js';
import { countSameRenotes } from '@/misc/count-same-renotes.js';

/**
 * Delete a post.
 * @param user Author
 * @param note Post
 */
export default async function(user: { id: User['id'] }, note: Note, quiet = false) {
    const deletedAt = new Date();

    if (note.renoteId && (await countSameRenotes(user.id, note.renoteId, note.id)) === 0) {
        Notes.decrement({ id: note.renoteId }, 'renoteCount', 1);
        Notes.decrement({ id: note.renoteId }, 'score', 1);
    }

    if (note.replyId) {
        await Notes.decrement({ id: note.replyId }, 'repliesCount', 1);
    }

    if (!quiet) {
        publishNoteStream(note.id, 'deleted', {
            deletedAt: deletedAt,
        });

        // Update statistics
        notesChart.update(note, false);
        perUserNotesChart.update(user, note, false);
    }

    await Notes.delete({
        id: note.id,
        userId: user.id,
    });
}

async function findCascadingNotes(note: Note) {
    const cascadingNotes: Note[] = [];

    const recursive = async (noteId: string) => {
        const query = Notes.createQueryBuilder('note')
            .where('note.replyId = :noteId', { noteId })
            .orWhere(new Brackets(q => {
                q.where('note.renoteId = :noteId', { noteId })
                .andWhere('note.text IS NOT NULL');
            }))
            .leftJoinAndSelect('note.user', 'user');
        const replies = await query.getMany();
        for (const reply of replies) {
            cascadingNotes.push(reply);
            await recursive(reply.id);
        }
    };
    await recursive(note.id);

    return cascadingNotes;
}

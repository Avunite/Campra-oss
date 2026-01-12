import { publishNoteStream } from '@/services/stream.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { User } from '@/models/entities/user.js';
import { Note } from '@/models/entities/note.js';
import { NoteReactions, Notes } from '@/models/index.js';
import { decodeReaction } from '@/misc/reaction-lib.js';

export default async (user: { id: User['id'] }, note: Note) => {
    // if already unreacted
    const exist = await NoteReactions.findOneBy({
        noteId: note.id,
        userId: user.id,
    });

    if (exist == null) {
        throw new IdentifiableError('60527ec9-b4cb-4a88-a6bd-32d3ad26817d', 'not reacted');
    }

    // Delete reaction
    const result = await NoteReactions.delete(exist.id);

    if (result.affected !== 1) {
        throw new IdentifiableError('60527ec9-b4cb-4a88-a6bd-32d3ad26817d', 'not reacted');
    }

    // Decrement reactions count
    const sql = `jsonb_set("reactions", '{${exist.reaction}}', (COALESCE("reactions"->>'${exist.reaction}', '0')::int - 1)::text::jsonb)`;
    await Notes.createQueryBuilder().update()
        .set({
            reactions: () => sql,
        })
        .where('id = :id', { id: note.id })
        .execute();

    Notes.decrement({ id: note.id }, 'score', 1);

    publishNoteStream(note.id, 'unreacted', {
        reaction: decodeReaction(exist.reaction).reaction,
        userId: user.id,
    });
};

import { StreamServer } from '../../streaming.js';
import { Notes } from '@/models/index.js';
import readNote from '@/services/note/read.js';
import { Note } from '@/models/entities/note.js';
import { Packed } from '@/misc/schema.js';

/**
 * Handles note-related events in the streaming server
 */
export function NotesHandler(server: StreamServer): void {
  // Maximum number of notes to cache per connection
  const MAX_CACHED_NOTES = 32;

  // Create a note cache for performance
  const noteCache = new Map<string, Map<string, Packed<'Note'>>>();

  // Helper to get or create a per-connection note cache
  const getConnectionCache = (connectionId: string): Map<string, Packed<'Note'>> => {
    if (!noteCache.has(connectionId)) {
      noteCache.set(connectionId, new Map());
    }
    return noteCache.get(connectionId)!;
  };

  // Handle caching notes
  server.cacheNote = (connectionId: string, note: Packed<'Note'>): void => {
    const cache = getConnectionCache(connectionId);
    
    const addToCache = (noteToCache: Packed<'Note'>) => {
      // Replace existing note with updated version
      if (cache.has(noteToCache.id)) {
        cache.set(noteToCache.id, noteToCache);
        return;
      }
      
      // Add new note to cache
      cache.set(noteToCache.id, noteToCache);
      
      // Trim cache if it exceeds max size
      if (cache.size > MAX_CACHED_NOTES) {
        // Get oldest note (first one in Map) and delete it
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
    };
    
    // Cache the note and related notes
    addToCache(note);
    if (note.reply) addToCache(note.reply);
    if (note.renote) addToCache(note.renote);
  };

  // Handle reading a note
  server.readNote = (connectionId: string, user: any, noteId: Note['id']): void => {
    if (!user) return;
    
    const cache = getConnectionCache(connectionId);
    const note = cache.get(noteId);
    
    if (!note) return;
    
    // Only mark as read if the note is not from the current user
    if (note.userId !== user.id) {
      const connections = server.getUserConnections(user.id);
      const connection = connections[0];
      
      if (connection) {
        readNote(user.id, [note], {
          following: new Set(connection.user.following || []),
          followingChannels: new Set(connection.user.followingChannels || []),
        });
      }
    }
  };

  // Handle subscribing to a note
  server.subscribeToNote = (connectionId: string, noteId: Note['id']): void => {
    // Implementation would track subscriptions per connection
    // and handle Redis pub/sub registration
  };

  // Handle unsubscribing from a note
  server.unsubscribeFromNote = (connectionId: string, noteId: Note['id']): void => {
    // Implementation would update subscription tracking
    // and handle Redis pub/sub unregistration
  };

  // Clean up note cache when connection closes
  server.onConnectionClose = (connectionId: string): void => {
    noteCache.delete(connectionId);
  };
} 
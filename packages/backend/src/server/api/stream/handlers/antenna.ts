import { StreamServer } from '../../streaming.js';
import { Antenna } from '@/models/entities/antenna.js';
import { Note } from '@/models/entities/note.js';
import { User } from '@/models/entities/user.js';
import { Antennas } from '@/models/index.js';

/**
 * Handles antenna-related events in the streaming server
 */
export function AntennaHandler(server: StreamServer): void {
  // Map to track active antenna subscriptions per connection
  const activeAntennas = new Map<string, Set<Antenna['id']>>();
  
  // Map to track user's antennas for quick access
  const userAntennas = new Map<User['id'], Antenna['id'][]>();
  
  // Helper to get or create active antennas set for a connection
  const getConnectionAntennas = (connectionId: string): Set<Antenna['id']> => {
    if (!activeAntennas.has(connectionId)) {
      activeAntennas.set(connectionId, new Set());
    }
    return activeAntennas.get(connectionId)!;
  };
  
  // Initialize user's antennas
  server.initializeUserAntennas = async (connectionId: string, userId: User['id']): Promise<void> => {
    if (!userId) return;
    
    // Find all antennas belonging to the user
    const antennas = await Antennas.find({
      where: { userId: userId },
      select: ['id'],
    });
    
    // Store for quick access
    userAntennas.set(userId, antennas.map(a => a.id));
    
    // Subscribe to all user's antennas
    const antennaSet = getConnectionAntennas(connectionId);
    antennas.forEach(antenna => antennaSet.add(antenna.id));
  };
  
  // Subscribe to an antenna
  server.subscribeToAntenna = (connectionId: string, antennaId: Antenna['id']): void => {
    const antennas = getConnectionAntennas(connectionId);
    antennas.add(antennaId);
  };
  
  // Unsubscribe from an antenna
  server.unsubscribeFromAntenna = (connectionId: string, antennaId: Antenna['id']): void => {
    const antennas = getConnectionAntennas(connectionId);
    antennas.delete(antennaId);
  };
  
  // Check if a note matches any active antennas
  server.processNoteForAntennas = async (note: Note): Promise<void> => {
    // Implementation would match the note against antenna criteria 
    // and publish to matching antenna streams
    
    // This is a simplified example
    for (const [userId, antennaIds] of userAntennas.entries()) {
      // In a real implementation, we'd check if the note matches antenna criteria
      // For each matching antenna, we'd publish to its stream
    }
  };
  
  // Clean up when connection closes
  server.onConnectionClose = (connectionId: string): void => {
    activeAntennas.delete(connectionId);
  };
} 
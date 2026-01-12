import { StreamServer } from '../../streaming.js';
import { User } from '@/models/entities/user.js';
import { AbuseUserReport } from '@/models/entities/abuse-user-report.js';
import { publishAdminStream } from '@/services/stream.js';

/**
 * Handles admin-related events in the streaming server
 */
export function AdminHandler(server: StreamServer): void {
  // Map to track active admin connections by user ID
  const activeAdminConnections = new Map<User['id'], string[]>();
  
  // Register an admin connection
  server.registerAdminConnection = (connectionId: string, userId: User['id'], isAdmin: boolean): void => {
    // Only track admin users
    if (!isAdmin) return;
    
    if (!activeAdminConnections.has(userId)) {
      activeAdminConnections.set(userId, []);
    }
    
    const connections = activeAdminConnections.get(userId)!;
    if (!connections.includes(connectionId)) {
      connections.push(connectionId);
    }
  };
  
  // Get all active admin user IDs
  server.getActiveAdminUserIds = (): User['id'][] => {
    return Array.from(activeAdminConnections.keys());
  };
  
  // Send abuse report to all active admins
  server.broadcastAbuseReport = (report: AbuseUserReport): void => {
    const activeAdmins = server.getActiveAdminUserIds();
    
    activeAdmins.forEach(adminId => {
      publishAdminStream(adminId, 'newAbuseUserReport', {
        id: report.id,
        targetUserId: report.targetUserId,
        reporterId: report.reporterId,
        comment: report.comment,
      });
    });
  };
  
  // Clean up when connection closes
  server.onConnectionClose = (connectionId: string): void => {
    for (const [userId, connections] of activeAdminConnections.entries()) {
      const index = connections.indexOf(connectionId);
      
      if (index !== -1) {
        connections.splice(index, 1);
        
        // If no connections left, remove user
        if (connections.length === 0) {
          activeAdminConnections.delete(userId);
        }
      }
    }
  };
} 
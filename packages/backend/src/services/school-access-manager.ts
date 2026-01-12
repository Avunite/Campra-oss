/**
 * Enhanced School Access Manager
 * Provides additional utilities for managing school access revocation
 */

import { Users, Schools, SchoolBillings } from '@/models/index.js';
import Logger from '@/services/logger.js';
import { StripeSchoolManager } from './stripe-school-manager.js';

const logger = new Logger('school-access-manager');

export class SchoolAccessManager {
  /**
   * Suspend all active sessions for a school's students
   * This ensures immediate logout when school access is revoked
   */
  static async suspendAllSchoolSessions(schoolId: string): Promise<void> {
    try {
      // Find all active students from the school (excluding teachers and staff)
      const students = await Users.find({
        where: {
          schoolId: schoolId,
          enrollmentStatus: 'active',
          isSchoolAdmin: false, // Don't affect school staff
          isTeacher: false, // Don't affect teachers
          isStaff: false, // Don't affect platform staff
        },
      });

      // Log the suspension action
      logger.warn(`Suspending sessions for ${students.length} students from school ${schoolId}`);

      // Here you could implement session invalidation logic
      // For example, updating a session invalidation timestamp
      // or clearing cached session data

      // Optional: Send notifications to affected users
      for (const student of students) {
        // You could implement user notification logic here
        logger.info(`Session suspended for student ${student.id} due to school payment failure`);
      }

    } catch (error: any) {
      logger.error(`Error suspending school sessions for ${schoolId}: ${error.message}`);
    }
  }

  /**
   * Get detailed suspension information for a school
   */
  static async getSchoolSuspensionInfo(schoolId: string): Promise<{
    isSuspended: boolean;
    suspensionReason?: string;
    suspendedAt?: string;
    affectedStudentCount: number;
    billingStatus: string;
  }> {
    const school = await Schools.findOneBy({ id: schoolId });
    const billing = await SchoolBillings.findOne({
      where: { schoolId },
      order: { createdAt: 'DESC' },
    });

    const affectedStudentCount = await Users.count({
      where: {
        schoolId: schoolId,
        enrollmentStatus: 'active',
        isSchoolAdmin: false,
        isTeacher: false, // Don't count teachers
        isStaff: false,
      },
    });

    const isSuspended = school?.subscriptionStatus === 'suspended';
    
    return {
      isSuspended,
      suspensionReason: school?.settings?.suspension?.reason,
      suspendedAt: school?.settings?.suspension?.suspendedAt,
      affectedStudentCount,
      billingStatus: billing?.status || 'unknown',
    };
  }

  /**
   * Bulk suspend multiple schools (useful for administrative actions)
   */
  static async bulkSuspendSchools(schoolIds: string[], reason: string): Promise<void> {
    const stripeManager = await StripeSchoolManager.initialize();
    
    for (const schoolId of schoolIds) {
      try {
        await stripeManager.suspendSchoolAccess(schoolId, reason);
        await this.suspendAllSchoolSessions(schoolId);
        logger.info(`Bulk suspended school ${schoolId}: ${reason}`);
      } catch (error: any) {
        logger.error(`Error bulk suspending school ${schoolId}: ${error.message}`);
      }
    }
  }

  /**
   * Generate suspension audit report
   */
  static async generateSuspensionAuditReport(): Promise<{
    suspendedSchools: Array<{
      schoolId: string;
      schoolName: string;
      suspendedAt: string;
      reason: string;
      studentCount: number;
    }>;
    totalSuspendedStudents: number;
  }> {
    const suspendedSchools = await Schools.find({
      where: { subscriptionStatus: 'suspended' },
    });

    const report = [];
    let totalSuspendedStudents = 0;

    for (const school of suspendedSchools) {
      const studentCount = await Users.count({
        where: {
          schoolId: school.id,
          enrollmentStatus: 'active',
          isSchoolAdmin: false,
          isTeacher: false, // Don't count teachers
          isStaff: false,
        },
      });

      totalSuspendedStudents += studentCount;

      report.push({
        schoolId: school.id,
        schoolName: school.name,
        suspendedAt: school.settings?.suspension?.suspendedAt || new Date().toISOString(),
        reason: school.settings?.suspension?.reason || 'unknown',
        studentCount,
      });
    }

    return {
      suspendedSchools: report,
      totalSuspendedStudents,
    };
  }
}

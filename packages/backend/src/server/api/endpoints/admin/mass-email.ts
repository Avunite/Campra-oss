import define from '../../define.js';
import { sendEmail } from '@/services/send-email.js';
import { Users, UserProfiles } from '@/models/index.js';
import { In } from 'typeorm';

export const meta = {
  tags: ['admin'],
  requireCredential: true,
  requireAdmin: true,
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    userIds: { type: 'array', items: { type: 'string' }, nullable: true },
    subject: { type: 'string' },
    text: { type: 'string' },
    html: { type: 'string', nullable: true },
  },
  required: ['subject', 'text'],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps) => {
  let userProfiles;

  if (ps.userIds && ps.userIds.length > 0) {
    // Send to selected users
    userProfiles = await UserProfiles.find({
      where: { userId: In(ps.userIds) },
      relations: ['user'],
    });
  } else {
    // Send to all users
    userProfiles = await UserProfiles.find({
      relations: ['user'],
    });
  }

  let sentCount = 0;
  let errorCount = 0;

  for (const profile of userProfiles) {
    if (profile.email) {
      try {
        await sendEmail(profile.email, ps.subject, ps.text, ps.html || ps.text);
        sentCount++;
      } catch (error) {
        console.error(`Failed to send email to ${profile.email}:`, error);
        errorCount++;
      }
    }
  }

  return {
    message: 'Mass email sending completed',
    sentCount,
    errorCount,
    totalAttempted: userProfiles.length,
  };
});
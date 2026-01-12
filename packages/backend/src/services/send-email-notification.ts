import { UserProfiles } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { Note } from '@/models/entities/note.js';
import { UserGroup } from '@/models/entities/user-group.js';
import { sendEmail } from './send-email.js';
import * as Acct from '@/misc/acct.js';
import config from '@/config/index.js';

function getUserDisplayName(user: User): string {
  return user.name || `@${Acct.toString(user)}`;
}

async function follow(userId: User['id'], follower: User) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
  if (!userProfile.email || !userProfile.emailNotificationTypes.includes('follow')) return;

  const followerName = getUserDisplayName(follower);
  const subject = 'New follower';
  const text = `${followerName} is now following you.`;
  const html = `
    <p>${followerName} is now following you.</p>
    <p>View their profile: <a href="${config.url}/@${Acct.toString(follower)}">${config.url}/@${Acct.toString(follower)}</a></p>
  `;

  await sendEmail(userProfile.email, subject, html, text);
}

async function receiveFollowRequest(userId: User['id'], follower: User) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
  if (!userProfile.email || !userProfile.emailNotificationTypes.includes('receiveFollowRequest')) return;

  const followerName = getUserDisplayName(follower);
  const subject = 'New follow request';
  const text = `${followerName} has requested to follow you.`;
  const html = `
    <p>${followerName} has requested to follow you.</p>
    <p>View their profile: <a href="${config.url}/@${Acct.toString(follower)}">${config.url}/@${Acct.toString(follower)}</a></p>
    <p>You can approve or reject this request in your notifications.</p>
  `;

  await sendEmail(userProfile.email, subject, html, text);
}

async function mention(userId: User['id'], mentioner: User, note: Note) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
  if (!userProfile.email || !userProfile.emailNotificationTypes.includes('mention')) return;

  const mentionerName = getUserDisplayName(mentioner);
  const subject = 'New mention';
  const text = `${mentionerName} mentioned you in a bark.`;
  const html = `
    <p>${mentionerName} mentioned you in a bark:</p>
    <blockquote>${note.text}</blockquote>
    <p>View the bark: <a href="${config.url}/barks/${note.id}">${config.url}/barks/${note.id}</a></p>
  `;

  await sendEmail(userProfile.email, subject, html, text);
}

async function reply(userId: User['id'], replier: User, note: Note) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
  if (!userProfile.email || !userProfile.emailNotificationTypes.includes('reply')) return;

  const replierName = getUserDisplayName(replier);
  const subject = 'New reply to your bark';
  const text = `${replierName} replied to your bark.`;
  const html = `
    <p>${replierName} replied to your bark:</p>
    <blockquote>${note.text}</blockquote>
    <p>View the reply: <a href="${config.url}/barks/${note.id}">${config.url}/barks/${note.id}</a></p>
  `;

  await sendEmail(userProfile.email, subject, html, text);
}

async function quote(userId: User['id'], quoter: User, note: Note) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
  if (!userProfile.email || !userProfile.emailNotificationTypes.includes('quote')) return;

  const quoterName = getUserDisplayName(quoter);
  const subject = 'Your bark was quoted';
  const text = `${quoterName} quoted your bark.`;
  const html = `
    <p>${quoterName} quoted your bark:</p>
    <blockquote>${note.text}</blockquote>
    <p>View the quote: <a href="${config.url}/barks/${note.id}">${config.url}/barks/${note.id}</a></p>
  `;

  await sendEmail(userProfile.email, subject, html, text);
}

async function groupInvite(userId: User['id'], inviter: User, group: UserGroup) {
  const userProfile = await UserProfiles.findOneByOrFail({ userId: userId });
  if (!userProfile.email || !userProfile.emailNotificationTypes.includes('groupInvite')) return;

  const inviterName = getUserDisplayName(inviter);
  const subject = 'New group invitation';
  const text = `${inviterName} invited you to join the group "${group.name}".`;
  const html = `
    <p>${inviterName} invited you to join the group "${group.name}".</p>
    <p>You can accept or decline this invitation in your notifications.</p>
  `;

  await sendEmail(userProfile.email, subject, html, text);
}

export const sendEmailNotification = {
  follow,
  receiveFollowRequest,
  mention,
  reply,
  quote,
  groupInvite,
};
import * as nodemailer from 'nodemailer';
import { fetchMeta } from '@/misc/fetch-meta.js';
import Logger from './logger.js';
import config from '@/config/index.js';

export const logger = new Logger('email');

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  const meta = await fetchMeta(true);
  const iconUrl = `${config.url}/static-assets/mi-white.png`;
  const emailSettingUrl = `${config.url}/settings/email`;
  const enableAuth = meta.smtpUser != null && meta.smtpUser !== '';

  const transporter = nodemailer.createTransport({
    host: meta.smtpHost,
    port: meta.smtpPort,
    secure: meta.smtpSecure,
    ignoreTLS: !enableAuth,
    proxy: config.proxySmtp,
    auth: enableAuth ? {
      user: meta.smtpUser,
      pass: meta.smtpPass,
    } : undefined,
  } as any);

  try {
    const info = await transporter.sendMail({
      from: meta.email!,
      to: to,
      subject: 'Campra | ' + subject,
      text: text,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>Campra | ${subject}</title>
        </head>
        <body style="background: #eee; margin: 0; font-family: sans-serif; font-size: 14px;">
          <main style="max-width: 500px; margin: 0 auto; background: #e0def4; color: #6e6a86;">
            <header style="padding: 32px; background: #6e85d3;">
              <img src="https://campra.app/static-assets/dog.png" alt="Logo" style="max-width: 128px; max-height: 28px; vertical-align: bottom;">
            </header>
            <article style="padding: 32px;">
              <h1 style="margin: 0 0 1em 0; color: #6e6a86;">${subject}</h1>
              <div style="color: #6e6a86;">${html}</div>
            </article>
            <footer style="padding: 32px; border-top: solid 1px #eee;">
              <a href="${emailSettingUrl}" style="text-decoration: none; color: #31748f;">Unsubscribe</a>
              <span style="color: #31748f;">|</span>
              <a href="${config.url}" style="text-decoration: none; color: #31748f;">${config.host}</a>
            </footer>
          </main>
        </body>
        </html>
      `,
      headers: {
        'List-Unsubscribe': `<${emailSettingUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    });

    logger.info(`Message sent: ${info.messageId}`);
  } catch (err) {
    logger.error(err as Error);
    throw err;
  }
}
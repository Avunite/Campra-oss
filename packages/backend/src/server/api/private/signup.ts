import Koa from 'koa';
import rndstr from 'rndstr';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { verifyHcaptcha, verifyRecaptcha } from '@/misc/captcha.js';
import { Users, RegistrationTickets, UserPendings } from '@/models/index.js';
import { signup } from '../common/signup.js';
import config from '@/config/index.js';
import { sendEmail } from '@/services/send-email.js';
import { genId } from '@/misc/gen-id.js';
import { validateEmailForAccount } from '@/services/validate-email-for-account.js';
import { SchoolService } from '@/services/school-service.js';

interface SignupBody {
  username: string;
  password: string;
  host?: string;
  invitationCode?: string;
  emailAddress?: string;
  'hcaptcha-response'?: string;
  'g-recaptcha-response'?: string;
}

export default async (ctx: Koa.Context) => {
  const body = ctx.request.body as SignupBody;
  const instance = await fetchMeta(true);

  // Verify *Captcha
  if (process.env.NODE_ENV !== 'test') {
    if (instance.enableHcaptcha && instance.hcaptchaSecretKey) {
      await verifyHcaptcha(instance.hcaptchaSecretKey, body['hcaptcha-response'] || '').catch(e => {
        ctx.throw(400, e);
      });
    }
    if (instance.enableRecaptcha && instance.recaptchaSecretKey) {
      await verifyRecaptcha(instance.recaptchaSecretKey, body['g-recaptcha-response'] || '').catch(e => {
        ctx.throw(400, e);
      });
    }
  }

  const username = body.username;
  const password = body.password;
  const host: string | null = process.env.NODE_ENV === 'test' ? (body.host || null) : null;
  const invitationCode = body.invitationCode;
  const emailAddress = body.emailAddress;

  if (instance.emailRequiredForSignup) {
    if (emailAddress == null || typeof emailAddress !== 'string') {
      ctx.status = 400;
      ctx.body = {
        error: {
          message: 'Email address is required for signup',
          code: 'EMAIL_REQUIRED',
          id: 'email-required',
        },
      };
      return;
    }
    
    // Check email account limits
    const available = await validateEmailForAccount(emailAddress);
    if (!available) {
      ctx.status = 400;
      ctx.body = {
        error: {
          message: 'Maximum number of accounts reached for this email',
          code: 'EMAIL_ACCOUNT_LIMIT',
          id: 'email-account-limit',
        },
      };
      return;
    }

    // CAMPRA PHASE 2: School email verification and billing enforcement
    const eligibility = await SchoolService.validateRegistrationEligibility(emailAddress);
    
    if (!eligibility.allowed) {
      if (eligibility.reason === 'SCHOOL_NOT_REGISTERED') {
        ctx.status = 404;
        ctx.body = {
          error: {
            message: 'Your school is not registered with Campra. Contact your school administration about Campra access.',
            code: 'SCHOOL_NOT_REGISTERED',
            id: 'school-not-registered',
          },
        };
        return;
      }
      
      if (eligibility.reason === 'SCHOOL_REGISTRATION_CLOSED') {
        ctx.status = 403;
        ctx.body = {
          error: {
            message: 'Registration is currently closed for your school. Contact your school administration to enable domain-based signups.',
            code: 'SCHOOL_REGISTRATION_CLOSED',
            id: 'school-registration-closed',
            school: eligibility.school ? {
              name: eligibility.school.name,
              domain: eligibility.school.domain,
            } : null,
          },
        };
        return;
      }
      
      if (eligibility.reason === 'SCHOOL_SUBSCRIPTION_REQUIRED') {
        ctx.status = 402;
        ctx.body = {
          error: {
            message: 'Your school needs an active Campra subscription for student access. Contact your school administration to complete Campra setup.',
            code: 'SCHOOL_SUBSCRIPTION_REQUIRED', 
            id: 'school-subscription-required',
            school: eligibility.school ? {
              name: eligibility.school.name,
              domain: eligibility.school.domain,
            } : null,
          },
        };
        return;
      }

      if (eligibility.reason === 'STUDENT_CAP_REACHED') {
        ctx.status = 403;
        ctx.body = {
          error: {
            message: 'Your school has reached its student capacity limit. Contact your school administration to increase the student cap.',
            code: 'STUDENT_CAP_REACHED',
            id: 'student-cap-reached',
            school: eligibility.school ? {
              name: eligibility.school.name,
              domain: eligibility.school.domain,
            } : null,
          },
        };
        return;
      }

      if (eligibility.reason === 'LMS_NOT_CONFIGURED') {
        ctx.status = 503;
        ctx.body = {
          error: {
            message: 'Your school requires LMS validation but the LMS connection is not configured. Contact your school administration.',
            code: 'LMS_NOT_CONFIGURED',
            id: 'lms-not-configured',
            school: eligibility.school ? {
              name: eligibility.school.name,
              domain: eligibility.school.domain,
            } : null,
          },
        };
        return;
      }

      if (eligibility.reason === 'LMS_VALIDATION_FAILED') {
        ctx.status = 403;
        ctx.body = {
          error: {
            message: 'Your email address could not be validated in the Learning Management System. Contact your school administration.',
            code: 'LMS_VALIDATION_FAILED',
            id: 'lms-validation-failed',
            school: eligibility.school ? {
              name: eligibility.school.name,
              domain: eligibility.school.domain,
            } : null,
          },
        };
        return;
      }

      // Other validation errors
      ctx.status = 403;
      ctx.body = {
        error: {
          message: 'Registration not allowed for this email address',
          code: 'REGISTRATION_NOT_ALLOWED',
          id: 'registration-not-allowed',
        },
      };
      return;
    }
  }

  if (instance.disableRegistration) {
    if (invitationCode == null || typeof invitationCode !== 'string') {
      ctx.status = 400;
      return;
    }
    const ticket = await RegistrationTickets.findOneBy({
      code: invitationCode,
    });
    if (ticket == null) {
      ctx.status = 400;
      return;
    }
    RegistrationTickets.delete(ticket.id);
  }

  // Check pre-release restrictions
  if (instance.preReleaseMode) {
    ctx.status = 403;
    ctx.body = { 
      error: {
        message: 'Registration is currently restricted to select users during our pre-release phase.',
        code: 'PRE_RELEASE_REGISTRATION_DISABLED',
        id: 'pre-release-registration-disabled'
      }
    };
    return;
  }

  if (instance.emailRequiredForSignup) {
    const code = rndstr('a-z0-9', 16);
    const salt = await bcrypt.genSalt(8);
    const hash = await bcrypt.hash(password, salt);

    await UserPendings.insert({
      id: genId(),
      createdAt: new Date(),
      code,
      email: emailAddress!,
      username: username,
      password: hash,
    });

    const link = `${config.url}/signup-complete/${code}`;
    sendEmail(emailAddress!, 'Signup',
      `To complete signup, please click this link:<br><a href="${link}">${link}</a>`,
      `To complete signup, please click this link: ${link}`);

    ctx.status = 204;
  } else {
    try {
      // Get school information for non-staff registrations
      let schoolId: string | null = null;
      
      if (emailAddress && !SchoolService.isStaffEmail(emailAddress)) {
        const school = await SchoolService.findSchoolByEmailDomain(emailAddress);
        if (school) {
          schoolId = school.id;
        }
      }

      const { account, secret } = await signup({
        username, password, host,
      });

      // Assign user to school if applicable
      if (schoolId) {
        await Users.update({ id: account.id }, { 
          schoolId,
          enrollmentStatus: 'active',
        });
        
        // Update school student count and billing
        await SchoolService.updateStudentCountAndBilling(schoolId);
      }

      const res = await Users.pack(account, account, {
        detail: true,
        includeSecrets: true,
      });
      (res as any).token = secret;
      ctx.body = res;
    } catch (e) {
      ctx.throw(400, e instanceof Error ? e.message : 'Unknown error');
    }
  }
};
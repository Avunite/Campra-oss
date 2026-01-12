import { validate as validateEmail } from 'deep-email-validator';
import { UserProfiles } from '@/models/index.js';
import { fetchMeta } from '@/misc/fetch-meta.js';

type ValidationResult = {
  valid: boolean;
  reason?: 'regex' | 'disposable' | 'mx' | 'smtp';
};

export async function validateEmailForAccount(emailAddress: string): Promise<{
  available: boolean;
  reason: null | 'used' | 'format' | 'disposable' | 'mx' | 'smtp';
}> {
  const meta = await fetchMeta();
  const usageCount = await UserProfiles.count({
    where: {
      emailVerified: true,
      email: emailAddress,
    },
  });

  const validated = meta.enableActiveEmailValidation
    ? await validateEmail({
        email: emailAddress,
        validateRegex: true,
        validateMx: true,
        validateTypo: false,
        validateDisposable: true,
        validateSMTP: false,
      }) as ValidationResult
    : { valid: true };

  const available = usageCount < 3 && validated.valid;

  return {
    available,
    reason: available
      ? null
      : usageCount >= 3
      ? 'used'
      : validated.reason === 'regex'
      ? 'format'
      : validated.reason === 'disposable'
      ? 'disposable'
      : validated.reason === 'mx'
      ? 'mx'
      : validated.reason === 'smtp'
      ? 'smtp'
      : null,
  };
}
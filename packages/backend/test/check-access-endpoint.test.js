import * as assert from 'assert';

import checkAccess from '../src/server/api/endpoints/schools/check-access.js';
import { SchoolService } from '../src/services/school-service.js';

describe('schools/check-access endpoint', () => {
    it('should return SCHOOL_REGISTRATION_CLOSED when service throws that reason', async () => {
        // Mock validateRegistrationEligibility to throw a reason-code error
        const originalValidate = SchoolService.validateRegistrationEligibility;
        const originalFind = SchoolService.findSchoolByEmailDomain;

        try {
            SchoolService.validateRegistrationEligibility = async () => { throw new Error('SCHOOL_REGISTRATION_CLOSED'); };
            SchoolService.findSchoolByEmailDomain = async () => ({ id: 's1', name: 'Providence Day', domain: 'providenceday.org', type: 'K-12', registrationSettings: { allowDomainSignups: false, allowStudentsChooseUsername: true } });

            const result = await checkAccess({ email: 'aaa@providenceday.org' }, null, null);
            assert.strictEqual(result.allowed, false);
            assert.strictEqual(result.reason, 'SCHOOL_REGISTRATION_CLOSED');
            assert.strictEqual(result.school && result.school.name, 'Providence Day');
        } finally {
            SchoolService.validateRegistrationEligibility = originalValidate;
            SchoolService.findSchoolByEmailDomain = originalFind;
        }
    });

    it('should return INVALID_EMAIL when validation throws an invalid email error', async () => {
        const originalValidate = SchoolService.validateRegistrationEligibility;

        try {
            SchoolService.validateRegistrationEligibility = async () => { throw new Error('INVALID_EMAIL'); };
            const result = await checkAccess({ email: 'bad-email' }, null, null);
            assert.strictEqual(result.allowed, false);
            assert.strictEqual(result.reason, 'INVALID_EMAIL');
        } finally {
            SchoolService.validateRegistrationEligibility = originalValidate;
        }
    });
});

import * as assert from 'assert';

import { SchoolService } from '../src/services/school-service.js';

describe('SchoolService', () => {
    it('extractDomain returns domain for typical email', () => {
        const email = 'aidan.deniershain@providenceday.org';
        const domain = SchoolService.extractDomain(email);
        assert.strictEqual(domain, 'providenceday.org');
    });

    it('extractDomain trims whitespace and lowercases', () => {
        const email = '  User@ExAMPle.Org  ';
        const domain = SchoolService.extractDomain(email);
        assert.strictEqual(domain, 'example.org');
    });

    it('isStaffEmail matches campra and avunite domains', () => {
        assert.strictEqual(SchoolService.isStaffEmail('foo@campra.com'), true);
        assert.strictEqual(SchoolService.isStaffEmail('bar@avunite.com'), true);
        assert.strictEqual(SchoolService.isStaffEmail('user@example.com'), false);
    });
});

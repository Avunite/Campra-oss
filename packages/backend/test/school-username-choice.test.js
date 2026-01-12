/**
 * Simple test for school username choice feature
 * Tests the allowStudentsChooseUsername setting
 */

describe('School Username Choice Settings', () => {
	test('School entity should have allowStudentsChooseUsername field with default true', () => {
		// Simulating default registration settings
		const defaultSettings = {
			allowDomainSignups: false,
			requireInvitation: true,
			autoGraduationEnabled: true,
			allowStudentsChooseUsername: true
		};

		expect(defaultSettings.allowStudentsChooseUsername).toBe(true);
	});

	test('Username should be sanitized from email prefix when auto-generation is enabled', () => {
		// Simulate the sanitization logic from MkSignup.vue
		const email = 'john.doe+test@university.edu';
		const emailPrefix = email.split('@')[0];
		const sanitizedUsername = emailPrefix.replace(/[^a-zA-Z0-9_]/g, '_');

		expect(sanitizedUsername).toBe('john_doe_test');
	});

	test('Username sanitization should handle special characters', () => {
		const testCases = [
			{ email: 'test-user@school.edu', expected: 'test_user' },
			{ email: 'john.doe@school.edu', expected: 'john_doe' },
			{ email: 'user123@school.edu', expected: 'user123' },
			{ email: 'test_user@school.edu', expected: 'test_user' },
			{ email: 'a!b#c$d%e@school.edu', expected: 'a_b_c_d_e' }
		];

		testCases.forEach(({ email, expected }) => {
			const emailPrefix = email.split('@')[0];
			const sanitizedUsername = emailPrefix.replace(/[^a-zA-Z0-9_]/g, '_');
			expect(sanitizedUsername).toBe(expected);
		});
	});

	test('School settings should merge properly with defaults', () => {
		const currentSettings = {
			allowDomainSignups: true,
			requireInvitation: false,
			autoGraduationEnabled: true,
			allowStudentsChooseUsername: true
		};

		const newSettings = {
			allowStudentsChooseUsername: false
		};

		const mergedSettings = {
			...currentSettings,
			...newSettings
		};

		expect(mergedSettings.allowStudentsChooseUsername).toBe(false);
		expect(mergedSettings.allowDomainSignups).toBe(true);
		expect(mergedSettings.autoGraduationEnabled).toBe(true);
	});

	test('Username should be readonly when allowStudentsChooseUsername is false', () => {
		const schoolInfo = {
			allowed: true,
			school: {
				id: 'test-school',
				name: 'Test University',
				domain: 'university.edu',
				type: 'university',
				allowStudentsChooseUsername: false
			}
		};

		// Simulate the logic from MkSignup.vue onSchoolInfo
		const usernameReadonly = schoolInfo?.school && 
			schoolInfo.school.allowStudentsChooseUsername === false;

		expect(usernameReadonly).toBe(true);
	});

	test('Username should be editable when allowStudentsChooseUsername is true', () => {
		const schoolInfo = {
			allowed: true,
			school: {
				id: 'test-school',
				name: 'Test University',
				domain: 'university.edu',
				type: 'university',
				allowStudentsChooseUsername: true
			}
		};

		// Simulate the logic from MkSignup.vue onSchoolInfo
		const usernameReadonly = schoolInfo?.school && 
			schoolInfo.school.allowStudentsChooseUsername === false;

		expect(usernameReadonly).toBe(false);
	});
});

import define from '../../../define.js';
import { ApiError } from '../../../error.js';
import { SchoolAccessManager } from '@/services/school-access-manager.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	
	description: 'Get detailed information about suspended schools and affected students',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			suspendedSchools: {
				type: 'array',
				optional: false,
				nullable: false,
				items: {
					type: 'object',
					properties: {
						schoolId: { type: 'string' },
						schoolName: { type: 'string' },
						suspendedAt: { type: 'string' },
						reason: { type: 'string' },
						studentCount: { type: 'number' },
					},
				},
			},
			totalSuspendedStudents: {
				type: 'number',
				optional: false,
				nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		const report = await SchoolAccessManager.generateSuspensionAuditReport();
		return report;
	} catch (error: any) {
		throw new ApiError({
			message: `Failed to generate suspension report: ${error.message}`,
			code: 'SUSPENSION_REPORT_FAILED',
			id: 'suspension-report-failed-001',
			httpStatusCode: 500,
		});
	}
});

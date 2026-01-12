import define from '../../define.js';
import { CSVImportService } from '@/services/csv-import.js';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Get import summary for school (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			lastImportDate: {
				type: 'string',
				optional: true,
				nullable: true,
				format: 'date-time',
			},
			totalImported: {
				type: 'number',
				optional: false,
				nullable: false,
			},
			successRate: {
				type: 'number',
				optional: false,
				nullable: false,
			},
			recentImports: {
				type: 'number',
				optional: false,
				nullable: false,
			},
		},
	},

	errors: {
		accessDenied: {
			message: 'Access denied: School admin access required',
			code: 'ACCESS_DENIED',
			id: 'school-admin-025',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('ACCESS_DENIED');
	}

	const schoolId = user.adminForSchoolId;

	try {
		// Get recent import history (last 30 days)
		const importHistory = await CSVImportService.getImportHistory(schoolId, 50);
		
		if (importHistory.length === 0) {
			return {
				lastImportDate: null,
				totalImported: 0,
				successRate: 0,
				recentImports: 0,
			};
		}

		// Calculate summary statistics
		const lastImport = importHistory[0];
		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const recentImports = importHistory.filter(log => 
			new Date(log.createdAt) >= thirtyDaysAgo
		);

		const totalImported = importHistory.reduce((sum, log) => sum + log.successfulRows, 0);
		const totalAttempted = importHistory.reduce((sum, log) => sum + log.totalRows, 0);
		const successRate = totalAttempted > 0 ? Math.round((totalImported / totalAttempted) * 100) : 0;

		return {
			lastImportDate: lastImport.createdAt.toISOString(),
			totalImported,
			successRate,
			recentImports: recentImports.length,
		};
	} catch (error) {
		console.error('Import summary error:', error);
		
		// Return empty state if there's an error
		return {
			lastImportDate: null,
			totalImported: 0,
			successRate: 0,
			recentImports: 0,
		};
	}
});

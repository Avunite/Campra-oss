import define from '../../define.js';
import { CSVImportService } from '@/services/csv-import.js';
import { DriveFiles } from '@/models/index.js';
import { createTemp } from '@/misc/create-temp.js';
import { downloadUrl } from '@/misc/download-url.js';
import * as fs from 'node:fs';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Import students from CSV data (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			success: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
			result: {
				type: 'object',
				optional: false,
				nullable: false,
				properties: {
					totalRows: {
						type: 'number',
						optional: false,
						nullable: false,
					},
					successfulRows: {
						type: 'number',
						optional: false,
						nullable: false,
					},
					failedRows: {
						type: 'number',
						optional: false,
						nullable: false,
					},
					invitationsSent: {
						type: 'number',
						optional: false,
						nullable: false,
					},
					logId: {
						type: 'string',
						optional: false,
						nullable: false,
						format: 'campra:id',
					},
					errors: {
						type: 'array',
						optional: false,
						nullable: false,
						items: {
							type: 'object',
							properties: {
								row: {
									type: 'number',
									optional: false,
									nullable: false,
								},
								field: {
									type: 'string',
									optional: false,
									nullable: false,
								},
								message: {
									type: 'string',
									optional: false,
									nullable: false,
								},
							},
						},
					},
				},
			},
		},
	},

	errors: {
		accessDenied: {
			message: 'Access denied: School admin access required',
			code: 'ACCESS_DENIED',
			id: 'school-admin-017',
		},
		invalidCSV: {
			message: 'Invalid CSV format',
			code: 'INVALID_CSV',
			id: 'school-admin-018',
		},
		csvTooLarge: {
			message: 'CSV file too large (max 10MB)',
			code: 'CSV_TOO_LARGE',
			id: 'school-admin-019',
		},
		importFailed: {
			message: 'Import process failed',
			code: 'IMPORT_FAILED',
			id: 'school-admin-020',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		fileId: { 
			type: 'string',
			format: 'campra:id',
		},
		dryRun: { 
			type: 'boolean', 
			default: false,
		},
	},
	required: ['fileId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('ACCESS_DENIED');
	}

	const schoolId = user.adminForSchoolId;

	// Get the drive file
	const file = await DriveFiles.findOneBy({
		id: ps.fileId,
		userId: user.id,
	});

	if (!file) {
		throw new Error('FILE_NOT_FOUND');
	}

	// Check file size (10MB limit)
	if (file.size > 10 * 1024 * 1024) {
		throw new Error('CSV_TOO_LARGE');
	}

	// Check file type
	if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
		throw new Error('INVALID_CSV');
	}

	let [path, cleanup] = await createTemp();

	try {
		// Download file to temp location
		await downloadUrl(file.url, path);

		// Read file content
		const csvContent = fs.readFileSync(path, 'utf-8');

		// Parse CSV data
		const rows = await CSVImportService.parseCSV(csvContent);
		
		// Process the import
		const result = await CSVImportService.processImport(
			schoolId,
			rows,
			user.id,
			ps.dryRun || false
		);
		
		return {
			success: true,
			result: {
				totalRows: result.totalRows,
				successfulRows: result.successfulRows,
				failedRows: result.failedRows,
				invitationsSent: result.invitationsSent,
				logId: result.logId,
				errors: result.errors.map(error => ({
					row: error.row,
					field: error.field,
					message: error.message,
				})),
			},
		};
	} catch (error: any) {
		if (error.message.includes('CSV file is empty') || 
			error.message.includes('Missing required headers') ||
			error.message.includes('Invalid CSV format')) {
			throw new Error('INVALID_CSV');
		}
		
		if (error.message === 'School not found') {
			throw new Error('ACCESS_DENIED');
		}
		
		// Log the error for debugging
		console.error('CSV Import Error:', error);
		throw new Error('IMPORT_FAILED');
	} finally {
		cleanup();
	}
});
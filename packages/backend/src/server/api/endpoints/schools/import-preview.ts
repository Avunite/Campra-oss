import define from '../../define.js';
import { CSVImportService } from '@/services/csv-import.js';
import { DriveFiles } from '@/models/index.js';
import { createTemp } from '@/misc/create-temp.js';
import { downloadUrl } from '@/misc/download-url.js';
import * as fs from 'node:fs';

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Preview CSV import data with intelligent format detection (school admin only)',

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			preview: {
				type: 'array',
				optional: false,
				nullable: false,
				items: {
					type: 'object',
					properties: {
						email: {
							type: 'string',
							optional: false,
							nullable: false,
						},
						name: {
							type: 'string',
							optional: false,
							nullable: false,
						},
						firstName: {
							type: 'string',
							optional: true,
							nullable: true,
						},
						lastName: {
							type: 'string',
							optional: true,
							nullable: true,
						},
						type: {
							type: 'string',
							optional: true,
							nullable: true,
						},
						grade: {
							type: 'string',
							optional: true,
							nullable: true,
						},
						studentId: {
							type: 'string',
							optional: true,
							nullable: true,
						},
						className: {
							type: 'string',
							optional: true,
							nullable: true,
						},
						department: {
							type: 'string',
							optional: true,
							nullable: true,
						},
						role: {
							type: 'string',
							optional: true,
							nullable: true,
						},
						graduationDate: {
							type: 'string',
							optional: true,
							nullable: true,
						},
					},
				},
			},
			detectedFormat: {
				type: 'string',
				optional: false,
				nullable: false,
			},
			supportedFields: {
				type: 'array',
				optional: false,
				nullable: false,
				items: {
					type: 'string',
				},
			},
			validation: {
				type: 'object',
				optional: false,
				nullable: false,
				properties: {
					valid: {
						type: 'boolean',
						optional: false,
						nullable: false,
					},
					totalRows: {
						type: 'number',
						optional: false,
						nullable: false,
					},
					validRows: {
						type: 'number',
						optional: false,
						nullable: false,
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
			id: 'school-admin-014',
		},
		invalidCSV: {
			message: 'Invalid CSV format',
			code: 'INVALID_CSV',
			id: 'school-admin-015',
		},
		csvTooLarge: {
			message: 'CSV file too large (max 10MB)',
			code: 'CSV_TOO_LARGE',
			id: 'school-admin-016',
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
		validate: { 
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

		// Get enhanced preview with format detection
		const previewResult = await CSVImportService.previewCSV(csvContent, 5);
		
		// Validate all rows for comprehensive validation info if requested
		let validationResult;
		
		if (ps.validate) {
			validationResult = await CSVImportService.validateRows(
				await CSVImportService.parseCSV(csvContent), 
				schoolId
			);
		}
		
		return {
			preview: previewResult.rows,
			detectedFormat: previewResult.detectedFormat,
			supportedFields: previewResult.supportedFields,
		validation: {
			valid: validationResult?.valid || true,
			totalRows: previewResult.totalRows,
			validRows: validationResult?.validRows.length || previewResult.totalRows,
			errors: validationResult?.errors || [],
		},
		};
	} catch (error: any) {
		if (error.message.includes('CSV file is empty') || 
			error.message.includes('Missing required') ||
			error.message.includes('Invalid CSV format')) {
			throw new Error('INVALID_CSV');
		}
		
		// Re-throw other errors
		throw error;
	} finally {
		cleanup();
	}
});
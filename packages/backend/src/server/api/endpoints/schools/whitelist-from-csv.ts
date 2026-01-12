import define from '../../define.js';
import { EmailWhitelists, Schools } from '@/models/index.js';
import { EmailWhitelist } from '@/models/entities/email-whitelist.js';
import { genId } from '@/misc/gen-id.js';
import Logger from '@/services/logger.js';

const logger = new Logger('whitelist-csv-import');

export const meta = {
	tags: ['schools'],
	requireCredential: true,
	
	description: 'Import whitelist entries from CSV data (school admin only)',

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
					errors: {
						type: 'array',
						optional: false,
						nullable: false,
					},
				},
			},
		},
	},

	errors: {
		accessDenied: {
			message: 'Access denied: School admin access required',
			code: 'ACCESS_DENIED',
			id: 'whitelist-csv-001',
		},
		invalidCSV: {
			message: 'Invalid CSV format',
			code: 'INVALID_CSV',
			id: 'whitelist-csv-002',
		},
		csvTooLarge: {
			message: 'CSV file too large (max 5MB)',
			code: 'CSV_TOO_LARGE',
			id: 'whitelist-csv-003',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		csvFile: { 
			type: 'string',
			minLength: 1,
			maxLength: 5242880, // 5MB in characters (approximate)
		},
	},
	required: ['csvFile'],
} as const;

interface WhitelistCSVRow {
	email: string;
	name?: string;
	gradeLevel?: string;
	notes?: string;
}

export default define(meta, paramDef, async (ps, user) => {
	// Check if user is school admin
	if (!user.isSchoolAdmin || !user.adminForSchoolId) {
		throw new Error('ACCESS_DENIED');
	}

	const schoolId = user.adminForSchoolId;

	// Check CSV size
	if (ps.csvFile.length > 5242880) { // 5MB
		throw new Error('CSV_TOO_LARGE');
	}

	// Get school information
	const school = await Schools.findOneBy({ id: schoolId });
	if (!school) {
		throw new Error('ACCESS_DENIED');
	}

	try {
		// Parse CSV data
		const rows = parseWhitelistCSV(ps.csvFile, school.domain);
		
		const errors: any[] = [];
		let successfulRows = 0;

		// Process each row
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			
			try {
				// Check if already whitelisted
				const existing = await EmailWhitelists.findOne({
					where: { schoolId, email: row.email },
				});

				if (existing) {
					errors.push({
						row: i + 2, // +2 for header and 0-indexing
						email: row.email,
						error: 'Email already whitelisted',
					});
					continue;
				}

				// Create whitelist entry
				const whitelist = new EmailWhitelist({
					id: genId(),
					schoolId,
					email: row.email,
					name: row.name || null,
					gradeLevel: row.gradeLevel || null,
					notes: row.notes || null,
					addedBy: user.id,
					invitationSent: false,
					registered: false,
				});

				await EmailWhitelists.save(whitelist);
				successfulRows++;
			} catch (error: any) {
				errors.push({
					row: i + 2,
					email: row.email,
					error: error.message || 'Unknown error',
				});
			}
		}

		logger.info(`Whitelist CSV import completed for school ${schoolId}: ${successfulRows}/${rows.length} successful`);

		return {
			success: true,
			result: {
				totalRows: rows.length,
				successfulRows,
				failedRows: rows.length - successfulRows,
				errors,
			},
		};
	} catch (error: any) {
		if (error.message.includes('CSV file is empty') || 
			error.message.includes('Missing required headers') ||
			error.message.includes('Invalid CSV format')) {
			throw new Error('INVALID_CSV');
		}
		
		// Log the error for debugging
		logger.error('Whitelist CSV Import Error:', error);
		throw new Error('INVALID_CSV');
	}
});

/**
 * Parse CSV data for whitelist import
 */
function parseWhitelistCSV(csvData: string, schoolDomain: string): WhitelistCSVRow[] {
	const lines = csvData.trim().split('\n');
	
	if (lines.length === 0) {
		throw new Error('CSV file is empty');
	}

	// Parse header row
	const headerLine = lines[0];
	const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());
	
	// Find header indices
	const emailIndex = headers.findIndex(h => h === 'email' || h === 'email_address' || h === 'e_mail');
	const nameIndex = headers.findIndex(h => h === 'name' || h === 'full_name' || h === 'student_name');
	const gradeIndex = headers.findIndex(h => h === 'grade' || h === 'grade_level' || h === 'year');
	const notesIndex = headers.findIndex(h => h === 'notes' || h === 'note' || h === 'comments');

	// Validate that we have required fields
	if (emailIndex === -1) {
		throw new Error('Missing required email column');
	}

	const rows: WhitelistCSVRow[] = [];

	// Parse data rows
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue; // Skip empty lines

		const values = parseCSVLine(line);
		
		const email = values[emailIndex]?.trim().toLowerCase() || '';
		
		// Validate email
		if (!email) continue;
		
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			continue; // Skip invalid emails
		}

		// Verify email is from school domain
		const emailDomain = email.split('@')[1];
		if (emailDomain !== schoolDomain.toLowerCase()) {
			continue; // Skip emails not from school domain
		}

		const row: WhitelistCSVRow = {
			email,
			name: nameIndex !== -1 ? values[nameIndex]?.trim() : undefined,
			gradeLevel: gradeIndex !== -1 ? values[gradeIndex]?.trim() : undefined,
			notes: notesIndex !== -1 ? values[notesIndex]?.trim() : undefined,
		};

		rows.push(row);
	}

	return rows;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;
	
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		
		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				// Escaped quote
				current += '"';
				i++; // Skip next quote
			} else {
				// Toggle quote state
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			// End of field
			result.push(current);
			current = '';
		} else {
			current += char;
		}
	}
	
	// Add the last field
	result.push(current);
	
	return result;
}

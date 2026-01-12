import { CSVImportLogs, Users, UserProfiles, Schools } from '@/models/index.js';
import { CSVImportLog } from '@/models/entities/csv-import-log.js';
import { User } from '@/models/entities/user.js';
import { genId } from '@/misc/gen-id.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { sendEmail } from './send-email.js';
import config from '@/config/index.js';
import Logger from './logger.js';
import bcrypt from 'bcryptjs';

const logger = new Logger('csv-import');

export interface CSVStudentRow {
	email: string;
	name: string;
	firstName?: string;
	lastName?: string;
	type?: 'student' | 'teacher';
	graduationDate?: string;
	grade?: string;
	studentId?: string;
	className?: string;
	department?: string;
	role?: string;
}

export interface SchoolSystemFormat {
	name: string;
	emailFields: string[];
	nameFields: string[];
	firstNameFields: string[];
	lastNameFields: string[];
	typeFields: string[];
	gradeFields: string[];
	studentIdFields: string[];
	classFields: string[];
	departmentFields: string[];
	roleFields: string[];
	graduationFields: string[];
}

export interface ImportError {
	row: number;
	field: string;
	message: string;
	data: any;
}

export interface ValidationResult {
	valid: boolean;
	errors: ImportError[];
	validRows: CSVStudentRow[];
}

export interface ImportResult {
	totalRows: number;
	successfulRows: number;
	failedRows: number;
	errors: ImportError[];
	invitationsSent: number;
	logId: string;
}

/**
 * CSV Import service for student and teacher data
 */
export class CSVImportService {
	/**
	 * Common school management system export formats
	 */
	private static readonly SCHOOL_SYSTEM_FORMATS: SchoolSystemFormat[] = [
		// PowerSchool
		{
			name: 'PowerSchool',
			emailFields: ['email', 'email_addr', 'student_email', 'email_address', 'guardian_email'],
			nameFields: ['name', 'full_name', 'student_name'],
			firstNameFields: ['first_name', 'firstname', 'fname', 'given_name'],
			lastNameFields: ['last_name', 'lastname', 'lname', 'family_name', 'surname'],
			typeFields: ['type', 'user_type', 'role', 'account_type'],
			gradeFields: ['grade', 'grade_level', 'current_grade', 'gradelevel'],
			studentIdFields: ['student_id', 'studentid', 'id', 'student_number', 'sis_id'],
			classFields: ['class', 'classroom', 'homeroom', 'section'],
			departmentFields: ['department', 'dept', 'division'],
			roleFields: ['role', 'position', 'title', 'job_title'],
			graduationFields: ['graduation_date', 'graduationdate', 'grad_date', 'expected_graduation']
		},
		// Google Classroom
		{
			name: 'Google Classroom',
			emailFields: ['email', 'primary_email', 'google_email'],
			nameFields: ['name', 'full_name', 'display_name'],
			firstNameFields: ['first_name', 'given_name'],
			lastNameFields: ['last_name', 'family_name'],
			typeFields: ['type', 'role', 'user_type'],
			gradeFields: ['grade'],
			studentIdFields: ['student_id', 'id'],
			classFields: ['class_name', 'course_name'],
			departmentFields: ['department'],
			roleFields: ['role'],
			graduationFields: ['graduation_year']
		},
		// Canvas LMS
		{
			name: 'Canvas',
			emailFields: ['email', 'login_id', 'sis_login_id', 'unique_id'],
			nameFields: ['name', 'full_name', 'sortable_name'],
			firstNameFields: ['first_name', 'given_name'],
			lastNameFields: ['last_name', 'family_name'],
			typeFields: ['role', 'enrollment_type'],
			gradeFields: ['grade'],
			studentIdFields: ['user_id', 'sis_user_id', 'student_id'],
			classFields: ['course_id', 'section_name'],
			departmentFields: ['account_name'],
			roleFields: ['role'],
			graduationFields: ['graduation_date']
		},
		// Schoology
		{
			name: 'Schoology',
			emailFields: ['email', 'primary_email'],
			nameFields: ['name', 'display_name'],
			firstNameFields: ['first_name', 'fname'],
			lastNameFields: ['last_name', 'lname'],
			typeFields: ['role', 'user_role'],
			gradeFields: ['grade_level'],
			studentIdFields: ['school_uid', 'user_id'],
			classFields: ['section_title'],
			departmentFields: ['building'],
			roleFields: ['role'],
			graduationFields: ['grad_year']
		},
		// Clever
		{
			name: 'Clever',
			emailFields: ['email', 'student_email', 'teacher_email'],
			nameFields: ['name', 'student_name', 'teacher_name'],
			firstNameFields: ['student_first', 'teacher_first', 'first_name'],
			lastNameFields: ['student_last', 'teacher_last', 'last_name'],
			typeFields: ['role'],
			gradeFields: ['grade'],
			studentIdFields: ['student_id', 'teacher_id', 'clever_id'],
			classFields: ['class_name'],
			departmentFields: ['school_name'],
			roleFields: ['role'],
			graduationFields: ['graduation_year']
		},
		// Infinite Campus
		{
			name: 'Infinite Campus',
			emailFields: ['email', 'contact_email', 'student_email'],
			nameFields: ['name', 'student_name'],
			firstNameFields: ['first_name', 'legal_first_name'],
			lastNameFields: ['last_name', 'legal_last_name'],
			typeFields: ['type'],
			gradeFields: ['grade', 'current_grade'],
			studentIdFields: ['student_id', 'state_id'],
			classFields: ['class'],
			departmentFields: ['school'],
			roleFields: ['role'],
			graduationFields: ['grad_date']
		},
		// Skyward
		{
			name: 'Skyward',
			emailFields: ['email', 'email_address'],
			nameFields: ['name', 'student_name'],
			firstNameFields: ['first_name'],
			lastNameFields: ['last_name'],
			typeFields: ['type'],
			gradeFields: ['grade'],
			studentIdFields: ['student_id'],
			classFields: ['section'],
			departmentFields: ['school'],
			roleFields: ['role'],
			graduationFields: ['graduation_date']
		},
		// Generic/Manual format (fallback)
		{
			name: 'Generic',
			emailFields: ['email', 'email_address', 'e_mail', 'mail'],
			nameFields: ['name', 'full_name', 'fullname'],
			firstNameFields: ['first_name', 'firstname', 'fname', 'first'],
			lastNameFields: ['last_name', 'lastname', 'lname', 'last', 'surname'],
			typeFields: ['type', 'role', 'user_type', 'account_type'],
			gradeFields: ['grade', 'grade_level', 'year', 'class_year'],
			studentIdFields: ['id', 'student_id', 'user_id', 'number'],
			classFields: ['class', 'classroom', 'section', 'homeroom'],
			departmentFields: ['department', 'division', 'school'],
			roleFields: ['role', 'position', 'title'],
			graduationFields: ['graduation_date', 'grad_date', 'graduation_year', 'grad_year']
		}
	];

	/**
	 * Auto-detect the best matching school system format
	 */
	private static detectFormat(headers: string[]): SchoolSystemFormat {
		const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'));
		
		let bestMatch: SchoolSystemFormat = this.SCHOOL_SYSTEM_FORMATS[this.SCHOOL_SYSTEM_FORMATS.length - 1]; // Default to Generic
		let bestScore = 0;

		for (const format of this.SCHOOL_SYSTEM_FORMATS) {
			let score = 0;
			const allFields = [
				...format.emailFields,
				...format.nameFields,
				...format.firstNameFields,
				...format.lastNameFields,
				...format.typeFields,
				...format.gradeFields,
				...format.studentIdFields
			];

			// Count matching fields
			for (const field of allFields) {
				const normalizedField = field.toLowerCase().replace(/[^a-z0-9]/g, '_');
				if (normalizedHeaders.includes(normalizedField)) {
					score++;
				}
			}

			// Bonus points for required fields
			const hasEmail = format.emailFields.some(f => 
				normalizedHeaders.includes(f.toLowerCase().replace(/[^a-z0-9]/g, '_'))
			);
			const hasName = format.nameFields.some(f => 
				normalizedHeaders.includes(f.toLowerCase().replace(/[^a-z0-9]/g, '_'))
			) || (
				format.firstNameFields.some(f => 
					normalizedHeaders.includes(f.toLowerCase().replace(/[^a-z0-9]/g, '_'))
				) && format.lastNameFields.some(f => 
					normalizedHeaders.includes(f.toLowerCase().replace(/[^a-z0-9]/g, '_'))
				)
			);

			if (hasEmail) score += 10;
			if (hasName) score += 10;

			if (score > bestScore) {
				bestScore = score;
				bestMatch = format;
			}
		}

		logger.info(`Auto-detected format: ${bestMatch.name} (score: ${bestScore})`);
		return bestMatch;
	}

	/**
	 * Find the best matching header from a list of possible headers
	 */
	private static findHeader(headers: string[], possibleHeaders: string[]): number {
		const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'));
		
		for (const possible of possibleHeaders) {
			const normalizedPossible = possible.toLowerCase().replace(/[^a-z0-9]/g, '_');
			const index = normalizedHeaders.indexOf(normalizedPossible);
			if (index !== -1) {
				return index;
			}
		}
		
		return -1;
	}
	/**
	 * Parse CSV data from buffer or string with intelligent format detection
	 */
	public static async parseCSV(data: Buffer | string): Promise<CSVStudentRow[]> {
		const csvText = typeof data === 'string' ? data : data.toString('utf-8');
		const lines = csvText.trim().split('\n');
		
		if (lines.length === 0) {
			throw new Error('CSV file is empty');
		}

		// Parse header row
		const headerLine = lines[0];
		const headers = this.parseCSVLine(headerLine).map(h => h.trim());
		
		// Auto-detect the format
		const format = this.detectFormat(headers);
		logger.info(`Using format: ${format.name}`);

		// Find header indices using the detected format
		const emailIndex = this.findHeader(headers, format.emailFields);
		const nameIndex = this.findHeader(headers, format.nameFields);
		const firstNameIndex = this.findHeader(headers, format.firstNameFields);
		const lastNameIndex = this.findHeader(headers, format.lastNameFields);
		const typeIndex = this.findHeader(headers, format.typeFields);
		const gradeIndex = this.findHeader(headers, format.gradeFields);
		const studentIdIndex = this.findHeader(headers, format.studentIdFields);
		const classIndex = this.findHeader(headers, format.classFields);
		const departmentIndex = this.findHeader(headers, format.departmentFields);
		const roleIndex = this.findHeader(headers, format.roleFields);
		const graduationIndex = this.findHeader(headers, format.graduationFields);

		// Validate that we have required fields
		if (emailIndex === -1) {
			throw new Error(`Missing required email field. Expected one of: ${format.emailFields.join(', ')}`);
		}

		// We need either a full name field OR both first and last name
		if (nameIndex === -1 && (firstNameIndex === -1 || lastNameIndex === -1)) {
			throw new Error(`Missing required name field(s). Expected either a full name field (${format.nameFields.join(', ')}) or both first name (${format.firstNameFields.join(', ')}) and last name (${format.lastNameFields.join(', ')}) fields`);
		}

		const rows: CSVStudentRow[] = [];

		// Parse data rows
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue; // Skip empty lines

			const values = this.parseCSVLine(line);
			
			// Build the row object
			const row: CSVStudentRow = {
				email: values[emailIndex]?.trim() || '',
				name: '', // Will be set below
			};

			// Handle name - prefer full name, fallback to first + last
			if (nameIndex !== -1 && values[nameIndex]?.trim()) {
				row.name = values[nameIndex].trim();
			} else if (firstNameIndex !== -1 && lastNameIndex !== -1) {
				const firstName = values[firstNameIndex]?.trim() || '';
				const lastName = values[lastNameIndex]?.trim() || '';
				row.name = `${firstName} ${lastName}`.trim();
				row.firstName = firstName;
				row.lastName = lastName;
			}

			// Optional fields with intelligent mapping
			if (typeIndex !== -1 && values[typeIndex]) {
				const typeValue = values[typeIndex].trim().toLowerCase();
				// Map various role types to our standard types
				if (typeValue.includes('teacher') || typeValue.includes('staff') || typeValue.includes('faculty') || 
					typeValue.includes('instructor') || typeValue.includes('educator') || typeValue === 'teacher' ||
					roleIndex !== -1 && values[roleIndex]?.toLowerCase().includes('teacher')) {
					row.type = 'teacher';
				} else if (typeValue.includes('student') || typeValue.includes('pupil') || typeValue.includes('learner') ||
						   typeValue === 'student') {
					row.type = 'student';
				}
			}

			// Handle role field separately if type wasn't set from type field
			if (!row.type && roleIndex !== -1 && values[roleIndex]) {
				const roleValue = values[roleIndex].trim().toLowerCase();
				if (roleValue.includes('teacher') || roleValue.includes('staff') || roleValue.includes('faculty') || 
					roleValue.includes('instructor') || roleValue.includes('educator')) {
					row.type = 'teacher';
				} else if (roleValue.includes('student') || roleValue.includes('pupil')) {
					row.type = 'student';
				}
			}

			// Set default type if not determined
			if (!row.type) {
				row.type = 'student'; // Default to student
			}

			// Grade level
			if (gradeIndex !== -1 && values[gradeIndex]) {
				row.grade = values[gradeIndex].trim();
			}

			// Student ID
			if (studentIdIndex !== -1 && values[studentIdIndex]) {
				row.studentId = values[studentIdIndex].trim();
			}

			// Class/Section
			if (classIndex !== -1 && values[classIndex]) {
				row.className = values[classIndex].trim();
			}

			// Department
			if (departmentIndex !== -1 && values[departmentIndex]) {
				row.department = values[departmentIndex].trim();
			}

			// Role (for additional context)
			if (roleIndex !== -1 && values[roleIndex]) {
				row.role = values[roleIndex].trim();
			}

			// Graduation date with flexible parsing
			if (graduationIndex !== -1 && values[graduationIndex]) {
				const gradValue = values[graduationIndex].trim();
				// Handle graduation year (just a year) vs full date
				if (/^\d{4}$/.test(gradValue)) {
					// Just a year, assume June graduation
					row.graduationDate = `${gradValue}-06-01`;
				} else {
					row.graduationDate = gradValue;
				}
			}

			rows.push(row);
		}

		logger.info(`Parsed ${rows.length} rows using ${format.name} format`);
		return rows;
	}

	/**
	 * Parse a single CSV line handling quoted values
	 */
	private static parseCSVLine(line: string): string[] {
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

	/**
	 * Validate CSV rows
	 */
	public static async validateRows(rows: CSVStudentRow[], schoolId: string): Promise<ValidationResult> {
		const errors: ImportError[] = [];
		const validRows: CSVStudentRow[] = [];
		const emailSet = new Set<string>();

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const rowNumber = i + 2; // +2 because we skip header and arrays are 0-indexed
			let isValid = true;

			// Validate email
			if (!row.email) {
				errors.push({
					row: rowNumber,
					field: 'email',
					message: 'Email is required',
					data: row,
				});
				isValid = false;
			} else if (!this.isValidEmail(row.email)) {
				errors.push({
					row: rowNumber,
					field: 'email',
					message: 'Invalid email format',
					data: row,
				});
				isValid = false;
			} else if (emailSet.has(row.email.toLowerCase())) {
				errors.push({
					row: rowNumber,
					field: 'email',
					message: 'Duplicate email in CSV',
					data: row,
				});
				isValid = false;
			} else {
				emailSet.add(row.email.toLowerCase());
				
				// Check if user already exists
				const existingUser = await Users.findOne({
					where: { email: row.email.toLowerCase() },
				});
				
				if (existingUser) {
					errors.push({
						row: rowNumber,
						field: 'email',
						message: 'User with this email already exists',
						data: row,
					});
					isValid = false;
				}
			}

			// Validate name
			if (!row.name || row.name.trim().length === 0) {
				errors.push({
					row: rowNumber,
					field: 'name',
					message: 'Name is required',
					data: row,
				});
				isValid = false;
			} else if (row.name.length > 100) {
				errors.push({
					row: rowNumber,
					field: 'name',
					message: 'Name must be 100 characters or less',
					data: row,
				});
				isValid = false;
			}

			// Validate type if provided
			if (row.type && !['student', 'teacher'].includes(row.type)) {
				errors.push({
					row: rowNumber,
					field: 'type',
					message: 'Type must be "student" or "teacher"',
					data: row,
				});
				isValid = false;
			}

			// Validate graduation date if provided
			if (row.graduationDate) {
				const date = new Date(row.graduationDate);
				if (isNaN(date.getTime())) {
					errors.push({
						row: rowNumber,
						field: 'graduationDate',
						message: 'Invalid graduation date format (use YYYY-MM-DD)',
						data: row,
					});
					isValid = false;
				}
			}

			if (isValid) {
				validRows.push(row);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			validRows,
		};
	}

	/**
	 * Process CSV import and create user accounts
	 */
	public static async processImport(
		schoolId: string,
		rows: CSVStudentRow[],
		importedBy: string,
		dryRun: boolean = false
	): Promise<ImportResult> {
		const school = await Schools.findOneBy({ id: schoolId });
		if (!school) {
			throw new Error('School not found');
		}

		// Validate rows first
		const validation = await this.validateRows(rows, schoolId);
		
		let successfulRows = 0;
		let invitationsSent = 0;
		const processErrors: ImportError[] = [...validation.errors];

		if (!dryRun && validation.validRows.length > 0) {
			// Process valid rows
			for (let i = 0; i < validation.validRows.length; i++) {
				const row = validation.validRows[i];
				
				try {
					// Create user account
					const userId = genId();
					const now = new Date();
					const tempPassword = secureRndstr(12, true);
					const hashedPassword = await bcrypt.hash(tempPassword, 10);

					// Generate username from email
					const baseUsername = row.email.split('@')[0];
					let username = baseUsername;
					let counter = 1;
					
					// Ensure username is unique
					while (await Users.findOne({ where: { usernameLower: username.toLowerCase() } })) {
						username = `${baseUsername}${counter}`;
						counter++;
					}

					const user = await Users.save({
						id: userId,
						createdAt: now,
						username,
						usernameLower: username.toLowerCase(),
						name: row.name,
						email: row.email.toLowerCase(),
						isSchoolAdmin: row.type === 'teacher',
						schoolId,
						enrollmentStatus: 'active',
						isAlumni: false,
						billingExempt: row.type === 'teacher', // Teachers are exempt from billing
						graduationDate: row.graduationDate ? new Date(row.graduationDate) : null,
						gradeLevel: row.grade || null, // Save grade level if provided
					});

					// Create user profile
					await UserProfiles.save({
						userId: user.id,
						email: row.email.toLowerCase(),
						emailVerified: false,
						password: hashedPassword,
					});

					// Send invitation email
					await this.sendStudentInvitationEmail(
						row.email,
						row.name,
						school.name,
						tempPassword,
						row.type || 'student'
					);

					successfulRows++;
					invitationsSent++;
				} catch (error: any) {
					processErrors.push({
						row: i + 2, // +2 for header and 0-indexing
						field: 'processing',
						message: `Failed to create account: ${error.message}`,
						data: row,
					});
				}
			}
		} else if (!dryRun) {
			// No valid rows to process
			successfulRows = 0;
		} else {
			// Dry run - count valid rows as successful
			successfulRows = validation.validRows.length;
		}

		// Create import log
		const logId = genId();
		if (!dryRun) {
			await CSVImportLogs.save({
				id: logId,
				schoolId,
				importedBy,
				totalRows: rows.length,
				successfulRows,
				errors: processErrors,
				createdAt: new Date(),
			});
		}

		logger.info(`CSV import ${dryRun ? 'dry run ' : ''}completed for school ${schoolId}: ${successfulRows}/${rows.length} successful`);

		return {
			totalRows: rows.length,
			successfulRows,
			failedRows: rows.length - successfulRows,
			errors: processErrors,
			invitationsSent,
			logId,
		};
	}

	/**
	 * Send invitation email to imported student/teacher
	 */
	private static async sendStudentInvitationEmail(
		email: string,
		name: string,
		schoolName: string,
		tempPassword: string,
		userType: string
	): Promise<void> {
		const loginUrl = `${config.url}`;
		const subject = `Welcome to ${schoolName} on Campra`;
		
		// Extract username from email (part before @)
		const username = email.split('@')[0];
		
		const html = `
			<p>Hello ${name},</p>
			<p>You have been added to <strong>${schoolName}</strong> on Campra as a ${userType}.</p>
			<p>Your account has been created with the following credentials:</p>
			<div style="background: #f5f5f5; padding: 16px; border-radius: 6px; margin: 16px 0;">
				<p><strong>Username:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 3px;">${username}</code></p>
				<p><strong>Temporary Password:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 3px;">${tempPassword}</code></p>
			</div>
			<p><strong>Important:</strong></p>
			<ul>
				<li>Use your <strong>username</strong> (not email) to log in</li>
				<li>Please change your password after your first login for security</li>
			</ul>
			<p><a href="${loginUrl}" style="background: #e84d83; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Sign In to Campra</a></p>
			<p>Or visit: <a href="${loginUrl}">${loginUrl}</a></p>
			<p>Welcome to your campus community!</p>
		`;

		const text = `
Hello ${name},

You have been added to ${schoolName} on Campra as a ${userType}.

Your account has been created with the following credentials:
Username: ${username}
Temporary Password: ${tempPassword}

Important:
- Use your username (not email) to log in
- Please change your password after your first login for security

Sign in at: ${loginUrl}

Welcome to your campus community!
		`;

		await sendEmail(email, subject, html, text);
	}

	/**
	 * Get import history for a school
	 */
	public static async getImportHistory(schoolId: string, limit: number = 10): Promise<CSVImportLog[]> {
		return await CSVImportLogs.find({
			where: { schoolId },
			order: { createdAt: 'DESC' },
			take: limit,
		});
	}

	/**
	 * Get import log by ID
	 */
	public static async getImportLog(logId: string): Promise<CSVImportLog | null> {
		return await CSVImportLogs.findOneBy({ id: logId });
	}

	/**
	 * Simple email validation
	 */
	private static isValidEmail(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}

	/**
	 * Preview CSV data (first N rows) with format detection
	 */
	public static async previewCSV(data: Buffer | string, maxRows: number = 5): Promise<{
		headers: string[];
		detectedFormat: string;
		rows: CSVStudentRow[];
		totalRows: number;
		supportedFields: string[];
	}> {
		const csvText = typeof data === 'string' ? data : data.toString('utf-8');
		const lines = csvText.trim().split('\n');
		
		if (lines.length === 0) {
			throw new Error('CSV file is empty');
		}

		// Parse headers and detect format
		const headerLine = lines[0];
		const headers = this.parseCSVLine(headerLine).map(h => h.trim());
		const format = this.detectFormat(headers);
		
		// Parse all rows for accurate count, but only return preview
		const allRows = await this.parseCSV(data);
		const previewRows = allRows.slice(0, maxRows);
		
		// Determine which fields are supported based on detected format
		const supportedFields: string[] = [];
		if (this.findHeader(headers, format.emailFields) !== -1) supportedFields.push('email');
		if (this.findHeader(headers, format.nameFields) !== -1 || 
			(this.findHeader(headers, format.firstNameFields) !== -1 && this.findHeader(headers, format.lastNameFields) !== -1)) {
			supportedFields.push('name');
		}
		if (this.findHeader(headers, format.typeFields) !== -1 || this.findHeader(headers, format.roleFields) !== -1) supportedFields.push('type');
		if (this.findHeader(headers, format.gradeFields) !== -1) supportedFields.push('grade');
		if (this.findHeader(headers, format.studentIdFields) !== -1) supportedFields.push('studentId');
		if (this.findHeader(headers, format.classFields) !== -1) supportedFields.push('className');
		if (this.findHeader(headers, format.departmentFields) !== -1) supportedFields.push('department');
		if (this.findHeader(headers, format.graduationFields) !== -1) supportedFields.push('graduationDate');
		
		return {
			headers,
			detectedFormat: format.name,
			rows: previewRows,
			totalRows: allRows.length,
			supportedFields,
		};
	}

	/**
	 * Validate CSV format without processing - with detailed format analysis
	 */
	public static async validateCSVFormat(data: Buffer | string): Promise<{
		valid: boolean;
		errors: string[];
		warnings: string[];
		rowCount: number;
		detectedFormat: string;
		supportedFields: string[];
		missingFields: string[];
	}> {
		try {
			const csvText = typeof data === 'string' ? data : data.toString('utf-8');
			const lines = csvText.trim().split('\n');
			
			if (lines.length === 0) {
				return {
					valid: false,
					errors: ['CSV file is empty'],
					warnings: [],
					rowCount: 0,
					detectedFormat: 'Unknown',
					supportedFields: [],
					missingFields: ['email', 'name'],
				};
			}

			const headerLine = lines[0];
			const headers = this.parseCSVLine(headerLine).map(h => h.trim());
			const format = this.detectFormat(headers);
			
			// Check for required fields
			const hasEmail = this.findHeader(headers, format.emailFields) !== -1;
			const hasName = this.findHeader(headers, format.nameFields) !== -1 || 
				(this.findHeader(headers, format.firstNameFields) !== -1 && this.findHeader(headers, format.lastNameFields) !== -1);
			
			const errors: string[] = [];
			const warnings: string[] = [];
			const supportedFields: string[] = [];
			const missingFields: string[] = [];

			if (!hasEmail) {
				errors.push(`Missing required email field. Expected one of: ${format.emailFields.join(', ')}`);
				missingFields.push('email');
			} else {
				supportedFields.push('email');
			}

			if (!hasName) {
				errors.push(`Missing required name field(s). Expected either a full name or both first and last name fields`);
				missingFields.push('name');
			} else {
				supportedFields.push('name');
			}

			// Check for optional fields and add warnings for commonly expected fields
			if (this.findHeader(headers, format.typeFields) !== -1 || this.findHeader(headers, format.roleFields) !== -1) {
				supportedFields.push('type');
			} else {
				warnings.push('No user type/role field detected. All users will be imported as students by default.');
			}

			if (this.findHeader(headers, format.gradeFields) !== -1) supportedFields.push('grade');
			if (this.findHeader(headers, format.studentIdFields) !== -1) supportedFields.push('studentId');
			if (this.findHeader(headers, format.classFields) !== -1) supportedFields.push('className');
			if (this.findHeader(headers, format.departmentFields) !== -1) supportedFields.push('department');
			if (this.findHeader(headers, format.graduationFields) !== -1) supportedFields.push('graduationDate');

			// Try to parse to get accurate row count
			const rows = await this.parseCSV(data);
			
			return {
				valid: errors.length === 0,
				errors,
				warnings,
				rowCount: rows.length,
				detectedFormat: format.name,
				supportedFields,
				missingFields,
			};
		} catch (error: any) {
			return {
				valid: false,
				errors: [error.message],
				warnings: [],
				rowCount: 0,
				detectedFormat: 'Unknown',
				supportedFields: [],
				missingFields: ['email', 'name'],
			};
		}
	}
}
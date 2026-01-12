import { Users } from '@/models/index.js';
import Logger from '@/services/logger.js';

const logger = new Logger('username-validator');

export interface UsernameValidationResult {
	isValid: boolean;
	reason?: string;
	suggestions?: string[];
}

export class UsernameValidator {
	/**
	 * Validate that a username is a reasonable variation of the user's real name
	 */
	static async validateUsernameAgainstName(username: string, realName: string, userId?: string): Promise<UsernameValidationResult> {
		// Skip validation if no real name provided
		if (!realName || !realName.trim()) {
			return {
				isValid: true, // Allow any username if we don't have a real name to compare against
			};
		}

		// Clean and normalize inputs
		const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
		const cleanName = realName.toLowerCase().replace(/[^a-z\s]/g, '');
		
		if (cleanUsername.length < 2) {
			return {
				isValid: false,
				reason: 'Username is too short',
			};
		}

		// Extract name components
		const nameWords = cleanName.split(/\s+/).filter(word => word.length > 1);
		
		if (nameWords.length === 0) {
			return {
				isValid: true, // Allow any username if name is unclear
			};
		}

		// Check various valid patterns
		const validPatterns = this.generateValidUsernamePatterns(nameWords);
		
		// Check if username matches any valid pattern
		const isValid = validPatterns.some(pattern => {
			const regex = new RegExp(pattern, 'i');
			return regex.test(cleanUsername);
		});

		if (isValid) {
			return { isValid: true };
		}

		// Generate suggestions
		const suggestions = await this.generateUsernameSuggestions(nameWords, userId);

		return {
			isValid: false,
			reason: 'Username should be a variation of your real name',
			suggestions,
		};
	}

	/**
	 * Generate valid regex patterns for usernames based on name components
	 */
	private static generateValidUsernamePatterns(nameWords: string[]): string[] {
		const patterns: string[] = [];
		
		if (nameWords.length >= 1) {
			const firstName = nameWords[0];
			const lastName = nameWords[nameWords.length - 1];
			
			// Full first name variations
			patterns.push(`^${firstName}\\d*$`); // john, john123
			patterns.push(`^${firstName}[a-z]*\\d*$`); // johnsmith, johnsmth2
			
			if (nameWords.length >= 2) {
				// First + Last combinations
				patterns.push(`^${firstName}${lastName}\\d*$`); // johnsmith
				patterns.push(`^${firstName}\\.?${lastName}\\d*$`); // john.smith
				patterns.push(`^${firstName}[_-]${lastName}\\d*$`); // john_smith, john-smith
				
				// First initial + last name
				patterns.push(`^${firstName.charAt(0)}${lastName}\\d*$`); // jsmith
				patterns.push(`^${firstName.charAt(0)}\\.?${lastName}\\d*$`); // j.smith
				
				// Last name + first initial
				patterns.push(`^${lastName}${firstName.charAt(0)}\\d*$`); // smithj
				
				// First name + last initial
				patterns.push(`^${firstName}${lastName.charAt(0)}\\d*$`); // johns
			}
			
			// Handle initials for longer names
			if (nameWords.length >= 3) {
				const initials = nameWords.map(word => word.charAt(0)).join('');
				patterns.push(`^${initials}\\d*$`); // jjs for John J Smith
			}
		}
		
		return patterns;
	}

	/**
	 * Generate username suggestions based on real name
	 */
	private static async generateUsernameSuggestions(nameWords: string[], excludeUserId?: string): Promise<string[]> {
		const suggestions: string[] = [];
		
		if (nameWords.length === 0) return suggestions;
		
		const firstName = nameWords[0];
		const lastName = nameWords.length > 1 ? nameWords[nameWords.length - 1] : '';
		
		// Generate base suggestions
		const baseSuggestions = [
			firstName,
			lastName ? `${firstName}${lastName}` : null,
			lastName ? `${firstName}.${lastName}` : null,
			lastName ? `${firstName}_${lastName}` : null,
			lastName ? `${firstName.charAt(0)}${lastName}` : null,
			lastName ? `${firstName}${lastName.charAt(0)}` : null,
		].filter(Boolean) as string[];
		
		// Check availability and add numbers if needed
		for (const baseSuggestion of baseSuggestions) {
			const cleanSuggestion = baseSuggestion.toLowerCase().replace(/[^a-z0-9._]/g, '');
			
			if (suggestions.length >= 5) break; // Limit suggestions
			
			// Try base suggestion first
			if (await this.isUsernameAvailable(cleanSuggestion, excludeUserId)) {
				suggestions.push(cleanSuggestion);
				continue;
			}
			
			// Try with numbers
			for (let i = 1; i <= 99; i++) {
				const numberedSuggestion = `${cleanSuggestion}${i}`;
				if (await this.isUsernameAvailable(numberedSuggestion, excludeUserId)) {
					suggestions.push(numberedSuggestion);
					break;
				}
			}
		}
		
		return suggestions.slice(0, 5); // Return max 5 suggestions
	}

	/**
	 * Check if a username is available
	 */
	private static async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
		try {
			const query = Users.createQueryBuilder('user')
				.where('user.usernameLower = :username', { username: username.toLowerCase() })
				.andWhere('user.host IS NULL'); // Only check local users
			
			if (excludeUserId) {
				query.andWhere('user.id != :excludeUserId', { excludeUserId });
			}
			
			const existingUser = await query.getOne();
			return !existingUser;
		} catch (error) {
			logger.error('Failed to check username availability:', { error: error instanceof Error ? error.message : String(error) });
			return false;
		}
	}

	/**
	 * Check if a user is allowed to bypass username validation
	 * (School admins can override this for special cases)
	 */
	static async canBypassValidation(userId: string, adminUserId: string): Promise<boolean> {
		try {
			const [user, admin] = await Promise.all([
				Users.findOneBy({ id: userId }),
				Users.findOneBy({ id: adminUserId }),
			]);

			if (!user || !admin) return false;

			// Admin can bypass for users in their school
			return admin.isSchoolAdmin && 
				   admin.adminForSchoolId === user.schoolId;
		} catch (error) {
			logger.error('Failed to check bypass permissions:', { error: error instanceof Error ? error.message : String(error) });
			return false;
		}
	}

	/**
	 * Validate username format (basic checks)
	 */
	static validateUsernameFormat(username: string): UsernameValidationResult {
		// Basic format validation
		if (!username || username.length < 1) {
			return {
				isValid: false,
				reason: 'Username is required',
			};
		}

		if (username.length > 32) {
			return {
				isValid: false,
				reason: 'Username is too long (max 32 characters)',
			};
		}

		if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
			return {
				isValid: false,
				reason: 'Username can only contain letters, numbers, dots, underscores, and hyphens',
			};
		}

		if (username.startsWith('.') || username.endsWith('.') || 
			username.startsWith('_') || username.endsWith('_') ||
			username.startsWith('-') || username.endsWith('-')) {
			return {
				isValid: false,
				reason: 'Username cannot start or end with dots, underscores, or hyphens',
			};
		}

		// Check for reserved words
		const reservedWords = [
			'admin', 'administrator', 'root', 'system', 'api', 'www', 'mail', 'email',
			'support', 'help', 'about', 'contact', 'terms', 'privacy', 'legal',
			'campra', 'avunite', 'moderator', 'staff', 'teacher', 'student',
		];

		if (reservedWords.includes(username.toLowerCase())) {
			return {
				isValid: false,
				reason: 'Username is reserved and cannot be used',
			};
		}

		return { isValid: true };
	}
}

export default UsernameValidator;

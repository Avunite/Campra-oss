/**
 * LMS Student data structure
 */
export interface LMSStudent {
    externalId: string;
    email: string;
    firstName: string;
    lastName: string;
    graduationDate?: Date;
    graduationYear?: number;
    gradeLevel?: string;
    enrollmentStatus?: string;
}

/**
 * LMS Credentials structure
 */
export interface LMSCredentials {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
}

/**
 * Base abstract class for all LMS adapters
 */
export abstract class BaseLMSAdapter {
    constructor(
        protected apiUrl: string,
        protected credentials: LMSCredentials,
    ) { }

    /**
     * Get OAuth authorization URL
     */
    abstract getAuthorizationUrl(redirectUri: string, state: string): string;

    /**
     * Exchange authorization code for access token
     */
    abstract exchangeCodeForToken(code: string, redirectUri: string): Promise<LMSCredentials>;

    /**
     * Refresh expired access token
     */
    abstract refreshAccessToken(): Promise<LMSCredentials>;

    /**
     * Test connection to LMS
     */
    abstract testConnection(): Promise<boolean>;

    /**
     * Fetch all students from LMS
     */
    abstract fetchStudents(): Promise<LMSStudent[]>;

    /**
     * Fetch a single student by external ID
     */
    abstract fetchStudentById(externalId: string): Promise<LMSStudent>;

    /**
     * Fetch a student by email address (for validation during signup)
     */
    abstract fetchStudentByEmail(email: string): Promise<LMSStudent | null>;

    /**
     * Make an authenticated request to the LMS API
     */
    protected abstract makeAuthenticatedRequest(endpoint: string, options?: RequestInit): Promise<any>;

    /**
     * Get current credentials (useful for persisting refreshed tokens)
     */
    getCredentials(): LMSCredentials {
        return this.credentials;
    }
}

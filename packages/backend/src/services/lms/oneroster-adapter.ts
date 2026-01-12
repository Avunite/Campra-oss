import { BaseLMSAdapter, type LMSStudent, type LMSCredentials } from './base-adapter.js';
import Logger from '../logger.js';

const logger = new Logger('oneroster-adapter');

/**
 * Generic OneRoster 1.1 adapter for LMS platforms that support the standard
 */
export class OneRosterAdapter extends BaseLMSAdapter {
    /**
     * OneRoster typically uses OAuth 2.0
     */
    getAuthorizationUrl(redirectUri: string, state: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.credentials.clientId,
            redirect_uri: redirectUri,
            state: state,
            scope: 'roster.readonly', // OneRoster standard scope
        });
        return `${this.apiUrl}/oauth2/authorize?${params}`;
    }

    async exchangeCodeForToken(code: string, redirectUri: string): Promise<LMSCredentials> {
        const response = await fetch(`${this.apiUrl}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
                client_id: this.credentials.clientId,
                client_secret: this.credentials.clientSecret,
            }),
        });

        if (!response.ok) {
            throw new Error(`OneRoster token exchange failed: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            ...this.credentials,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
        };
    }

    async refreshAccessToken(): Promise<LMSCredentials> {
        if (!this.credentials.refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await fetch(`${this.apiUrl}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: this.credentials.refreshToken,
                client_id: this.credentials.clientId,
                client_secret: this.credentials.clientSecret,
            }),
        });

        if (!response.ok) {
            throw new Error(`OneRoster token refresh failed: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            ...this.credentials,
            accessToken: data.access_token,
            refreshToken: data.refresh_token || this.credentials.refreshToken,
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
        };
    }

    async testConnection(): Promise<boolean> {
        try {
            // Test by fetching a single student (limit=1)
            await this.makeAuthenticatedRequest('/ims/oneroster/v1p1/students?limit=1');
            return true;
        } catch (error) {
            logger.error('OneRoster connection test failed:', error);
            return false;
        }
    }

    async fetchStudents(): Promise<LMSStudent[]> {
        const response = await this.makeAuthenticatedRequest('/ims/oneroster/v1p1/students');

        if (!response.students || !Array.isArray(response.students)) {
            return [];
        }

        return response.students.map((student: any) => this.mapOneRosterStudent(student));
    }

    async fetchStudentById(externalId: string): Promise<LMSStudent> {
        const response = await this.makeAuthenticatedRequest(`/ims/oneroster/v1p1/students/${externalId}`);

        if (!response.student) {
            throw new Error(`Student ${externalId} not found`);
        }

        return this.mapOneRosterStudent(response.student);
    }

    async fetchStudentByEmail(email: string): Promise<LMSStudent | null> {
        try {
            // OneRoster filter syntax: filter=email='email@domain.com'
            const filterParam = encodeURIComponent(`email='${email}'`);
            const response = await this.makeAuthenticatedRequest(
                `/ims/oneroster/v1p1/students?filter=${filterParam}`
            );

            if (!response.students || response.students.length === 0) {
                return null;
            }

            return this.mapOneRosterStudent(response.students[0]);
        } catch (error) {
            logger.error(`Error fetching student by email ${email}:`, error);
            return null;
        }
    }

    protected async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
        // EDGE CASE FIX #9: Check if token is expired and refresh if needed
        if (this.credentials.expiresAt && this.credentials.expiresAt <= new Date()) {
            logger.info('Access token expired, refreshing...');
            try {
                const newCredentials = await this.refreshAccessToken();
                this.credentials = newCredentials;
                // Note: Caller should persist new credentials to database
                logger.info('Access token refreshed successfully');
            } catch (error) {
                logger.error('Failed to refresh access token:', error);
                throw new Error('LMS_TOKEN_EXPIRED');
            }
        }

        const response = await fetch(`${this.apiUrl}${endpoint}`, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${this.credentials.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        // Handle 401 Unauthorized - token might have expired mid-flight
        if (response.status === 401 && this.credentials.refreshToken) {
            logger.warn('Received 401, attempting token refresh...');
            try {
                const newCredentials = await this.refreshAccessToken();
                this.credentials = newCredentials;

                // Retry the original request with new token
                const retryResponse = await fetch(`${this.apiUrl}${endpoint}`, {
                    ...options,
                    headers: {
                        ...options.headers,
                        'Authorization': `Bearer ${newCredentials.accessToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                });

                if (!retryResponse.ok) {
                    throw new Error(`OneRoster API error: ${retryResponse.status} ${retryResponse.statusText}`);
                }

                return retryResponse.json();
            } catch (error) {
                logger.error('Token refresh retry failed:', error);
                throw new Error('LMS_TOKEN_EXPIRED');
            }
        }

        if (!response.ok) {
            throw new Error(`OneRoster API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Map OneRoster student format to our LMSStudent interface
     */
    private mapOneRosterStudent(student: any): LMSStudent {
        return {
            externalId: student.sourcedId,
            email: student.email,
            firstName: student.givenName,
            lastName: student.familyName,
            gradeLevel: student.grades?.join(', '), // OneRoster supports multiple grades
            enrollmentStatus: student.status === 'active' ? 'active' : 'inactive',
            // OneRoster doesn't typically include graduation date in student object
            // May need to fetch from demographics or custom fields
        };
    }
}

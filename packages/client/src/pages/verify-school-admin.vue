<template>
<MkSpacer :content-max="500" :margin-min="16" :margin-max="32">
	<div class="school-admin-verification">
		<div class="verification-container">
			<!-- Header -->
			<div class="header">
				<div class="logo">
					<i class="ph-graduation-cap ph-lg"></i>
				</div>
				<h1>{{ i18n.ts.schoolAdminVerification || 'School Admin Verification' }}</h1>
				<p class="subtitle">{{ i18n.ts.verifyAccountToAccess || 'Verify your account to access school administration' }}</p>
			</div>

			<!-- Loading State -->
			<div v-if="loading" class="loading-state">
				<MkLoading/>
				<p>{{ i18n.ts.verifyingToken || 'Verifying your account...' }}</p>
			</div>

			<!-- Error State -->
			<div v-else-if="error" class="error-state">
				<div class="error-content">
					<i class="ph-warning-circle ph-lg error-icon"></i>
					<h3>{{ i18n.ts.verificationFailed || 'Verification Failed' }}</h3>
					<p class="error-message">{{ error }}</p>
					
					<div v-if="isTokenExpired" class="expired-help">
						<p>{{ i18n.ts.tokenExpiredHelp || 'Your verification link has expired. Please contact your platform administrator to resend the verification email.' }}</p>
					</div>
					
					<div class="error-actions">
						<MkButton @click="retryVerification" v-if="!isTokenExpired">
							<i class="ph-arrow-clockwise ph-lg"></i>
							{{ i18n.ts.retry || 'Try Again' }}
						</MkButton>
						<MkButton @click="goHome">
							<i class="ph-house ph-lg"></i>
							{{ i18n.ts.goToHome || 'Go to Home' }}
						</MkButton>
					</div>
				</div>
			</div>

			<!-- Success State -->
			<div v-else-if="verificationSuccess" class="success-state">
				<div class="success-content">
					<i class="ph-check-circle ph-lg success-icon"></i>
					<h3>{{ i18n.ts.verificationComplete || 'Verification Complete!' }}</h3>
					<p>{{ i18n.ts.accountVerifiedSuccess || 'Your school administrator account has been verified successfully.' }}</p>
					
					<div v-if="schoolInfo" class="school-info">
						<div class="school-card">
							<div class="school-details">
								<h4>{{ schoolInfo.name }}</h4>
								<p class="school-domain">{{ schoolInfo.domain }}</p>
								<p v-if="schoolInfo.location" class="school-location">{{ schoolInfo.location }}</p>
							</div>
						</div>
					</div>
					
					<div class="success-actions">
						<MkButton @click="goToDashboard" primary>
							<i class="ph-gauge ph-lg"></i>
							{{ i18n.ts.goToAdminDashboard || 'Go to Admin Dashboard' }}
						</MkButton>
					</div>
				</div>
			</div>

			<!-- Password Setup Form -->
			<div v-else-if="needsPasswordSetup" class="password-setup">
				<div class="form-content">
					<h3>{{ i18n.ts.setPassword || 'Set Your Password' }}</h3>
					<p>{{ i18n.ts.setPasswordDescription || 'Create a secure password for your school administrator account.' }}</p>
					
					<form @submit.prevent="setupPassword" class="password-form">
						<div class="form-group">
							<MkInput 
								v-model="passwordForm.name" 
								type="text" 
								:placeholder="i18n.ts.name || 'Full Name'"
								required
								autocomplete="name"
							>
								<template #label>{{ i18n.ts.name || 'Full Name' }}</template>
								<template #caption>{{ i18n.ts.nameForAccount || 'Your full name for the administrator account' }}</template>
							</MkInput>
						</div>
						
						<div class="form-group">
							<MkInput 
								v-model="passwordForm.password" 
								type="password" 
								:placeholder="i18n.ts.password || 'Password'"
								required
								autocomplete="new-password"
							>
								<template #label>{{ i18n.ts.password || 'Password' }}</template>
								<template #caption>{{ i18n.ts.passwordRequirements || 'At least 8 characters with letters and numbers' }}</template>
							</MkInput>
						</div>
						
						<div class="form-group">
							<MkInput 
								v-model="passwordForm.confirmPassword" 
								type="password" 
								:placeholder="i18n.ts.confirmPassword || 'Confirm Password'"
								required
								autocomplete="new-password"
							>
								<template #label>{{ i18n.ts.confirmPassword || 'Confirm Password' }}</template>
							</MkInput>
						</div>
						
						<div v-if="passwordError" class="password-error">
							<i class="ph-warning ph-lg"></i>
							{{ passwordError }}
						</div>
						
						<div class="form-actions">
							<MkButton type="submit" :disabled="!canSubmitPassword || submittingPassword" primary full>
								<i v-if="submittingPassword" class="ph-spinner ph-lg fa-spin"></i>
								<i v-else class="ph-check ph-lg"></i>
								{{ submittingPassword ? (i18n.ts.settingPassword || 'Setting password...') : (i18n.ts.verifyAccount || 'Verify Account') }}
							</MkButton>
						</div>
					</form>
				</div>
			</div>

			<!-- Already Verified State -->
			<div v-else-if="alreadyVerified" class="already-verified">
				<div class="already-verified-content">
					<i class="ph-check-circle ph-lg success-icon"></i>
					<h3>{{ i18n.ts.alreadyVerified || 'Already Verified' }}</h3>
					<p>{{ i18n.ts.accountAlreadyVerified || 'This account has already been verified.' }}</p>
					
					<div class="already-verified-actions">
						<MkButton @click="goToDashboard" primary>
							<i class="ph-gauge ph-lg"></i>
							{{ i18n.ts.goToAdminDashboard || 'Go to Admin Dashboard' }}
						</MkButton>
						<MkButton @click="goHome">
							<i class="ph-house ph-lg"></i>
							{{ i18n.ts.goToHome || 'Go to Home' }}
						</MkButton>
					</div>
				</div>
			</div>
		</div>
	</div>
</MkSpacer>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/form/input.vue';
import MkLoading from '@/components/MkLoading.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { useRouter } from '@/router';
import { login } from '@/account';

const router = useRouter();

const loading = ref(true);
const error = ref('');
const verificationSuccess = ref(false);
const needsPasswordSetup = ref(false);
const alreadyVerified = ref(false);
const isTokenExpired = ref(false);
const submittingPassword = ref(false);
const passwordError = ref('');

const schoolInfo = ref(null);
const verificationData = ref(null);

const passwordForm = ref({
	name: '',
	password: '',
	confirmPassword: ''
});

const canSubmitPassword = computed(() => {
	return passwordForm.value.name.trim().length >= 1 &&
		   passwordForm.value.password.length >= 8 &&
		   passwordForm.value.confirmPassword.length >= 8 &&
		   passwordForm.value.password === passwordForm.value.confirmPassword &&
		   isValidPassword(passwordForm.value.password);
});

function isValidPassword(password: string): boolean {
	// At least 8 characters, contains letters and numbers
	const hasLetter = /[a-zA-Z]/.test(password);
	const hasNumber = /\d/.test(password);
	return password.length >= 8 && hasLetter && hasNumber;
}

async function verifyToken() {
	const token = router.currentRoute.value.params.token as string;
	
	if (!token) {
		error.value = i18n.ts.invalidVerificationLink || 'Invalid verification link';
		loading.value = false;
		return;
	}
	
	loading.value = true;
	error.value = '';
	
	try {
		const result = await os.api('schools/verify-admin', {
			token: token
		});
		
		if (result.alreadyVerified) {
			alreadyVerified.value = true;
			schoolInfo.value = result.school;
		} else if (result.needsPasswordSetup) {
			needsPasswordSetup.value = true;
			verificationData.value = result;
			schoolInfo.value = result.school;
		} else {
			verificationSuccess.value = true;
			schoolInfo.value = result.school;
		}
		
	} catch (err) {
		console.error('Verification failed:', err);
		error.value = (err as any)?.message || i18n.ts.verificationFailed || 'Verification failed';
		
		// Check if token is expired
		if ((err as any)?.id === 'verification-expired' || (err as any)?.message?.includes('expired')) {
			isTokenExpired.value = true;
		}
	} finally {
		loading.value = false;
	}
}

async function setupPassword() {
	if (!canSubmitPassword.value || submittingPassword.value) return;
	
	passwordError.value = '';
	submittingPassword.value = true;
	
	try {
		const token = router.currentRoute.value.params.token as string;
		
		const result = await os.api('schools/verify-admin', {
			token: token,
			password: passwordForm.value.password,
			name: passwordForm.value.name.trim()
		});
		
		verificationSuccess.value = true;
		needsPasswordSetup.value = false;
		schoolInfo.value = result.school;
		
		// Auto-login the user
		if (result.token) {
			await login(result.token, '/school-admin/dashboard');
		}
		
	} catch (err) {
		console.error('Password setup failed:', err);
		passwordError.value = (err as any)?.message || i18n.ts.passwordSetupFailed || 'Failed to set password';
	} finally {
		submittingPassword.value = false;
	}
}

function retryVerification() {
	verifyToken();
}

function goHome() {
	router.push('/');
}

function goToDashboard() {
	router.push('/school-admin/dashboard');
}

onMounted(() => {
	verifyToken();
});

definePageMetadata({
	title: i18n.ts.schoolAdminVerification || 'School Admin Verification',
	icon: 'ph-graduation-cap ph-lg',
});
</script>

<style lang="scss" scoped>
.school-admin-verification {
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--bg);
	
	.verification-container {
		width: 100%;
		max-width: 500px;
		background: var(--panel);
		border-radius: 16px;
		padding: 40px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
		
		.header {
			text-align: center;
			margin-bottom: 32px;
			
			.logo {
				width: 80px;
				height: 80px;
				background: var(--accent);
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				margin: 0 auto 24px;
				
				i {
					font-size: 40px;
					color: white;
				}
			}
			
			h1 {
				margin: 0 0 12px 0;
				font-size: 1.8em;
				font-weight: 600;
			}
			
			.subtitle {
				margin: 0;
				opacity: 0.7;
				font-size: 1em;
				line-height: 1.4;
			}
		}
		
		.loading-state {
			text-align: center;
			padding: 40px 20px;
			
			p {
				margin: 16px 0 0 0;
				opacity: 0.7;
			}
		}
		
		.error-state {
			text-align: center;
			
			.error-content {
				.error-icon {
					font-size: 48px;
					color: var(--error);
					margin-bottom: 16px;
				}
				
				h3 {
					margin: 0 0 12px 0;
					color: var(--error);
				}
				
				.error-message {
					margin: 0 0 20px 0;
					opacity: 0.8;
				}
				
				.expired-help {
					background: var(--warnBg);
					padding: 16px;
					border-radius: 8px;
					margin-bottom: 20px;
					
					p {
						margin: 0;
						color: var(--warn);
						font-size: 0.9em;
						line-height: 1.4;
					}
				}
				
				.error-actions {
					display: flex;
					gap: 12px;
					justify-content: center;
					flex-wrap: wrap;
				}
			}
		}
		
		.success-state {
			text-align: center;
			
			.success-content {
				.success-icon {
					font-size: 48px;
					color: var(--success);
					margin-bottom: 16px;
				}
				
				h3 {
					margin: 0 0 12px 0;
					color: var(--success);
				}
				
				p {
					margin: 0 0 24px 0;
					opacity: 0.8;
					line-height: 1.4;
				}
				
				.school-info {
					margin-bottom: 24px;
					
					.school-card {
						background: var(--bg);
						padding: 20px;
						border-radius: 12px;
						border: 1px solid var(--divider);
						
						.school-details {
							h4 {
								margin: 0 0 8px 0;
								font-size: 1.2em;
								font-weight: 600;
							}
							
							.school-domain {
								margin: 0 0 4px 0;
								color: var(--accent);
								font-family: monospace;
								font-size: 0.9em;
							}
							
							.school-location {
								margin: 0;
								opacity: 0.7;
								font-size: 0.9em;
							}
						}
					}
				}
				
				.success-actions {
					display: flex;
					gap: 12px;
					justify-content: center;
					flex-wrap: wrap;
				}
			}
		}
		
		.password-setup {
			.form-content {
				h3 {
					margin: 0 0 12px 0;
					font-size: 1.3em;
					font-weight: 600;
					text-align: center;
				}
				
				p {
					margin: 0 0 24px 0;
					opacity: 0.7;
					text-align: center;
					line-height: 1.4;
				}
				
				.password-form {
					.form-group {
						margin-bottom: 20px;
					}
					
					.password-error {
						background: var(--errorBg);
						color: var(--error);
						padding: 12px;
						border-radius: 8px;
						margin-bottom: 20px;
						display: flex;
						align-items: center;
						gap: 8px;
						font-size: 0.9em;
					}
					
					.form-actions {
						margin-top: 24px;
					}
				}
			}
		}
		
		.already-verified {
			text-align: center;
			
			.already-verified-content {
				.success-icon {
					font-size: 48px;
					color: var(--success);
					margin-bottom: 16px;
				}
				
				h3 {
					margin: 0 0 12px 0;
					color: var(--success);
				}
				
				p {
					margin: 0 0 24px 0;
					opacity: 0.8;
					line-height: 1.4;
				}
				
				.already-verified-actions {
					display: flex;
					gap: 12px;
					justify-content: center;
					flex-wrap: wrap;
				}
			}
		}
	}
}

@media (max-width: 768px) {
	.school-admin-verification {
		padding: 16px;
		
		.verification-container {
			padding: 24px;
			
			.header {
				.logo {
					width: 60px;
					height: 60px;
					
					i {
						font-size: 30px;
					}
				}
				
				h1 {
					font-size: 1.5em;
				}
			}
			
			.success-state,
			.error-state,
			.already-verified {
				.success-actions,
				.error-actions,
				.already-verified-actions {
					flex-direction: column;
				}
			}
		}
	}
}
</style>
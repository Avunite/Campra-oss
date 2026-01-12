<template>
<MkModal ref="modal" :z-priority="'high'" @click="modal.close()" @closed="$emit('closed')">
	<div class="forced-password-change-modal">
		<div class="modal-content" @click.stop>
			<div class="header">
				<div class="icon">
					<i class="ph-lock-key ph-lg"></i>
				</div>
				<h1>{{ i18n.ts.passwordChangeRequired || 'Password Change Required' }}</h1>
				<p class="subtitle">
					{{ i18n.ts.passwordChangeRequiredDescription || 'For security reasons, you must change your password before continuing.' }}
				</p>
			</div>

			<form @submit.prevent="changePassword" class="password-form">
				<div class="form-group">
					<MkInput 
						ref="currentPasswordInput"
						v-model="currentPassword" 
						type="password" 
						:placeholder="i18n.ts.currentPassword || 'Current Password'"
						required
						autocomplete="current-password"
						:disabled="submitting"
					>
						<template #label>{{ i18n.ts.currentPassword || 'Current Password' }}</template>
						<template #caption>{{ i18n.ts.enterCurrentPassword || 'Enter your current temporary password' }}</template>
					</MkInput>
				</div>
				
				<div class="form-group">
					<MkInput 
						v-model="newPassword" 
						type="password" 
						:placeholder="i18n.ts.newPassword || 'New Password'"
						required
						autocomplete="new-password"
						:disabled="submitting"
					>
						<template #label>{{ i18n.ts.newPassword || 'New Password' }}</template>
						<template #caption>{{ i18n.ts.passwordRequirements || 'At least 8 characters with letters and numbers' }}</template>
					</MkInput>
				</div>
				
				<div class="form-group">
					<MkInput 
						v-model="confirmPassword" 
						type="password" 
						:placeholder="i18n.ts.confirmPassword || 'Confirm New Password'"
						required
						autocomplete="new-password"
						:disabled="submitting"
					>
						<template #label>{{ i18n.ts.confirmPassword || 'Confirm New Password' }}</template>
					</MkInput>
				</div>

				<div class="password-strength" v-if="newPassword">
					<div class="strength-bar">
						<div class="strength-fill" :class="passwordStrengthClass" :style="{ width: passwordStrength + '%' }"></div>
					</div>
					<p class="strength-text" :class="passwordStrengthClass">
						{{ passwordStrengthText }}
					</p>
				</div>
				
				<div v-if="error" class="error-message">
					<i class="ph-warning ph-lg"></i>
					{{ error }}
				</div>
				
				<div class="form-actions">
					<MkButton 
						type="submit" 
						:disabled="!canSubmit || submitting" 
						primary 
						full
						gradate
					>
						<i v-if="submitting" class="ph-spinner ph-lg fa-spin"></i>
						<i v-else class="ph-check ph-lg"></i>
						{{ submitting ? (i18n.ts.changingPassword || 'Changing password...') : (i18n.ts.changePassword || 'Change Password') }}
					</MkButton>
				</div>
			</form>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import MkModal from '@/components/MkModal.vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/form/input.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';

const emit = defineEmits<{
	closed: [];
	success: [];
}>();

const modal = ref<InstanceType<typeof MkModal>>();
const currentPasswordInput = ref<InstanceType<typeof MkInput>>();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const submitting = ref(false);
const error = ref('');

const passwordStrength = computed(() => {
	const password = newPassword.value;
	let score = 0;
	
	if (password.length >= 8) score += 25;
	if (password.length >= 12) score += 25;
	if (/[a-z]/.test(password)) score += 10;
	if (/[A-Z]/.test(password)) score += 15;
	if (/\d/.test(password)) score += 15;
	if (/[^a-zA-Z\d]/.test(password)) score += 10;
	
	return Math.min(100, score);
});

const passwordStrengthClass = computed(() => {
	const strength = passwordStrength.value;
	if (strength < 40) return 'weak';
	if (strength < 70) return 'medium';
	return 'strong';
});

const passwordStrengthText = computed(() => {
	const strength = passwordStrength.value;
	if (strength < 40) return i18n.ts.passwordWeak || 'Weak';
	if (strength < 70) return i18n.ts.passwordMedium || 'Medium';
	return i18n.ts.passwordStrong || 'Strong';
});

const canSubmit = computed(() => {
	return currentPassword.value.length > 0 &&
		   newPassword.value.length >= 8 &&
		   confirmPassword.value.length >= 8 &&
		   newPassword.value === confirmPassword.value &&
		   isValidPassword(newPassword.value) &&
		   !submitting.value;
});

function isValidPassword(password: string): boolean {
	const hasLetter = /[a-zA-Z]/.test(password);
	const hasNumber = /\d/.test(password);
	return password.length >= 8 && hasLetter && hasNumber;
}

async function changePassword() {
	if (!canSubmit.value) return;
	
	error.value = '';
	submitting.value = true;
	
	try {
		await os.api('i/change-required-password', {
			currentPassword: currentPassword.value,
			newPassword: newPassword.value,
		});
		
		os.success(i18n.ts.passwordChanged || 'Password changed successfully');
		emit('success');
		modal.value?.close();
		
	} catch (err) {
		console.error('Password change failed:', err);
		error.value = (err as any)?.message || i18n.ts.passwordChangeFailed || 'Failed to change password';
	} finally {
		submitting.value = false;
	}
}

onMounted(() => {
	// Focus the current password input
	nextTick(() => {
		currentPasswordInput.value?.focus();
	});
});
</script>

<style lang="scss" scoped>
.forced-password-change-modal {
	.modal-content {
		max-width: 500px;
		width: 90vw;
		background: var(--panel);
		border-radius: 16px;
		padding: 40px;
		margin: auto;
		
		.header {
			text-align: center;
			margin-bottom: 32px;
			
			.icon {
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
				color: var(--accent);
			}
			
			.subtitle {
				margin: 0;
				opacity: 0.7;
				font-size: 1em;
				line-height: 1.4;
			}
		}
		
		.password-form {
			.form-group {
				margin-bottom: 20px;
			}
			
			.password-strength {
				margin: 16px 0 20px 0;
				
				.strength-bar {
					height: 8px;
					background: var(--bg);
					border-radius: 4px;
					overflow: hidden;
					margin-bottom: 8px;
					
					.strength-fill {
						height: 100%;
						transition: width 0.3s ease, background-color 0.3s ease;
						border-radius: 4px;
						
						&.weak {
							background: var(--error);
						}
						
						&.medium {
							background: var(--warn);
						}
						
						&.strong {
							background: var(--success);
						}
					}
				}
				
				.strength-text {
					margin: 0;
					font-size: 0.9em;
					font-weight: 500;
					
					&.weak {
						color: var(--error);
					}
					
					&.medium {
						color: var(--warn);
					}
					
					&.strong {
						color: var(--success);
					}
				}
			}
			
			.error-message {
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

@media (max-width: 768px) {
	.forced-password-change-modal {
		.modal-content {
			padding: 24px;
			border-radius: 12px;
			
			.header {
				.icon {
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
		}
	}
}
</style>

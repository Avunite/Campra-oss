<template>
<div v-if="email" class="school-check">
	<div v-if="checking" class="checking">
		<i class="ph-circle-notch ph-lg fa-pulse"></i>
		{{ i18n.ts.checking }}
	</div>
	<div v-else-if="schoolInfo">
		<div v-if="schoolInfo.allowed" class="school-valid">
			<i class="ph-check ph-lg" style="color: var(--success);"></i>
			<strong>{{ schoolInfo.school.name }}</strong>
			<div class="school-type">{{ schoolInfo.school.type }}</div>
			<div class="eligible">{{ i18n.ts.registrationEligible }}</div>
		</div>
		<div v-else class="school-invalid">
			<i class="ph-warning ph-lg" style="color: var(--error);"></i>
			<div v-if="schoolInfo.reason === 'SCHOOL_NOT_REGISTERED'" class="error-message">
				<strong>{{ i18n.ts.schoolNotRegistered }}</strong>
				<p>{{ i18n.ts.schoolNotRegisteredDescription }}</p>
			</div>
			<div v-else-if="schoolInfo.reason === 'SCHOOL_REGISTRATION_CLOSED'" class="error-message">
				<strong>{{ i18n.ts.registrationClosed }}</strong>
				<p>{{ i18n.ts.schoolRegistrationClosedDescription }}</p>
				<div v-if="schoolInfo.school" class="school-info">
					<strong>{{ schoolInfo.school.name }}</strong>
					<div class="school-type">{{ schoolInfo.school.type }}</div>
				</div>
			</div>
			<div v-else-if="schoolInfo.reason === 'SCHOOL_SUBSCRIPTION_REQUIRED'" class="error-message">
				<strong>{{ i18n.ts.schoolSubscriptionRequired }}</strong>
				<p>{{ i18n.ts.schoolSubscriptionRequiredDescription }}</p>
				<div v-if="schoolInfo.school" class="school-info">
					<strong>{{ schoolInfo.school.name }}</strong>
					<div class="school-type">{{ schoolInfo.school.type }}</div>
				</div>
			</div>
			<div v-else-if="schoolInfo.reason === 'INVALID_EMAIL'" class="error-message">
				<strong>{{ i18n.ts.invalidEmail }}</strong>
				<p>{{ i18n.ts.invalidEmailDescription }}</p>
			</div>
			<div v-else-if="schoolInfo.reason === 'ERROR'" class="error-message">
				<strong>{{ i18n.ts.schoolCheckFailed || i18n.ts.somethingHappened }}</strong>
				<p>{{ i18n.ts.schoolCheckFailedDescription || i18n.ts.pageLoadErrorDescription }}</p>
			</div>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import * as os from '@/os';
import { i18n } from '@/i18n';

const props = defineProps<{
	email: string;
}>();

const emit = defineEmits<{
	(ev: 'schoolInfo', info: any): void;
}>();

const checking = ref(false);
const schoolInfo = ref(null);

async function checkSchoolAccess() {
	if (!props.email) {
		schoolInfo.value = null;
		emit('schoolInfo', null);
		return;
	}

	checking.value = true;
	
	try {
		const result = await os.api('schools/check-access', {
			email: props.email,
		});
		
		schoolInfo.value = result;
		emit('schoolInfo', result);
	} catch (error) {
		console.error('Failed to check school access:', error);
		const errorResult = {
			allowed: false,
			reason: 'ERROR',
		};
		schoolInfo.value = errorResult;
		emit('schoolInfo', errorResult);
	} finally {
		checking.value = false;
	}
}

watch(() => props.email, () => {
	checkSchoolAccess();
}, { immediate: true });
</script>

<style lang="scss" scoped>
.school-check {
	margin: 8px 0;
	padding: 12px;
	border: 1px solid var(--divider);
	border-radius: 6px;
	background: var(--panel);

	.checking {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--accent);
	}

	.school-valid {
		color: var(--success);
		
		.school-type {
			font-size: 0.85em;
			opacity: 0.7;
			text-transform: capitalize;
		}
		
		.eligible {
			font-size: 0.85em;
			margin-top: 4px;
		}
	}

	.school-invalid {
		color: var(--error);
		
		.error-message {
			margin-left: 24px;
			
			strong {
				display: block;
				margin-bottom: 4px;
			}
			
			p {
				margin: 0;
				font-size: 0.9em;
				opacity: 0.8;
			}
			
			.school-info {
				margin-top: 8px;
				padding: 8px;
				background: var(--bg);
				border-radius: 4px;
				
				.school-type {
					font-size: 0.85em;
					opacity: 0.7;
					text-transform: capitalize;
				}
			}
		}
	}
}
</style>

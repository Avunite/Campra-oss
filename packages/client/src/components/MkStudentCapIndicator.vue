<template>
	<div class="student-cap-indicator" :class="statusClass">
		<div class="cap-header">
			<i :class="statusIcon"></i>
			<span class="cap-title">{{ title }}</span>
		</div>
		
		<div v-if="showDetails" class="cap-details">
			<div v-if="studentCap !== null" class="cap-usage">
				<div class="usage-bar">
					<div class="usage-fill" :style="{ width: `${utilizationPercentage}%` }"></div>
				</div>
				<div class="usage-text">
					{{ currentStudentCount }} / {{ studentCap }} students ({{ utilizationPercentage }}%)
				</div>
			</div>
			
			<div v-if="!canRegisterNewStudents" class="warning-message">
				<i class="ph-warning ph-lg"></i>
				<span>Student registration is currently blocked</span>
			</div>
			
			<div v-if="isNearCapacity && canRegisterNewStudents" class="warning-message near-capacity">
				<i class="ph-warning-circle ph-lg"></i>
				<span>Approaching student capacity limit</span>
			</div>
		</div>
		
		<div v-if="showActions" class="cap-actions">
			<MkButton v-if="!canRegisterNewStudents && isSchoolAdmin" @click="requestCapIncrease" primary>
				<i class="ph-arrow-up ph-lg"></i>
				Increase Cap
			</MkButton>
			
			<MkButton v-if="isNearCapacity && isSchoolAdmin" @click="requestCapIncrease">
				<i class="ph-arrow-up ph-lg"></i>
				Increase Cap
			</MkButton>
			
			<MkButton v-if="isSchoolAdmin && !isNearCapacity && canRegisterNewStudents" @click="setStudentCap">
				<i class="ph-gear-six ph-lg"></i>
				Set Cap
			</MkButton>
			
			<MkButton v-if="showManageLink && isSchoolAdmin" @click="manageCaps" small>
				<i class="ph-gear-six ph-lg"></i>
				Manage
			</MkButton>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os';
import { $i } from '@/account';
import { useRouter } from '@/router';
import { useStripePricing } from '@/composables/use-stripe-pricing';

const router = useRouter();

const props = defineProps<{
	studentCap: number | null;
	currentStudentCount: number;
	utilizationPercentage: number | null;
	capEnforced: boolean;
	canRegisterNewStudents: boolean;
	isNearCapacity: boolean;
	capStatus: string;
	showDetails?: boolean;
	showActions?: boolean;
	showManageLink?: boolean;
	size?: 'small' | 'medium' | 'large';
	billingRate?: number; // Rate per student per year
}>();

const isSchoolAdmin = computed(() => $i?.isSchoolAdmin || false);

const statusClass = computed(() => {
	const classes = [`cap-${props.capStatus}`, `size-${props.size || 'medium'}`];
	
	if (props.capStatus === 'at_capacity') {
		classes.push('status-critical');
	} else if (props.capStatus === 'near_capacity') {
		classes.push('status-warning');
	} else if (props.capStatus === 'low_usage') {
		classes.push('status-good');
	} else if (props.capStatus === 'cap_disabled') {
		classes.push('status-disabled');
	}
	
	return classes.join(' ');
});

const statusIcon = computed(() => {
	switch (props.capStatus) {
		case 'at_capacity': return 'ph-warning-circle ph-lg';
		case 'near_capacity': return 'ph-warning ph-lg';
		case 'moderate_usage': return 'ph-info ph-lg';
		case 'low_usage': return 'ph-check-circle ph-lg';
		case 'cap_disabled': return 'ph-x-circle ph-lg';
		case 'unlimited': return 'ph-infinity ph-lg';
		default: return 'ph-circle ph-lg';
	}
});

const title = computed(() => {
	if (!props.capEnforced) {
		return 'Student Cap Disabled';
	}
	
	switch (props.capStatus) {
		case 'at_capacity': return 'At Capacity';
		case 'near_capacity': return 'Near Capacity';
		case 'moderate_usage': return 'Moderate Usage';
		case 'low_usage': return 'Low Usage';
		case 'unlimited': return 'Unlimited';
		default: return 'Student Cap Status';
	}
});

async function requestCapIncrease() {
	const { canceled, result } = await os.form('Request Cap Increase', {
		newCap: {
			type: 'number',
			label: 'New Student Cap',
			min: (props.studentCap || 0) + 1,
			max: 50000,
			default: (props.studentCap || 0) + 50,
		},
	});

	if (canceled) return;

	try {
		const response = await os.apiWithDialog('schools/request-cap-increase', {
			newCap: result.newCap,
		});

		if (response.billing?.clientSecret) {
			// Handle payment if required
			os.alert({
				type: 'info',
				title: 'Payment Required',
				text: `Student cap increased to ${result.newCap}.\n\nAdditional cost: $${response.billing.additionalCost.toFixed(2)}\n\nPayment will be processed automatically.`,
			});
		} else {
			os.success(`Student cap increased to ${result.newCap} successfully!`);
		}

		// Emit event to refresh parent component data
		// This assumes the parent component will refetch cap status
		setTimeout(() => {
			window.location.reload();
		}, 1000);

	} catch (error: any) {
		os.alert({
			type: 'error',
			title: 'Cap Increase Failed',
			text: error.message || 'Failed to increase student cap. Please try again.',
		});
	}
}

function manageCaps() {
	// Navigate to school admin billing page where cap management should be available
	router.push('/school-admin/billing');
}

async function setStudentCap() {
	const formResult: any = await os.form('Set Student Cap', {
		newCap: {
			type: 'number',
			label: 'New Student Cap',
			min: Math.max(props.currentStudentCount, 1),
			max: 50000,
			default: props.studentCap || Math.max(props.currentStudentCount + 50, 100),
		},
	});

	if (formResult.canceled) return;

	const newCap = formResult.result.newCap;
	const currentCap = props.studentCap || 0;

	// If decreasing or same, no preview needed
	if (newCap <= currentCap) {
		try {
			await os.apiWithDialog('schools/set-student-cap', {
				studentCap: newCap,
			});

			os.alert({
				type: 'success',
				text: `Student cap updated to ${newCap} successfully!`
			});

			setTimeout(() => {
				window.location.reload();
			}, 1000);
		} catch (error: any) {
			os.alert({
				type: 'error',
				title: 'Cap Update Failed',
				text: error.message || 'Failed to update student cap.',
			});
		}
		return;
	}

	// For increases, calculate cost locally
	// Note: We use standard rate as we don't have billing info in this component
	// If the school has a custom rate, the backend will handle it correctly
	try {
		const { standardRate } = useStripePricing();
		const rate = standardRate.value; // Get current rate from Stripe API
		const additionalStudents = newCap - currentCap;
		const additionalCost = additionalStudents * rate;
		const currentTotalCost = currentCap * rate;
		const newTotalCost = newCap * rate;

		let confirmMessage = `Current: **${currentCap} students**\n`;
		confirmMessage += `New: **${newCap} students** (+${additionalStudents})\n\n`;

		if (additionalCost > 0) {
			confirmMessage += `⚠️ **Estimated charge: ~$${additionalCost.toFixed(2)}**\n`;
			confirmMessage += `(Based on standard $${rate}/student rate)\n\n`;
			confirmMessage += `Annual cost will increase from ~$${currentTotalCost.toFixed(2)} to ~$${newTotalCost.toFixed(2)}\n\n`;
		}

		confirmMessage += `Continue?`;

		const { canceled } = await os.confirm({
			type: additionalCost > 0 ? 'warning' : 'question',
			title: additionalCost > 0 ? 'Confirm Payment' : 'Confirm Cap Increase',
			text: confirmMessage,
		});

		if (canceled) return;

		await os.apiWithDialog('schools/set-student-cap', {
			studentCap: newCap,
		});

		os.alert({
			type: 'success',
			text: `Student cap updated to ${newCap} successfully!`
		});

		setTimeout(() => {
			window.location.reload();
		}, 1000);

	} catch (error: any) {
		os.alert({
			type: 'error',
			title: 'Cap Update Failed',
			text: error.message || 'Failed to update student cap.',
		});
	}
}
</script>

<style lang="scss" scoped>
.student-cap-indicator {
	border-radius: 8px;
	border: 1px solid var(--divider);
	padding: 12px;
	background: var(--panel);

	&.size-small {
		padding: 8px;
		font-size: 0.9em;
	}

	&.size-large {
		padding: 16px;
		font-size: 1.1em;
	}

	&.status-critical {
		border-color: var(--error);
		background: color-mix(in srgb, var(--error) 5%, var(--panel));
	}

	&.status-warning {
		border-color: var(--warn);
		background: color-mix(in srgb, var(--warn) 5%, var(--panel));
	}

	&.status-good {
		border-color: var(--success);
		background: color-mix(in srgb, var(--success) 5%, var(--panel));
	}

	&.status-disabled {
		border-color: var(--fg);
		background: color-mix(in srgb, var(--fg) 3%, var(--panel));
		opacity: 0.7;
	}

	.cap-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;

		i {
			font-size: 1.2em;
		}

		.cap-title {
			font-weight: 600;
		}

		.status-critical & i {
			color: var(--error);
		}

		.status-warning & i {
			color: var(--warn);
		}

		.status-good & i {
			color: var(--success);
		}
	}

	.cap-details {
		margin-bottom: 12px;

		.cap-usage {
			margin-bottom: 8px;

			.usage-bar {
				width: 100%;
				height: 6px;
				background: var(--divider);
				border-radius: 3px;
				overflow: hidden;
				margin-bottom: 4px;

				.usage-fill {
					height: 100%;
					background: var(--accent);
					transition: width 0.3s ease;
				}

				.status-critical & .usage-fill {
					background: var(--error);
				}

				.status-warning & .usage-fill {
					background: var(--warn);
				}

				.status-good & .usage-fill {
					background: var(--success);
				}
			}

			.usage-text {
				font-size: 0.9em;
				opacity: 0.8;
				text-align: center;
			}
		}

		.warning-message {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 6px 8px;
			border-radius: 4px;
			font-size: 0.9em;
			background: color-mix(in srgb, var(--error) 10%, var(--panel));
			color: var(--error);

			&.near-capacity {
				background: color-mix(in srgb, var(--warn) 10%, var(--panel));
				color: var(--warn);
			}

			i {
				font-size: 1em;
			}
		}
	}

	.cap-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
}
</style>

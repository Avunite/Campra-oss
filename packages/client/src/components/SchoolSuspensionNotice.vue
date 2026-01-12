<template>
	<div v-if="schoolSuspended" class="school-suspension-notice">
		<div class="suspension-header">
			<i class="ph-warning-circle ph-lg"></i>
			<h3>School Access Suspended</h3>
		</div>
		
		<div class="suspension-message">
			<p v-if="props.suspensionReason === 'payment_failed'">
				Your school's Campra subscription payment has failed. Please contact your school administration to resolve this payment issue and restore access to the platform.
			</p>
			<p v-else-if="props.suspensionReason === 'subscription_cancelled'">
				Your school's Campra subscription has been cancelled. Please contact your school administration to reactivate your subscription.
			</p>
			<p v-else>
				Your school's access to Campra has been suspended. Please contact your school administration for more information.
			</p>
		</div>

		<div class="suspension-actions">
			<button class="btn primary" @click="contactAdmin">
				<i class="ph-envelope ph-lg"></i>
				Contact School Administration
			</button>
			
			<button v-if="$i?.isSchoolAdmin" @click="manageBilling" class="btn admin-action">
				<i class="ph-credit-card ph-lg"></i>
				Manage Billing
			</button>
		</div>

		<div class="suspension-details" v-if="showDetails">
			<details>
				<summary>Technical Details</summary>
				<div class="details-content">
					<p><strong>School:</strong> {{ props.schoolInfo?.name || 'Unknown' }}</p>
					<p><strong>Suspension Reason:</strong> {{ props.suspensionReason || 'Unknown' }}</p>
					<p><strong>Suspended At:</strong> {{ props.suspendedAt ? new Date(props.suspendedAt).toLocaleString() : 'Unknown' }}</p>
					<p><strong>Contact:</strong> For billing issues, contact your school's administration or finance department.</p>
				</div>
			</details>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { $i } from '@/account.js';

const props = defineProps<{
	visible?: boolean;
	suspensionReason?: string;
	suspendedAt?: string;
	schoolInfo?: {
		name: string;
		domain: string;
	};
}>();

const showDetails = ref(false);

const schoolSuspended = computed(() => {
	return props.visible ?? false;
});

function contactAdmin() {
	if (props.schoolInfo?.domain) {
		const adminEmail = `admin@${props.schoolInfo.domain}`;
		window.location.href = `mailto:${adminEmail}?subject=Campra Access Issue&body=Hello, I am unable to access Campra due to a school subscription issue. Please help resolve this.`;
	} else {
		alert('Please contact your school administration regarding Campra access issues.');
	}
}

function manageBilling() {
	// Navigate to school admin billing page
	window.location.href = '/school-admin/billing';
}

onMounted(() => {
	// Auto-show details if user is school admin
	if ($i?.isSchoolAdmin) {
		showDetails.value = true;
	}
});
</script>

<style lang="scss" scoped>
.school-suspension-notice {
	background: linear-gradient(135deg, #ff6b6b, #ee5a52);
	color: white;
	padding: 2rem;
	border-radius: 12px;
	margin: 1rem 0;
	box-shadow: 0 8px 32px rgba(255, 107, 107, 0.3);
	
	.suspension-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
		
		i {
			font-size: 2rem;
			opacity: 0.9;
		}
		
		h3 {
			margin: 0;
			font-size: 1.5rem;
			font-weight: 600;
		}
	}
	
	.suspension-message {
		margin-bottom: 2rem;
		
		p {
			margin: 0;
			line-height: 1.6;
			font-size: 1.1rem;
			opacity: 0.95;
		}
	}
	
	.suspension-actions {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
		
		.btn {
			background: rgba(255, 255, 255, 0.9);
			color: #333;
			border: none;
			padding: 0.75rem 1.5rem;
			border-radius: 8px;
			font-weight: 500;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			transition: all 0.2s;
			
			&:hover {
				background: white;
				transform: translateY(-1px);
			}
			
			&.admin-action {
				background: rgba(255, 255, 255, 0.2);
				color: white;
				border: 1px solid rgba(255, 255, 255, 0.3);
				
				&:hover {
					background: rgba(255, 255, 255, 0.3);
				}
			}
		}
	}
	
	.suspension-details {
		border-top: 1px solid rgba(255, 255, 255, 0.3);
		padding-top: 1rem;
		
		details {
			summary {
				cursor: pointer;
				font-weight: 500;
				opacity: 0.9;
				
				&:hover {
					opacity: 1;
				}
			}
			
			.details-content {
				margin-top: 1rem;
				padding: 1rem;
				background: rgba(0, 0, 0, 0.1);
				border-radius: 8px;
				
				p {
					margin: 0.5rem 0;
					font-size: 0.9rem;
					opacity: 0.9;
				}
			}
		}
	}
}

@media (max-width: 768px) {
	.school-suspension-notice {
		padding: 1.5rem;
		
		.suspension-header {
			h3 {
				font-size: 1.3rem;
			}
		}
		
		.suspension-actions {
			flex-direction: column;
		}
	}
}
</style>

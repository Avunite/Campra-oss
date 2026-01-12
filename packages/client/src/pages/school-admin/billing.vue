<template>
<MkSpacer :content-max="800" :margin-min="16" :margin-max="32">
	<div v-if="loading" class="loading">
		<MkLoading/>
	</div>
	<div v-else>
		<div class="title">
			{{ i18n.ts.billing }}
		</div>
		<div class="description">
			{{ i18n.ts.schoolBillingDescription }}
		</div>

		<div v-if="billing" class="billing-sections">
			<div class="billing-card subscription-status">
				<div class="card-header">
					<i :class="getStatusIcon(billing.status)" class="status-icon"></i>
					<div class="header-info">
						<div class="status-title">{{ formatSubscriptionStatus(billing.status) }}</div>
						<div class="status-subtitle">{{ i18n.ts.subscriptionStatus }}</div>
					</div>
				</div>
				<div class="card-content">
					<div class="status-details">
						<div class="detail-item">
							<label>{{ i18n.ts.currentStudents }}</label>
							<span class="value">{{ billing.studentCount }}</span>
						</div>
						<div v-if="billing.studentCap" class="detail-item">
							<label>Student Cap (Billing Basis)</label>
							<span class="value">{{ billing.studentCap }}</span>
						</div>
						<div class="detail-item">
							<label>{{ i18n.ts.yearlyRate }}</label>
							<span class="value">${{ totalAnnualCost.toFixed(2) }} /year</span>
						</div>
						<div class="detail-item">
							<label>Rate per Student</label>
							<span class="value">${{ effectiveBillingRate.toFixed(2) }} /year</span>
						</div>
						<div class="detail-item">
							<label>{{ i18n.ts.billingCycle }}</label>
							<span class="value">{{ i18n.ts.annualBilling }}</span>
						</div>
						<div class="detail-item billing-note">
							<i class="ph-info ph-lg"></i>
							<span>{{ i18n.ts.billingInfo }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="billing-actions">
			<MkButton v-if="billing?.status === 'active'" @click="manageSubscription" primary>
				<i class="ph-gear-six ph-lg"></i>
				{{ i18n.ts.manageSubscription }}
			</MkButton>
			<MkButton v-else @click="createSubscription" primary :disabled="creatingSubscription">
				<i v-if="creatingSubscription" class="ph-circle-notch ph-lg ph-spin"></i>
				<i v-else class="ph-credit-card ph-lg"></i>
				{{ creatingSubscription ? 'Creating Subscription...' : i18n.ts.activateSubscription }}
			</MkButton>
		</div>

		<MkInfo v-if="billing && effectiveBillingRate !== undefined && effectiveBillingRate !== standardRate" class="special-billing-info">
			<div v-if="isFreeAccess">
				<strong>Special Billing:</strong> Your school has been granted free access by platform administrators.
				<div class="upgrade-option">
					<MkButton @click="upgradeFromFree" small>
						<i class="ph-credit-card ph-lg"></i>
						Set up paid subscription anyway
					</MkButton>
					<p style="font-size: 0.85em; margin-top: 0.5em; opacity: 0.7;">
						Setting up a paid subscription ensures billing continues to work even if free access is later revoked.
					</p>
				</div>
			</div>
			<div v-else-if="isDiscountedRate">
				<strong>Discounted Rate:</strong> {{ discountedRateMessage }}
			</div>
			<div v-else>
				<strong>Custom Rate:</strong> Your school has a custom billing rate of ${{ effectiveBillingRate.toFixed(2) }}/student/year (above standard ${{ standardRate.toFixed(2) }} rate).
			</div>
		</MkInfo>

		<MkInfo class="billing-info">
			{{ i18n.ts.billingInfo }}
		</MkInfo>

		<!-- Student Cap Management Section -->
		<div v-if="capStatus" class="billing-sections">
			<div class="billing-card cap-management">
				<div class="card-header">
					<i class="ph-users ph-lg status-icon"></i>
					<div class="header-info">
						<div class="status-title">Student Capacity Management</div>
						<div class="status-subtitle">Prepaid cap billing system</div>
					</div>
				</div>
				<div class="card-content">
					<MkStudentCapIndicator
						:student-cap="capStatus.studentCap"
						:current-student-count="capStatus.currentStudentCount"
						:utilization-percentage="capStatus.utilizationPercentage"
						:cap-enforced="capStatus.capEnforced"
						:can-register-new-students="capStatus.canRegisterNewStudents"
						:is-near-capacity="capStatus.isNearCapacity"
						:cap-status="capStatus.capStatus"
						:show-details="true"
						:show-actions="true"
						:size="'large'"
						:billing-rate="effectiveBillingRate"
					/>
					
					<div v-if="capStatus.capEnforced" class="cap-details">
						<div class="detail-item">
							<label>Current Cap</label>
							<span class="value">{{ capStatus.studentCap }} students</span>
						</div>
						<div class="detail-item">
							<label>Remaining Capacity</label>
							<span class="value">{{ capStatus.remainingCapacity }} students</span>
						</div>
						<div v-if="capStatus.lastCapUpdate" class="detail-item">
							<label>Last Updated</label>
							<span class="value">{{ formatDate(capStatus.lastCapUpdate) }}</span>
						</div>
					</div>
					
					<MkInfo v-if="!capStatus.capEnforced" class="cap-info">
						<strong>Notice:</strong> Student cap enforcement is currently disabled for your school. 
						Students can register without limits. Contact platform administrators to enable prepaid cap billing.
					</MkInfo>
				</div>
			</div>
		</div>
	</div>
</MkSpacer>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { i18n } from '@/i18n';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkStudentCapIndicator from '@/components/MkStudentCapIndicator.vue';
import * as os from '@/os';
import { $i } from '@/account';
import { definePageMetadata } from '@/scripts/page-metadata';
import { useStripePricing } from '@/composables/use-stripe-pricing';

const loading = ref(true);
const creatingSubscription = ref(false);
const billing = ref(null);
const capStatus = ref(null);

// Fetch current Stripe pricing
const { standardRate } = useStripePricing();

// Computed properties for billing rates
const effectiveBillingRate = computed(() => {
	return billing.value?.pricePerStudentAnnual ?? standardRate.value;
});

const totalAnnualCost = computed(() => {
	const billedStudents = billing.value?.billedStudents || billing.value?.studentCount || 0;
	return billedStudents * effectiveBillingRate.value;
});

const isFreeAccess = computed(() => {
	return effectiveBillingRate.value === 0;
});

const isDiscountedRate = computed(() => {
	return effectiveBillingRate.value > 0 && effectiveBillingRate.value < standardRate.value;
});

const isCustomRate = computed(() => {
	return effectiveBillingRate.value > standardRate.value;
});

const discountedRateMessage = computed(() => {
	const monthlyRate = (standardRate.value / 12).toFixed(2);
	const yearlyRate = standardRate.value.toFixed(2);
	return `Your school is receiving a discounted rate of $${effectiveBillingRate.value.toFixed(2)}/student/year (normally $${monthlyRate} per student per month, billed yearly at $${yearlyRate} per student per year)`;
});

function getStatusIcon(status: string): string {
	switch (status) {
		case 'active': return 'ph-check-circle ph-lg';
		case 'pending': return 'ph-clock ph-lg';
		case 'suspended': return 'ph-warning-circle ph-lg';
		case 'cancelled': return 'ph-x-circle ph-lg';
		default: return 'ph-clock ph-lg';
	}
}

function formatSubscriptionStatus(status: string): string {
	const statuses = {
		active: i18n.ts.active || 'Active',
		pending: 'Pending',
		suspended: i18n.ts.suspended || 'Suspended',
		cancelled: i18n.ts.cancel || 'Cancelled'
	};
	return statuses[status] || status;
}

function formatDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString();
}

async function loadBillingData() {
	if (!$i?.isSchoolAdmin || !$i?.adminForSchoolId) {
		os.alert({
			type: 'error',
			text: i18n.ts.schoolAdminAccessRequired
		});
		return;
	}

	loading.value = true;
	
	try {
		// Load billing info
		try {
			billing.value = await os.api('schools/billing-info', {});
		} catch (billingError) {
			console.warn('Could not load billing info:', billingError);
			// Create a default billing structure if the endpoint fails
			billing.value = {
				id: null,
				status: 'pending',
				studentCount: 0,
				studentCap: null,
				billedStudents: 0,
				pricePerStudentAnnual: standardRate.value,
				totalAnnualAmount: 0,
				billingCycle: 'annual',
				nextPaymentDate: null,
				lastPaymentDate: null,
			};
		}

		// Load cap status
		try {
			capStatus.value = await os.api('schools/cap-status', {});
		} catch (capError) {
			console.warn('Could not load cap status:', capError);
			// Don't fail the whole page if cap status fails
			capStatus.value = null;
		}
	} catch (error) {
		console.warn('Error loading billing data:', error);
		os.alert({
			type: 'error',
			text: 'Failed to load billing data'
		});
	} finally {
		loading.value = false;
	}
}

function manageSubscription() {
	// Use the simplified portal opening function
	openStripePortal();
}

function showSubscriptionOptions() {
	const menuItems = [{
		icon: 'ph-credit-card ph-lg',
		text: 'Update Payment Method',
		action: () => setupPaymentMethod(),
	}, {
		icon: 'ph-receipt ph-lg',
		text: 'View Detailed Invoices',
		action: () => viewInvoices(),
	}, {
		icon: 'ph-chart-line ph-lg',
		text: 'View Subscription Details',
		action: () => viewSubscriptionDetails(),
	}];

	os.popup(import('@/components/MkMenu.vue'), menuItems);
}

async function viewSubscriptionDetails() {
	if (!billing.value) {
		os.alert({
			type: 'error',
			text: 'No billing information available'
		});
		return;
	}

	const details = [
		`Subscription Status: ${formatSubscriptionStatus(billing.value.status)}`,
		`Current Students: ${billing.value.studentCount}`,
		billing.value.studentCap ? `Student Cap: ${billing.value.studentCap}` : '',
		billing.value.billedStudents ? `Billed Students: ${billing.value.billedStudents}` : '',
		`Annual Rate: $${((billing.value.billedStudents || billing.value.studentCount) * (billing.value.pricePerStudentAnnual || standardRate.value)).toFixed(2)}`,
		`Rate per Student: $${(billing.value.pricePerStudentAnnual || standardRate.value).toFixed(2)} per year`,
		billing.value.nextPaymentDate ? `Next Payment: ${formatDate(billing.value.nextPaymentDate)}` : '',
		billing.value.lastPaymentDate ? `Last Payment: ${formatDate(billing.value.lastPaymentDate)}` : '',
		'',
		'Billing Information:',
		'• Billing is calculated annually based on student cap (prepaid system)',
		'• If no cap is set, billing uses current student count',
		'• Only students count toward billing (staff excluded)', 
		`• Rate: $${(billing.value.pricePerStudentAnnual || standardRate.value).toFixed(2)} per student per year`,
		'• Payments are processed automatically via Stripe'
	].filter(Boolean).join('\n');

	os.alert({
		type: 'info',
		title: 'Subscription Details',
		text: details
	});
}

function createSubscription() {
	// Prevent multiple calls
	if (creatingSubscription.value) return;
	
	const billedStudents = billing.value?.billedStudents || billing.value?.studentCount || 0;
	const rate = billing.value?.pricePerStudentAnnual || standardRate.value;
	const annualCost = billedStudents * rate;
	
	// Show billing explanation first
	let billingMessage = `Campra school billing information:\n\n`;
	
	const currentStudents = billing.value?.studentCount || 0;
	const billingBasis = billing.value?.studentCap ? 'student cap' : 'current student count';
	
	if (rate === 0) {
		billingMessage += `• Your school has been granted FREE access by platform administrators\n`;
		billingMessage += `• No payment required\n`;
		billingMessage += `• Current students: ${currentStudents}\n`;
		if (billing.value?.studentCap) {
			billingMessage += `• Student cap: ${billing.value.studentCap}\n`;
		}
		billingMessage += `\nProceed to activate free access?`;
	} else if (billedStudents === 0) {
		billingMessage += `• $${rate.toFixed(2)} per student per year\n`;
		billingMessage += `• Billed annually (once per year)\n`;
		billingMessage += `• Billing based on ${billingBasis}\n`;
		billingMessage += `• Only students count (staff excluded)\n`;
		billingMessage += `• You can set up billing before adding students\n\n`;
		billingMessage += `Current students: ${currentStudents}\n`;
		if (billing.value?.studentCap) {
			billingMessage += `Student cap: ${billing.value.studentCap}\n`;
		}
		billingMessage += `When students register, billing will be: $${rate.toFixed(2)} per student per year\n\n`;
		billingMessage += `Proceed to setup billing?`;
	} else {
		billingMessage += `• $${rate.toFixed(2)} per student per year\n`;
		billingMessage += `• Billed annually (once per year)\n`;
		billingMessage += `• Billing based on ${billingBasis}\n`;
		billingMessage += `• Only students count (staff excluded)\n`;
		billingMessage += `• Automatic billing via Stripe\n\n`;
		billingMessage += `Current students: ${currentStudents}\n`;
		if (billing.value?.studentCap) {
			billingMessage += `Student cap (billing basis): ${billing.value.studentCap}\n`;
		}
		billingMessage += `Your current rate: $${annualCost.toFixed(2)} per year for ${billedStudents} ${billingBasis === 'student cap' ? 'cap' : 'students'}\n\n`;
		billingMessage += `Proceed to setup billing?`;
	}
	
	os.confirm({
		type: 'info',
		title: 'School Billing Setup',
		text: billingMessage
	}).then((confirmed) => {
		if (!confirmed) return;
		
		// Set loading state to prevent double-clicks
		creatingSubscription.value = true;
		
		// Create subscription
		os.api('stripe/create-school-subscription', {}).then(async (result) => {
			if (result.status === 'active' && result.subscriptionId === null) {
				// Free access activated
				os.alert({
					type: 'success',
					text: 'Your school subscription has been activated with complimentary access!'
				});
				// Reload the page to show updated status
				location.reload();
			} else if (result.subscriptionId) {
				// Subscription created - wait for it to be ready before opening portal
				os.alert({
					type: 'info',
					text: 'Subscription created! Please wait while we finalize setup...'
				});
				
				// Poll billing status to check if subscription is ready
				let attempts = 0;
				const maxAttempts = 10;
				const pollInterval = 15.0000; // 1.5 seconds
				
				const checkSubscriptionReady = async (): Promise<boolean> => {
					try {
						await loadBillingData();
						
						// Check if billing status is no longer incomplete
						if (billing.value && billing.value.status !== 'incomplete') {
							// Subscription is ready, try to open portal
							setTimeout(() => {
								openStripePortal();
								creatingSubscription.value = false;
							}, 500);
							return true;
						}
						
						attempts++;
						if (attempts < maxAttempts) {
							// Keep polling
							setTimeout(checkSubscriptionReady, pollInterval);
						} else {
							// Timeout - subscription taking too long
							os.alert({
								type: 'warning',
								text: 'Subscription is taking longer than expected to set up. Please refresh the page in a moment and try accessing the billing portal again.'
							});
							creatingSubscription.value = false;
						}
						return false;
					} catch (error) {
						console.error('Error polling subscription status:', error);
						attempts++;
						if (attempts < maxAttempts) {
							setTimeout(checkSubscriptionReady, pollInterval);
						} else {
							os.alert({
								type: 'error',
								text: 'Failed to verify subscription setup. Please refresh the page and try again.'
							});
							creatingSubscription.value = false;
						}
						return false;
					}
				};
				
				// Start polling
				setTimeout(checkSubscriptionReady, pollInterval);
			} else {
				// Fallback case
				os.alert({
					type: 'info',
					text: 'Subscription setup initiated. If you do not see the billing portal, please try refreshing the page.'
				});
				setTimeout(() => loadBillingData(), 2000);
				creatingSubscription.value = false;
			}
		}).catch((error) => {
			console.warn('Could not create subscription:', error);
			
			// Check for specific error indicating subscription already exists
			if (error.message && error.message.includes('already has active')) {
				os.alert({
					type: 'info',
					text: 'Your subscription is already set up. Refreshing billing information...'
				});
				loadBillingData();
			} else {
				os.alert({
					type: 'error',
					text: error.message || 'Failed to setup billing. Please try again or contact support.'
				});
			}
			creatingSubscription.value = false;
		});
	});
}

function openStripePortal() {
	// Try to open Stripe billing portal directly
	os.api('stripe/manage', { action: 'portal' }).then((result) => {
		if (result.url) {
			// Success - open Stripe portal in new tab
			window.open(result.url, '_blank');
			// Reload billing data when they return
			setTimeout(() => {
				loadBillingData();
			}, 1000);
		}
	}).catch((error) => {
		console.warn('Could not open Stripe portal:', error);
		
		if (error.code === 'STRIPE_PORTAL_NOT_CONFIGURED') {
			showPortalSetupInstructions();
		} else if (error.code === 'SUBSCRIPTION_NOT_SETUP') {
			// For new subscriptions, provide better guidance
			os.alert({
				type: 'info',
				text: 'Your subscription is being set up. Please wait a moment and try again, or contact support if the issue persists.'
			});
		} else if (error.code === 'SUBSCRIPTION_INCOMPLETE') {
			// Subscription still being processed
			os.alert({
				type: 'info',
				text: 'Your subscription is still being set up. This usually takes just a few seconds. Please wait a moment and the billing portal will open automatically.'
			});
		} else if (error.code === 'FREE_ACCESS_NO_PORTAL') {
			// School has complimentary access
			os.alert({
				type: 'info',
				text: 'Your school has complimentary access to Campra. The billing portal is not available for schools with free access. Contact support if you need to upgrade to a paid plan.'
			});
		} else {
			os.alert({
				type: 'error',
				text: error.message || 'Could not open billing portal. Please contact support for assistance.'
			});
		}
	});
}

function setupPaymentMethodDirectly() {
	// Direct setup without extra popups
	os.api('stripe/setup-intent', {}).then((result) => {
		if (result.client_secret) {
			// For now, redirect to a Stripe setup page or show setup instructions
			os.alert({
				type: 'info',
				text: 'Payment setup initialized. Please contact support to complete billing setup.'
			});
		}
	}).catch((error) => {
		console.warn('Could not setup payment method:', error);
		os.alert({
			type: 'error',
			text: 'Failed to setup payment method. Please contact support.'
		});
	});
}

function setupPaymentMethod() {
	// Use existing setup intent endpoint
	os.api('stripe/setup-intent', {}).then((result) => {
		if (result.client_secret) {
			os.alert({
				type: 'info',
				text: 'Payment method setup is ready. You will be redirected to complete the setup.'
			}).then(() => {
				// For now, direct to billing portal where they can add payment methods
				manageSubscription();
			});
		} else {
			os.alert({
				type: 'info',
				text: 'Payment method setup initiated. Please follow the instructions.'
			});
		}
	}).catch((error) => {
		console.warn('Could not setup payment method:', error);
		os.alert({
			type: 'error',
			text: 'Failed to setup payment method. Please try again or use the billing portal.'
		}).then(() => {
			// Fallback to billing portal
			manageSubscription();
		});
	});
}

function viewInvoices() {
	// Load real invoice data from backend
	os.api('schools/invoices', { limit: 10 }).then((invoices) => {
		if (invoices.length === 0) {
			os.alert({
				type: 'info',
				title: 'No Invoices',
				text: 'No payment history found for your school yet.'
			});
			return;
		}
		
		const invoiceList = invoices.map(inv => 
			`${inv.invoiceNumber} - ${inv.date} - $${inv.amount.toFixed(2)} (${inv.status}) - ${inv.period} - ${inv.studentCount} students`
		).join('\n');

		os.alert({
			type: 'info',
			title: 'Recent Annual Invoices',
			text: `Your recent annual invoices:\n\n${invoiceList}\n\nContact support@campra.app for detailed invoice PDFs.`
		});
	}).catch((error) => {
		console.warn('Could not load invoices:', error);
		os.alert({
			type: 'error',
			text: 'Failed to load invoice history. Please try again.'
		});
	});
}

function showPortalSetupInstructions() {
	os.alert({
		type: 'info',
		title: 'Stripe Customer Portal Setup Required',
		text: `To enable the billing portal, a platform administrator needs to configure it in Stripe:

1. Go to https://dashboard.stripe.com/test/settings/billing/portal
2. Configure the customer portal settings
3. Save the configuration

Once configured, school admins will be able to:
• Update payment methods
• View detailed invoices
• Download billing statements
• Update billing information

For now, you can use the subscription management options below or contact support for billing assistance.`
	});
}

async function setNewStudentCap() {
	const formResult: any = await os.form('Update Student Cap', {
		newCap: {
			type: 'number',
			label: 'New Student Cap',
			min: Math.max(capStatus.value?.currentStudentCount || 0, 1),
			max: 50000,
			default: capStatus.value?.studentCap || 100,
		},
	});

	if (formResult.canceled) return;

	const newCap = formResult.result.newCap;
	const currentCap = capStatus.value?.studentCap || 0;

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

			await loadBillingData();
		} catch (error) {
			// Error handled by apiWithDialog
		}
		return;
	}

	// For increases, calculate cost locally
	try {
		// Get rate from billing data
		const rate = billing.value?.pricePerStudentAnnual ?? standardRate.value;
		const additionalStudents = newCap - currentCap;
		const additionalCost = additionalStudents * rate;
		const currentTotalCost = currentCap * rate;
		const newTotalCost = newCap * rate;
		
		// Check if this will charge immediately (has active subscription and not free)
		const willChargeImmediately = rate > 0 && billing.value?.status === 'active' && billing.value?.stripeCustomerId;
		const hasPaymentMethod = billing.value?.paymentMethod !== null;
		const willChargeOnSubscriptionSetup = rate > 0 && !willChargeImmediately && hasPaymentMethod;

		// Build confirmation message
		let confirmMessage = `📊 **Cap Increase Summary**\n\n`;
		confirmMessage += `Current Cap: **${currentCap} students**\n`;
		confirmMessage += `New Cap: **${newCap} students**\n`;
		confirmMessage += `Additional: **+${additionalStudents} students**\n`;
		confirmMessage += `Rate: **$${rate.toFixed(2)}/student/year**\n\n`;

		if (willChargeImmediately) {
			confirmMessage += `⚠️ **IMMEDIATE CHARGE**\n\n`;
			confirmMessage += `You will be charged **$${additionalCost.toFixed(2)}** immediately for the additional capacity.\n\n`;
			confirmMessage += `Current Annual Cost: $${currentTotalCost.toFixed(2)}\n`;
			confirmMessage += `New Annual Cost: **$${newTotalCost.toFixed(2)}**\n\n`;
			
			if (!hasPaymentMethod) {
				os.alert({
					type: 'error',
					title: 'No Payment Method',
					text: 'Please add a payment method before increasing your cap.'
				});
				return;
			}
		} else if (willChargeOnSubscriptionSetup) {
			confirmMessage += `💳 **CHARGE WHEN SUBSCRIPTION ACTIVATES**\n\n`;
			confirmMessage += `The additional **$${additionalCost.toFixed(2)}** will be charged when you activate your subscription.\n\n`;
			confirmMessage += `Future Annual Cost: **$${newTotalCost.toFixed(2)}**\n\n`;
		} else {
			confirmMessage += `📝 **CAP UPDATED**\n\n`;
			confirmMessage += `Your student cap has been updated. Set up billing to start charging at the new rate.\n\n`;
			confirmMessage += `Future Annual Cost: **$${newTotalCost.toFixed(2)}**\n\n`;
		}

		confirmMessage += `Do you want to proceed?`;

		const { canceled } = await os.confirm({
			type: willChargeImmediately ? 'warning' : 'question',
			title: willChargeImmediately ? 'Confirm Payment' : 'Confirm Cap Increase',
			text: confirmMessage,
		});

		if (canceled) return;

		// User confirmed, proceed with the increase
		await os.apiWithDialog('schools/set-student-cap', {
			studentCap: newCap,
		});

		os.alert({
			type: 'success',
			text: willChargeImmediately 
				? `Student cap increased to ${newCap} and payment of $${additionalCost.toFixed(2)} processed successfully!`
				: `Student cap updated to ${newCap} successfully!`
		});

		await loadBillingData();
	} catch (error: any) {
		os.alert({
			type: 'error',
			title: 'Failed to Update Cap',
			text: error.message || 'An error occurred while updating the student cap.'
		});
	}
}

async function requestEmergencyCapIncrease() {
	const formResult: any = await os.form('Emergency Cap Increase', {
		urgentIncrease: {
			type: 'number',
			label: 'Emergency Increase Amount',
			min: 1,
			max: 1000,
			default: 50,
		},
		urgencyReason: {
			type: 'string',
			label: 'Emergency Reason',
			placeholder: 'Explain why you need an emergency cap increase...',
			required: true,
			maxLength: 500,
		},
	});

	if (formResult.canceled) return;

	const currentCap = capStatus.value?.studentCap || 0;
	const newCap = currentCap + formResult.result.urgentIncrease;

	try {
		// Calculate cost locally
		const rate = billing.value?.pricePerStudentAnnual ?? standardRate.value;
		const additionalCost = formResult.result.urgentIncrease * rate;
		const willChargeImmediately = rate > 0 && billing.value?.status === 'active' && billing.value?.stripeCustomerId;

		let confirmMessage = `🚨 **Emergency Cap Increase**\n\n`;
		confirmMessage += `Adding: **${formResult.result.urgentIncrease} students**\n`;
		confirmMessage += `New Cap: **${newCap} students**\n\n`;

		if (willChargeImmediately) {
			confirmMessage += `⚠️ **Immediate charge: $${additionalCost.toFixed(2)}**\n\n`;
		}

		confirmMessage += `Reason: ${formResult.result.urgencyReason}\n\n`;
		confirmMessage += `Proceed with emergency increase?`;

		const { canceled } = await os.confirm({
			type: 'warning',
			title: 'Confirm Emergency Increase',
			text: confirmMessage,
		});

		if (canceled) return;

		await os.apiWithDialog('schools/set-student-cap', {
			studentCap: newCap,
			reason: `EMERGENCY: ${formResult.result.urgencyReason}`,
		});

		os.alert({
			type: 'success',
			text: `Emergency cap increase successful! New cap: ${newCap} students.`
		});

		await loadBillingData();
	} catch (error: any) {
		os.alert({
			type: 'error',
			title: 'Emergency Increase Failed',
			text: error.message || 'Failed to process emergency cap increase.'
		});
	}
}

function viewCapHistory() {
	os.alert({
		type: 'info',
		title: 'Student Cap History',
		text: 'Cap history feature coming soon. This will show all changes made to your student cap, including dates, amounts, and reasons for changes.'
	});
}

function upgradeFromFree() {
	// Allow free access schools to set up paid billing
	createSubscription();
}

onMounted(() => {
	loadBillingData();
});

definePageMetadata({
	title: i18n.ts.billing,
	icon: 'ph-credit-card ph-lg',
});
</script>

<style lang="scss" scoped>
.title {
	font-weight: bold;
	font-size: 1.2em;
	margin-bottom: 0.5em;
}

.description {
	opacity: 0.7;
	margin-bottom: 2em;
}

.billing-sections {
	display: grid;
	gap: 1.5rem;
	margin-bottom: 2rem;
}

.billing-card {
	background: var(--panel);
	border-radius: 12px;
	border: 1px solid var(--divider);
	overflow: hidden;

	.card-header {
		padding: 1.5rem;
		background: var(--bg);
		border-bottom: 1px solid var(--divider);
		display: flex;
		align-items: center;
		gap: 1rem;

		.status-icon, i {
			font-size: 1.5rem;
			color: var(--accent);
		}

		.header-info {
			.status-title {
				font-weight: bold;
				font-size: 1.1em;
			}

			.status-subtitle {
				opacity: 0.7;
				font-size: 0.9em;
			}
		}
	}

	.card-content {
		padding: 1.5rem;
	}

	&.subscription-status {
		.status-icon {
			&.ph-check-circle { color: var(--success); }
			&.ph-warning-circle { color: var(--warn); }
			&.ph-x-circle { color: var(--error); }
			&.ph-clock { color: var(--accent); }
		}
	}
}

.status-details, .payment-details {
	display: grid;
	gap: 1rem;

	.detail-item {
		display: flex;
		justify-content: space-between;
		align-items: center;

		&.billing-note {
			display: flex;
			gap: 0.5rem;
			align-items: flex-start;
			justify-content: flex-start;
			background: var(--info-bg);
			padding: 1rem;
			border-radius: 8px;
			border: 1px solid var(--info);
			color: var(--info);
			font-size: 0.9em;
			margin-top: 0.5rem;

			i {
				margin-top: 0.1rem;
				flex-shrink: 0;
			}
		}

		label {
			font-weight: 500;
			opacity: 0.8;
		}

		.value {
			font-weight: bold;
		}
	}
}

.no-payment-info {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	color: var(--warn);
	opacity: 0.8;

	i {
		font-size: 1.2rem;
	}
}

.billing-actions {
	display: flex;
	gap: 1rem;
	margin-bottom: 2rem;
	flex-wrap: wrap;

	@media (max-width: 768px) {
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;

		> * {
			width: 100%;
		}
	}
}

.billing-info {
	margin: 0;
	background: var(--warnBg);
	border: 1px solid var(--warn);
}

.special-billing-info {
	background: var(--infoBg);
	border: 1px solid var(--info);
	margin-bottom: 1rem;
}

.loading {
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 200px;
}

.cap-management {
	.status-icon {
		color: var(--accent);
	}

	.card-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.cap-management-actions {
		margin-top: 16px;
		padding: 16px;
		background: var(--bg);
		border-radius: 8px;
		border: 1px solid var(--divider);

		h4 {
			margin: 0 0 12px 0;
			font-size: 1.1em;
			font-weight: 600;
		}

		.action-buttons {
			display: flex;
			gap: 12px;
			flex-wrap: wrap;
		}
	}

	.cap-details {
		display: grid;
		gap: 1rem;

		.detail-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}
	}

	.cap-info {
		background: var(--infoBg);
		border: 1px solid var(--info);
		padding: 1rem;
		border-radius: 8px;
	}
}
</style>
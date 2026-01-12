<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader :actions="headerActions" :tabs="headerTabs" />
		</template>
		<MkSpacer :content-max="800" :margin-min="16" :margin-max="32">
			<div class="school-admin-dashboard">
				<div v-if="school" class="dashboard-content">
					<!-- School Profile Section -->
					<div class="_formRoot">

						<div class="_formBlock school-header">
							<div class="school-info">
								<div class="school-logo" @click="uploadSchoolLogo">
									<img v-if="schoolLogoUrl" :src="schoolLogoUrl" :alt="school.name" class="logo" />
									<div v-else class="placeholder-logo">
										<i class="ph-graduation-cap-bold ph-lg placeholder-icon"></i>
									</div>
									<div class="logo-overlay">
										<i class="ph-link ph-lg"></i>
										<span>{{ schoolLogoUrl ? 'Change Logo' : 'Set Logo' }}</span>
									</div>
								</div>
								<div class="school-details">
									<h2>{{ school.name }}</h2>
									<p class="domain">{{ school.domain }}</p>
									<p v-if="school.location" class="location">{{ school.location }}</p>
								</div>
							</div>
							<div class="actions">
								<MkButton @click="editSchoolProfile" primary>
									<i class="ph-pencil-simple ph-lg"></i>
									{{ i18n.ts.editProfile }}
								</MkButton>
							</div>
						</div>

						<!-- Subscription Status -->
						<div class="_formBlock subscription-status">
							<h3>{{ i18n.ts.subscriptionStatus }}</h3>
							<div class="status-card" :class="subscriptionStatusClass">
								<div class="status-info">
									<div class="status-badge">
										<i :class="subscriptionIcon"></i>
										<span class="status-text">{{ formatSubscriptionStatus(billing?.status ||
											'pending')
										}}</span>
									</div>
									<div v-if="billing" class="billing-details">
										<p><strong>{{ i18n.ts.students }}:</strong> {{ billing.studentCount }}</p>
										<p><strong>Annual Rate:</strong> ${{ (billing.studentCount *
											(billing.pricePerStudentAnnual || standardRate)).toFixed(2) }} per year</p>
										<p><strong>Rate per Student:</strong> ${{ (billing.pricePerStudentAnnual ||
											standardRate).toFixed(2) }} per year</p>
										<p v-if="billing.nextPaymentDate"><strong>{{ i18n.ts.nextPayment }}:</strong> {{
											formatDate(billing.nextPaymentDate) }}</p>
									</div>
								</div>
								<div class="status-actions">
									<MkButton v-if="billing?.status === 'active'" @click="manageBilling">
										<i class="ph-credit-card ph-lg"></i>
										{{ i18n.ts.manageBilling }}
									</MkButton>
									<MkButton v-else @click="activateSubscription" primary>
										<i class="ph-credit-card ph-lg"></i>
										{{ i18n.ts.activateSubscription }}
									</MkButton>
								</div>
							</div>
						</div>

						<!-- School Settings -->
						<div class="_formBlock settings-section">
							<h3>{{ i18n.ts.schoolSettings || 'School Settings' }}</h3>
							<div class="settings-grid">
								<div class="setting-item registration-setting">
									<div class="setting-info">
										<div class="setting-header">
											<div class="setting-label">{{ i18n.ts.registrationMode || 'Registration Mode' }}</div>
											<div class="setting-status" :class="registrationModeClass">
												<i :class="registrationModeIcon"></i>
												<span>{{ registrationModeText }}</span>
											</div>
										</div>
									<div class="setting-description">
										{{ registrationModeDescription }}
									</div>
									
									<!-- Show billing warning if trying to enable registration without active billing -->
									<MkInfo v-if="registrationMode === 'disabled' && billing && billing.status !== 'active' && !school?.adminOverride && !school?.freeActivation" class="billing-warning" style="margin-top: 12px;">
										<strong>⚠️ Billing Required</strong><br>
										To enable student registration, you must first activate your school billing.
										<MkButton @click="router.push('/school-admin/billing')" primary small style="margin-top: 8px;">
											<i class="ph-credit-card ph-lg"></i>
											Go to Billing
										</MkButton>
									</MkInfo>
									
									<div class="registration-modes">
										<div class="mode-buttons">
											<button 
												class="mode-button"
												:class="{ active: registrationMode === 'domain' }"
												@click="updateRegistrationMode('domain')"
											>
												<i class="ph-globe ph-lg"></i>
												{{ i18n.ts.domainBased || 'Domain-based' }}
											</button>
											<button 
												class="mode-button"
												:class="{ active: registrationMode === 'disabled' }"
												@click="updateRegistrationMode('disabled')"
											>
												<i class="ph-lock ph-lg"></i>
												{{ i18n.ts.disabled || 'Disabled' }}
											</button>
										</div>
									</div>
								</div>
							</div>								<div class="setting-item">
									<div class="setting-info">
										<div class="setting-label">{{ i18n.ts.schoolLocation || 'School Location' }}
										</div>
										<div class="setting-value">
											{{ school?.location || i18n.ts.notSet || 'Not set' }}
										</div>
									</div>
									<MkButton @click="updateLocation" size="small">
										{{ i18n.ts.update || 'Update' }}
									</MkButton>
								</div>
							</div>
						</div>



						<!-- Students Overview -->
						<div class="_formBlock students-section">
							<h3>{{ i18n.ts.students }}</h3>
							<div class="students-stats">
								<div class="stat-card">
									<div class="stat-number">{{ studentCount }}</div>
									<div class="stat-label">{{ i18n.ts.totalStudents }}</div>
								</div>
								<div class="stat-card">
									<div class="stat-number">{{ teacherCount }}</div>
									<div class="stat-label">{{ i18n.ts.totalTeachers || 'Total Teachers' }}</div>
								</div>
								<div class="stat-card">
									<div class="stat-number">{{ recentStudents }}</div>
									<div class="stat-label">{{ i18n.ts.recentRegistrations }}</div>
								</div>

							</div>
							<div class="student-actions">
								<MkButton @click="viewStudentDirectory">
									<i class="ph-users ph-lg"></i>
									{{ i18n.ts.viewStudentDirectory }}
								</MkButton>
								<MkButton @click="goToTeachers">
									<i class="ph-chalkboard-teacher ph-lg"></i>
									{{ i18n.ts.manageTeachers || 'Manage Teachers' }}
								</MkButton>
							</div>
						</div>



						<!-- Analytics Section -->
						<div class="_formBlock analytics-section">
							<h3>{{ i18n.ts.analytics }}</h3>
							<div class="analytics-grid">
								<div class="metric-card">
									<div class="metric-value">{{ analytics.activeUsers || 0 }}</div>
									<div class="metric-label">{{ i18n.ts.activeUsers }}</div>
								</div>
								<div class="metric-card">
									<div class="metric-value">{{ analytics.postsThisWeek || 0 }}</div>
									<div class="metric-label">{{ i18n.ts.postsThisWeek }}</div>
								</div>
								<div class="metric-card">
									<div class="metric-value">{{ analytics.engagementRate || '0%' }}</div>
									<div class="metric-label">{{ i18n.ts.engagement }}</div>
								</div>
							</div>
						</div>

						<!-- Moderation Section -->
						<div class="_formBlock moderation-section">
							<h3>{{ i18n.ts.moderation }}</h3>
							<div class="moderation-grid">
								<div class="metric-card" :class="{ 'has-issues': moderationStats.pendingReports > 0 }">
									<div class="metric-value">{{ moderationStats.pendingReports || 0 }}</div>
									<div class="metric-label">{{ i18n.ts.pendingReports || 'Pending Reports' }}</div>
								</div>
								<div class="metric-card" :class="{ 'has-issues': moderationStats.flaggedContent > 0 }">
									<div class="metric-value">{{ moderationStats.flaggedContent || 0 }}</div>
									<div class="metric-label">{{ i18n.ts.flaggedContent || 'Flagged Content' }}</div>
								</div>
								<div class="metric-card">
									<div class="metric-value">{{ moderationStats.suspendedUsers || 0 }}</div>
									<div class="metric-label">{{ i18n.ts.suspendedUsers || 'Suspended Users' }}</div>
								</div>
							</div>
							<div v-if="moderationStats.pendingReports > 0 || moderationStats.flaggedContent > 0"
								class="moderation-actions">
								<MkButton @click="viewModerationReports" primary>
									<i class="ph-shield-warning ph-lg"></i>
									{{ i18n.ts.reviewReports || 'Review Reports' }}
								</MkButton>
							</div>
						</div>



						<!-- Student Cap Status -->
						<div class="_formBlock cap-section">
							<h3>Student Capacity</h3>
							<div v-if="capStatus">
								<MkStudentCapIndicator :student-cap="capStatus.studentCap"
									:current-student-count="capStatus.currentStudentCount"
									:utilization-percentage="capStatus.utilizationPercentage"
									:cap-enforced="capStatus.capEnforced"
									:can-register-new-students="capStatus.canRegisterNewStudents"
									:is-near-capacity="capStatus.isNearCapacity" :cap-status="capStatus.capStatus"
									:show-details="true" :show-actions="true" :show-manage-link="true" size="medium"
									:billing-rate="billing?.pricePerStudentAnnual || standardRate" />
							</div>
							<div v-else class="cap-loading">
								<MkLoading />
								<p>Loading student capacity information...</p>
							</div>
						</div>
					</div>
				</div>

				<div v-else-if="loading" class="loading">
					<MkLoading />
				</div>

				<div v-else class="error">
					<MkError @retry="loadSchoolData">
						{{ i18n.ts.failedToLoadSchoolData }}
					</MkError>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkStudentCapIndicator from '@/components/MkStudentCapIndicator.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { $i } from '@/account';
import { useRouter } from '@/router';
import { useStripePricing } from '@/composables/use-stripe-pricing';

const router = useRouter();
const { standardRate } = useStripePricing();

const school = ref(null);
const billing = ref(null);
const capStatus = ref(null);
const loading = ref(true);
const studentCount = ref(0);
const teacherCount = ref(0);
const recentStudents = ref(0);

const schoolSettings = ref(null);
const registrationMode = ref('disabled');
const analytics = ref({
	activeUsers: 0,
	postsThisWeek: 0,
	engagementRate: '0%'
});
const moderationStats = ref({
	pendingReports: 0,
	flaggedContent: 0,
	suspendedUsers: 0,
	hiddenPosts: 0
});

const headerActions = computed(() => [
	{
		icon: 'ph-gear-six ph-lg',
		text: i18n.ts.settings,
		handler: () => editSchoolProfile(),
	},
]);

const headerTabs = computed(() => []);

const schoolLogoUrl = computed(() => {
	if (!school.value) return null;
	// Prefer logoUrl if available, otherwise try to construct from logoId
	if (school.value.logoUrl) return school.value.logoUrl;
	if (school.value.logoId) {
		// For now, return null since we need the full file data to get the URL
		// The backend should populate logoUrl when logoId is set
		return null;
	}
	return null;
});

const subscriptionStatusClass = computed(() => {
	if (!billing.value) return 'status-pending';

	switch (billing.value.status) {
		case 'active': return 'status-active';
		case 'suspended': return 'status-suspended';
		case 'cancelled': return 'status-cancelled';
		default: return 'status-pending';
	}
});

const subscriptionIcon = computed(() => {
	if (!billing.value) return 'ph-clock ph-lg';

	switch (billing.value.status) {
		case 'active': return 'ph-check-circle ph-lg';
		case 'suspended': return 'ph-warning ph-lg';
		case 'cancelled': return 'ph-x-circle ph-lg';
		default: return 'ph-clock ph-lg';
	}
});

const registrationModeClass = computed(() => {
	if (!schoolSettings.value) return 'mode-unknown';

	const settings = schoolSettings.value.registrationSettings;
	if (settings.allowDomainSignups) return 'mode-open';
	return 'mode-closed';
});

const registrationModeIcon = computed(() => {
	if (!schoolSettings.value) return 'ph-question ph-lg';

	const settings = schoolSettings.value.registrationSettings;
	if (settings.allowDomainSignups) return 'ph-globe ph-lg';
	return 'ph-lock ph-lg';
});

const registrationModeText = computed(() => {
	if (!schoolSettings.value) return i18n.ts.unknown || 'Unknown';

	const settings = schoolSettings.value.registrationSettings;
	if (settings.allowDomainSignups) return i18n.ts.domainBasedSignup || 'Domain-based Signup';
	return i18n.ts.registrationClosed || 'Registration Closed';
});

const registrationModeDescription = computed(() => {
	if (!schoolSettings.value) return '';

	const settings = schoolSettings.value.registrationSettings;
	if (settings.allowDomainSignups) return i18n.ts.domainSignupDescription || 'Students with your school email domain can register automatically';
	return i18n.ts.registrationClosedDescription || 'New registrations are not allowed';
});

// Update registrationMode when schoolSettings changes
function updateRegistrationModeFromSettings() {
	if (!schoolSettings.value?.registrationSettings) {
		// Default to domain-based if no settings exist yet
		registrationMode.value = 'domain';
		return;
	}

	const settings = schoolSettings.value.registrationSettings;
	
	if (settings.allowDomainSignups) {
		registrationMode.value = 'domain';
	} else {
		registrationMode.value = 'disabled';
	}
}

// Handle registration mode changes from the radio buttons
async function updateRegistrationMode(newMode: string) {
	if (!$i?.adminForSchoolId) return;

	try {
		let allowDomainSignups = false;
		let requireInvitation = false;
		let autoGraduationEnabled = schoolSettings.value?.registrationSettings?.autoGraduationEnabled ?? true;

		switch (newMode) {
			case 'domain':
				allowDomainSignups = true;
				requireInvitation = false;
				break;
			case 'disabled':
			default:
				allowDomainSignups = false;
				requireInvitation = false;
				break;
		}

		// If trying to open registration, check billing status first
		if (allowDomainSignups && !schoolSettings.value?.registrationSettings?.allowDomainSignups) {
			// Check if billing is active
			if (!billing.value || (billing.value.status !== 'active' && !school.value?.adminOverride && !school.value?.freeActivation)) {
				const confirmed = await os.confirm({
					type: 'warning',
					title: 'Billing Required',
					text: `⚠️ **Cannot open registration without active billing**\n\nYour school billing must be active before you can enable student registration.\n\nWould you like to go to the billing page to activate your subscription?`,
				});

				if (confirmed && !confirmed.canceled) {
					router.push('/school-admin/billing');
				}
				return;
			}
		}

		const newSettings = {
			allowDomainSignups,
			requireInvitation,
			autoGraduationEnabled
		};

		await os.apiWithDialog('schools/update-settings', {
			schoolId: $i.adminForSchoolId,
			registrationSettings: newSettings
		});

		// Update local settings immediately to ensure UI reflects the change
		if (schoolSettings.value) {
			schoolSettings.value.registrationSettings = newSettings;
		}

		// Explicitly update registration mode to ensure radio reflects the new state
		registrationMode.value = newMode;

		// Also reload school settings specifically to ensure everything is in sync
		try {
			schoolSettings.value = await os.api('schools/get-settings', {
				schoolId: $i.adminForSchoolId
			});
			// Double-check that the registration mode matches what we expect
			updateRegistrationModeFromSettings();
		} catch (error) {
			console.warn('Could not reload school settings:', error);
		}
	} catch (error) {
		// Error handled by apiWithDialog
		// Revert the radio button to previous state
		updateRegistrationModeFromSettings();
	}
}

function formatSubscriptionStatus(status: string): string {
	const statuses = {
		active: i18n.ts.active,
		pending: i18n.ts.pending,
		suspended: i18n.ts.suspended,
		cancelled: i18n.ts.cancelled
	};
	return statuses[status] || status;
}

function formatDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString();
}

async function loadSchoolData() {
	if (!$i?.isSchoolAdmin || !$i?.adminForSchoolId) {
		os.alert({
			type: 'error',
			text: i18n.ts.schoolAdminAccessRequired
		});
		return;
	}

	loading.value = true;

	try {
		// Load school information
		school.value = await os.api('schools/show', {
			schoolId: $i.adminForSchoolId
		});

		// Load billing information (no schoolId needed - uses admin's school)
		try {
			billing.value = await os.api('schools/billing-info', {});
		} catch (error) {
			console.warn('Could not load billing info:', error);
		}

		// Load student statistics (no schoolId needed - uses admin's school)
		try {
			const stats = await os.api('schools/student-stats', {});
			studentCount.value = stats.total;
			teacherCount.value = stats.teachers || 0;
			recentStudents.value = stats.recent;

		} catch (error) {
			console.warn('Could not load student stats:', error);
		}

		// Load school settings
		try {
			schoolSettings.value = await os.api('schools/get-settings', {
				schoolId: $i.adminForSchoolId
			});
			// Update registration mode after loading settings
			updateRegistrationModeFromSettings();
		} catch (error) {
			console.warn('Could not load school settings:', error);
		}



		// Load analytics (no schoolId needed - uses admin's school)
		try {
			analytics.value = await os.api('schools/analytics', {});
		} catch (error) {
			console.warn('Could not load analytics:', error);
		}

		// Load moderation stats
		try {
			moderationStats.value = await os.api('schools/moderation-stats', {});
		} catch (error) {
			console.warn('Could not load moderation stats:', error);
		}

		// Load student cap status
		try {
			capStatus.value = await os.api('schools/cap-status', {});
		} catch (error) {
			console.warn('Could not load cap status:', error);
		}

	} catch (error) {
		os.alert({
			type: 'error',
			text: i18n.ts.failedToLoadSchoolData
		});
	} finally {
		loading.value = false;
	}
}

async function editSchoolProfile() {
	const { canceled, result } = await os.form(i18n.ts.editSchoolProfile, {
		name: {
			type: 'string',
			label: i18n.ts.schoolName,
			default: school.value?.name || ''
		},
		description: {
			type: 'string',
			label: i18n.ts.description,
			default: school.value?.description || ''
		},
		websiteUrl: {
			type: 'string',
			label: i18n.ts.website,
			default: school.value?.websiteUrl || ''
		}
	});

	if (canceled) return;

	try {
		await os.apiWithDialog('schools/update-profile', {
			schoolId: $i?.adminForSchoolId,
			...result
		});

		// Reload school data
		await loadSchoolData();
	} catch (error) {
		// Error handled by apiWithDialog
	}
}

async function uploadSchoolLogo() {
	const { selectFile } = await import('@/scripts/select-file');
	
	selectFile(null, i18n.ts.logo || 'Logo').then(async (file) => {
		let originalOrCropped = file;

		const { canceled } = await os.yesno({
			type: 'question',
			text: i18n.t('cropImageAsk') || 'Do you want to crop this image?',
		});

		if (!canceled) {
			originalOrCropped = await os.cropImage(file, {
				aspectRatio: 1,
			});
		}

		try {
			// Update school profile with new logo file ID
			await os.apiWithDialog('schools/update-profile', {
				schoolId: $i?.adminForSchoolId,
				logoId: originalOrCropped.id
			});

			// Reload school data
			await loadSchoolData();
		} catch (error) {
			// Error handled by apiWithDialog
		}
	}).catch(() => {
		// User canceled file selection
	});
}

function manageBilling() {
	// Redirect to billing page
	router.push('/school-admin/billing');
}

function activateSubscription() {
	// Redirect to billing page where they can activate
	router.push('/school-admin/billing');
}

function viewStudentDirectory() {
	router.push('/school-admin/students');
}

function viewReports() {
	// Redirect to moderation page
	router.push('/school-admin/moderation');
}

function viewModerationReports() {
	// Redirect to moderation page
	router.push('/school-admin/moderation');
}

function manageDomains() {
	// Show current domain info with contact information
	os.alert({
		type: 'info',
		title: 'Domain Management',
		text: `Your school domain: ${school.value?.domain || 'N/A'}\n\nTo add additional domains or modify domain settings, please contact support@campra.app with your school administration credentials.`
	});
}

function viewActivity() {
	// Redirect to analytics page
	router.push('/school-admin/analytics');
}

function goToSettings() {
	router.push('/school-admin/settings');
}



function goToTeachers() {
	router.push('/school-admin/teachers');
}

async function toggleRegistrationMode() {
	if (!schoolSettings.value) return;

	const currentSettings = schoolSettings.value.registrationSettings;
	const { canceled, result } = await os.form(i18n.ts.registrationSettings || 'Registration Settings', {
		allowDomainSignups: {
			type: 'boolean',
			label: i18n.ts.allowDomainSignups || 'Allow domain-based signups',
			default: currentSettings.allowDomainSignups
		},
		requireInvitation: {
			type: 'boolean',
			label: i18n.ts.requireInvitation || 'Require invitation for registration',
			default: currentSettings.requireInvitation
		}
	});

	if (canceled) return;

	try {
		await os.apiWithDialog('schools/update-settings', {
			schoolId: $i?.adminForSchoolId,
			registrationSettings: result
		});

		// Reload school data
		await loadSchoolData();
	} catch (error) {
		// Error handled by apiWithDialog
	}
}

async function updateLocation() {
	const { canceled, result } = await os.form(i18n.ts.schoolLocation || 'School Location', {
		location: {
			type: 'string',
			label: i18n.ts.location || 'Location',
			placeholder: 'City, State, Country',
			default: school.value?.location || ''
		}
	});

	if (canceled) return;

	try {
		await os.apiWithDialog('schools/update-settings', {
			schoolId: $i?.adminForSchoolId,
			location: result.location
		});

		// Reload school data
		await loadSchoolData();
	} catch (error) {
		// Error handled by apiWithDialog
	}
}

// Watch for changes in schoolSettings and update registrationMode accordingly
watch(schoolSettings, () => {
	updateRegistrationModeFromSettings();
}, { deep: true, immediate: true });

onMounted(() => {
	loadSchoolData();
});

definePageMetadata({
	title: i18n.ts.schoolAdminDashboard,
	icon: 'ph-graduation-cap-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.school-admin-dashboard {
	.school-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		background: var(--panel);
		border-radius: 8px;

		.school-info {
			display: flex;
			align-items: center;

			.school-logo {
				margin-right: 16px;
				position: relative;
				cursor: pointer;
				transition: all 0.2s ease;

				&:hover {
					transform: scale(1.02);

					.logo-overlay {
						opacity: 1;
					}
				}

				.logo {
					width: 64px;
					height: 64px;
					border-radius: 8px;
					object-fit: cover;
					display: block;
				}

				.placeholder-logo {
					width: 64px;
					height: 64px;
					display: flex;
					align-items: center;
					justify-content: center;
					background: var(--accent);
					color: white;
					border-radius: 8px;

					.placeholder-icon {
						font-size: 32px;
					}
				}

				.logo-overlay {
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background: rgba(0, 0, 0, 0.7);
					border-radius: 8px;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					color: white;
					opacity: 0;
					transition: opacity 0.2s ease;
					font-size: 0.8em;

					i {
						font-size: 1.5em;
						margin-bottom: 4px;
					}

					span {
						font-weight: 500;
					}
				}
			}

			.school-details {
				h2 {
					margin: 0 0 4px 0;
					font-size: 1.5em;
					font-weight: bold;
				}

				.domain {
					margin: 0 0 4px 0;
					color: var(--accent);
					font-family: monospace;
				}

				.location {
					margin: 0;
					opacity: 0.7;
				}
			}
		}
	}

	.subscription-status {
		.status-card {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 16px;
			border-radius: 8px;
			border: 2px solid;

			&.status-active {
				background: var(--success);
				border-color: var(--success);
				color: white;
			}

			&.status-pending {
				background: var(--warn);
				border-color: var(--warn);
				color: white;
			}

			&.status-suspended {
				background: var(--error);
				border-color: var(--error);
				color: white;
			}

			&.status-cancelled {
				background: var(--fg);
				border-color: var(--fg);
				color: var(--bg);
			}

			.status-info {
				.status-badge {
					display: flex;
					align-items: center;
					margin-bottom: 8px;

					i {
						margin-right: 8px;
					}

					.status-text {
						font-weight: bold;
						font-size: 1.1em;
					}
				}

				.billing-details {
					p {
						margin: 4px 0;
						opacity: 0.9;
					}
				}
			}
		}
	}

	.students-section {
		.students-stats {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
			gap: 16px;
			margin-bottom: 16px;

			.stat-card {
				text-align: center;
				padding: 16px;
				background: var(--panel);
				border-radius: 8px;

				.stat-number {
					font-size: 2em;
					font-weight: bold;
					color: var(--accent);
				}

				.stat-label {
					opacity: 0.7;
					margin-top: 4px;
				}
			}
		}
	}

	.analytics-section {
		.analytics-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
			gap: 16px;

			.metric-card {
				text-align: center;
				padding: 16px;
				background: var(--panel);
				border-radius: 8px;

				.metric-value {
					font-size: 1.5em;
					font-weight: bold;
					color: var(--accent);
				}

				.metric-label {
					opacity: 0.7;
					margin-top: 4px;
					font-size: 0.9em;
				}
			}
		}
	}

	.moderation-section {
		.moderation-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
			gap: 16px;
			margin-bottom: 16px;

			.metric-card {
				text-align: center;
				padding: 16px;
				background: var(--panel);
				border-radius: 8px;
				border: 1px solid var(--divider);
				transition: all 0.2s;

				&.has-issues {
					border-color: var(--warn);
					background: var(--warnBg);

					.metric-value {
						color: var(--warn);
					}
				}

				.metric-value {
					font-size: 1.5em;
					font-weight: bold;
					color: var(--accent);
				}

				.metric-label {
					opacity: 0.7;
					margin-top: 4px;
					font-size: 0.9em;
				}
			}
		}

		.moderation-actions {
			display: flex;
			justify-content: center;
			gap: 12px;
		}
	}

	.moderation-section {
		.moderation-actions {
			display: flex;
			gap: 12px;
			flex-wrap: wrap;
		}
	}

	.loading,
	.error {
		text-align: center;
		padding: 32px;
	}

	.cap-section {
		h3 {
			margin: 0 0 16px 0;
			font-size: 1.2em;
			font-weight: bold;
		}
	}

	.quick-actions-section {
		.quick-actions-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
			gap: 16px;

			.action-button {
				display: flex;
				align-items: center;
				gap: 16px;
				padding: 20px;
				text-align: left;
				background: var(--panel);
				border: 1px solid var(--divider);
				border-radius: 12px;
				transition: all 0.2s;

				&:hover {
					border-color: var(--accent);
					background: var(--accentedBg);
				}

				i {
					font-size: 24px;
					color: var(--accent);
					flex-shrink: 0;
				}

				.action-content {
					.action-title {
						font-weight: 600;
						margin-bottom: 4px;
					}

					.action-desc {
						font-size: 0.9em;
						opacity: 0.7;
						line-height: 1.3;
					}
				}
			}
		}
	}

	.settings-section {
		.settings-grid {
			display: grid;
			gap: 16px;

			.setting-item {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 20px;
				background: var(--panel);
				border-radius: 12px;
				border: 1px solid var(--divider);
				transition: all 0.2s;

				&:hover {
					border-color: var(--accent);
					background: var(--accentedBg);
				}

				.setting-info {
					flex: 1;

					.setting-header {
						display: flex;
						align-items: center;
						justify-content: space-between;
						margin-bottom: 8px;
					}

					.setting-label {
						font-weight: 600;
						font-size: 1.1em;
						color: var(--fg);
					}

					.setting-status {
						display: flex;
						align-items: center;
						gap: 6px;
						padding: 4px 12px;
						border-radius: 12px;
						font-size: 0.85em;
						font-weight: 500;

						&.mode-open {
							background: var(--success);
							color: var(--successFg);
						}

						&.mode-invitation {
							background: var(--warn);
							color: var(--warnFg);
						}

						&.mode-closed, &.mode-unknown {
							background: var(--error);
							color: var(--errorFg);
						}
					}

					.setting-description {
						margin-bottom: 16px;
						font-size: 0.9em;
						color: var(--fgTransparentWeak);
						line-height: 1.4;
					}

					.registration-modes {
						margin-top: 12px;

						.mode-buttons {
							display: flex;
							gap: 8px;
							flex-wrap: wrap;

							.mode-button {
								display: flex;
								align-items: center;
								gap: 6px;
								padding: 8px 16px;
								border: 2px solid var(--divider);
								border-radius: 8px;
								background: var(--panel);
								color: var(--fg);
								font-size: 0.9em;
								font-weight: 500;
								cursor: pointer;
								transition: all 0.2s ease;

								&:hover {
									border-color: var(--accent);
									background: var(--accentedBg);
								}

								&.active {
									border-color: var(--accent);
									background: var(--accent);
									color: var(--accentFg);
								}

								i {
									font-size: 1.1em;
								}
							}
						}
					}

					.setting-value {
						display: flex;
						align-items: center;
						gap: 8px;
						margin-bottom: 6px;
						font-weight: 500;

						&.mode-open {
							color: var(--success);
						}

						&.mode-invitation {
							color: #d97706;
						}

						&.mode-closed {
							color: var(--error);
						}

						&.mode-unknown {
							color: var(--fg);
							opacity: 0.5;
						}

						i {
							font-size: 1.1em;
						}
					}

					.setting-desc {
						margin: 0;
						opacity: 0.7;
						font-size: 0.9em;
						line-height: 1.4;
					}
				}
			}
		}
	}

	.students-section {
		.students-stats {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
			gap: 16px;
			margin-bottom: 16px;

			.stat-card {
				text-align: center;
				padding: 16px;
				background: var(--panel);
				border-radius: 8px;

				.stat-number {
					font-size: 2em;
					font-weight: bold;
					color: var(--accent);
				}

				.stat-label {
					opacity: 0.7;
					margin-top: 4px;
					font-size: 0.9em;
				}
			}
		}

		.student-actions {
			display: flex;
			gap: 12px;
			flex-wrap: wrap;
		}
	}

	.recent-imports-section {
		.section-header {
			margin-bottom: 16px;
			
			h3 {
				display: flex;
				align-items: center;
				gap: 8px;
				margin: 0;
				
				.section-icon {
					color: var(--accent);
				}
			}
		}
		
		.import-summary-card {
			background: var(--panel);
			border-radius: 12px;
			border: 1px solid var(--divider);
			overflow: hidden;
			transition: all 0.2s ease;
			
			&:hover {
				border-color: var(--accent);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
			}

			.import-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 16px 20px;
				background: var(--bg);
				border-bottom: 1px solid var(--divider);

				.import-status-badge {
					display: flex;
					align-items: center;
					gap: 6px;
					padding: 6px 12px;
					border-radius: 20px;
					font-size: 0.9em;
					font-weight: 600;
					
					&.success {
						background: rgba(34, 197, 94, 0.1);
						color: #22c55e;
						border: 1px solid rgba(34, 197, 94, 0.2);
					}
					
					&.warning {
						background: rgba(251, 191, 36, 0.15);
						color: #d97706;
						border: 1px solid rgba(251, 191, 36, 0.3);
						font-weight: 600;
					}
					
					&.error {
						background: rgba(239, 68, 68, 0.1);
						color: #ef4444;
						border: 1px solid rgba(239, 68, 68, 0.2);
					}
				}

				.import-date {
					display: flex;
					align-items: center;
					gap: 6px;
					color: var(--fgTransparentWeak);
					font-size: 0.9em;
				}
			}

			.import-stats-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
				gap: 12px;
				padding: 20px;

				.stat-card {
					display: flex;
					align-items: center;
					gap: 12px;
					padding: 16px;
					background: var(--bg);
					border-radius: 8px;
					border: 1px solid var(--divider);
					transition: all 0.2s ease;

					&:hover {
						transform: translateY(-1px);
						box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
					}

					.stat-icon {
						display: flex;
						align-items: center;
						justify-content: center;
						width: 40px;
						height: 40px;
						border-radius: 8px;
						font-size: 20px;
					}

					&.primary .stat-icon {
						background: rgba(var(--accent-rgb), 0.1);
						color: var(--accent);
					}

					&.success .stat-icon {
						background: rgba(34, 197, 94, 0.1);
						color: #22c55e;
					}

					&.error .stat-icon {
						background: rgba(239, 68, 68, 0.1);
						color: #ef4444;
					}

					.stat-content {
						flex: 1;

						.stat-value {
							font-size: 1.4em;
							font-weight: 700;
							line-height: 1.2;
							margin-bottom: 2px;
						}

						.stat-label {
							font-size: 0.85em;
							color: var(--fgTransparentWeak);
							line-height: 1.3;
						}
					}
				}
			}

			.import-actions {
				display: flex;
				gap: 12px;
				padding: 16px 20px;
				background: var(--bg);
				border-top: 1px solid var(--divider);

				.import-more-btn {
					flex: 1;
				}
			}
		}

		.no-imports-card {
			background: var(--panel);
			border-radius: 12px;
			border: 2px dashed var(--divider);
			padding: 40px 20px;
			transition: all 0.2s ease;

			&:hover {
				border-color: var(--accent);
				background: var(--bg);
			}

			.no-imports-content {
				text-align: center;
				max-width: 400px;
				margin: 0 auto;

				.empty-state-icon {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					width: 80px;
					height: 80px;
					background: rgba(var(--accent-rgb), 0.1);
					border-radius: 50%;
					margin-bottom: 20px;

					i {
						font-size: 36px;
						color: var(--accent);
					}
				}

				h4 {
					margin: 0 0 8px 0;
					font-size: 1.2em;
					font-weight: 600;
					color: var(--fg);
				}

				p {
					margin: 0 0 24px 0;
					color: var(--fgTransparentWeak);
					font-size: 0.95em;
					line-height: 1.5;
				}

				.no-imports-actions {
					display: flex;
					gap: 12px;
					justify-content: center;
					flex-wrap: wrap;

					.primary-action {
						min-width: 160px;
					}
				}
			}
		}
	}
}

@media (max-width: 768px) {
	.school-admin-dashboard {
		.quick-actions-section {
			.quick-actions-grid {
				grid-template-columns: 1fr;
			}
		}

		.registration-status-section {
			.registration-status-card {
				flex-direction: column;
				align-items: stretch;
				gap: 16px;
			}
		}

		.students-section {
			.students-stats {
				grid-template-columns: repeat(2, 1fr);
			}

			.student-actions {
				flex-direction: column;
			}
		}

		.recent-imports-section {
			.import-summary-card {
				.import-header {
					flex-direction: column;
					align-items: stretch;
					gap: 12px;
					text-align: center;
				}

				.import-stats-grid {
					grid-template-columns: 1fr;
					padding: 16px;

					.stat-card {
						justify-content: center;
						text-align: center;
						
						.stat-content {
							text-align: center;
						}
					}
				}

				.import-actions {
					flex-direction: column;
					gap: 8px;
				}
			}
			
			.no-imports-card {
				padding: 30px 16px;
				
				.no-imports-content {
					.no-imports-actions {
						flex-direction: column;
						align-items: stretch;
						
						.primary-action {
							min-width: auto;
						}
					}
				}
			}
		}
	}
}
</style>

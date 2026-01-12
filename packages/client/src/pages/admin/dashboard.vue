<template>
<MkStickyContainer>
	<template #header>
		<XHeader :actions="headerActions" :tabs="headerTabs"/>
	</template>
	<MkSpacer :content-max="1200">
		<div class="_formRoot">
			<div class="_formBlock">
				<div class="title">{{ i18n.ts.platformAdmin }} Dashboard</div>
				<div class="description">Campra Platform Administration & School Billing Overview</div>
			</div>

			<div v-if="loading" class="_formBlock">
				<MkLoading/>
			</div>

			<div v-else class="_formRoot">
				<!-- Platform Stats -->
				<div class="_formBlock">
					<div class="stats-grid">
						<div class="stat-card primary">
							<div class="stat-icon">
								<i class="ph-graduation-cap-bold ph-lg"></i>
							</div>
							<div class="stat-content">
								<div class="stat-number">{{ stats.totalSchools }}</div>
								<div class="stat-label">Total Schools</div>
							</div>
						</div>
						<div class="stat-card success">
							<div class="stat-icon">
								<i class="ph-check-circle-bold ph-lg"></i>
							</div>
							<div class="stat-content">
								<div class="stat-number">{{ stats.activeSchools }}</div>
								<div class="stat-label">Active Schools</div>
							</div>
						</div>
						<div class="stat-card info">
							<div class="stat-icon">
								<i class="ph-users-bold ph-lg"></i>
							</div>
							<div class="stat-content">
								<div class="stat-number">{{ stats.totalStudents }}</div>
								<div class="stat-label">Total Students</div>
							</div>
						</div>
						<div class="stat-card accent">
							<div class="stat-icon">
								<i class="ph-currency-dollar-bold ph-lg"></i>
							</div>
							<div class="stat-content">
								<div class="stat-number">${{ (stats.totalStudents * standardRate).toFixed(0) }}</div>
								<div class="stat-label">Annual Revenue</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Billing System Status -->
				<div class="_formBlock">
					<div class="section-header">
						<i class="ph-credit-card-bold ph-lg"></i>
						<span>Billing System Status</span>
					</div>
					<div class="billing-status">
						<div class="status-item">
							<div class="status-indicator" :class="{ active: billingConfig.configured }"></div>
							<div class="status-content">
								<div class="status-title">Stripe Configuration</div>
								<div class="status-subtitle">
									{{ billingConfig.configured ? 'Configured & Ready' : 'Not Configured' }}
								</div>
							</div>
							<MkButton v-if="!billingConfig.configured" @click="goToSettings" primary>
								Configure
							</MkButton>
						</div>
						<div class="status-item">
							<div class="status-indicator active"></div>
							<div class="status-content">
								<div class="status-title">Billing Rate</div>
								<div class="status-subtitle">${{ billingConfig.defaultRate }}/student/year</div>
							</div>
						</div>
						<div class="status-item">
							<div class="status-indicator" :class="{ active: stats.paidSchools > 0 }"></div>
							<div class="status-content">
								<div class="status-title">Active Subscriptions</div>
								<div class="status-subtitle">{{ stats.paidSchools }} schools paying</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Quick Actions -->
				<div class="_formBlock">
					<div class="section-header">
						<i class="ph-lightning-bold ph-lg"></i>
						<span>Quick Actions</span>
					</div>
					<div class="quick-actions">
						<MkButton @click="goToSchools" class="action-button">
							<i class="ph-graduation-cap-bold ph-lg"></i>
							<span>Manage Schools</span>
						</MkButton>
						<MkButton @click="goToSettings" class="action-button">
							<i class="ph-gear-six-bold ph-lg"></i>
							<span>Platform Settings</span>
						</MkButton>
						<MkButton @click="viewBillingReports" class="action-button">
							<i class="ph-chart-line-bold ph-lg"></i>
							<span>Billing Reports</span>
						</MkButton>
						<MkButton @click="openStripeConfig" class="action-button">
							<i class="ph-credit-card-bold ph-lg"></i>
							<span>Stripe Setup</span>
						</MkButton>
					</div>
				</div>

				<!-- Recent Schools -->
				<div class="_formBlock">
					<div class="section-header">
						<i class="ph-clock-bold ph-lg"></i>
						<span>Recent Schools</span>
					</div>
					<div class="recent-schools">
						<div v-for="school in recentSchools" :key="school.id" class="school-item">
							<div class="school-info">
								<div class="school-name">{{ school.name }}</div>
								<div class="school-meta">
									{{ school.studentCount }} students • 
									{{ formatSubscriptionStatus(school.subscriptionStatus) }}
								</div>
							</div>
							<div class="school-actions">
								<MkButton @click="viewSchool(school)" small>
									<i class="ph-eye-bold ph-lg"></i>
								</MkButton>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkLoading from '@/components/MkLoading.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { useRouter } from '@/router';

const router = useRouter();

const loading = ref(true);
const stats = ref({
	totalSchools: 0,
	activeSchools: 0,
	totalStudents: 0,
	paidSchools: 0,
});
const billingConfig = ref({
	configured: false,
	defaultRate: 15.00,
});
const recentSchools = ref([]);

// Fetch current Stripe pricing
const { standardRate } = useStripePricing();

function formatSubscriptionStatus(status: string) {
	const statuses = {
		active: 'Active',
		pending: 'Pending',
		suspended: 'Suspended',
		cancelled: 'Cancelled'
	};
	return statuses[status] || status;
}

async function loadDashboardData() {
	loading.value = true;
	
	try {
		// Load billing configuration
		const config = await os.api('stripe/config-status');
		billingConfig.value = config;

		// Load platform stats (we'll need to create this endpoint)
		try {
			const platformStats = await os.api('admin/stats');
			stats.value = platformStats;
		} catch (error) {
			console.warn('Platform stats not available:', error);
		}

		// Load recent schools
		try {
			const schools = await os.api('admin/list-schools', { 
				limit: 5, 
				offset: 0 
			});
			recentSchools.value = schools;
		} catch (error) {
			console.warn('Recent schools not available:', error);
		}

	} catch (error) {
		console.error('Failed to load dashboard data:', error);
		os.alert({
			type: 'error',
			text: 'Failed to load dashboard data'
		});
	} finally {
		loading.value = false;
	}
}

function goToSchools() {
	router.push('/admin/schools');
}

function goToSettings() {
	router.push('/admin/settings');
}

function viewBillingReports() {
	os.alert({
		type: 'info',
		title: 'Billing Reports',
		text: 'Detailed billing reports and analytics coming soon.\n\nFor now, check individual school billing in the Schools management page.'
	});
}

function openStripeConfig() {
	router.push('/admin/settings');
}

function viewSchool(school) {
	router.push(`/admin/schools`);
}

onMounted(() => {
	loadDashboardData();
});

const headerActions = computed(() => [
	{
		icon: 'ph-arrow-clockwise-bold ph-lg',
		text: 'Refresh',
		handler: loadDashboardData,
	}
]);

const headerTabs = computed(() => []);

definePageMetadata({
	title: 'Platform Dashboard',
	icon: 'ph-gauge-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.title {
	font-weight: bold;
	font-size: 1.3em;
	margin-bottom: 0.5em;
}

.description {
	opacity: 0.7;
	margin-bottom: 2em;
}

.stats-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 1rem;
	margin-bottom: 2rem;
}

.stat-card {
	background: var(--panel);
	border-radius: 12px;
	padding: 1.5rem;
	border: 1px solid var(--divider);
	display: flex;
	align-items: center;
	gap: 1rem;

	&.primary { border-color: var(--accent); }
	&.success { border-color: var(--success); }
	&.info { border-color: var(--info); }
	&.accent { border-color: var(--warn); }

	.stat-icon {
		width: 48px;
		height: 48px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
	}

	&.primary .stat-icon {
		background: var(--accentedBg);
		color: var(--accent);
	}

	&.success .stat-icon {
		background: var(--successBg);
		color: var(--success);
	}

	&.info .stat-icon {
		background: var(--infoBg);
		color: var(--info);
	}

	&.accent .stat-icon {
		background: var(--warnBg);
		color: var(--warn);
	}

	.stat-content {
		flex: 1;
	}

	.stat-number {
		font-size: 1.8rem;
		font-weight: bold;
		line-height: 1;
	}

	.stat-label {
		opacity: 0.7;
		font-size: 0.9rem;
		margin-top: 0.25rem;
	}
}

.section-header {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	font-weight: bold;
	font-size: 1.1rem;
	margin-bottom: 1rem;
	color: var(--accent);

	i {
		font-size: 1.2rem;
	}
}

.billing-status {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.status-item {
	display: flex;
	align-items: center;
	gap: 1rem;
	padding: 1rem;
	background: var(--panel);
	border-radius: 8px;
	border: 1px solid var(--divider);
}

.status-indicator {
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: var(--divider);

	&.active {
		background: var(--success);
	}
}

.status-content {
	flex: 1;

	.status-title {
		font-weight: 500;
		margin-bottom: 0.25rem;
	}

	.status-subtitle {
		opacity: 0.7;
		font-size: 0.9rem;
	}
}

.quick-actions {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	gap: 1rem;
}

.action-button {
	display: flex !important;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
	padding: 1.5rem 1rem !important;
	height: auto !important;

	i {
		font-size: 1.5rem;
	}

	span {
		font-size: 0.9rem;
	}
}

.recent-schools {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.school-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1rem;
	background: var(--panel);
	border-radius: 8px;
	border: 1px solid var(--divider);
}

.school-info {
	.school-name {
		font-weight: 500;
		margin-bottom: 0.25rem;
	}

	.school-meta {
		opacity: 0.7;
		font-size: 0.9rem;
	}
}

.school-actions {
	display: flex;
	gap: 0.5rem;
}
</style>

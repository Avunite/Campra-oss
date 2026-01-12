<template>
<MkStickyContainer>
	<template #header>
		<XHeader :actions="headerActions" :tabs="headerTabs"/>
	</template>
	<MkSpacer :content-max="1200">
		<div class="_formRoot">
			<div class="_formBlock">
				<div class="admin-header">
					<h1>School Management Dashboard</h1>
					<p>Manage schools, student caps, and billing for the Campra platform</p>
				</div>
			</div>

			<div v-if="loading" class="_formBlock">
				<MkLoading/>
			</div>

			<div v-else class="_formRoot">
				<!-- Quick Stats -->
				<div class="_formBlock">
					<div class="stats-overview">
						<div class="stat-card total">
							<div class="stat-icon">
								<i class="ph-graduation-cap-bold ph-lg"></i>
							</div>
							<div class="stat-content">
								<div class="stat-number">{{ stats.totalSchools }}</div>
								<div class="stat-label">Total Schools</div>
							</div>
						</div>
						<div class="stat-card active">
							<div class="stat-icon">
								<i class="ph-check-circle-bold ph-lg"></i>
							</div>
							<div class="stat-content">
								<div class="stat-number">{{ stats.schoolsWithCaps }}</div>
								<div class="stat-label">Schools with Caps</div>
							</div>
						</div>
						<div class="stat-card students">
							<div class="stat-icon">
								<i class="ph-users-bold ph-lg"></i>
							</div>
							<div class="stat-content">
								<div class="stat-number">{{ stats.totalStudents }}</div>
								<div class="stat-label">Total Students</div>
							</div>
						</div>
						<div class="stat-card capacity">
							<div class="stat-icon">
								<i class="ph-chart-bar-bold ph-lg"></i>
							</div>
							<div class="stat-content">
								<div class="stat-number">{{ stats.totalCapacity }}</div>
								<div class="stat-label">Total Capacity</div>
							</div>
						</div>
						<div class="stat-card revenue">
							<div class="stat-icon">
								<i class="ph-currency-dollar-bold ph-lg"></i>
							</div>
							<div class="stat-content">
								<div class="stat-number">${{ stats.annualRevenue }}</div>
								<div class="stat-label">Annual Revenue</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Actions Bar -->
				<div class="_formBlock">
					<div class="actions-bar">
						<MkButton @click="createNewSchool" primary>
							<i class="ph-plus ph-lg"></i>
							Create School
						</MkButton>
						<MkButton @click="bulkCapManagement">
							<i class="ph-list-checks ph-lg"></i>
							Bulk Cap Management
						</MkButton>
						<MkButton @click="exportSchoolData">
							<i class="ph-download ph-lg"></i>
							Export Data
						</MkButton>
						<MkButton @click="refreshData">
							<i class="ph-arrow-clockwise ph-lg"></i>
							Refresh
						</MkButton>
					</div>
				</div>

				<!-- Filters -->
				<div class="_formBlock">
					<div class="filters-row">
						<MkInput v-model="searchQuery" placeholder="Search schools..." class="search-input">
							<template #prefix><i class="ph-magnifying-glass ph-lg"></i></template>
						</MkInput>
						<MkSelect v-model="filterStatus" class="filter-select">
							<template #label>Status</template>
							<option value="all">All Schools</option>
							<option value="active">Active</option>
							<option value="pending">Pending Setup</option>
							<option value="no_cap">No Cap Set</option>
							<option value="near_capacity">Near Capacity</option>
							<option value="at_capacity">At Capacity</option>
						</MkSelect>
						<MkSelect v-model="sortBy" class="filter-select">
							<template #label>Sort By</template>
							<option value="name">School Name</option>
							<option value="students">Student Count</option>
							<option value="capacity">Capacity Usage</option>
							<option value="revenue">Revenue</option>
							<option value="created">Date Created</option>
						</MkSelect>
					</div>
				</div>

				<!-- Schools List -->
				<div class="_formBlock">
					<div class="schools-grid">
						<div v-for="school in filteredSchools" :key="school.id" class="school-card" :class="getSchoolStatusClass(school)">
							<div class="school-header">
								<div class="school-info">
									<div class="school-logo">
										<img v-if="school.logoUrl" :src="school.logoUrl" :alt="school.name" class="logo"/>
										<i v-else class="ph-graduation-cap ph-lg"></i>
									</div>
									<div class="school-details">
										<h3>{{ school.name }}</h3>
										<p class="domain">{{ school.domain }}</p>
										<p v-if="school.location" class="location">{{ school.location }}</p>
									</div>
								</div>
								<div class="school-actions">
									<MkButton @click="manageSchoolCap(school)" small>
										<i class="ph-users ph-lg"></i>
										Manage Cap
									</MkButton>
									<MkButton @click="viewSchoolDetails(school)" small>
										<i class="ph-eye ph-lg"></i>
										View
									</MkButton>
								</div>
							</div>

							<div class="school-stats">
								<div class="stat-row">
									<div class="stat">
										<span class="label">Students:</span>
										<span class="value">{{ school.currentStudentCount || 0 }}</span>
									</div>
									<div class="stat">
										<span class="label">Cap:</span>
										<span class="value">{{ school.studentCap > 0 ? school.studentCap : 'Not Set' }}</span>
									</div>
									<div class="stat">
										<span class="label">Rate:</span>
										<span class="value">${{ school.billingRate || standardRate.toFixed(2) }}/year</span>
									</div>
								</div>
								
								<div v-if="school.studentCap > 0" class="capacity-bar">
									<div class="capacity-fill" :style="{ width: `${getCapacityPercentage(school)}%` }"></div>
									<span class="capacity-text">{{ getCapacityPercentage(school) }}% utilized</span>
								</div>
								
								<div v-else class="no-cap-warning">
									<i class="ph-warning ph-lg"></i>
									<span>No student cap set</span>
								</div>
							</div>

							<div class="school-status">
								<div class="status-badge" :class="getStatusBadgeClass(school)">
									<i :class="getStatusIcon(school)"></i>
									<span>{{ getStatusText(school) }}</span>
								</div>
								<div class="revenue-info">
									Annual: ${{ calculateAnnualRevenue(school) }}
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Pagination -->
				<div v-if="totalPages > 1" class="_formBlock">
					<div class="pagination">
						<MkButton v-for="page in totalPages" :key="page" 
								  @click="currentPage = page" 
								  :class="{ active: currentPage === page }" 
								  small>
							{{ page }}
						</MkButton>
					</div>
				</div>
			</div>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/form/input.vue';
import MkSelect from '@/components/form/select.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { useRouter } from '@/router';
import { useStripePricing } from '@/composables/use-stripe-pricing';

const router = useRouter();
const { standardRate } = useStripePricing();

const loading = ref(true);
const schools = ref([]);
const stats = ref({
	totalSchools: 0,
	schoolsWithCaps: 0,
	totalStudents: 0,
	totalCapacity: 0,
	annualRevenue: 0,
});

const searchQuery = ref('');
const filterStatus = ref('all');
const sortBy = ref('name');
const currentPage = ref(1);
const itemsPerPage = 12;

const filteredSchools = computed(() => {
	let filtered = schools.value;

	// Apply search filter
	if (searchQuery.value) {
		const query = searchQuery.value.toLowerCase();
		filtered = filtered.filter(school => 
			school.name.toLowerCase().includes(query) ||
			school.domain.toLowerCase().includes(query) ||
			school.location?.toLowerCase().includes(query)
		);
	}

	// Apply status filter
	if (filterStatus.value !== 'all') {
		filtered = filtered.filter(school => {
			switch (filterStatus.value) {
				case 'active':
					return school.subscriptionStatus === 'active';
				case 'pending':
					return school.subscriptionStatus === 'pending';
				case 'no_cap':
					return !school.studentCap;
				case 'near_capacity':
					return school.studentCap && getCapacityPercentage(school) >= 80 && getCapacityPercentage(school) < 100;
				case 'at_capacity':
					return school.studentCap && getCapacityPercentage(school) >= 100;
				default:
					return true;
			}
		});
	}

	// Apply sorting
	filtered = filtered.sort((a, b) => {
		switch (sortBy.value) {
			case 'name':
				return a.name.localeCompare(b.name);
			case 'students':
				return (b.currentStudentCount || 0) - (a.currentStudentCount || 0);
			case 'capacity':
				return getCapacityPercentage(b) - getCapacityPercentage(a);
			case 'revenue':
				return calculateAnnualRevenue(b) - calculateAnnualRevenue(a);
			case 'created':
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			default:
				return 0;
		}
	});

	// Apply pagination
	const startIndex = (currentPage.value - 1) * itemsPerPage;
	return filtered.slice(startIndex, startIndex + itemsPerPage);
});

const totalPages = computed(() => {
	const totalFiltered = schools.value.filter(school => {
		if (searchQuery.value) {
			const query = searchQuery.value.toLowerCase();
			if (!school.name.toLowerCase().includes(query) &&
				!school.domain.toLowerCase().includes(query) &&
				!school.location?.toLowerCase().includes(query)) {
				return false;
			}
		}
		
		if (filterStatus.value !== 'all') {
			switch (filterStatus.value) {
				case 'active':
					return school.subscriptionStatus === 'active';
				case 'pending':
					return school.subscriptionStatus === 'pending';
				case 'no_cap':
					return !school.studentCap;
				case 'near_capacity':
					return school.studentCap && getCapacityPercentage(school) >= 80 && getCapacityPercentage(school) < 100;
				case 'at_capacity':
					return school.studentCap && getCapacityPercentage(school) >= 100;
			}
		}
		
		return true;
	}).length;
	
	return Math.ceil(totalFiltered / itemsPerPage);
});

function getCapacityPercentage(school: any): number {
	if (!school.studentCap) return 0;
	return Math.round(((school.currentStudentCount || 0) / school.studentCap) * 100);
}

function calculateAnnualRevenue(school: any): number {
	const rate = school.billingRate || standardRate.value;
	const capacity = school.studentCap || 0;
	return Math.round(capacity * rate);
}

function getSchoolStatusClass(school: any): string {
	if (!school.studentCap) return 'no-cap';
	const percentage = getCapacityPercentage(school);
	if (percentage >= 100) return 'at-capacity';
	if (percentage >= 80) return 'near-capacity';
	return 'normal';
}

function getStatusBadgeClass(school: any): string {
	if (!school.studentCap) return 'status-warning';
	const percentage = getCapacityPercentage(school);
	if (percentage >= 100) return 'status-critical';
	if (percentage >= 80) return 'status-warning';
	return 'status-good';
}

function getStatusIcon(school: any): string {
	if (!school.studentCap) return 'ph-warning ph-lg';
	const percentage = getCapacityPercentage(school);
	if (percentage >= 100) return 'ph-x-circle ph-lg';
	if (percentage >= 80) return 'ph-warning-circle ph-lg';
	return 'ph-check-circle ph-lg';
}

function getStatusText(school: any): string {
	if (!school.studentCap) return 'No Cap Set';
	const percentage = getCapacityPercentage(school);
	if (percentage >= 100) return 'At Capacity';
	if (percentage >= 80) return 'Near Capacity';
	return 'Active';
}

async function loadData() {
	loading.value = true;
	try {
		const response = await os.api('admin/schools/dashboard-data', {});
		schools.value = response.schools;
		stats.value = response.stats;
	} catch (error) {
		os.alert({
			type: 'error',
			text: 'Failed to load school data'
		});
	} finally {
		loading.value = false;
	}
}

async function manageSchoolCap(school: any) {
	const { canceled, result } = await os.form(`Manage Student Cap - ${school.name}`, {
		currentInfo: {
			type: 'string',
			label: 'Current Status',
			default: school.studentCap 
				? `Cap: ${school.studentCap} students (${getCapacityPercentage(school)}% used)`
				: 'No cap set',
			readonly: true,
		},
		studentCap: {
			type: 'number',
			label: 'Student Cap',
			min: 1,
			max: 50000,
			default: school.studentCap || 100,
		},
		reason: {
			type: 'string',
			label: 'Reason for Change',
			placeholder: 'Explain why you are setting/changing this cap...',
			required: true,
			maxLength: 500,
		},
	});

	if (canceled) return;

	try {
		await os.apiWithDialog('admin/schools/set-student-cap', {
			schoolId: school.id,
			studentCap: result.studentCap,
			reason: result.reason,
		});

		os.success(`Student cap updated for ${school.name}`);
		await loadData();

	} catch (error: any) {
		os.alert({
			type: 'error',
			title: 'Failed to Update Cap',
			text: error.message || 'An error occurred while updating the student cap.',
		});
	}
}

async function createNewSchool() {
	const { canceled, result } = await os.form('Create New School', {
		name: {
			type: 'string',
			label: 'School Name',
			required: true,
		},
		domain: {
			type: 'string',
			label: 'Domain',
			placeholder: 'school.edu',
			required: true,
		},
		studentCap: {
			type: 'number',
			label: 'Initial Student Cap',
			min: 1,
			max: 50000,
			default: 100,
			required: true,
		},
		location: {
			type: 'string',
			label: 'Location',
			placeholder: 'City, State/Country',
		},
		description: {
			type: 'string',
			label: 'Description',
			placeholder: 'Brief description of the school...',
		},
	});

	if (canceled) return;

	try {
		await os.apiWithDialog('admin/schools/create', {
			name: result.name,
			domain: result.domain,
			location: result.location,
			description: result.description,
			studentCap: result.studentCap,
			reason: 'Initial school setup with student cap',
		});

		os.success(`School "${result.name}" created successfully`);
		await loadData();

	} catch (error: any) {
		os.alert({
			type: 'error',
			title: 'Failed to Create School',
			text: error.message || 'An error occurred while creating the school.',
		});
	}
}

function viewSchoolDetails(school: any) {
	router.push(`/admin/schools/${school.id}`);
}

async function bulkCapManagement() {
	const schoolsWithoutCaps = schools.value.filter(s => !s.studentCap);
	
	if (schoolsWithoutCaps.length === 0) {
		os.alert({
			type: 'info',
			text: 'All schools already have student caps configured.',
		});
		return;
	}

	const { canceled, result } = await os.form('Bulk Cap Management', {
		info: {
			type: 'string',
			label: 'Schools without caps',
			default: `${schoolsWithoutCaps.length} schools need caps configured`,
			readonly: true,
		},
		defaultCap: {
			type: 'number',
			label: 'Default Cap for All',
			min: 1,
			max: 50000,
			default: 100,
		},
		reason: {
			type: 'string',
			label: 'Reason',
			default: 'Bulk cap configuration for prepaid billing system',
			required: true,
		},
	});

	if (canceled) return;

	try {
		loading.value = true;
		
		for (const school of schoolsWithoutCaps) {
			await os.api('admin/schools/set-student-cap', {
				schoolId: school.id,
				studentCap: result.defaultCap,
				reason: result.reason,
			});
		}

		os.success(`Set caps for ${schoolsWithoutCaps.length} schools`);
		await loadData();

	} catch (error: any) {
		os.alert({
			type: 'error',
			title: 'Bulk Operation Failed',
			text: error.message || 'Some schools may have been updated successfully.',
		});
		await loadData();
	}
}

async function exportSchoolData() {
	try {
		const data = schools.value.map(school => ({
			name: school.name,
			domain: school.domain,
			studentCount: school.currentStudentCount || 0,
			studentCap: school.studentCap > 0 ? school.studentCap : 'Not Set',
			capacityUsage: school.studentCap ? `${getCapacityPercentage(school)}%` : 'N/A',
			annualRevenue: calculateAnnualRevenue(school),
			status: getStatusText(school),
			createdAt: school.createdAt,
		}));

		const csv = [
			'Name,Domain,Students,Cap,Usage,Revenue,Status,Created',
			...data.map(row => Object.values(row).join(','))
		].join('\n');

		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `campra-schools-${new Date().toISOString().split('T')[0]}.csv`;
		a.click();
		URL.revokeObjectURL(url);

		os.success('School data exported successfully');

	} catch (error) {
		os.alert({
			type: 'error',
			text: 'Failed to export data',
		});
	}
}

function refreshData() {
	loadData();
}

// Watch for filter changes and reset pagination
watch([searchQuery, filterStatus], () => {
	currentPage.value = 1;
});

onMounted(() => {
	loadData();
});

const headerActions = computed(() => [
	{
		icon: 'ph-plus ph-lg',
		text: 'Create School',
		handler: createNewSchool,
	},
	{
		icon: 'ph-arrow-clockwise ph-lg',
		text: 'Refresh',
		handler: refreshData,
	}
]);

const headerTabs = computed(() => []);

definePageMetadata({
	title: 'School Management Dashboard',
	icon: 'ph-graduation-cap-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.admin-header {
	text-align: center;
	margin-bottom: 2rem;

	h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2em;
		font-weight: bold;
	}

	p {
		margin: 0;
		opacity: 0.7;
		font-size: 1.1em;
	}
}

.stats-overview {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 1rem;
	margin-bottom: 2rem;

	.stat-card {
		background: var(--panel);
		border-radius: 12px;
		padding: 1.5rem;
		border: 1px solid var(--divider);
		display: flex;
		align-items: center;
		gap: 1rem;

		.stat-icon {
			width: 48px;
			height: 48px;
			border-radius: 8px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 1.5rem;
			color: white;
		}

		.stat-content {
			flex: 1;

			.stat-number {
				font-size: 1.8rem;
				font-weight: bold;
				line-height: 1;
				margin-bottom: 0.25rem;
			}

			.stat-label {
				font-size: 0.9rem;
				opacity: 0.7;
			}
		}

		&.total .stat-icon {
			background: var(--accent);
		}

		&.active .stat-icon {
			background: var(--success);
		}

		&.students .stat-icon {
			background: var(--info);
		}

		&.capacity .stat-icon {
			background: var(--warn);
		}

		&.revenue .stat-icon {
			background: #10b981;
		}
	}
}

.actions-bar {
	display: flex;
	gap: 1rem;
	flex-wrap: wrap;
}

.filters-row {
	display: grid;
	grid-template-columns: 1fr auto auto auto;
	gap: 1rem;
	align-items: end;

	.search-input {
		min-width: 300px;
	}

	.filter-select {
		min-width: 15.000px;
	}
}

.schools-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
	gap: 1.5rem;

	.school-card {
		background: var(--panel);
		border-radius: 12px;
		border: 1px solid var(--divider);
		padding: 1.5rem;
		transition: all 0.2s ease;

		&:hover {
			border-color: var(--accent);
			transform: translateY(-2px);
		}

		&.no-cap {
			border-color: var(--warn);
		}

		&.near-capacity {
			border-color: var(--warn);
		}

		&.at-capacity {
			border-color: var(--error);
		}
	}
}

.school-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	margin-bottom: 1rem;

	.school-info {
		display: flex;
		gap: 1rem;
		flex: 1;

		.school-logo {
			width: 48px;
			height: 48px;
			border-radius: 8px;
			background: var(--accent);
			display: flex;
			align-items: center;
			justify-content: center;
			color: white;
			font-size: 1.5rem;
			flex-shrink: 0;

			.logo {
				width: 100%;
				height: 100%;
				object-fit: cover;
				border-radius: 8px;
			}
		}

		.school-details {
			flex: 1;

			h3 {
				margin: 0 0 0.25rem 0;
				font-size: 1.2rem;
				font-weight: 600;
			}

			.domain {
				margin: 0 0 0.25rem 0;
				font-family: monospace;
				font-size: 0.9rem;
				color: var(--accent);
			}

			.location {
				margin: 0;
				font-size: 0.9rem;
				opacity: 0.7;
			}
		}
	}

	.school-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}
}

.school-stats {
	margin-bottom: 1rem;

	.stat-row {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1rem;

		.stat {
			display: flex;
			justify-content: space-between;
			font-size: 0.9rem;

			.label {
				opacity: 0.7;
			}

			.value {
				font-weight: 500;
			}
		}
	}

	.capacity-bar {
		position: relative;
		height: 6px;
		background: var(--divider);
		border-radius: 3px;
		overflow: hidden;
		margin-bottom: 0.5rem;

		.capacity-fill {
			height: 100%;
			background: var(--success);
			transition: width 0.3s ease;

			.at-capacity & {
				background: var(--error);
			}

			.near-capacity & {
				background: var(--warn);
			}
		}

		.capacity-text {
			position: absolute;
			top: -1.5rem;
			right: 0;
			font-size: 0.8rem;
			opacity: 0.7;
		}
	}

	.no-cap-warning {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--warn);
		font-size: 0.9rem;
	}
}

.school-status {
	display: flex;
	justify-content: space-between;
	align-items: center;

	.status-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.75rem;
		border-radius: 16px;
		font-size: 0.8rem;
		font-weight: 500;

		&.status-good {
			background: color-mix(in srgb, var(--success) 20%, var(--panel));
			color: var(--success);
		}

		&.status-warning {
			background: color-mix(in srgb, var(--warn) 20%, var(--panel));
			color: var(--warn);
		}

		&.status-critical {
			background: color-mix(in srgb, var(--error) 20%, var(--panel));
			color: var(--error);
		}
	}

	.revenue-info {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--success);
	}
}

.pagination {
	display: flex;
	justify-content: center;
	gap: 0.5rem;

	.active {
		background: var(--accent);
		color: white;
	}
}
</style>

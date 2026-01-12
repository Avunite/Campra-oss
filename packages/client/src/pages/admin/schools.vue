<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader :actions="headerActions" :tabs="headerTabs" />
		</template>
		<MkSpacer :content-max="1200">
			<div class="admin-schools">
				<!-- Header Section with Quick Stats -->
				<div class="_formRoot">
					<div class="_formBlock">
						<div class="title">School Management</div>
						<div class="description">Manage schools, student caps, and billing across the platform</div>
					</div>

					<!-- Quick Stats Cards -->
					<div class="_formBlock">
						<div class="stats-grid">
							<div class="stat-card">
								<div class="stat-icon">
									<i class="ph-graduation-cap-bold ph-lg"></i>
								</div>
								<div class="stat-content">
									<div class="stat-number">{{ totalSchools }}</div>
									<div class="stat-label">Total Schools</div>
								</div>
							</div>
							<div class="stat-card">
								<div class="stat-icon">
									<i class="ph-check-circle-bold ph-lg"></i>
								</div>
								<div class="stat-content">
									<div class="stat-number">{{ activeSchools }}</div>
									<div class="stat-label">Active Schools</div>
								</div>
							</div>
							<div class="stat-card">
								<div class="stat-icon">
									<i class="ph-users-bold ph-lg"></i>
								</div>
								<div class="stat-content">
									<div class="stat-number">{{ totalStudents }}</div>
									<div class="stat-label">Total Students</div>
								</div>
							</div>
							<div class="stat-card">
								<div class="stat-icon">
									<i class="ph-currency-dollar-bold ph-lg"></i>
								</div>
								<div class="stat-content">
									<div class="stat-number">${{ monthlyRevenue }}</div>
									<div class="stat-label">Monthly Revenue</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Filters and Search -->
					<div class="_formBlock">
						<div class="toolbar">
							<div class="search-section">
								<MkInput v-model="searchQuery" placeholder="Search schools..." class="search-input">
									<template #prefix><i class="ph-magnifying-glass ph-lg"></i></template>
								</MkInput>
							</div>
							<div class="filters">
								<MkSelect v-model="selectedStatus" class="filter-select">
									<template #label>Status</template>
									<option value="">All Status</option>
									<option value="active">Active</option>
									<option value="pending">Pending</option>
									<option value="suspended">Suspended</option>
									<option value="cancelled">Cancelled</option>
								</MkSelect>
								<MkSelect v-model="selectedType" class="filter-select">
									<template #label>Type</template>
									<option value="">All Types</option>
									<option value="university">University</option>
									<option value="college">College</option>
									<option value="k12">K-12 School</option>
									<option value="trade_school">Trade School</option>
									<option value="private_school">Private School</option>
								</MkSelect>
								<MkSelect v-model="sortBy" class="filter-select">
									<template #label>Sort By</template>
									<option value="createdAt">Newest First</option>
									<option value="name">Name A-Z</option>
									<option value="studentCount">Most Students</option>
									<option value="revenue">Highest Revenue</option>
								</MkSelect>
							</div>
							<div class="actions">
								<MkButton @click="createSchool" primary>
									<i class="ph-plus ph-lg"></i>
									Add School
								</MkButton>
								<MkButton @click="createDemoSchool">
									<i class="ph-eye ph-lg"></i>
									Create Demo School
								</MkButton>
								<MkButton @click="bulkActions" v-if="selectedSchools.length > 0">
									<i class="ph-selection ph-lg"></i>
									Bulk Actions ({{ selectedSchools.length }})
								</MkButton>
							</div>
						</div>
					</div>

					<!-- Schools List -->
					<div class="_formBlock">
						<MkLoading v-if="loading" />
						<div v-else-if="filteredSchools.length === 0" class="empty">
							<div class="empty-icon">
								<i class="ph-graduation-cap ph-lg"></i>
							</div>
							<div class="empty-text">No schools found</div>
							<MkButton @click="createSchool" primary>
								<i class="ph-plus ph-lg"></i>
								Create First School
							</MkButton>
						</div>
						<div v-else class="schools-grid">
							<div v-for="school in filteredSchools" :key="school.id" class="school-card"
								:class="getSchoolStatusClass(school)">
								<div class="school-header">
									<div class="school-select">
										<input type="checkbox" :value="school.id" v-model="selectedSchools" />
									</div>
									<div class="school-info">
										<div class="school-logo">
											<img v-if="school.logoUrl" :src="school.logoUrl" :alt="school.name"
												class="logo" />
											<i v-else class="ph-graduation-cap-bold ph-lg placeholder-icon"></i>
										</div>
										<div class="school-details">
											<h3 class="school-name">{{ school.name }}</h3>
											<div class="school-domain">{{ school.domain }}</div>
											<div class="school-type">{{ formatSchoolType(school.type) }}</div>
										</div>
									</div>
									<div class="school-status">
										<div v-if="school.isDemo" class="demo-badge">
											<i class="ph-eye ph-lg"></i>
											<span>DEMO</span>
										</div>
										<div class="status-badge" :class="school.subscriptionStatus">
											<i :class="getStatusIcon(school.subscriptionStatus)"></i>
											<span>{{ formatSubscriptionStatus(school.subscriptionStatus) }}</span>
										</div>
									</div>
								</div>

								<div class="school-metrics">
									<div class="metric">
										<div class="metric-value">{{ school.studentCount || 0 }}</div>
										<div class="metric-label">Students</div>
									</div>
									<div class="metric">
										<div class="metric-value">{{ school.studentCap > 0 ? school.studentCap : 'No Cap' }}</div>
										<div class="metric-label">Student Cap</div>
									</div>
									<div class="metric">
										<div class="metric-value">${{ calculateRevenue(school).toFixed(0) }}</div>
										<div class="metric-label">Annual Revenue</div>
									</div>
									<div class="metric">
										<div class="metric-value">{{ getCapUtilization(school) }}%</div>
										<div class="metric-label">Cap Usage</div>
									</div>
								</div>

								<!-- Student Cap Indicator -->
								<div v-if="school.studentCap > 0" class="cap-indicator">
									<div class="cap-bar">
										<div class="cap-fill" :style="{ width: `${getCapUtilization(school)}%` }"
											:class="getCapStatusClass(school)"></div>
									</div>
									<div class="cap-text">
										{{ school.studentCount || 0 }} / {{ school.studentCap }} students
										<span v-if="!school.studentCapEnforced" class="cap-disabled">(Disabled)</span>
									</div>
								</div>

								<div class="school-actions">
									<MkButton @click="viewSchool(school)" small>
										<i class="ph-eye ph-lg"></i>
										View
									</MkButton>
									<MkButton @click="editSchool(school)" small>
										<i class="ph-pencil-simple ph-lg"></i>
										Edit
									</MkButton>
									<MkButton @click="addSchoolAdmin(school)" small>
										<i class="ph-user-plus ph-lg"></i>
										Add Admin
									</MkButton>
									<MkButton @click="manageSchoolAdmins(school)" small>
										<i class="ph-user-gear ph-lg"></i>
										Manage Admins
									</MkButton>
									<MkButton @click="manageStudentCap(school)" small>
										<i class="ph-users ph-lg"></i>
										Cap
									</MkButton>
									<MkButton @click="manageBilling(school)" small>
										<i class="ph-credit-card ph-lg"></i>
										Configure Billing
									</MkButton>
									<MkButton @click="toggleDemoStatus(school)" small :danger="school.isDemo">
										<i class="ph-eye ph-lg"></i>
										{{ school.isDemo ? 'Remove Demo' : 'Make Demo' }}
									</MkButton>
									<MkButton @click="showSchoolMenu(school, $event)" small>
										<i class="ph-dots-three ph-lg"></i>
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

// Reactive data
const loading = ref(true);
const schools = ref([]);
const selectedSchools = ref([]);
const searchQuery = ref('');
const selectedStatus = ref('');
const selectedType = ref('');
const sortBy = ref('createdAt');

// Stats
const totalSchools = ref(0);
const activeSchools = ref(0);
const totalStudents = ref(0);
const monthlyRevenue = ref(0);

// Computed properties
const filteredSchools = computed(() => {
	let filtered = schools.value;

	// Apply search filter
	if (searchQuery.value) {
		const query = searchQuery.value.toLowerCase();
		filtered = filtered.filter(school =>
			school.name.toLowerCase().includes(query) ||
			school.domain.toLowerCase().includes(query) ||
			school.description?.toLowerCase().includes(query)
		);
	}

	// Apply status filter
	if (selectedStatus.value) {
		filtered = filtered.filter(school => school.subscriptionStatus === selectedStatus.value);
	}

	// Apply type filter
	if (selectedType.value) {
		filtered = filtered.filter(school => school.type === selectedType.value);
	}

	// Apply sorting
	filtered.sort((a, b) => {
		switch (sortBy.value) {
			case 'name':
				return a.name.localeCompare(b.name);
			case 'studentCount':
				return (b.studentCount || 0) - (a.studentCount || 0);
			case 'revenue':
				return calculateRevenue(b) - calculateRevenue(a);
			case 'createdAt':
			default:
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		}
	});

	return filtered;
});

const headerActions = computed(() => [
	{
		icon: 'ph-plus ph-lg',
		text: 'Add School',
		handler: createSchool,
	},
	{
		icon: 'ph-arrow-clockwise ph-lg',
		text: 'Refresh',
		handler: loadSchools,
	},
]);

const headerTabs = computed(() => []);

// Methods
async function loadSchools() {
	loading.value = true;
	try {
		const data = await os.api('admin/schools/list', {});
		schools.value = data.schools || [];
		// Calculate stats from the schools data since this endpoint doesn't provide stats
		totalSchools.value = schools.value.length;
		activeSchools.value = schools.value.filter(s => s.subscriptionStatus === 'active').length;
		totalStudents.value = schools.value.reduce((sum, s) => sum + (s.studentCount || 0), 0);
		monthlyRevenue.value = schools.value.reduce((sum, s) => sum + calculateRevenue(s), 0);
	} catch (error) {
		os.alert({
			type: 'error',
			text: 'Failed to load schools data'
		});
	} finally {
		loading.value = false;
	}
}

// Fetch current Stripe pricing
const { standardRate } = useStripePricing();

function calculateRevenue(school: any): number {
	if (!school.studentCap || !school.studentCapEnforced) return 0;
	const rate = school.customBillingRate || standardRate.value;
	return school.studentCap * rate;
}

function getCapUtilization(school: any): number {
	if (!school.studentCap) return 0;
	return Math.round(((school.studentCount || 0) / school.studentCap) * 100);
}

function getCapStatusClass(school: any): string {
	const utilization = getCapUtilization(school);
	if (utilization >= 100) return 'cap-critical';
	if (utilization >= 90) return 'cap-warning';
	if (utilization >= 70) return 'cap-moderate';
	return 'cap-good';
}

function getSchoolStatusClass(school: any): string {
	return `status-${school.subscriptionStatus || 'unknown'}`;
}

function getStatusIcon(status: string): string {
	switch (status) {
		case 'active': return 'ph-check-circle ph-lg';
		case 'pending': return 'ph-clock ph-lg';
		case 'suspended': return 'ph-warning-circle ph-lg';
		case 'cancelled': return 'ph-x-circle ph-lg';
		default: return 'ph-circle ph-lg';
	}
}

function formatSubscriptionStatus(status: string): string {
	const statuses = {
		active: 'Active',
		pending: 'Pending',
		suspended: 'Suspended',
		cancelled: 'Cancelled'
	};
	return statuses[status] || status;
}

function formatSchoolType(type: string): string {
	const types = {
		university: 'University',
		college: 'College',
		k12: 'K-12 School',
		trade_school: 'Trade School',
		private_school: 'Private School'
	};
	return types[type] || type;
}

async function createSchool() {
	const formResult: any = await os.form('Create New School', {
		name: {
			type: 'string',
			label: 'School Name',
			placeholder: 'Enter school name...',
			required: true,
		},
		domain: {
			type: 'string',
			label: 'Domain',
			placeholder: 'example.edu',
			required: true,
		},
		type: {
			type: 'enum',
			label: 'School Type',
			enum: [
				{ value: 'university', label: 'University' },
				{ value: 'college', label: 'College' },
				{ value: 'k12', label: 'K-12 School' },
				{ value: 'trade_school', label: 'Trade School' },
				{ value: 'private_school', label: 'Private School' },
			],
			required: true,
		},
		description: {
			type: 'string',
			label: 'Description',
			placeholder: 'Brief description of the school...',
		},
		location: {
			type: 'string',
			label: 'Location',
			placeholder: 'City, State/Country',
		},
		studentCap: {
			type: 'number',
			label: 'Initial Student Cap',
			min: 1,
			max: 50000,
			default: 100,
			required: true,
		},
	});

	if (formResult.canceled) return;

	try {
		// First create the school
		const newSchool = await os.apiWithDialog('admin/create-school', {
			name: formResult.result.name,
			domain: formResult.result.domain,
			type: formResult.result.type,
			description: formResult.result.description,
			location: formResult.result.location,
		});

		// Then set the student cap
		if (formResult.result.studentCap) {
			await os.api('admin/schools/set-student-cap', {
				schoolId: newSchool.id,
				studentCap: formResult.result.studentCap,
			});
		}

		await loadSchools();
	} catch (error) {
		// Error handled by apiWithDialog
	}
}

async function createDemoSchool() {
	const formResult: any = await os.form('Create Demo School', {
		schoolName: {
			type: 'string',
			label: 'School Name',
			placeholder: 'Demo University',
			required: true,
		},
		schoolDomain: {
			type: 'string',
			label: 'Domain',
			placeholder: 'demo.edu',
			required: true,
		},
		schoolType: {
			type: 'enum',
			label: 'School Type',
			enum: [
				{ value: 'university', label: 'University' },
				{ value: 'college', label: 'College' },
				{ value: 'k12', label: 'K-12 School' },
				{ value: 'trade_school', label: 'Trade School' },
				{ value: 'private_school', label: 'Private School' },
			],
			default: 'university',
			required: true,
		},
		location: {
			type: 'string',
			label: 'Location',
			placeholder: 'Demo City, Demo State',
		},
		adminUsername: {
			type: 'string',
			label: 'Admin Username',
			placeholder: 'demoadmin',
			required: true,
		},
		adminPassword: {
			type: 'string',
			label: 'Admin Password',
			placeholder: 'Minimum 8 characters',
			required: true,
		},
		studentCount: {
			type: 'number',
			label: 'Number of Demo Students',
			default: 2,
			min: 1,
			max: 10,
		},
	});

	if (formResult.canceled) return;

	try {
		const result = await os.apiWithDialog('admin/create-demo-school', formResult.result);
		
		// Show credentials dialog
		await os.alert({
			type: 'success',
			title: 'Demo School Created',
			text: `Demo school "${result.school.name}" has been created successfully!\n\n` +
				`Admin Login:\n` +
				`Username: ${result.admin.username}\n` +
				`Password: ${result.admin.password}\n\n` +
				`Students:\n` +
				result.students.map(s => `${s.username} / ${s.password}`).join('\n') +
				`\n\nPlease save these credentials.`,
		});

		await loadSchools();
	} catch (error) {
		// Error handled by apiWithDialog
	}
}

async function toggleDemoStatus(school: any) {
	const newStatus = !school.isDemo;
	const action = newStatus ? 'mark as demo' : 'remove demo status from';
	
	const confirmed = await os.confirm({
		type: 'warning',
		title: `Toggle Demo Status`,
		text: `Are you sure you want to ${action} ${school.name}?\n\n` +
			(newStatus 
				? 'This will mark the school and all its users as demo accounts. Stripe operations will be disabled.' 
				: 'This will remove demo status. The school will function normally again.'),
	});

	if (!confirmed.canceled) {
		try {
			await os.apiWithDialog('admin/mark-school-demo', {
				schoolId: school.id,
				isDemo: newStatus,
			});
			await loadSchools();
		} catch (error) {
			// Error handled by apiWithDialog
		}
	}
}

async function editSchool(school: any) {
	const formResult: any = await os.form(`Edit ${school.name}`, {
		name: {
			type: 'string',
			label: 'School Name',
			default: school.name,
			required: true,
		},
		description: {
			type: 'string',
			label: 'Description',
			default: school.description || '',
		},
		location: {
			type: 'string',
			label: 'Location',
			default: school.location || '',
		},
		websiteUrl: {
			type: 'string',
			label: 'Website URL',
			default: school.websiteUrl || '',
		},
	});

	if (formResult.canceled) return;

	try {
		await os.apiWithDialog('admin/update-school', {
			schoolId: school.id,
			...formResult.result
		});
		await loadSchools();
	} catch (error) {
		// Error handled by apiWithDialog
	}
}

async function manageStudentCap(school: any) {
	const formResult: any = await os.form(`Manage Student Cap - ${school.name}`, {
		studentCap: {
			type: 'number',
			label: 'Student Cap',
			min: Math.max(school.studentCount || 0, 1),
			max: 50000,
			default: school.studentCap || 100,
			required: true,
		},
	});

	if (formResult.canceled) return;

	try {
		await os.apiWithDialog('admin/schools/set-student-cap', {
			schoolId: school.id,
			...formResult.result
		});
		await loadSchools();
	} catch (error) {
		// Error handled by apiWithDialog
	}
}

async function manageSchoolAdmins(school: any) {
	// First, get current school admins
	let currentAdmins: any[] = [];
	try {
		console.log('Loading admins for school:', school.id);
		const response = await os.api('admin/list-school-admins', { schoolId: school.id });
		console.log('Admin response:', response);
		currentAdmins = response.admins || [];
	} catch (error) {
		console.error('Could not load current admins:', error);
		os.alert({
			type: 'error',
			text: `Failed to load school administrators: ${(error as any)?.message || 'Unknown error'}`
		});
		return;
	}

	const menuItems = [
		{
			text: 'Add New Admin',
			icon: 'ph-user-plus ph-lg',
			action: () => addSchoolAdmin(school)
		},
		null, // separator
		...currentAdmins.map(admin => ({
			text: `Remove ${admin.username}`,
			icon: 'ph-user-minus ph-lg',
			action: () => removeSchoolAdmin(school, admin),
			danger: true
		}))
	];

	if (currentAdmins.length === 0) {
		menuItems.push({
			text: 'No current admins',
			icon: 'ph-info ph-lg',
			action: () => Promise.resolve()
		});
	}

	// Show admin info first
	let adminList = 'No admins found';
	if (currentAdmins.length > 0) {
		adminList = currentAdmins.map(admin => `• ${admin.username} (${admin.name})\n  📧 ${admin.email}\n  ⏰ Created: ${new Date(admin.createdAt).toLocaleDateString()}`).join('\n\n');
	}

	os.alert({
		type: 'info',
		title: `School Admins - ${school.name}`,
		text: `Current administrators:\n\n${adminList}\n\nUse the menu below to manage admins.`
	});

	// Then show management menu
	setTimeout(() => {
		os.popupMenu(menuItems, document.body);
	}, 100);
}

async function addSchoolAdmin(school: any) {
	const formResult: any = await os.form(`Add Admin to ${school.name}`, {
		email: {
			type: 'string',
			label: 'Email Address',
			placeholder: 'admin@example.edu',
			required: true,
		},
		name: {
			type: 'string',
			label: 'Full Name',
			placeholder: 'John Doe',
			required: true,
		},
		generatePassword: {
			type: 'boolean',
			label: 'Generate temporary password',
			default: true,
		},
	});

	if (formResult.canceled) return;

	try {
		const response = await os.apiWithDialog('admin/create-school-admin', {
			schoolId: school.id,
			email: formResult.result.email,
			name: formResult.result.name,
			generatePassword: formResult.result.generatePassword
		});

		// Show success message
		let successMessage = `School administrator created successfully!\n\n`;
		successMessage += `👤 Name: ${formResult.result.name}\n`;
		successMessage += `📧 Email: ${response.user.email}\n`;
		successMessage += `🆔 Username: ${response.user.username}\n`;
		successMessage += `🏫 School: ${school.name}`;

		if (response.temporaryPassword) {
			successMessage += `\n\n🔑 Temporary Password: ${response.temporaryPassword}`;
			successMessage += `\n\n⚠️ IMPORTANT:\n`;
			successMessage += `• Save this password immediately\n`;
			successMessage += `• It will not be displayed again\n`;
			successMessage += `• The admin should change it on first login\n`;
			successMessage += `• Send these credentials securely to the administrator`;
		} else {
			successMessage += `\n\n⚠️ No password generated - admin will need to set one during first login.`;
		}

		os.alert({
			type: 'success',
			text: successMessage
		});
	} catch (error) {
		// Error handled by apiWithDialog
	}
}

async function removeSchoolAdmin(school: any, admin: any) {
	const confirmed = await os.confirm({
		type: 'warning',
		text: `Are you sure you want to remove ${admin.username} as an admin from ${school.name}?`
	});

	if (!confirmed) return;

	try {
		await os.apiWithDialog('admin/remove-school-admin', {
			userId: admin.id,
			reason: `Removed by platform admin from ${school.name}`
		});
		os.alert({
			type: 'success',
			text: `Successfully removed ${admin.username} from ${school.name}`
		});
	} catch (error) {
		// Error handled by apiWithDialog
	}
}

function viewSchool(school: any) {
	const details = [
		`Name: ${school.name}`,
		`Domain: ${school.domain}`,
		`Type: ${formatSchoolType(school.type)}`,
		`Status: ${formatSubscriptionStatus(school.subscriptionStatus)}`,
		`Students: ${school.studentCount || 0}`,
		`Student Cap: ${school.studentCap > 0 ? school.studentCap : 'No cap'}`,
		school.location ? `Location: ${school.location}` : null,
		school.description ? `Description: ${school.description}` : null,
		school.websiteUrl ? `Website: ${school.websiteUrl}` : null,
		`Created: ${new Date(school.createdAt).toLocaleDateString()}`,
	].filter(Boolean).join('\n');

	os.alert({
		type: 'info',
		title: school.name,
		text: details
	});
}

function manageBilling(school: any) {
	configureBilling(school);
}

async function configureBilling(school) {
	const currentRate = standardRate.value; // Get from Stripe API

	// Use the enhanced billing information from the API response
	const currentBillingType = school.billingType || 'standard';
	const currentBillingRate = school.billingRate || currentRate;
	const customRate = school.customRate;
	const discountPercentage = school.discountPercentage;

	// Set appropriate defaults based on current billing configuration
	let defaultCustomRate = currentRate;
	let defaultDiscount = 0;
	let defaultReason = '';

	// Set defaults based on current billing type
	switch (currentBillingType) {
		case 'free':
			defaultReason = 'Modify free access configuration';
			break;
		case 'custom':
			defaultCustomRate = customRate || currentBillingRate;
			defaultReason = `Update custom rate (currently $${currentBillingRate.toFixed(2)}/student/year)`;
			break;
		case 'discount':
			defaultDiscount = discountPercentage || 0;
			defaultReason = `Update discount (currently ${discountPercentage || 0}% off standard rate)`;
			break;
		case 'standard':
		default:
			defaultReason = 'Change from standard billing rate';
			break;
	}

	// Build dynamic form labels with current values
	const standardLabel = `Standard Rate ($${currentRate}/student/year)${currentBillingType === 'standard' ? ' (Current)' : ''}`;
	const customLabel = `Custom Rate${currentBillingType === 'custom' ? ` (Current: $${currentBillingRate.toFixed(2)}/student/year)` : ''}`;
	const discountLabel = `Percentage Discount${currentBillingType === 'discount' ? ` (Current: ${discountPercentage}% off)` : ''}`;
	const freeLabel = `Free (Admin Override)${currentBillingType === 'free' ? ' (Current)' : ''}`;

	const { canceled, result }: any = await os.form('Configure Billing Rate', {
		billingType: {
			type: 'enum',
			label: 'Billing Type',
			enum: [
				{ label: standardLabel, value: 'standard' },
				{ label: customLabel, value: 'custom' },
				{ label: discountLabel, value: 'discount' },
				{ label: freeLabel, value: 'free' }
			],
			default: currentBillingType
		},
		customRate: {
			type: 'number',
			label: 'Custom Rate per Student (USD/year)',
			min: 0,
			max: 100,
			step: 0.01,
			default: defaultCustomRate
		},
		discountPercentage: {
			type: 'number',
			label: 'Discount Percentage',
			min: 0,
			max: 100,
			step: 1,
			default: defaultDiscount
		},
		reason: {
			type: 'string',
			label: 'Reason for Change',
			placeholder: defaultReason,
			required: true
		}
	});

	if (canceled) return;

	try {
		await os.api('admin/schools/set-billing-rate', {
			schoolId: school.id,
			billingType: result.billingType,
			customRate: result.customRate,
			discountPercentage: result.discountPercentage,
			reason: result.reason
		});

		os.success();
		loadSchools(); // Reload the schools list to show updated billing info
	} catch (error: any) {
		os.alert({
			type: 'error',
			text: `Failed to configure billing: ${(error as any).message || 'Unknown error'}`
		});
	}
}

function showSchoolMenu(school: any, event: MouseEvent) {
	os.popupMenu([
		{
			icon: 'ph-eye ph-lg',
			text: 'View Details',
			action: () => viewSchool(school),
		},
		{
			icon: 'ph-pencil-simple ph-lg',
			text: 'Edit School',
			action: () => editSchool(school),
		},
		{
			icon: 'ph-users ph-lg',
			text: 'Manage Student Cap',
			action: () => manageStudentCap(school),
		},
		{
			icon: 'ph-credit-card ph-lg',
			text: 'Configure Billing',
			action: () => manageBilling(school),
		},
		null, // separator
		{
			icon: 'ph-warning-circle ph-lg',
			text: school.subscriptionStatus === 'suspended' ? 'Unsuspend School' : 'Suspend School',
			action: () => toggleSuspension(school),
		},
		{
			icon: 'ph-trash ph-lg',
			text: 'Delete School',
			danger: true,
			action: () => deleteSchool(school),
		},
	], event.target as HTMLElement);
}

async function toggleSuspension(school: any) {
	const action = school.subscriptionStatus === 'suspended' ? 'restore' : 'suspend';
	const confirmed = await os.confirm({
		type: 'warning',
		text: `Are you sure you want to ${action === 'restore' ? 'unsuspend' : 'suspend'} ${school.name}?`
	});

	if (!confirmed) return;

	try {
		await os.apiWithDialog('admin/schools/manual-access-control', {
			schoolId: school.id,
			action: action,
			reason: `Manual ${action === 'restore' ? 'unsuspend' : 'suspend'} by admin`
		});
		await loadSchools();
	} catch (error) {
		// Error handled by apiWithDialog
	}
}

async function deleteSchool(school: any) {
	const formResult: any = await os.form(`Delete School: ${school.name}`, {
		confirmation: {
			type: 'string',
			label: `Type "${school.name}" to confirm deletion`,
			placeholder: school.name,
			required: true,
		},
		reason: {
			type: 'string',
			label: 'Reason for deletion',
			placeholder: 'Explain why you are deleting this school...',
			required: true,
		},
		cancelSubscriptions: {
			type: 'boolean',
			label: 'Cancel active Stripe subscriptions',
			default: true,
		},
	});

	if (formResult.canceled) return;

	if (formResult.result.confirmation !== school.name) {
		os.alert({
			type: 'error',
			text: 'School name confirmation does not match. Deletion cancelled.'
		});
		return;
	}

	try {
		await os.apiWithDialog('admin/schools/delete-school', {
			schoolId: school.id,
			reason: formResult.result.reason,
			cancelActiveSubscriptions: formResult.result.cancelSubscriptions
		});
		await loadSchools();
		os.alert({
			type: 'success',
			text: `School "${school.name}" has been deleted successfully.`
		});
	} catch (error) {
		// Error handled by apiWithDialog
	}
}

function bulkActions() {
	os.alert({
		type: 'info',
		title: 'Bulk Actions',
		text: `Bulk actions for ${selectedSchools.value.length} selected schools coming soon.`
	});
}

// Watch for filter changes to debounce search
watch([searchQuery, selectedStatus, selectedType, sortBy], () => {
	// Filters are applied via computed property
}, { debounce: 300 });

onMounted(() => {
	loadSchools();
});

definePageMetadata({
	title: 'School Management',
	icon: 'ph-graduation-cap ph-lg',
});
</script>

<style lang="scss" scoped>
.admin-schools {
	.title {
		font-size: 1.5em;
		font-weight: bold;
		margin-bottom: 0.5em;
	}

	.description {
		opacity: 0.7;
		margin-bottom: 2em;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
		margin-bottom: 2em;

		.stat-card {
			background: var(--panel);
			padding: 20px;
			border-radius: 8px;
			border: 1px solid var(--divider);
			display: flex;
			align-items: center;
			gap: 16px;

			.stat-icon {
				background: var(--accent);
				color: white;
				width: 48px;
				height: 48px;
				border-radius: 8px;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.stat-content {
				.stat-number {
					font-size: 1.8em;
					font-weight: bold;
					line-height: 1;
				}

				.stat-label {
					opacity: 0.7;
					font-size: 0.9em;
					margin-top: 4px;
				}
			}
		}
	}

	.toolbar {
		display: flex;
		gap: 16px;
		align-items: end;
		flex-wrap: wrap;

		.search-section {
			flex: 1;
			min-width: 200px;
		}

		.filters {
			display: flex;
			gap: 12px;
		}

		.filter-select {
			min-width: 120px;
		}

		.actions {
			display: flex;
			gap: 8px;
		}
	}

	.empty {
		text-align: center;
		padding: 64px 32px;

		.empty-icon {
			font-size: 3em;
			opacity: 0.3;
			margin-bottom: 16px;
		}

		.empty-text {
			font-size: 1.2em;
			opacity: 0.7;
			margin-bottom: 24px;
		}
	}

	.schools-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
		gap: 20px;

		.school-card {
			background: var(--panel);
			border: 1px solid var(--divider);
			border-radius: 8px;
			padding: 20px;
			transition: all 0.2s ease;

			&:hover {
				border-color: var(--accent);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
			}

			&.status-active {
				border-left: 4px solid var(--success);
			}

			&.status-pending {
				border-left: 4px solid var(--warn);
			}

			&.status-suspended {
				border-left: 4px solid var(--error);
			}

			&.status-cancelled {
				border-left: 4px solid var(--fg);
				opacity: 0.7;
			}

			.school-header {
				display: flex;
				align-items: flex-start;
				gap: 12px;
				margin-bottom: 16px;

				.school-select {
					margin-top: 4px;
				}

				.school-info {
					flex: 1;
					display: flex;
					gap: 12px;

					.school-logo {
						.logo {
							width: 48px;
							height: 48px;
							border-radius: 6px;
							object-fit: cover;
						}

						.placeholder-icon {
							width: 48px;
							height: 48px;
							background: var(--accent);
							color: white;
							border-radius: 6px;
							display: flex;
							align-items: center;
							justify-content: center;
							font-size: 24px;
						}
					}

					.school-details {
						.school-name {
							margin: 0 0 4px 0;
							font-size: 1.1em;
							font-weight: 600;
						}

						.school-domain {
							color: var(--accent);
							font-family: monospace;
							font-size: 0.9em;
							margin-bottom: 2px;
						}

						.school-type {
							opacity: 0.7;
							font-size: 0.85em;
						}
					}
				}

				.school-status {
					display: flex;
					flex-direction: column;
					gap: 4px;
					align-items: flex-end;

					.demo-badge {
						display: flex;
						align-items: center;
						gap: 4px;
						padding: 4px 8px;
						border-radius: 4px;
						font-size: 0.75em;
						font-weight: 600;
						background: color-mix(in srgb, var(--accent) 15.00%, transparent);
						color: var(--accent);
						border: 1px solid var(--accent);
						text-transform: uppercase;
						letter-spacing: 0.5px;
					}

					.status-badge {
						display: flex;
						align-items: center;
						gap: 4px;
						padding: 4px 8px;
						border-radius: 4px;
						font-size: 0.8em;
						font-weight: 500;

						&.active {
							background: color-mix(in srgb, var(--success) 15.00%, transparent);
							color: var(--success);
						}

						&.pending {
							background: color-mix(in srgb, var(--warn) 15.00%, transparent);
							color: var(--warn);
						}

						&.suspended {
							background: color-mix(in srgb, var(--error) 15.00%, transparent);
							color: var(--error);
						}

						&.cancelled {
							background: color-mix(in srgb, var(--fg) 15.00%, transparent);
							color: var(--fg);
						}
					}
				}
			}

			.school-metrics {
				display: grid;
				grid-template-columns: repeat(4, 1fr);
				gap: 16px;
				margin-bottom: 16px;

				.metric {
					text-align: center;

					.metric-value {
						font-size: 1.2em;
						font-weight: 600;
						line-height: 1;
					}

					.metric-label {
						font-size: 0.8em;
						opacity: 0.7;
						margin-top: 4px;
					}
				}
			}

			.cap-indicator {
				margin-bottom: 16px;

				.cap-bar {
					width: 100%;
					height: 6px;
					background: var(--divider);
					border-radius: 3px;
					overflow: hidden;
					margin-bottom: 6px;

					.cap-fill {
						height: 100%;
						transition: width 0.3s ease;

						&.cap-good {
							background: var(--success);
						}

						&.cap-moderate {
							background: var(--accent);
						}

						&.cap-warning {
							background: var(--warn);
						}

						&.cap-critical {
							background: var(--error);
						}
					}
				}

				.cap-text {
					font-size: 0.85em;
					text-align: center;
					opacity: 0.8;

					.cap-disabled {
						color: var(--warn);
						font-weight: 500;
					}
				}
			}

			.school-actions {
				display: flex;
				gap: 8px;
				flex-wrap: wrap;
			}
		}
	}
}
</style>

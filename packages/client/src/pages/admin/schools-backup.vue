<template>
<MkStickyContainer>
	<template #header><MkPageHeader :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :content-max="700" :margin-min="16" :margin-max="32">
		<div class="_formRoot">
			<div class="toolbar">
				<MkButton @click="createSchool" primary>
					<i class="ph-plus ph-lg"></i>
					{{ i18n.ts.addSchool }}
				</MkButton>
				
				<div class="filters">
					<MkSelect v-model="selectedType" small style="margin-right: 8px;">
						<template #label>{{ i18n.ts.schoolType }}</template>
						<option value="">{{ i18n.ts.all }}</option>
						<option value="university">University</option>
						<option value="college">College</option>
						<option value="k12">K-12 School</option>
						<option value="trade_school">Trade School</option>
						<option value="private_school">Private School</option>
					</MkSelect>
					
					<MkSelect v-model="selectedStatus" small>
						<template #label>{{ i18n.ts.subscriptionStatus }}</template>
						<option value="">{{ i18n.ts.all }}</option>
						<option value="active">Active</option>
						<option value="pending">Pending</option>
						<option value="suspended">Suspended</option>
						<option value="cancelled">Cancelled</option>
					</MkSelect>
				</div>
				
				<MkInput v-model="searchQuery" small type="search" style="flex: 1;">
					<template #prefix><i class="ph-magnifying-glass ph-lg"></i></template>
					<template #label>{{ i18n.ts.search }}</template>
				</MkInput>
			</div>

			<!-- Subscription Summary -->
			<div v-if="!loading && schools.length > 0" class="subscription-summary">
				<div class="summary-item">
					<span class="count">{{ activeSchoolsCount }}</span>
					<span class="label">Active Schools</span>
				</div>
				<div class="summary-item warning">
					<span class="count">{{ inactiveSchoolsCount }}</span>
					<span class="label">Need Activation</span>
				</div>
				<div class="summary-item">
					<span class="count">{{ suspendedSchoolsCount }}</span>
					<span class="label">Suspended</span>
				</div>
				<div class="summary-item">
					<span class="count">{{ schools.length }}</span>
					<span class="label">Total</span>
				</div>
			</div>

			<MkLoading v-if="loading"/>
			<div v-else-if="schools.length === 0" class="empty">
				<div>{{ i18n.ts.noSchools }}</div>
			</div>
			<div v-else class="schools">
				<div v-for="school in schools" :key="school.id" class="school">
					<div class="school-info">
						<div class="school-header">
							<div class="school-name">
								<h3>{{ school.name }}</h3>
								<div class="school-domain">{{ school.domain }}</div>
							</div>
							<div class="school-badges">
								<div class="school-type">{{ formatSchoolType(school.type) }}</div>
								<div :class="`subscription-status ${school.subscriptionStatus}`">
									{{ formatSubscriptionStatus(school.subscriptionStatus) }}
								</div>
								<div v-if="school.metadata?.adminOverride && school.subscriptionStatus === 'active'" class="admin-override-badge">
									<i class="ph-shield-check ph-lg"></i>
									Free Access
								</div>
							</div>
						</div>
						
						<div v-if="school.description" class="school-description">
							{{ school.description }}
						</div>
						
						<div class="school-stats">
							<div class="stat">
								<span class="label">{{ i18n.ts.students }}:</span>
								<span class="value">{{ school.studentCount }}</span>
							</div>
							<div class="stat">
								<span class="label">Billing Rate:</span>
								<span class="value" :class="getBillingRateClass(school)">{{ formatBillingRate(school) }}</span>
							</div>
							<div class="stat">
								<span class="label">Annual Revenue:</span>
								<span class="value">${{ formatCurrency(school.annualRevenue || 0) }}</span>
							</div>
							<div v-if="school.location" class="stat">
								<span class="label">{{ i18n.ts.location }}:</span>
								<span class="value">{{ school.location }}</span>
							</div>
							<div class="stat">
								<span class="label">{{ i18n.ts.createdAt }}:</span>
								<span class="value">{{ formatDate(school.createdAt) }}</span>
							</div>
						</div>
						
						<div class="school-actions">
							<!-- Quick activation button for inactive schools -->
							<MkButton 
								v-if="school.subscriptionStatus !== 'active'" 
								@click="activateSchoolForFree(school)" 
								primary
								small
							>
								<i class="ph-check-circle ph-lg"></i>
								Activate Free
							</MkButton>

							<!-- Quick revoke button for schools with admin override -->
							<MkButton 
								v-if="school.subscriptionStatus === 'active' && school.metadata?.adminOverride" 
								@click="revokeFreeAccess(school)" 
								warn
								small
							>
								<i class="ph-minus-circle ph-lg"></i>
								Revoke Free
							</MkButton>
							
							<!-- Configure Billing Button -->
							<MkButton @click="configureBilling(school)" small>
								<i class="ph-gear-six ph-lg"></i>
								Billing Config
							</MkButton>
							
							<MkButton @click="viewSchool(school)" small>
								<i class="ph-eye ph-lg"></i>
								{{ i18n.ts.view }}
							</MkButton>
							<MkButton @click="editSchool(school)" small>
								<i class="ph-pencil-simple ph-lg"></i>
								{{ i18n.ts.edit }}
							</MkButton>
							<MkButton @click="manageSubscription(school)" small>
								<i class="ph-credit-card ph-lg"></i>
								{{ i18n.ts.subscription }}
							</MkButton>
							<MkButton @click="manageSchoolAdmins(school)" small>
								<i class="ph-users-three ph-lg"></i>
								Manage Admins
							</MkButton>
						</div>
					</div>
				</div>
			</div>
			
			<div v-if="hasMore" class="load-more">
				<MkButton @click="loadMore" :loading="loadingMore">
					{{ i18n.ts.loadMore }}
				</MkButton>
			</div>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/form/input.vue';
import MkSelect from '@/components/form/select.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { useStripePricing } from '@/composables/use-stripe-pricing';

// Oh boy, here we go managing schools like it's herding cats
const schools = ref([]);
const loading = ref(true);
const loadingMore = ref(false);
const hasMore = ref(false);
const offset = ref(0);
const limit = 20;

const searchQuery = ref('');
const selectedType = ref('');
const selectedStatus = ref('');

// Fetch current Stripe pricing
const { standardRate } = useStripePricing();

// Computed properties for subscription summary, because counting schools is thrilling
const activeSchoolsCount = computed(() => 
	schools.value.filter(school => school.subscriptionStatus === 'active').length
);

const inactiveSchoolsCount = computed(() => 
	schools.value.filter(school => school.subscriptionStatus === 'inactive' || school.subscriptionStatus === 'pending').length
);

const suspendedSchoolsCount = computed(() => 
	schools.value.filter(school => school.subscriptionStatus === 'suspended' || school.subscriptionStatus === 'cancelled').length
);

function formatSchoolType(type: string) {
	const types = {
		university: 'University',
		college: 'College', 
		k12: 'K-12 School',
		trade_school: 'Trade School',
		private_school: 'Private School'
	};
	return types[type] || type;
}

function formatSubscriptionStatus(status: string) {
	const statuses = {
		active: 'Active',
		pending: 'Pending',
		suspended: 'Suspended', 
		cancelled: 'Cancelled'
	};
	return statuses[status] || status;
}

function formatDate(dateString: string) {
	return new Date(dateString).toLocaleDateString();
}

function formatBillingRate(school: any): string {
	if (!school.billingRate && school.billingRate !== 0) return 'Unknown';
	
	switch (school.billingType) {
		case 'free':
			return 'Free';
		case 'custom':
			return `$${school.billingRate.toFixed(2)}/student/year (Custom)`;
		case 'discount':
			const discount = school.discountPercentage || 0;
			return `$${school.billingRate.toFixed(2)}/student/year (${discount}% discount)`;
		case 'standard':
		default:
			return `$${school.billingRate.toFixed(2)}/student/year`;
	}
}

function getBillingRateClass(school: any): string {
	switch (school.billingType) {
		case 'free':
			return 'billing-free';
		case 'custom':
			return 'billing-custom';
		case 'discount':
			return 'billing-discount';
		default:
			return '';
	}
}

function formatCurrency(amount: number): string {
	return amount.toFixed(2);
}

async function loadSchools(reset = false) {
	if (reset) {
		offset.value = 0;
		schools.value = [];
	}
	
	loading.value = reset;
	loadingMore.value = !reset;
	
	try {
		const params = {
			limit,
			offset: offset.value,
			...(searchQuery.value && { search: searchQuery.value }),
			...(selectedType.value && { type: selectedType.value }),
			...(selectedStatus.value && { subscriptionStatus: selectedStatus.value }),
		};
		
		const result = await os.api('admin/list-schools', params);
		
		if (reset) {
			schools.value = result;
		} else {
			schools.value.push(...result);
		}
		
		hasMore.value = result.length === limit;
		offset.value += result.length;
	} catch (error) {
		os.alert({
			type: 'error',
			text: 'Failed to load schools'
		});
	} finally {
		loading.value = false;
		loadingMore.value = false;
	}
}

function loadMore() {
	loadSchools(false);
}

async function createSchool() {
	const { canceled, result }: any = await os.form(i18n.ts.createSchool, {
		name: {
			type: 'string',
			label: i18n.ts.schoolName,
			placeholder: 'University of Example'
		},
		domain: {
			type: 'string', 
			label: i18n.ts.domain,
			placeholder: 'example.edu'
		},
		type: {
			type: 'enum',
			label: i18n.ts.schoolType,
			enum: [
				{ label: 'University', value: 'university' },
				{ label: 'College', value: 'college' },
				{ label: 'K-12 School', value: 'k12' },
				{ label: 'Trade School', value: 'trade_school' },
				{ label: 'Private School', value: 'private_school' }
			],
			default: 'university'
		},
		location: {
			type: 'string',
			label: i18n.ts.location,
			placeholder: 'City, State, Country'
		},
		description: {
			type: 'string',
			label: i18n.ts.description,
			placeholder: 'Brief description of the school'
		},
		websiteUrl: {
			type: 'string',
			label: i18n.ts.website,
			placeholder: 'https://example.edu'
		}
	});
	
	if (canceled) return;
	
	try {
		const schoolResponse = await os.apiWithDialog('admin/create-school', {
			name: result.name,
			domain: result.domain,
			type: result.type,
			location: result.location,
			description: result.description,
			websiteUrl: result.websiteUrl
		});
		
		// If user requested to create admin, do it now
		if (result.createAdmin) {
			try {
				const school = { 
					id: schoolResponse.school.id, 
					name: result.name, 
					domain: result.domain 
				};
				await createSchoolAdmin(school);
			} catch (adminError) {
				os.alert({
					type: 'warning',
					text: 'School created successfully, but failed to create admin. You can create one manually from the school management menu.'
				});
			}
		}
		
		loadSchools(true);
	} catch (error) {
		// Error is handled by apiWithDialog
	}
}

function viewSchool(school) {
	const details = [
		`Name: ${school.name}`,
		`Domain: ${school.domain}`,
		`Type: ${formatSchoolType(school.type)}`,
		`Status: ${formatSubscriptionStatus(school.subscriptionStatus)}`,
		`Students: ${school.studentCount}`,
		school.location ? `Location: ${school.location}` : null,
		school.description ? `Description: ${school.description}` : null,
		school.websiteUrl ? `Website: ${school.websiteUrl}` : null,
		`Created: ${formatDate(school.createdAt)}`,
		`Active: ${school.isActive ? 'Yes' : 'No'}`
	].filter(Boolean).join('\n');
	
	os.alert({
		type: 'info',
		title: `School Details`,
		text: details
	});
}

async function editSchool(school) {
	// This was the problem - os.form returns a Promise, but we weren't awaiting it properly
	// Classic "I'll just chain .then() and hope for the best" approach 🤦‍♂️
	try {
		const { canceled, result }: any = await os.form('Edit School', {
			name: {
				type: 'string',
				label: i18n.ts.name,
				default: school.name
			},
			location: {
				type: 'string',
				label: i18n.ts.location,
				default: school.location || ''
			},
			description: {
				type: 'string',
				label: i18n.ts.description,
				default: school.description || ''
			},
			websiteUrl: {
				type: 'string',
				label: i18n.ts.website,
				default: school.websiteUrl || ''
			},
			isActive: {
				type: 'boolean',
				label: 'Active',
				default: school.isActive
			}
		});
		
		// If user canceled the form, bail out faster than a student dropping calculus
		if (canceled) return;
		
		// Now we actually have the form data, not a Promise of form data
		await os.apiWithDialog('admin/update-school', {
			schoolId: school.id,
			name: result.name,
			location: result.location,
			description: result.description,
			websiteUrl: result.websiteUrl,
			isActive: result.isActive
		});
		
		// Reload the schools list to show the updates
		loadSchools(true);
	} catch (error) {
		// Error is handled by apiWithDialog, but we should probably log it too
		// because debugging async issues is like finding a needle in a haystack made of needles
		console.error('Edit school failed:', error);
	}
}

function manageSubscription(school) {
	const menuItems = [{
		icon: 'ph-user-gear ph-lg',
		text: 'Create School Admin',
		action: () => createSchoolAdmin(school),
	}, {
		icon: 'ph-users ph-lg',
		text: 'Manage School Admins',
		action: () => manageSchoolAdmins(school),
	}, {
		icon: 'ph-credit-card ph-lg',
		text: 'Billing Settings',
		action: () => manageBilling(school),
	}, {
		icon: 'ph-chart-line ph-lg',
		text: 'Subscription Status',
		action: () => viewSubscriptionStatus(school),
	}];

	// Add subscription management options for platform admins
	if (school.subscriptionStatus !== 'active') {
		menuItems.push({
			icon: 'ph-check-circle ph-lg',
			text: 'Activate for Free',
			action: () => activateSchoolForFree(school),
		});
	}

	if (school.subscriptionStatus === 'active') {
		// Check if this is a free activation (admin override)
		if (school.metadata?.adminOverride) {
			menuItems.push({
				icon: 'ph-minus-circle ph-lg',
				text: 'Revoke Free Access',
				action: () => revokeFreeAccess(school),
			});
		}
		
		menuItems.push({
			icon: 'ph-x-circle ph-lg',
			text: 'Deactivate School',
			action: () => deactivateSchool(school),
		});
	}

	menuItems.push({
		icon: 'ph-arrow-clockwise ph-lg',
		text: 'Refresh Status',
		action: () => refreshSchoolStatus(school),
	});

	if (school.subscriptionStatus !== 'suspended') {
		menuItems.push({
			icon: 'ph-warning-circle ph-lg',
			text: 'Suspend School',
			action: () => suspendSchool(school),
		});
	}

	os.popup(import('@/components/MkMenu.vue'), menuItems);
}

async function createSchoolAdmin(school) {
	try {
		const { canceled, result }: any = await os.form('Create School Administrator', {
			email: {
				type: 'string',
				label: 'Email Address',
				placeholder: `admin@${school.domain}`,
				description: 'Recommended to use the school domain for security',
				required: true
			},
			name: {
				type: 'string',
				label: 'Full Name',
				placeholder: 'John Doe',
				required: true
			},
			generatePassword: {
				type: 'boolean',
				label: 'Generate temporary password',
				default: true,
				description: 'A secure password will be generated and displayed'
			}
		});
		
		if (canceled) return;
		
		// Basic email validation
		if (!result.email || !result.email.includes('@')) {
			os.alert({
				type: 'error',
				title: 'Invalid Email',
				text: 'Please enter a valid email address.'
			});
			return;
		}
		
		// Name validation
		if (!result.name || result.name.trim().length < 2) {
			os.alert({
				type: 'error',
				title: 'Invalid Name',
				text: 'Please enter a full name (at least 2 characters).'
			});
			return;
		}
		
		// Check if email domain matches school (optional warning)
		const emailDomain = result.email.split('@')[1];
		if (emailDomain !== school.domain) {
			const proceed = await os.confirm({
				type: 'warning',
				title: 'Different Email Domain',
				text: `Email domain (${emailDomain}) doesn't match school domain (${school.domain}).\n\nThis may cause confusion for users but won't prevent functionality.\n\nProceed anyway?`
			});
			if (!proceed) return;
		}
		
		// Final confirmation
		const confirmed = await os.confirm({
			type: 'info',
			title: 'Create School Administrator',
			text: `Create school administrator account?\n\nSchool: ${school.name}\nName: ${result.name}\nEmail: ${result.email}\n\nThe administrator will have full access to manage ${school.name}'s Campra instance.`
		});
		
		if (!confirmed) return;
		
		const response = await os.apiWithDialog('admin/create-school-admin', {
			schoolId: school.id,
			email: result.email,
			name: result.name,
			generatePassword: result.generatePassword
		});
		
		// Show success with password if generated
		let successMessage = `School administrator created successfully!\n\n`;
		successMessage += `👤 Name: ${result.name}\n`;
		successMessage += `📧 Email: ${response.user.email}\n`;
		successMessage += `🆔 Username: ${response.user.username}\n`;
		successMessage += `🏫 School: ${school.name}`;
		
		if (response.temporaryPassword) {
			successMessage += `\n\n🔑 TEMPORARY PASSWORD:\n${response.temporaryPassword}`;
			successMessage += `\n\n⚠️ IMPORTANT:\n• Save this password immediately\n• It will not be displayed again\n• The admin should change it on first login\n• Send these credentials securely to the administrator`;
		} else {
			successMessage += `\n\n📝 The administrator will need to set up their password through the account recovery process.`;
		}
		
		os.alert({
			type: 'success',
			title: 'School Administrator Created',
			text: successMessage
		});
		
		// Optionally reload the admin list if we're in the context of managing admins
		// This would require passing a callback or managing state differently
		
	} catch (error: any) {
		// Enhanced error handling
		if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
			os.alert({
				type: 'error',
				title: 'Administrator Already Exists',
				text: `An administrator with this email or username already exists.\n\nPlease use a different email address or check if the user is already a school administrator.`
			});
		} else {
			console.error('Failed to create school admin:', error);
			// Error is handled by apiWithDialog, but we can add more context
		}
	}
}

async function activateSchoolForFree(school) {
	// Oh look, another async function to make free stuff happen
	const reasonInput = await os.inputText({
		title: `Activate ${school.name} for Free`,
		placeholder: 'Reason for free activation (optional)',
	});

	if (reasonInput.canceled) return; // User bailed, probably scared of free stuff

	const reasonText = reasonInput.result || 'Platform admin free activation';

	const confirmed = await os.confirm({
		type: 'info',
		text: `Activate ${school.name} for free? This will give them full access to Campra without payment.`,
	});

	if (!confirmed) return; // User chickened out

	try {
		await os.api('admin/schools/manage-subscription', {
			schoolId: school.id,
			action: 'activate',
			reason: reasonText,
		});

		os.success();
		await loadSchools(true); // Reload the list, because we’re fancy
	} catch (error) {
		// This error handling is so jank, it deserves an award
		console.error('Failed to activate school:', error);
		os.alert({
			type: 'error',
			text: `Failed to activate school: ${(error as any).message || 'Unknown error'}`,
		});
	}
}

async function revokeFreeAccess(school) {
	// Taking away free stuff, how cruel
	const reasonInput = await os.inputText({
		title: `Revoke Free Access for ${school.name}`,
		placeholder: 'Reason for revoking free access (required)',
	});

	if (reasonInput.canceled || !reasonInput.result) {
		os.alert({
			type: 'error',
			text: 'Reason for revocation is required',
		});
		return; // No reason, no revocation. Rules are rules.
	}

	const confirmed = await os.confirm({
		type: 'warning',
		text: `Are you sure you want to revoke free access for ${school.name}? They will lose access unless they have a paid subscription.`,
	});

	if (!confirmed) return; // User got cold feet

	try {
		await os.api('admin/schools/manage-subscription', {
			schoolId: school.id,
			action: 'revoke',
			reason: reasonInput.result,
		});

		os.success();
		await loadSchools(true); // Reload, because we love refreshing
	} catch (error) {
		// Why does this error handling feel like duct tape?
		console.error('Failed to revoke free access:', error);
		os.alert({
			type: 'error',
			text: `Failed to revoke free access: ${(error as any).message || 'Unknown error'}`,
		});
	}
}

async function deactivateSchool(school) {
	// Deactivating like it’s a bad Netflix subscription
	const reasonInput = await os.inputText({
		title: `Deactivate ${school.name}`,
		placeholder: 'Reason for deactivation (required)',
	});

	if (reasonInput.canceled || !reasonInput.result) {
		os.alert({
			type: 'error',
			text: 'Deactivation reason is required',
		});
		return; // No reason, no deactivation. Tough luck.
	}

	const confirmed = await os.confirm({
		type: 'warning',
		text: `Are you sure you want to deactivate ${school.name}? This will suspend their access to Campra.`,
	});

	if (!confirmed) return; // User’s having second thoughts

	try {
		await os.api('admin/schools/manage-subscription', {
			schoolId: school.id,
			action: 'deactivate',
			reason: reasonInput.result,
		});

		os.success();
		await loadSchools(true); // Reload, because why not
	} catch (error) {
		// This error block is held together by hopes and dreams
		console.error('Failed to deactivate school:', error);
		os.alert({
			type: 'error',
			text: `Failed to deactivate school: ${(error as any).message || 'Unknown error'}`,
		});
	}
}

async function suspendSchool(school) {
	// Suspending like it’s a kid in detention
	const reasonInput = await os.inputText({
		title: `Suspend ${school.name}`,
		placeholder: 'Reason for suspension (required)',
	});

	if (reasonInput.canceled || !reasonInput.result) {
		os.alert({
			type: 'error',
			text: 'Suspension reason is required',
		});
		return; // No reason, no suspension. Try harder.
	}

	const confirmed = await os.confirm({
		type: 'error',
		text: `Are you sure you want to SUSPEND ${school.name}? This is a serious action that will immediately block their access.`,
	});

	if (!confirmed) return; // User’s too nice to suspend

	try {
		await os.api('admin/schools/manage-subscription', {
			schoolId: school.id,
			action: 'suspend',
			reason: reasonInput.result,
		});

		os.success();
		await loadSchools(true); // Reload, because we’re obsessed
	} catch (error) {
		// This error handling is so brittle, it might snap
		console.error('Failed to suspend school:', error);
		os.alert({
			type: 'error',
			text: `Failed to suspend school: ${(error as any).message || 'Unknown error'}`,
		});
	}
}

async function refreshSchoolStatus(school) {
	try {
		const result = await os.api('admin/refresh-school-status', {
			schoolId: school.id,
		});

		if (result.oldStatus !== result.newStatus) {
			os.alert({
				type: 'success',
				text: `Status updated from ${result.oldStatus} to ${result.newStatus}`,
			});
			await loadSchools(true); // Reload to show updated status
		} else {
			os.alert({
				type: 'info',
				text: `Status is already correct: ${result.newStatus}`,
			});
		}
	} catch (error: any) {
		console.error('Failed to refresh school status:', error);
		os.alert({
			type: 'error',
			text: `Failed to refresh status: ${(error as any).message || 'Unknown error'}`,
		});
	}
}

async function manageSchoolAdmins(school) {
	console.log('manageSchoolAdmins called with school:', school);
	
	// Simple popup-based admin management
	try {
		// First, try to load the admins
		let admins: any[] = [];
		try {
			const adminData = await os.api('admin/list-school-admins', {
				schoolId: school.id
			});
			admins = adminData.admins || adminData || [];
		} catch (error) {
			console.warn('Could not load admin list:', error);
		}
		
		// Show admin management popup
		let adminText = `School: ${school.name}\n\n`;
		
		if (admins.length > 0) {
			adminText += `Current Administrators (${admins.length}):\n`;
			admins.forEach((admin, index) => {
				const status = admin.isActive ? '✅ Active' : '❌ Inactive';
				adminText += `${index + 1}. ${admin.name} (${admin.email}) - ${status}\n`;
			});
		} else {
			adminText += 'No administrators found for this school.\n';
		}
		
		adminText += '\nWhat would you like to do?';
		
		const items = [
			{ value: 'create', text: '➕ Create New Administrator' },
			...(admins.length > 0 ? [{ value: 'view', text: '👀 View All Administrators' }] : []),
			...(admins.length > 0 ? [{ value: 'remove', text: '➖ Remove Administrator' }] : []),
			{ value: 'cancel', text: '❌ Cancel' }
		];
		
		const { canceled, result } = await os.select({
			title: 'Manage School Administrators',
			text: adminText,
			items
		});
		
		if (canceled) return;
		
		switch (result) {
			case 'create':
				await createSchoolAdmin(school);
				break;
			case 'view':
				await showAdminList(school, admins);
				break;
			case 'remove':
				await removeSchoolAdmin(school, admins);
				break;
			default:
				// Cancel or close
				break;
		}
		
	} catch (error) {
		console.error('Error in manageSchoolAdmins:', error);
		os.alert({
			type: 'error',
			title: 'Admin Management Error',
			text: `Could not manage administrators for ${school.name}.\n\nError: ${(error as any).message || 'Unknown error'}`
		});
	}
}

async function showAdminList(school, admins) {
	const activeAdmins = admins.filter(admin => admin.isActive);
	const inactiveAdmins = admins.filter(admin => !admin.isActive);
	
	let adminDetails = '';
	
	if (activeAdmins.length > 0) {
		adminDetails += `🟢 ACTIVE ADMINISTRATORS (${activeAdmins.length}):\n`;
		adminDetails += activeAdmins.map(admin => {
			const lastActive = admin.lastActiveDate 
				? new Date(admin.lastActiveDate).toLocaleDateString()
				: 'Never';
			
			return `  ✅ ${admin.name} (@${admin.username})
     📧 ${admin.email}
     📅 Last Active: ${lastActive}
     🆔 Created: ${new Date(admin.createdAt).toLocaleDateString()}`;
		}).join('\n\n');
	}
	
	if (inactiveAdmins.length > 0) {
		if (adminDetails) adminDetails += '\n\n';
		adminDetails += `🔴 INACTIVE ADMINISTRATORS (${inactiveAdmins.length}):\n`;
		adminDetails += inactiveAdmins.map(admin => {
			const lastActive = admin.lastActiveDate 
				? new Date(admin.lastActiveDate).toLocaleDateString()
				: 'Never';
			
			return `  ❌ ${admin.name} (@${admin.username})
     📧 ${admin.email}
     📅 Last Active: ${lastActive}
     🆔 Created: ${new Date(admin.createdAt).toLocaleDateString()}
     ⚠️ Status: Account is locked or inactive`;
		}).join('\n\n');
	}

	os.alert({
		type: 'info',
		title: `School Administrators for ${school.name}`,
		text: `Total Admins: ${admins.length} (${activeAdmins.length} active, ${inactiveAdmins.length} inactive)\n\n${adminDetails}`
	});
}

async function showInactiveAdmins(school, inactiveAdmins) {
	const adminDetails = inactiveAdmins.map(admin => {
		const lastActive = admin.lastActiveDate 
			? new Date(admin.lastActiveDate).toLocaleDateString()
			: 'Never';
		
		return `❌ ${admin.name} (@${admin.username})
📧 ${admin.email}
📅 Last Active: ${lastActive}
🆔 Created: ${new Date(admin.createdAt).toLocaleDateString()}
⚠️ Status: Account is locked or inactive`;
	}).join('\n\n');

	os.alert({
		type: 'warning',
		title: `Inactive Admins for ${school.name}`,
		text: `Found ${inactiveAdmins.length} inactive administrator${inactiveAdmins.length > 1 ? 's' : ''}:\n\n${adminDetails}\n\nNote: Inactive admins cannot access the school admin panel. Consider removing their privileges or contacting them to reactivate their accounts.`
	});
}

async function removeSchoolAdmin(school, admins) {
	if (admins.length === 0) {
		os.alert({
			type: 'info',
			title: 'No Administrators to Remove',
			text: `${school.name} currently has no school administrators to remove.`
		});
		return;
	}
	
	// Create selection options with better formatting
	const adminOptions = admins.map(admin => ({
		value: admin.id,
		label: `${admin.name} (@${admin.username}) - ${admin.email}${admin.isActive ? '' : ' (Inactive)'}`
	}));
	
	const { canceled, result }: any = await os.form('Remove School Administrator', {
		adminId: {
			type: 'enum',
			label: 'Select Administrator to Remove',
			enum: adminOptions,
			description: 'Choose which administrator to remove from this school'
		},
		reason: {
			type: 'string',
			label: 'Reason for Removal',
			placeholder: 'Administrative action, role change, etc.',
			description: 'This will be logged for audit purposes'
		}
	});
	
	if (canceled) return;
	
	const selectedAdmin = admins.find(admin => admin.id === result.adminId);
	
	if (!selectedAdmin) {
		os.alert({
			type: 'error',
			title: 'Administrator Not Found',
			text: 'Could not find the selected administrator. Please try again.'
		});
		return;
	}
	
	// Enhanced confirmation dialog
	const lastActive = selectedAdmin.lastActiveDate 
		? new Date(selectedAdmin.lastActiveDate).toLocaleDateString()
		: 'Never';
	
	const confirmed = await os.confirm({
		type: 'warning',
		title: 'Remove School Administrator',
		text: `Remove administrator privileges from:\n\n👤 ${selectedAdmin.name} (@${selectedAdmin.username})\n📧 ${selectedAdmin.email}\n📅 Last Active: ${lastActive}\n🏫 School: ${school.name}\n\nThis will:\n• Remove their access to school admin features\n• Keep their user account active\n• Require re-assignment if privileges need to be restored\n\n⚠️ This action cannot be undone.`
	});
	
	if (!confirmed) return;
	
	try {
		await os.apiWithDialog('admin/remove-school-admin', {
			userId: result.adminId,
			reason: result.reason || 'Platform admin action'
		});
		
		os.alert({
			type: 'success',
			title: 'Administrator Removed',
			text: `School administrator privileges have been successfully removed from ${selectedAdmin.name}.\n\nThey will no longer have access to the school admin panel for ${school.name}.`
		});
		
	} catch (error) {
		console.error('Failed to remove school admin:', error);
		// Error is handled by apiWithDialog
	}
}

function manageBilling(school) {
	const menuItems = [{
		icon: 'ph-chart-line-up ph-lg',
		text: 'View Stripe Dashboard',
		action: () => openStripeDashboard(school),
	}, {
		icon: 'ph-credit-card ph-lg',
		text: 'Billing Configuration',
		action: () => configureBilling(school),
	}, {
		icon: 'ph-receipt ph-lg', 
		text: 'View Invoices',
		action: () => viewSchoolInvoices(school),
	}, {
		icon: 'ph-users ph-lg',
		text: 'Student Count & Billing',
		action: () => viewStudentBilling(school),
	}];

	os.popup(import('@/components/MkMenu.vue'), menuItems);
}

async function openStripeDashboard(school) {
	// Open Stripe customer dashboard if available
	try {
		// First check if Stripe is configured
		const config = await os.api('stripe/config-status');
		if (!config.configured) {
			os.alert({
				type: 'warning',
				title: 'Stripe Not Configured',
				text: 'Stripe API keys need to be configured before accessing billing dashboards.\n\nPlease configure Stripe in admin settings first.'
			});
			return;
		}

		// Try to get billing info
		const result = await os.api('stripe/manage', { 
			action: 'portal',
			schoolId: school.id 
		});
		if (result.url) {
			window.open(result.url, '_blank');
			return;
		}
	} catch (error) {
		console.warn('Could not open Stripe dashboard:', error);
	}
	
	os.alert({
		type: 'info',
		title: 'Stripe Dashboard',
		text: `School: ${school.name}\n\nStripe customer portal would open here if the school has an active subscription.\n\nTo set up billing:\n1. Configure Stripe in admin settings\n2. School admin must activate subscription`
	});
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
		loadSchools(true);
	} catch (error: any) {
		os.alert({
			type: 'error',
			text: `Failed to configure billing: ${(error as any).message || 'Unknown error'}`
		});
	}
}

async function viewSchoolInvoices(school) {
	try {
		const invoices = await os.api('schools/invoices', { 
			schoolId: school.id,
			limit: 10 
		});
		
		if (invoices.length === 0) {
			os.alert({
				type: 'info',
				title: 'No Invoices',
				text: `No billing history found for ${school.name}`
			});
			return;
		}

		const invoiceList = invoices.map(inv => 
			`${inv.date} - $${inv.amount.toFixed(2)} (${inv.status}) - ${inv.studentCount} students`
		).join('\n');

		os.alert({
			type: 'info',
			title: `Invoices for ${school.name}`,
			text: invoiceList
		});
	} catch (error) {
		os.alert({
			type: 'error',
			text: 'Failed to load invoice history'
		});
	}
}

async function viewStudentBilling(school) {
	const studentCount = school.studentCount || 0;
	const annualRate = studentCount * standardRate.value;
	const status = school.subscriptionStatus || 'unknown';
	
	const details = [
		`School: ${school.name}`,
		`Current Students: ${studentCount}`,
		`Annual Rate: $${annualRate.toFixed(2)} ($${standardRate.value.toFixed(2)} per student)`,
		`Subscription Status: ${formatSubscriptionStatus(status)}`,
		``,
		`Billing Notes:`,
		`• Only active students count toward billing`,
		`• Staff accounts are excluded from billing`,
		`• Billing is processed annually via Stripe`,
		school.metadata?.adminOverride ? `• ADMIN OVERRIDE: Free billing active` : null
	].filter(Boolean).join('\n');

	os.alert({
		type: 'info',
		title: 'Student Count & Billing',
		text: details
	});
}

async function viewSubscriptionStatus(school) {
	const status = school.subscriptionStatus || 'unknown';
	const studentCount = school.studentCount || 0;
	
	// Calculate effective rate
	let effectiveRate = standardRate.value; // Standard rate
	let rateDetails = 'Standard rate';
	
	if (school.metadata?.adminOverride || school.metadata?.freeActivation) {
		effectiveRate = 0;
		rateDetails = 'Free (Admin Override)';
	} else if (school.metadata?.customBillingRate) {
		effectiveRate = school.metadata.customBillingRate;
		rateDetails = `Custom rate ($${effectiveRate}/student/year)`;
	} else if (school.metadata?.discountPercentage) {
		const discount = school.metadata.discountPercentage;
		effectiveRate = standardRate.value * (1 - discount / 100);
		rateDetails = `${discount}% discount ($${effectiveRate.toFixed(2)}/student/year)`;
	}
	
	const annualRate = (studentCount * effectiveRate).toFixed(2);
	
	// Check Stripe configuration
	let stripeConfigured = false;
	try {
		const config = await os.api('stripe/config-status');
		stripeConfigured = config.configured;
	} catch (error) {
		console.warn('Could not check Stripe configuration:', error);
	}
	
	const details = [
		`School: ${school.name}`,
		`Subscription Status: ${formatSubscriptionStatus(status)}`,
		`Current Students: ${studentCount}`,
		`Billing Rate: ${rateDetails}`,
		`Annual Cost: $${annualRate}`,
		``,
		`Billing Information:`,
		`• Only active students count toward billing`,
		`• Staff accounts are excluded from billing`,
		`• Billing is processed annually via Stripe`,
		school.metadata?.adminOverride ? `• ADMIN OVERRIDE: Free billing active` : null,
		school.metadata?.lastBillingUpdate ? `• Last updated: ${new Date(school.metadata.lastBillingUpdate.timestamp).toLocaleDateString()}` : null,
		``,
		`Stripe Configuration: ${stripeConfigured ? '✅ Configured' : '❌ Not Configured'}`,
		!stripeConfigured ? `• Configure Stripe API keys in admin settings` : null
	].filter(Boolean).join('\n');
	
	os.alert({
		type: 'info',
		title: 'Subscription Status',
		text: details
	});
}

// Watch filters and reload, because we love watching things
watch([searchQuery, selectedType, selectedStatus], () => {
	loadSchools(true);
}, { debounce: 300 });

onMounted(() => {
	loadSchools(true);
});

const headerActions = computed(() => [
	{
		icon: 'ph-plus ph-lg',
		text: i18n.ts.addSchool,
		handler: createSchool,
	}
]);

const headerTabs = computed(() => []);

definePageMetadata({
	title: i18n.ts.schools,
	icon: 'ph-graduation-cap ph-lg',
});
</script>

<style lang="scss" scoped>
.toolbar {
	display: flex;
	gap: 16px;
	margin-bottom: 16px;
	align-items: end;
	
	.filters {
		display: flex;
		gap: 8px;
	}
}

.empty {
	text-align: center;
	padding: 32px;
	color: var(--fgTransparentWeak);
}

.schools {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.school {
	background: var(--panel);
	border-radius: 8px;
	padding: 16px;
	border: 1px solid var(--divider);
	
	.school-header {
		display: flex;
		justify-content: space-between;
		align-items: start;
		margin-bottom: 12px;
		
		.school-name {
			h3 {
				margin: 0 0 4px 0;
				font-size: 1.1em;
				font-weight: bold;
			}
			
			.school-domain {
				color: var(--accent);
				font-size: 0.9em;
			}
		}
		
		.school-badges {
			display: flex;
			gap: 8px;
			align-items: center;
			
			.school-type {
				background: var(--bg);
				padding: 4px 8px;
				border-radius: 4px;
				font-size: 0.8em;
				text-transform: capitalize;
			}
			
			.subscription-status {
				padding: 4px 8px;
				border-radius: 4px;
				font-size: 0.8em;
				font-weight: bold;
				
				&.active {
					background: var(--success);
					color: white;
				}
				
				&.inactive {
					background: var(--warn);
					color: white;
					animation: pulse 2s infinite;
				}
				
				&.pending {
					background: var(--warn);
					color: white;
				}
				
				&.suspended, &.cancelled {
					background: var(--error);
					color: white;
				}
			}

			.admin-override-badge {
				display: flex;
				align-items: center;
				gap: 4px;
				padding: 4px 8px;
				border-radius: 4px;
				font-size: 0.8em;
				font-weight: bold;
				background: var(--info);
				color: white;
				border: 2px solid var(--infoBg);

				i {
					font-size: 1em;
				}
			}
		}
	}
	
	.school-description {
		margin-bottom: 12px;
		color: var(--fg);
		font-size: 0.9em;
		line-height: 1.4;
	}
	
	.school-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		margin-bottom: 12px;
		
		.stat {
			display: flex;
			gap: 4px;
			font-size: 0.9em;
			
			.label {
				color: var(--fgTransparentWeak);
			}
			
			.value {
				font-weight: 500;
				
				&.billing-free {
					color: var(--success);
					font-weight: bold;
				}
				
				&.billing-custom {
					color: var(--accent);
					font-weight: bold;
				}
				
				&.billing-discount {
					color: var(--warn);
					font-weight: bold;
				}
			}
		}
	}
	
	.school-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}
}

.subscription-summary {
	display: flex;
	gap: 20px;
	margin-bottom: 20px;
	padding: 16px;
	background: var(--panel);
	border-radius: 8px;
	border: 1px solid var(--divider);

	.summary-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px;
		background: var(--bg);
		border-radius: 6px;
		min-width: 80px;

		.count {
			font-size: 1.5em;
			font-weight: bold;
			color: var(--accent);
		}

		.label {
			font-size: 0.8em;
			color: var(--fgTransparentWeak);
			margin-top: 4px;
		}

		&.warning {
			.count {
				color: var(--warn);
			}
		}
	}
}

@keyframes pulse {
	0% {
		opacity: 1;
	}
	50% {
		opacity: 0.7;
	}
	100% {
		opacity: 1;
	}
}

.load-more {
	text-align: center;
	margin-top: 16px;
}
</style>
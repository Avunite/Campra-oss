<template>
	<MkSpacer :content-max="900" :margin-min="16" :margin-max="32">
		<div class="staff-page">
			<div class="page-header">
				<h1>{{ i18n.ts.staff || 'Staff' }}</h1>
				<MkButton @click="showInviteDialog" primary>
					<i class="ph-user-plus ph-lg"></i>
					{{ i18n.ts.inviteStaff || 'Invite Staff' }}
				</MkButton>
			</div>

			<div class="search-bar">
				<MkInput v-model="searchQuery" :placeholder="i18n.ts.search" @update:model-value="onSearchChange">
					<template #prefix><i class="ph-magnifying-glass ph-lg"></i></template>
				</MkInput>
				<div class="staff-count">{{ allStaff.length }} {{ i18n.ts.staff || 'staff members' }}</div>
			</div>

			<div v-if="loading" class="loading">
				<MkLoading />
			</div>
			<div v-else-if="error" class="error">
				<p>{{ error }}</p>
				<MkButton @click="loadStaff">{{ i18n.ts.retry || 'Retry' }}</MkButton>
			</div>
			<div v-else-if="allStaff.length === 0" class="empty-state">
				<i class="ph-chalkboard-teacher ph-lg"></i>
				<p>{{ i18n.ts.noStaffFound || 'No staff members found' }}</p>
			</div>
			<div v-else class="staff-grid">
				<div v-for="staff in allStaff" :key="staff.id" class="staff-card">
					<div class="staff-info" @click="showUserInfo(staff)">
						<div class="staff-avatar">
							<MkAvatar :user="staff" :show-indicator="true" />
						</div>
						<div class="staff-details">
							<div class="staff-name">{{ staff.name || staff.username }}</div>
							<div class="staff-username">@{{ staff.username }}</div>
						</div>
						<div class="staff-role">
							<span v-if="staff.isSchoolAdmin" class="role admin">{{ i18n.ts.administrator ||
								'Administrator'
							}}</span>
							<span v-else-if="staff.isTeacher" class="role teacher">{{ i18n.ts.teacher || 'Teacher'
							}}</span>
							<span v-else class="role staff">{{ i18n.ts.staff || 'Staff' }}</span>
						</div>
					</div>
					<div class="staff-actions">
						<MkButton v-if="!staff.isSuspended && !staff.isSchoolAdmin" @click="suspendStaff(staff)" danger
							size="small">
							{{ i18n.ts.suspend }}
						</MkButton>
						<MkButton v-else-if="staff.isSuspended" @click="unsuspendStaff(staff)" size="small">
							{{ i18n.ts.unsuspend }}
						</MkButton>
					</div>
				</div>
			</div>
		</div>
	</MkSpacer>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/form/input.vue';

import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { $i } from '@/account';

const loading = ref(true);
const error = ref('');
const teachers = ref([]);
const schoolAdmins = ref([]);
const searchQuery = ref('');

let searchTimeout: number | null = null;

const allStaff = computed(() => {
	return [...teachers.value, ...schoolAdmins.value];
});

function onSearchChange() {
	if (searchTimeout) {
		clearTimeout(searchTimeout);
	}
	searchTimeout = setTimeout(() => {
		loadStaff();
	}, 500);
}

async function loadStaff() {
	loading.value = true;
	error.value = '';

	try {
		// Load teachers
		teachers.value = await os.api('schools/list-teachers', {
			search: searchQuery.value || undefined,
			limit: 100
		});

		// Load school admins
		const adminResult = await os.api('schools/students', {
			userType: 'staff',
			limit: 50
		});
		schoolAdmins.value = adminResult.filter((user: any) => user.isSchoolAdmin && user.id !== $i?.id);

	} catch (err) {
		console.error('Failed to load staff:', err);
		error.value = (err as any)?.message || 'Failed to load staff';
	} finally {
		loading.value = false;
	}
}

async function showInviteDialog() {
	const { canceled, result } = await os.form(i18n.ts.inviteStaff || 'Invite Staff Member', {
		email: {
			type: 'string',
			label: i18n.ts.email || 'Email',
			placeholder: 'user@example.com'
		},
		name: {
			type: 'string',
			label: i18n.ts.name || 'Full Name',
			placeholder: 'John Doe'
		},
		position: {
			type: 'enum',
			label: i18n.ts.position || 'Position',
			enum: [
				{ label: i18n.ts.teacher || 'Teacher', value: 'teacher' },
				{ label: i18n.ts.administrator || 'Administrator', value: 'admin' }
			]
		}
	});

	if (canceled) return;

	try {
		if (result.position === 'admin') {
			await os.apiWithDialog('schools/invite-admin', {
				email: result.email
			});
		} else {
			await os.apiWithDialog('schools/create-teacher', {
				email: result.email,
				name: result.name
			});
		}

		os.success();
		loadStaff();
	} catch (err) {
		console.error('Failed to invite staff:', err);
		os.alert({
			type: 'error',
			text: (err as any)?.message || 'Failed to invite staff member'
		});
	}
}

function showUserInfo(user: any) {
	os.pageWindow(`/user-info/${user.id}`);
}

async function suspendStaff(staff: any) {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: `Suspend ${staff.name || staff.username}?`
	});

	if (canceled) return;

	try {
		await os.api('school/suspend-student', {
			userId: staff.id
		});

		await loadStaff();
		os.success();
	} catch (err) {
		console.error('Failed to suspend staff:', err);
		os.alert({
			type: 'error',
			text: (err as any)?.message || 'Failed to suspend staff member'
		});
	}
}

async function unsuspendStaff(staff: any) {
	const { canceled } = await os.confirm({
		type: 'info',
		text: `Unsuspend ${staff.name || staff.username}?`
	});

	if (canceled) return;

	try {
		await os.api('school/unsuspend-student', {
			userId: staff.id
		});

		await loadStaff();
		os.success();
	} catch (err) {
		console.error('Failed to unsuspend staff:', err);
		os.alert({
			type: 'error',
			text: (err as any)?.message || 'Failed to unsuspend staff member'
		});
	}
}

onMounted(() => {
	loadStaff();
});

definePageMetadata({
	title: i18n.ts.staff || 'Staff',
	icon: 'ph-chalkboard-teacher ph-lg',
});
</script>

<style lang="scss" scoped>
.staff-page {
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;

		h1 {
			margin: 0;
			font-size: 1.5em;
			font-weight: 600;
		}
	}

	.search-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
		gap: 16px;

		.staff-count {
			font-size: 0.9em;
			opacity: 0.7;
			white-space: nowrap;
		}
	}

	.staff-grid {
		display: grid;
		gap: 12px;

		.staff-card {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 16px;
			background: var(--panel);
			border-radius: 8px;
			border: 1px solid var(--divider);
			transition: all 0.2s;

			&:hover {
				border-color: var(--accent);
				background: var(--accentedBg);
			}

			.staff-info {
				flex: 1;
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 12px;

				.staff-avatar {
					width: 40px;
					height: 40px;
					flex-shrink: 0;
				}

				.staff-details {
					flex: 1;
					min-width: 0;

					.staff-name {
						font-weight: 500;
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
					}

					.staff-username {
						font-size: 0.9em;
						opacity: 0.7;
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
					}
				}

				.staff-role {
					.role {
						padding: 4px 8px;
						border-radius: 12px;
						font-size: 0.8em;
						font-weight: 500;

						&.admin {
							background: var(--accent);
							color: white;
						}

						&.teacher {
							background: var(--success);
							color: white;
						}

						&.staff {
							background: var(--panel);
							color: var(--fg);
							border: 1px solid var(--divider);
						}
					}
				}
			}

			.staff-actions {
				display: flex;
				gap: 8px;
			}
		}
	}

	.loading,
	.error,
	.empty-state {
		text-align: center;
		padding: 48px 24px;

		i {
			font-size: 48px;
			color: var(--accent);
			margin-bottom: 16px;
		}

		p {
			margin: 0;
			opacity: 0.7;
		}
	}

	.error p {
		color: var(--error);
		opacity: 1;
		margin-bottom: 16px;
	}
}

@media (max-width: 768px) {
	.staff-page {
		.page-header {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
		}

		.search-bar {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
		}

		.staff-card {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;

			.staff-actions {
				justify-content: center;
			}
		}
	}
}
</style>
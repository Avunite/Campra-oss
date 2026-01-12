<template>
<MkStickyContainer>
	<template #header><MkPageHeader :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :content-max="900" :margin-min="16" :margin-max="32">
		<div class="whitelist-page">
			<div class="_formRoot">
				<div class="_formBlock">
					<MkInfo>{{ i18n.ts.emailWhitelist || 'Email Whitelist' }}</MkInfo>
					<p class="description">{{ i18n.ts.whitelistDescription || 'Manage which email addresses can register for your school. Only emails from your school domain can be whitelisted.' }}</p>
				</div>

				<!-- Add Email Form -->
				<div class="_formBlock">
					<div class="section-header">
						<h3><i class="ph-plus ph-lg"></i> {{ i18n.ts.addToWhitelist || 'Add Email to Whitelist' }}</h3>
					</div>
					
					<div class="add-form">
						<MkInput v-model="newEmail" :placeholder="i18n.ts.emailAddress || 'Email Address'" type="email">
							<template #prefix><i class="ph-envelope ph-lg"></i></template>
						</MkInput>
						<MkInput v-model="newName" :placeholder="i18n.ts.name || 'Name (Optional)'">
							<template #prefix><i class="ph-user ph-lg"></i></template>
						</MkInput>
						<MkInput v-model="newGrade" :placeholder="i18n.ts.gradeLevel || 'Grade Level (Optional)'">
							<template #prefix><i class="ph-graduation-cap ph-lg"></i></template>
						</MkInput>
						<MkInput v-model="newNotes" :placeholder="i18n.ts.notes || 'Notes (Optional)'">
							<template #prefix><i class="ph-note ph-lg"></i></template>
						</MkInput>
						<div class="button-group">
							<MkButton @click="addEmail" :disabled="!newEmail || processing" primary>
								<i class="ph-plus ph-lg"></i>
								{{ i18n.ts.add || 'Add' }}
							</MkButton>
						</div>
					</div>
				</div>

				<!-- CSV Upload -->
				<div class="_formBlock">
					<div class="section-header">
						<h3><i class="ph-upload ph-lg"></i> {{ i18n.ts.bulkImport || 'Bulk Import from CSV' }}</h3>
					</div>
					
					<div class="upload-area" @click="selectCSVFile">
						<input ref="fileInput" type="file" accept=".csv" @change="onCSVFileSelect" style="display: none;">
						<div class="upload-prompt">
							<i class="ph-cloud-arrow-up ph-lg upload-icon"></i>
							<p>{{ i18n.ts.uploadCSVWhitelist || 'Upload CSV with emails, names, and grades' }}</p>
							<p class="hint">{{ i18n.ts.csvFormatHint || 'Format: email, name, gradeLevel, notes' }}</p>
						</div>
					</div>
				</div>

				<!-- Whitelist Table -->
				<div class="_formBlock">
					<div class="section-header">
						<h3><i class="ph-list ph-lg"></i> {{ i18n.ts.whitelistedEmails || 'Whitelisted Emails' }}</h3>
						<span class="count">{{ whitelists.length }} {{ i18n.ts.emails || 'emails' }}</span>
					</div>

					<div v-if="loading" class="loading">
						<MkLoading/>
					</div>
					<div v-else-if="whitelists.length === 0" class="empty-state">
						<i class="ph-envelope ph-lg"></i>
						<p>{{ i18n.ts.noWhitelistedEmails || 'No whitelisted emails yet' }}</p>
					</div>
					<div v-else class="whitelist-table">
						<table>
							<thead>
								<tr>
									<th>{{ i18n.ts.email || 'Email' }}</th>
									<th>{{ i18n.ts.name || 'Name' }}</th>
									<th>{{ i18n.ts.grade || 'Grade' }}</th>
									<th>{{ i18n.ts.status || 'Status' }}</th>
									<th>{{ i18n.ts.actions || 'Actions' }}</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="item in whitelists" :key="item.id">
									<td class="email">{{ item.email }}</td>
									<td>{{ item.name || '-' }}</td>
									<td>{{ item.gradeLevel || '-' }}</td>
									<td>
										<span v-if="item.registered" class="status registered">
											<i class="ph-check-circle ph-sm"></i>
											{{ i18n.ts.registered || 'Registered' }}
										</span>
										<span v-else-if="item.invitationSent" class="status invited">
											<i class="ph-paper-plane-tilt ph-sm"></i>
											{{ i18n.ts.invited || 'Invited' }}
										</span>
										<span v-else class="status pending">
											<i class="ph-clock ph-sm"></i>
											{{ i18n.ts.pending || 'Pending' }}
										</span>
									</td>
									<td class="actions">
										<MkButton v-if="!item.registered && !item.invitationSent" @click="sendInvitation(item)" size="small">
											<i class="ph-paper-plane-tilt ph-sm"></i>
											{{ i18n.ts.sendInvite || 'Send Invite' }}
										</MkButton>
										<MkButton @click="removeEmail(item)" danger size="small">
											<i class="ph-trash ph-sm"></i>
											{{ i18n.ts.remove || 'Remove' }}
										</MkButton>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/form/input.vue';
import MkInfo from '@/components/MkInfo.vue';
import { i18n } from '@/i18n';
import * as os from '@/os';
import { definePageMetadata } from '@/scripts/page-metadata';

const loading = ref(false);
const processing = ref(false);
const whitelists = ref<any[]>([]);

const newEmail = ref('');
const newName = ref('');
const newGrade = ref('');
const newNotes = ref('');

const fileInput = ref<HTMLInputElement>();

const headerActions = computed(() => []);
const headerTabs = computed(() => []);

async function loadWhitelists() {
	loading.value = true;
	try {
		const result = await os.api('schools/manage-whitelist', {
			action: 'list',
		});
		whitelists.value = result.whitelists || [];
	} catch (error) {
		console.error('Failed to load whitelists:', error);
		os.alert({
			type: 'error',
			text: (error as any)?.message || i18n.ts.failedToLoad || 'Failed to load whitelists',
		});
	} finally {
		loading.value = false;
	}
}

async function addEmail() {
	if (!newEmail.value) return;
	
	processing.value = true;
	try {
		await os.api('schools/manage-whitelist', {
			action: 'add',
			email: newEmail.value,
			name: newName.value || null,
			gradeLevel: newGrade.value || null,
			notes: newNotes.value || null,
		});
		
		os.success();
		
		// Clear form
		newEmail.value = '';
		newName.value = '';
		newGrade.value = '';
		newNotes.value = '';
		
		// Reload list
		await loadWhitelists();
	} catch (error) {
		console.error('Failed to add email:', error);
		os.alert({
			type: 'error',
			text: (error as any)?.message || i18n.ts.failedToAdd || 'Failed to add email',
		});
	} finally {
		processing.value = false;
	}
}

async function removeEmail(item: any) {
	const confirmed = await os.confirm({
		type: 'warning',
		text: i18n.ts.removeWhitelistConfirm || `Remove ${item.email} from whitelist?`,
	});
	
	if (!confirmed.canceled) {
		try {
			await os.api('schools/manage-whitelist', {
				action: 'remove',
				whitelistId: item.id,
			});
			
			os.success();
			await loadWhitelists();
		} catch (error) {
			console.error('Failed to remove email:', error);
			os.alert({
				type: 'error',
				text: (error as any)?.message || i18n.ts.failedToRemove || 'Failed to remove email',
			});
		}
	}
}

async function sendInvitation(item: any) {
	try {
		await os.api('schools/manage-whitelist', {
			action: 'send-invitation',
			whitelistId: item.id,
		});
		
		os.success();
		await loadWhitelists();
	} catch (error) {
		console.error('Failed to send invitation:', error);
		os.alert({
			type: 'error',
			text: (error as any)?.message || i18n.ts.failedToSendInvite || 'Failed to send invitation',
		});
	}
}

function selectCSVFile() {
	fileInput.value?.click();
}

async function onCSVFileSelect(event: Event) {
	const file = (event.target as HTMLInputElement).files?.[0];
	if (!file) return;
	
	processing.value = true;
	try {
		// Read file as text
		const text = await file.text();
		
		// Upload CSV
		const result = await os.api('schools/whitelist-from-csv', {
			csvFile: text,
		});
		
		os.alert({
			type: 'success',
			text: `Imported ${result.result.successfulRows} of ${result.result.totalRows} emails`,
		});
		
		// Reload list
		await loadWhitelists();
	} catch (error) {
		console.error('Failed to import CSV:', error);
		os.alert({
			type: 'error',
			text: (error as any)?.message || i18n.ts.failedToImportCSV || 'Failed to import CSV',
		});
	} finally {
		processing.value = false;
		// Reset file input
		if (fileInput.value) {
			fileInput.value.value = '';
		}
	}
}

onMounted(() => {
	loadWhitelists();
});

definePageMetadata({
	title: i18n.ts.emailWhitelist || 'Email Whitelist',
	icon: 'ph-envelope-simple-open ph-lg',
});
</script>

<style lang="scss" scoped>
.whitelist-page {
	.description {
		margin-top: 8px;
		opacity: 0.7;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;

		h3 {
			display: flex;
			align-items: center;
			gap: 8px;
			margin: 0;
			font-size: 1.1em;
		}

		.count {
			opacity: 0.7;
		}
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: 12px;

		.button-group {
			display: flex;
			gap: 8px;
		}
	}

	.upload-area {
		border: 2px dashed var(--divider);
		border-radius: 8px;
		padding: 32px;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s;

		&:hover {
			border-color: var(--accent);
			background: var(--accentedBg);
		}

		.upload-icon {
			font-size: 3em;
			opacity: 0.5;
			margin-bottom: 16px;
		}

		.hint {
			margin-top: 8px;
			font-size: 0.9em;
			opacity: 0.6;
		}
	}

	.loading, .empty-state {
		padding: 32px;
		text-align: center;
		opacity: 0.7;

		i {
			font-size: 3em;
			margin-bottom: 16px;
		}
	}

	.whitelist-table {
		overflow-x: auto;

		table {
			width: 100%;
			border-collapse: collapse;

			th, td {
				padding: 12px;
				text-align: left;
				border-bottom: 1px solid var(--divider);
			}

			th {
				font-weight: 600;
				opacity: 0.7;
			}

			.email {
				font-family: monospace;
			}

			.status {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				padding: 4px 8px;
				border-radius: 4px;
				font-size: 0.9em;

				&.registered {
					color: var(--success);
					background: var(--successBg);
				}

				&.invited {
					color: var(--info);
					background: var(--infoBg);
				}

				&.pending {
					color: var(--warn);
					background: var(--warnBg);
				}
			}

			.actions {
				display: flex;
				gap: 8px;
			}
		}
	}
}
</style>

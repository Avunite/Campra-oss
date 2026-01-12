<template>
<MkSpacer :content-max="900" :margin-min="16" :margin-max="32">
	<div class="students-page">
		<div class="page-header">
			<h1>{{ i18n.ts.students }}</h1>
			<!-- <MkButton @click="showImportDialog" primary>
				<i class="ph-upload ph-lg"></i>
				{{ i18n.ts.importStudents || 'Import CSV' }}
			</MkButton> -->
		</div>

		<div v-if="lastImportResult" class="import-result">
			<span class="success">{{ lastImportResult.successfulRows }} imported</span>
			<span v-if="lastImportResult.failedRows > 0" class="failed">{{ lastImportResult.failedRows }} failed</span>
		</div>

		<div class="search-bar">
			<MkInput v-model="searchQuery" :placeholder="i18n.ts.search" @update:model-value="onSearchChange">
				<template #prefix><i class="ph-magnifying-glass ph-lg"></i></template>
			</MkInput>
			<div class="student-count">{{ students.length }} {{ i18n.ts.students }}</div>
		</div>

		<div v-if="loading" class="loading">
			<MkLoading/>
		</div>
		<div v-else-if="error" class="error">
			<p>{{ error }}</p>
			<MkButton @click="loadStudents">{{ i18n.ts.retry || 'Retry' }}</MkButton>
		</div>
		<div v-else-if="students.length === 0" class="empty-state">
			<i class="ph-users ph-lg"></i>
			<p>{{ i18n.ts.noStudentsFound || 'No students found' }}</p>
		</div>
		<div v-else class="students-grid">
			<div v-for="student in students" :key="student.id" class="student-card">
				<div class="student-info" @click="showUserInfo(student)">
					<MkUserCardMini :user="student"/>
					<div class="student-details">
						<div class="contact-info">
							<span v-if="student.email" class="email">
								<i class="ph-envelope ph-sm"></i>
								{{ student.email }}
							</span>
						</div>
						<div class="graduation-info">
							<span v-if="student.graduationDate" class="graduation-date">
								<i class="ph-graduation-cap ph-sm"></i>
								Graduates: {{ formatDate(student.graduationDate) }}
							</span>
							<span v-else-if="student.graduationYear" class="graduation-year">
								<i class="ph-graduation-cap ph-sm"></i>
								Class of {{ student.graduationYear }}
							</span>
							<span v-else class="no-graduation">
								<i class="ph-question ph-sm"></i>
								No graduation date set
							</span>
						</div>
						<div v-if="student.gradeLevel || student.major" class="academic-info">
							<span v-if="student.gradeLevel" class="grade-level">{{ student.gradeLevel }}</span>
							<span v-if="student.major" class="major">{{ student.major }}</span>
						</div>
					</div>
				</div>
				<div class="student-actions">
					<MkButton @click="setGraduationDate(student)" size="small">
						<i class="ph-graduation-cap ph-sm"></i>
						{{ student.graduationDate ? 'Update' : 'Set' }} Graduation
					</MkButton>
					<MkButton @click="editUsername(student)" size="small">
						<i class="ph-at ph-sm"></i>
						Username
					</MkButton>
					<MkButton v-if="!student.isSuspended" @click="suspendStudent(student)" danger size="small">
						{{ i18n.ts.suspend }}
					</MkButton>
					<MkButton v-else @click="unsuspendStudent(student)" size="small">
						{{ i18n.ts.unsuspend }}
					</MkButton>
				</div>
			</div>
		</div>

		<!-- Graduation Date Modal -->
		<XModalWindow
			v-if="showGraduationModal"
			:closable="true"
			@close="closeGraduationModal"
			@closed="closeGraduationModal"
		>
			<template #header>Set Graduation Date</template>
			<div class="graduation-modal">
				<div class="student-info-header">
					<MkUserCardMini :user="selectedStudent"/>
				</div>
				<div class="form-section">
					<label>Graduation Date</label>
					<MkInput
						v-model="graduationFormData.date"
						type="date"
						:placeholder="'YYYY-MM-DD'"
					/>
					<div class="help-text">
						Set the specific date when this student will graduate.
					</div>
				</div>
				<div class="modal-actions">
					<MkButton @click="closeGraduationModal">Cancel</MkButton>
					<MkButton @click="saveGraduationDate" primary :disabled="!graduationFormData.date">
						Save Graduation Date
					</MkButton>
				</div>
			</div>
		</XModalWindow>

		<!-- Username Edit Modal -->
		<XModalWindow
			v-if="showUsernameModal"
			:closable="true"
			@close="closeUsernameModal"
			@closed="closeUsernameModal"
		>
			<template #header>Edit Username</template>
			<div class="username-modal">
				<div class="student-info-header">
					<MkUserCardMini :user="selectedStudent"/>
				</div>
				<div class="form-section">
					<label>Username</label>
					<MkInput
						v-model="usernameFormData.username"
						:placeholder="selectedStudent?.username"
						@update:model-value="validateUsername"
					>
						<template #prefix>@</template>
					</MkInput>
					<div v-if="usernameValidation.error" class="error-text">
						{{ usernameValidation.error }}
					</div>
					<div v-else-if="usernameValidation.suggestions?.length" class="suggestions">
						<span class="suggestions-label">Suggestions:</span>
						<button
							v-for="suggestion in usernameValidation.suggestions"
							:key="suggestion"
							class="suggestion-btn"
							@click="usernameFormData.username = suggestion"
						>
							@{{ suggestion }}
						</button>
					</div>
				</div>
				<div class="form-section">
					<label>
						<input v-model="usernameFormData.bypassValidation" type="checkbox">
						Admin Override (bypass name validation)
					</label>
					<MkInput
						v-if="usernameFormData.bypassValidation"
						v-model="usernameFormData.reason"
						:placeholder="'Reason for override...'"
					/>
				</div>
				<div class="modal-actions">
					<MkButton @click="closeUsernameModal">Cancel</MkButton>
					<MkButton @click="saveUsername" primary :disabled="!usernameFormData.username">
						Update Username
					</MkButton>
				</div>
			</div>
		</XModalWindow>
	</div>
</MkSpacer>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { i18n } from '@/i18n';
import * as os from '@/os';
import { $i } from '@/account';
import { definePageMetadata } from '@/scripts/page-metadata';
import MkUserCardMini from '@/components/MkUserCardMini.vue';
import MkInput from '@/components/form/input.vue';
import MkButton from '@/components/MkButton.vue';
import MkLoading from '@/components/MkLoading.vue';
import XModalWindow from '@/components/MkModalWindow.vue';

const loading = ref(true);
const error = ref('');
const students = ref([]);
const searchQuery = ref('');
const lastImportResult = ref(null);

// Graduation date modal
const showGraduationModal = ref(false);
const selectedStudent = ref(null);
const graduationFormData = ref({
	date: '',
});

// Username modal
const showUsernameModal = ref(false);
const usernameFormData = ref({
	username: '',
	bypassValidation: false,
	reason: '',
});
const usernameValidation = ref({
	error: null,
	suggestions: [],
});

let searchTimeout: number | null = null;
let usernameValidationTimeout: number | null = null;

async function loadStudents() {
	loading.value = true;
	error.value = '';
	try {
		console.log('Loading students with params:', {
			search: searchQuery.value || undefined,
			userType: 'students',
			limit: 100,
		});
		
		students.value = await os.api('schools/students', {
			search: searchQuery.value || undefined,
			userType: 'students',
			limit: 100,
		});
		
		console.log('Loaded students:', students.value);
	} catch (err) {
		console.error('Failed to load students:', err);
		error.value = (err as any)?.message || i18n.ts.error || 'Failed to load students';
		os.alert({
			type: 'error',
			text: (err as any)?.message || i18n.ts.error || 'Failed to load students',
		});
	} finally {
		loading.value = false;
	}
}

function onSearchChange() {
	if (searchTimeout) {
		clearTimeout(searchTimeout);
	}
	searchTimeout = setTimeout(() => {
		loadStudents();
	}, 500);
}

function showUserInfo(user: any) {
	os.pageWindow(`/user-info/${user.id}`);
}

async function suspendStudent(student: any) {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.ts.suspendConfirm || `Are you sure you want to suspend ${student.username}?`,
	});
	
	if (canceled) return;
	
		try {
			await os.api('school/suspend-student', {
				userId: student.id,
			});
			
			os.success();
			loadStudents(); // Reload the list
		} catch (error) {
			console.error('Failed to suspend student:', error);
			os.alert({
				type: 'error',
				text: i18n.ts.error || 'Failed to suspend student',
			});
		}
	}

	async function unsuspendStudent(student: any) {
		const { canceled } = await os.confirm({
			type: 'info',
			text: i18n.ts.unsuspendConfirm || `Are you sure you want to unsuspend ${student.username}?`,
		});
		
		if (canceled) return;
		
		try {
			await os.api('school/unsuspend-student', {
				userId: student.id,
			});
			
			os.success();
			loadStudents(); // Reload the list
		} catch (error) {
			console.error('Failed to unsuspend student:', error);
			os.alert({
				type: 'error',
				text: i18n.ts.error || 'Failed to unsuspend student',
			});
		}
	}

	// Graduation date functions
	function setGraduationDate(student: any) {
		selectedStudent.value = student;
		graduationFormData.value = {
			date: student.graduationDate ? student.graduationDate.split('T')[0] : '',
		};
		showGraduationModal.value = true;
	}

	function closeGraduationModal() {
		showGraduationModal.value = false;
		selectedStudent.value = null;
		graduationFormData.value = { date: '' };
	}

	async function saveGraduationDate() {
		if (!selectedStudent.value || !graduationFormData.value.date) return;
		
		try {
			await os.api('school/set-graduation-date', {
				userId: selectedStudent.value.id,
				graduationDate: graduationFormData.value.date,
			});
			
			os.success();
			loadStudents(); // Reload the list
			closeGraduationModal();
		} catch (error) {
			console.error('Failed to set graduation date:', error);
			os.alert({
				type: 'error',
				text: (error as any)?.message || 'Failed to set graduation date',
			});
		}
	}

	// Username functions
	function editUsername(student: any) {
		selectedStudent.value = student;
		usernameFormData.value = {
			username: student.username,
			bypassValidation: false,
			reason: '',
		};
		usernameValidation.value = { error: null, suggestions: [] };
		showUsernameModal.value = true;
	}

	function closeUsernameModal() {
		showUsernameModal.value = false;
		selectedStudent.value = null;
		usernameFormData.value = { username: '', bypassValidation: false, reason: '' };
		usernameValidation.value = { error: null, suggestions: [] };
	}

	async function validateUsername() {
		if (!usernameFormData.value.username || usernameFormData.value.username === selectedStudent.value?.username) {
			usernameValidation.value = { error: null, suggestions: [] };
			return;
		}

		if (usernameValidationTimeout) {
			clearTimeout(usernameValidationTimeout);
		}

		usernameValidationTimeout = setTimeout(async () => {
			try {
				const result = await os.api('i/validate-username', {
					username: usernameFormData.value.username,
				});

				if (result.isValid) {
					usernameValidation.value = { error: null, suggestions: [] };
				} else {
					usernameValidation.value = {
						error: result.reason,
						suggestions: result.suggestions || [],
					};
				}
			} catch (error) {
				usernameValidation.value = {
					error: (error as any)?.message || 'Failed to validate username',
					suggestions: [],
				};
			}
		}, 500);
	}

	async function saveUsername() {
		if (!selectedStudent.value || !usernameFormData.value.username) return;
		
		try {
			const result = await os.api('school/set-student-username', {
				userId: selectedStudent.value.id,
				username: usernameFormData.value.username,
				bypassValidation: usernameFormData.value.bypassValidation,
				reason: usernameFormData.value.reason,
			});

			if (!result.success && result.validation && !result.validation.isValid) {
				// Show validation error but allow admin to override
				usernameValidation.value = {
					error: result.validation.reason + ' (You can use admin override to bypass this)',
					suggestions: result.validation.suggestions || [],
				};
				return;
			}
			
			os.success();
			loadStudents(); // Reload the list
			closeUsernameModal();
		} catch (error) {
			console.error('Failed to update username:', error);
			os.alert({
				type: 'error',
				text: (error as any)?.message || 'Failed to update username',
			});
		}
	}

	// Utility functions
	function formatDate(dateString: string) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString();
	}

async function showImportDialog() {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.csv';
	input.onchange = async (e) => {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		
		try {
			const reader = new FileReader();
			reader.onload = async (event) => {
				const csvContent = event.target?.result as string;
				const base64 = btoa(csvContent);
				
				try {
					const result = await os.apiWithDialog('schools/import-students', {
						csvFile: `data:text/csv;base64,${base64}`
					});
					
					lastImportResult.value = result;
					loadStudents(); // Reload the student list
					
					os.alert({
						type: 'success',
						text: `Import completed: ${result.successfulRows} students imported${result.failedRows > 0 ? `, ${result.failedRows} failed` : ''}`
					});
				} catch (error) {
					console.error('Import failed:', error);
					os.alert({
						type: 'error',
						text: 'Failed to import CSV file'
					});
				}
			};
			reader.readAsText(file);
		} catch (error) {
			console.error('File read error:', error);
		}
	};
	input.click();
}

onMounted(() => {
	console.log('Students component mounted, current user:', $i);
	loadStudents();
});

definePageMetadata({
	title: i18n.ts.students,
	icon: 'ph-users-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.students-page {
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

	.import-result {
		display: flex;
		gap: 16px;
		padding: 12px 16px;
		background: var(--panel);
		border-radius: 8px;
		margin-bottom: 16px;
		
		.success {
			color: var(--success);
			font-weight: 500;
		}
		
		.failed {
			color: var(--error);
			font-weight: 500;
		}
	}

	.search-bar {
		display: flex;
		gap: 16px;
		align-items: center;
		margin-bottom: 24px;
		
		.student-count {
			font-size: 0.9em;
			opacity: 0.7;
			white-space: nowrap;
		}
	}

	.students-grid {
		display: grid;
		gap: 12px;

		.student-card {
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

			.student-info {
				flex: 1;
				cursor: pointer;

				.student-details {
					margin-top: 8px;
					font-size: 0.85em;

					.contact-info {
						margin-bottom: 6px;

						.email {
							display: flex;
							align-items: center;
							gap: 4px;
							color: var(--accent);
							font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
							font-size: 0.9em;

							i {
								opacity: 0.7;
							}
						}
					}

					.graduation-info {
						display: flex;
						align-items: center;
						gap: 4px;
						margin-bottom: 4px;

						.graduation-date {
							color: var(--success);
							font-weight: 500;
						}

						.graduation-year {
							color: var(--accent);
							font-weight: 500;
						}

						.no-graduation {
							color: var(--warning);
							opacity: 0.8;
						}

						i {
							opacity: 0.7;
						}
					}

					.academic-info {
						display: flex;
						gap: 12px;
						opacity: 0.7;

						.grade-level,
						.major {
							font-size: 0.8em;
							padding: 2px 6px;
							background: var(--accentedBg);
							border-radius: 4px;
						}
					}
				}
			}

			.student-actions {
				display: flex;
				gap: 8px;
				flex-wrap: wrap;
			}
		}
	}

	.graduation-modal,
	.username-modal {
		padding: 24px;

		.student-info-header {
			margin-bottom: 24px;
			padding-bottom: 16px;
			border-bottom: 1px solid var(--divider);
		}

		.form-section {
			margin-bottom: 24px;

			label {
				display: block;
				margin-bottom: 8px;
				font-weight: 600;
				color: var(--fg);
			}

			.help-text {
				margin-top: 8px;
				font-size: 0.85em;
				opacity: 0.7;
			}

			.error-text {
				margin-top: 8px;
				font-size: 0.85em;
				color: var(--error);
			}

			.suggestions {
				margin-top: 12px;

				.suggestions-label {
					display: block;
					font-size: 0.85em;
					opacity: 0.7;
					margin-bottom: 8px;
				}

				.suggestion-btn {
					display: inline-block;
					margin: 2px 4px;
					padding: 4px 8px;
					background: var(--accentedBg);
					border: 1px solid var(--accent);
					border-radius: 4px;
					font-size: 0.8em;
					cursor: pointer;
					transition: all 0.2s;

					&:hover {
						background: var(--accent);
						color: var(--accentFg);
					}
				}
			}
		}

		.modal-actions {
			display: flex;
			gap: 12px;
			justify-content: flex-end;
			padding-top: 16px;
			border-top: 1px solid var(--divider);
		}
	}

	.loading, .error, .empty-state {
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
	.students-page {
		.page-header {
			flex-direction: column;
			align-items: stretch;
			gap: 16px;
		}

		.search-bar {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
			
			.student-count {
				text-align: center;
			}
		}

		.student-card {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;

			.student-actions {
				justify-content: center;
			}
		}
	}
}
</style>

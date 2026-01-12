<template>
<MkStickyContainer>
	<template #header><MkPageHeader :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :content-max="900" :margin-min="16" :margin-max="32">
		<div class="csv-import">
			<div class="_formRoot">
				<div class="_formBlock">
					<MkInfo>{{ i18n.ts.importStudents || 'Import Students' }}</MkInfo>
					<p class="description">{{ i18n.ts.importStudentsDescription || 'Upload a CSV file to import multiple students at once. The system will automatically detect your school management system format and send invitation emails to each student.' }}</p>
				</div>

				<!-- File Upload Section -->
				<div class="_formBlock">
					<div class="section-header">
						<h3><i class="ph-upload ph-lg"></i> {{ i18n.ts.uploadCSV || 'Upload CSV File' }}</h3>
					</div>
					
					<div class="upload-area" 
						:class="{ 'drag-over': dragOver, 'has-file': selectedFile }"
						@drop="onDrop"
						@dragover="onDragOver"
						@dragenter="onDragEnter"
						@dragleave="onDragLeave"
						@click="selectFile">
						<input ref="fileInput" type="file" accept=".csv" @change="onFileSelect" style="display: none;">
						
						<div v-if="!selectedFile" class="upload-prompt">
							<i class="ph-cloud-arrow-up ph-lg upload-icon"></i>
							<p class="upload-text">{{ i18n.ts.dragDropCSV || 'Drag and drop a CSV file here, or click to select' }}</p>
							<p class="upload-hint">{{ i18n.ts.csvFileFormat || 'CSV files only (.csv)' }}</p>
						</div>
						
						<div v-else class="file-info">
							<i class="ph-file-csv ph-lg file-icon"></i>
							<div class="file-details">
								<p class="file-name">{{ selectedFile.name }}</p>
								<p class="file-size">{{ formatFileSize(selectedFile.size) }}</p>
							</div>
							<MkButton @click.stop="removeFile" danger size="small">
								<i class="ph-x ph-lg"></i>
							</MkButton>
						</div>
					</div>
				</div>

				<!-- CSV Format Info -->
				<div class="_formBlock">
					<div class="format-info">
						<h4>{{ i18n.ts.csvRequiredColumns || 'Required Columns' }}</h4>
						<ul>
							<li><code>email</code> - {{ i18n.ts.studentEmail || 'Student email address' }}</li>
							<li><code>name</code> - {{ i18n.ts.studentName || 'Student full name' }}</li>
						</ul>
						
						<h4>{{ i18n.ts.csvOptionalColumns || 'Optional Columns' }}</h4>
						<ul>
							<li><code>type</code> - {{ i18n.ts.userType || 'User type' }} (student/teacher, {{ i18n.ts.defaultStudent || 'defaults to student' }})</li>
							<li><code>grade</code> or <code>gradeLevel</code> - {{ i18n.ts.gradeLevel || 'Grade level' }} (e.g., "Freshman", "Sophomore", "9", "10")</li>
							<li><code>graduationDate</code> - {{ i18n.ts.graduationDate || 'Graduation date' }} (YYYY-MM-DD {{ i18n.ts.format || 'format' }})</li>
						</ul>
						<p style="margin-top: 12px; opacity: 0.8; font-size: 0.9em;">
							<i class="ph-info ph-sm"></i> {{ i18n.ts.autoDetectFormat || 'The system automatically detects formats from PowerSchool, Canvas, Google Classroom, Schoology, Clever, and more!' }}
						</p>
					</div>
				</div>

				<!-- Preview Section -->
				<div v-if="previewData && previewData.length > 0" class="_formBlock">
					<div class="section-header">
						<h3><i class="ph-eye ph-lg"></i> {{ i18n.ts.csvPreview || 'CSV Preview' }}</h3>
						<p class="description">{{ i18n.ts.csvPreviewDescription || 'First 5 rows of your CSV file' }}</p>
					</div>
					
					<div class="preview-table-container">
						<table class="preview-table">
							<thead>
								<tr>
									<th>{{ i18n.ts.email || 'Email' }}</th>
									<th>{{ i18n.ts.name || 'Name' }}</th>
									<th>{{ i18n.ts.type || 'Type' }}</th>
									<th>{{ i18n.ts.grade || 'Grade' }}</th>
									<th>{{ i18n.ts.graduationDate || 'Graduation Date' }}</th>
									<th>{{ i18n.ts.status || 'Status' }}</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="(row, index) in previewData" :key="index" :class="{ 'error-row': row.hasError }">
									<td>{{ row.email }}</td>
									<td>{{ row.name }}</td>
									<td>{{ row.type || 'student' }}</td>
									<td>{{ row.grade || row.gradeLevel || '-' }}</td>
									<td>{{ row.graduationDate || '-' }}</td>
									<td>
										<span v-if="row.hasError" class="error-status">
											<i class="ph-warning ph-lg"></i>
											{{ row.errorMessage }}
										</span>
										<span v-else class="success-status">
											<i class="ph-check ph-lg"></i>
											{{ i18n.ts.valid || 'Valid' }}
										</span>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				<!-- Validation Results -->
				<div v-if="validationResults" class="_formBlock">
					<div class="validation-results">
						<div class="validation-summary">
							<div class="summary-item">
								<span class="label">{{ i18n.ts.totalRows || 'Total Rows' }}:</span>
								<span class="value">{{ validationResults.totalRows }}</span>
							</div>
							<div class="summary-item">
								<span class="label">{{ i18n.ts.validRows || 'Valid Rows' }}:</span>
								<span class="value success">{{ validationResults.validRows }}</span>
							</div>
							<div class="summary-item">
								<span class="label">{{ i18n.ts.invalidRows || 'Invalid Rows' }}:</span>
								<span class="value error">{{ validationResults.invalidRows }}</span>
							</div>
						</div>
						
						<div v-if="validationResults.errors.length > 0" class="validation-errors">
							<h4>{{ i18n.ts.validationErrors || 'Validation Errors' }}</h4>
							<ul>
								<li v-for="error in validationResults.errors" :key="`${error.row}-${error.field}`" class="error-item">
									{{ i18n.ts.row || 'Row' }} {{ error.row }}, {{ error.field }}: {{ error.message }}
								</li>
							</ul>
						</div>
					</div>
				</div>

				<!-- Import Progress -->
				<div v-if="importing" class="_formBlock">
					<div class="import-progress">
						<div class="progress-header">
							<h3><i class="ph-spinner ph-lg fa-spin"></i> {{ i18n.ts.importingStudents || 'Importing Students...' }}</h3>
						</div>
						<div class="progress-bar">
							<div class="progress-fill" :style="{ width: `${importProgress}%` }"></div>
						</div>
						<p class="progress-text">{{ importProgressText }}</p>
					</div>
				</div>

				<!-- Import Results -->
				<div v-if="importResults" class="_formBlock">
					<div class="import-results">
						<div class="results-header">
							<h3>
								<i v-if="importResults.failedRows === 0" class="ph-check-circle ph-lg success"></i>
								<i v-else class="ph-warning-circle ph-lg warning"></i>
								{{ i18n.ts.importComplete || 'Import Complete' }}
							</h3>
						</div>
						
						<div class="results-summary">
							<div class="summary-item">
								<span class="label">{{ i18n.ts.totalRows || 'Total Rows' }}:</span>
								<span class="value">{{ importResults.totalRows }}</span>
							</div>
							<div class="summary-item">
								<span class="label">{{ i18n.ts.successfulRows || 'Successful' }}:</span>
								<span class="value success">{{ importResults.successfulRows }}</span>
							</div>
							<div class="summary-item">
								<span class="label">{{ i18n.ts.failedRows || 'Failed' }}:</span>
								<span class="value error">{{ importResults.failedRows }}</span>
							</div>
							<div class="summary-item">
								<span class="label">{{ i18n.ts.invitationsSent || 'Invitations Sent' }}:</span>
								<span class="value">{{ importResults.invitationsSent }}</span>
							</div>
						</div>
						
						<div v-if="importResults.errors.length > 0" class="import-errors">
							<h4>{{ i18n.ts.importErrors || 'Import Errors' }}</h4>
							<ul>
								<li v-for="error in importResults.errors" :key="`${error.row}-${error.field}`" class="error-item">
									{{ i18n.ts.row || 'Row' }} {{ error.row }}: {{ error.message }}
								</li>
							</ul>
						</div>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="_formBlock">
					<div class="action-buttons">
						<MkButton v-if="selectedFile && !previewData" @click="previewCSV" :disabled="processing">
							<i class="ph-eye ph-lg"></i>
							{{ i18n.ts.previewImport || 'Preview Import' }}
						</MkButton>
						
						<MkButton v-if="previewData && !validationResults" @click="validateCSV" :disabled="processing">
							<i class="ph-check-square ph-lg"></i>
							{{ i18n.ts.validateCSV || 'Validate CSV' }}
						</MkButton>
						
						<MkButton v-if="validationResults && validationResults.validRows > 0" @click="importCSV" :disabled="processing || importing" primary>
							<i class="ph-upload ph-lg"></i>
							{{ i18n.ts.importStudents || 'Import Students' }}
						</MkButton>
						
						<MkButton v-if="importResults" @click="resetImport">
							<i class="ph-arrow-clockwise ph-lg"></i>
							{{ i18n.ts.importAnother || 'Import Another File' }}
						</MkButton>
					</div>
				</div>
			</div>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { $i } from '@/account';

const fileInput = ref<HTMLInputElement>();
const selectedFile = ref<File | null>(null);
const dragOver = ref(false);
const processing = ref(false);
const importing = ref(false);
const importProgress = ref(0);
const importProgressText = ref('');

const previewData = ref<any[] | null>(null);
const validationResults = ref<any | null>(null);
const importResults = ref<any | null>(null);

const headerActions = computed(() => []);
const headerTabs = computed(() => []);

function selectFile() {
	fileInput.value?.click();
}

function onFileSelect(event: Event) {
	const target = event.target as HTMLInputElement;
	if (target.files && target.files.length > 0) {
		selectedFile.value = target.files[0];
		resetPreview();
	}
}

function onDrop(event: DragEvent) {
	event.preventDefault();
	event.stopPropagation();
	dragOver.value = false;
	
	if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
		const file = event.dataTransfer.files[0];
		if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
			selectedFile.value = file;
			resetPreview();
		} else {
			os.alert({
				type: 'error',
				text: i18n.ts.invalidFileType || 'Please select a CSV file'
			});
		}
	}
}

function onDragOver(event: DragEvent) {
	event.preventDefault();
	event.stopPropagation();
	dragOver.value = true;
}

function onDragEnter(event: DragEvent) {
	event.preventDefault();
	event.stopPropagation();
	dragOver.value = true;
}

function onDragLeave(event: DragEvent) {
	event.preventDefault();
	event.stopPropagation();
	dragOver.value = false;
}

function removeFile() {
	selectedFile.value = null;
	resetPreview();
	if (fileInput.value) {
		fileInput.value.value = '';
	}
}

function resetPreview() {
	previewData.value = null;
	validationResults.value = null;
	importResults.value = null;
}

function resetImport() {
	selectedFile.value = null;
	resetPreview();
	if (fileInput.value) {
		fileInput.value.value = '';
	}
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function previewCSV() {
	if (!selectedFile.value) return;
	
	processing.value = true;
	
	try {
		// Read file as text
		const fileContent = await selectedFile.value.text();
		
		const result = await os.api('schools/import-preview', {
			csvFile: fileContent
		});
		
		previewData.value = result.preview;
		
	} catch (err) {
		console.error('Failed to preview CSV:', err);
		os.alert({
			type: 'error',
			text: (err as any)?.message || i18n.ts.csvPreviewError || 'Failed to preview CSV file'
		});
	} finally {
		processing.value = false;
	}
}

async function validateCSV() {
	if (!selectedFile.value) return;
	
	processing.value = true;
	
	try {
		const fileContent = await fileToBase64(selectedFile.value);
		
		const result = await os.api('schools/import-preview', {
			csvFile: fileContent,
			validate: true
		});
		
		validationResults.value = {
			totalRows: result.totalRows,
			validRows: result.validRows,
			invalidRows: result.invalidRows,
			errors: result.errors || []
		};
		
	} catch (err) {
		console.error('Failed to validate CSV:', err);
		os.alert({
			type: 'error',
			text: (err as any)?.message || i18n.ts.csvValidationError || 'Failed to validate CSV file'
		});
	} finally {
		processing.value = false;
	}
}

async function importCSV() {
	if (!selectedFile.value || !validationResults.value) return;
	
	const { canceled } = await os.confirm({
		type: 'info',
		text: i18n.ts.confirmImport || `Are you sure you want to import ${validationResults.value.validRows} students?`
	});
	
	if (canceled) return;
	
	importing.value = true;
	importProgress.value = 0;
	importProgressText.value = i18n.ts.preparingImport || 'Preparing import...';
	
	try {
		const fileContent = await fileToBase64(selectedFile.value);
		
		// Simulate progress updates
		const progressInterval = setInterval(() => {
			if (importProgress.value < 90) {
				importProgress.value += Math.random() * 10;
				importProgressText.value = `${i18n.ts.processingRows || 'Processing rows'}... ${Math.floor(importProgress.value)}%`;
			}
		}, 500);
		
		const result = await os.api('schools/import-students', {
			csvFile: fileContent
		});
		
		clearInterval(progressInterval);
		importProgress.value = 100;
		importProgressText.value = i18n.ts.importComplete || 'Import complete!';
		
		setTimeout(() => {
			importing.value = false;
			importResults.value = result;
		}, 1000);
		
	} catch (err) {
		importing.value = false;
		console.error('Failed to import CSV:', err);
		os.alert({
			type: 'error',
			text: (err as any)?.message || i18n.ts.csvImportError || 'Failed to import CSV file'
		});
	}
}

function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = error => reject(error);
	});
}

definePageMetadata({
	title: i18n.ts.importStudents || 'Import Students',
	icon: 'ph-upload ph-lg',
});
</script>

<style lang="scss" scoped>
.csv-import {
	.description {
		opacity: 0.7;
		margin: 8px 0 0 0;
	}
	
	.section-header {
		margin-bottom: 16px;
		
		h3 {
			margin: 0 0 8px 0;
			font-size: 1.2em;
			font-weight: bold;
			display: flex;
			align-items: center;
			gap: 8px;
		}
		
		.description {
			margin: 0;
			opacity: 0.7;
			font-size: 0.9em;
		}
	}
	
	.upload-area {
		border: 2px dashed var(--divider);
		border-radius: 8px;
		padding: 32px;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s;
		
		&:hover, &.drag-over {
			border-color: var(--accent);
			background: var(--accentedBg);
		}
		
		&.has-file {
			border-style: solid;
			border-color: var(--accent);
			background: var(--accentedBg);
		}
		
		.upload-prompt {
			.upload-icon {
				font-size: 48px;
				color: var(--accent);
				margin-bottom: 16px;
			}
			
			.upload-text {
				margin: 0 0 8px 0;
				font-size: 1.1em;
				font-weight: 500;
			}
			
			.upload-hint {
				margin: 0;
				opacity: 0.7;
				font-size: 0.9em;
			}
		}
		
		.file-info {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 16px;
			
			.file-icon {
				font-size: 32px;
				color: var(--accent);
			}
			
			.file-details {
				text-align: left;
				
				.file-name {
					margin: 0 0 4px 0;
					font-weight: 500;
				}
				
				.file-size {
					margin: 0;
					opacity: 0.7;
					font-size: 0.9em;
				}
			}
		}
	}
	
	.format-info {
		background: var(--panel);
		padding: 16px;
		border-radius: 8px;
		
		h4 {
			margin: 0 0 8px 0;
			font-size: 1em;
			font-weight: 600;
		}
		
		ul {
			margin: 0 0 16px 0;
			padding-left: 20px;
			
			&:last-child {
				margin-bottom: 0;
			}
			
			li {
				margin-bottom: 4px;
				
				code {
					background: var(--bg);
					padding: 2px 6px;
					border-radius: 4px;
					font-family: monospace;
					font-size: 0.9em;
				}
			}
		}
	}
	
	.preview-table-container {
		overflow-x: auto;
		border: 1px solid var(--divider);
		border-radius: 8px;
		
		.preview-table {
			width: 100%;
			border-collapse: collapse;
			
			th, td {
				padding: 12px;
				text-align: left;
				border-bottom: 1px solid var(--divider);
			}
			
			th {
				background: var(--panel);
				font-weight: 600;
				position: sticky;
				top: 0;
			}
			
			tr.error-row {
				background: var(--errorBg);
			}
			
			.error-status {
				color: var(--error);
				display: flex;
				align-items: center;
				gap: 4px;
			}
			
			.success-status {
				color: var(--success);
				display: flex;
				align-items: center;
				gap: 4px;
			}
		}
	}
	
	.validation-results, .import-results {
		background: var(--panel);
		padding: 16px;
		border-radius: 8px;
		
		.validation-summary, .results-summary {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
			gap: 16px;
			margin-bottom: 16px;
			
			.summary-item {
				display: flex;
				flex-direction: column;
				gap: 4px;
				
				.label {
					font-size: 0.9em;
					opacity: 0.7;
				}
				
				.value {
					font-size: 1.2em;
					font-weight: 600;
					
					&.success {
						color: var(--success);
					}
					
					&.error {
						color: var(--error);
					}
				}
			}
		}
		
		.validation-errors, .import-errors {
			h4 {
				margin: 0 0 8px 0;
				color: var(--error);
			}
			
			ul {
				margin: 0;
				padding-left: 20px;
				max-height: 200px;
				overflow-y: auto;
				
				.error-item {
					margin-bottom: 4px;
					color: var(--error);
					font-size: 0.9em;
				}
			}
		}
	}
	
	.import-progress {
		text-align: center;
		
		.progress-header {
			margin-bottom: 16px;
			
			h3 {
				margin: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 8px;
			}
		}
		
		.progress-bar {
			width: 100%;
			height: 8px;
			background: var(--divider);
			border-radius: 4px;
			overflow: hidden;
			margin-bottom: 8px;
			
			.progress-fill {
				height: 100%;
				background: var(--accent);
				transition: width 0.3s ease;
			}
		}
		
		.progress-text {
			margin: 0;
			opacity: 0.7;
		}
	}
	
	.results-header {
		margin-bottom: 16px;
		
		h3 {
			margin: 0;
			display: flex;
			align-items: center;
			gap: 8px;
			
			.success {
				color: var(--success);
			}
			
			.warning {
				color: var(--warn);
			}
		}
	}
	
	.action-buttons {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		justify-content: center;
	}
}

@media (max-width: 768px) {
	.csv-import {
		.validation-summary, .results-summary {
			grid-template-columns: 1fr;
		}
		
		.action-buttons {
			flex-direction: column;
		}
	}
}
</style>
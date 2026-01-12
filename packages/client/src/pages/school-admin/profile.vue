<template>
<MkSpacer :content-max="800" :margin-min="16" :margin-max="32">
	<div v-if="loading" class="loading">
		<MkLoading/>
	</div>
	<div v-else>
		<div class="title">
			{{ i18n.ts.schoolProfile }}
		</div>
		<div class="description">
			{{ i18n.ts.schoolProfileDescription }}
		</div>

		<div v-if="school" class="profile-sections">
			<div class="profile-section">
				<div class="section-header">
					<div class="section-title">{{ i18n.ts.basicInformation }}</div>
					<MkButton @click="editSchoolProfile" primary>
						<i class="ph-pencil-simple ph-lg"></i>
						{{ i18n.ts.edit }}
					</MkButton>
				</div>
				
				<div class="form-group">
					<label>{{ i18n.ts.schoolName }}</label>
					<div class="value">{{ school.name }}</div>
				</div>

				<div class="form-group">
					<label>{{ i18n.ts.domain }}</label>
					<div class="value">{{ school.domain }}</div>
				</div>

				<div class="form-group">
					<label>{{ i18n.ts.schoolType }}</label>
					<div class="value">{{ formatSchoolType(school.type) }}</div>
				</div>

				<div class="form-group">
					<label>{{ i18n.ts.location }}</label>
					<div class="value">{{ school.location || i18n.ts.notSet }}</div>
				</div>

				<div class="form-group">
					<label>{{ i18n.ts.description }}</label>
					<div class="value">{{ school.description || i18n.ts.notSet }}</div>
				</div>

				<div class="form-group">
					<label>{{ i18n.ts.website }}</label>
					<div class="value">
						<a v-if="school.websiteUrl" :href="school.websiteUrl" target="_blank" rel="noopener">
							{{ school.websiteUrl }}
						</a>
						<span v-else>{{ i18n.ts.notSet }}</span>
					</div>
				</div>
			</div>

			<div class="profile-section">
				<div class="section-title">{{ i18n.ts.schoolLogo }}</div>
				<div class="logo-section">
					<div v-if="school.logoUrl" class="current-logo">
						<img :src="school.logoUrl" alt="School Logo" class="logo-image">
					</div>
					<div v-else class="no-logo">
						<i class="ph-image ph-lg"></i>
						<div>{{ i18n.ts.noLogoSet }}</div>
					</div>
					<MkButton @click="uploadLogo" primary>
						{{ school.logoUrl ? i18n.ts.changeLogo : i18n.ts.uploadLogo }}
					</MkButton>
				</div>
			</div>
		</div>

		<div class="actions">
			<MkButton @click="editProfile" primary>
				<i class="ph-pencil ph-lg"></i>
				{{ i18n.ts.editProfile }}
			</MkButton>
			<MkButton @click="refreshData">
				<i class="ph-arrow-clockwise ph-lg"></i>
				{{ i18n.ts.reload }}
			</MkButton>
		</div>
	</div>
</MkSpacer>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { i18n } from '@/i18n';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os';
import { $i } from '@/account';
import { definePageMetadata } from '@/scripts/page-metadata';
import { selectFile } from '@/scripts/select-file';

const loading = ref(true);
const school = ref(null);

function formatSchoolType(type: string): string {
	const types = {
		university: i18n.ts.university,
		college: i18n.ts.college,
		k12: i18n.ts.k12School,
		trade_school: i18n.ts.tradeSchool,
		private_school: i18n.ts.privateSchool
	};
	return types[type] || type;
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
		school.value = await os.api('schools/show', {
			schoolId: $i.adminForSchoolId
		});
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
		location: {
			type: 'string',
			label: i18n.ts.location,
			default: school.value?.location || ''
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
		
		// Reload school data to show updates
		await loadSchoolData();
	} catch (error) {
		// Error is handled by apiWithDialog
	}
}

async function uploadLogo() {
	try {
		const file = await selectFile(null, 'School Logo');
		if (!file) return;

		let originalOrCropped = file;

		// Ask if user wants to crop the logo
		const { canceled } = await os.yesno({
			type: 'question',
			text: 'Do you want to crop the image?',
		});

		if (!canceled) {
			originalOrCropped = await os.cropImage(file, {
				aspectRatio: 16 / 9, // Wide logo format
			});
		}

		// Update school profile with the new logo
		await os.apiWithDialog('schools/update-profile', {
			schoolId: $i?.adminForSchoolId,
			logoUrl: originalOrCropped.url
		});

		// Reload school data to show the new logo
		await loadSchoolData();
		
		os.alert({
			type: 'success',
			text: 'School logo updated successfully!'
		});
	} catch (error) {
		os.alert({
			type: 'error',
			text: 'Failed to upload logo. Please try again.'
		});
	}
}

function refreshData() {
	loadSchoolData();
}

onMounted(() => {
	loadSchoolData();
});

definePageMetadata({
	title: i18n.ts.schoolProfile,
	icon: 'ph-gear-six ph-lg',
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

.profile-sections {
	display: grid;
	gap: 2rem;
	margin-bottom: 2rem;

	@media (max-width: 768px) {
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}
}

.profile-section {
	background: var(--panel);
	border-radius: 12px;
	padding: 1.5rem;
	border: 1px solid var(--divider);

	@media (max-width: 768px) {
		padding: 1rem;
		border-radius: 8px;
	}

	.section-title {
		font-weight: bold;
		font-size: 1.1em;
		margin-bottom: 1rem;
		color: var(--accent);

		@media (max-width: 768px) {
			font-size: 1em;
			margin-bottom: 0.75rem;
		}
	}
}

.section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 1rem;
}

.form-group {
	margin-bottom: 1rem;

	label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.25rem;
		font-size: 0.9em;
		color: var(--fg);
	}

	.value {
		color: var(--fgSoft);
		padding: 0.5rem 0;
		
		a {
			color: var(--accent);
			text-decoration: none;
			
			&:hover {
				text-decoration: underline;
			}
		}
	}
}

.logo-section {
	.current-logo {
		margin-bottom: 1rem;

		.logo-image {
			max-width: 200px;
			max-height: 100px;
			border-radius: 8px;
			object-fit: contain;
		}
	}

	.no-logo {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
		border: 2px dashed var(--divider);
		border-radius: 8px;
		margin-bottom: 1rem;
		opacity: 0.7;

		i {
			font-size: 2rem;
			margin-bottom: 0.5rem;
		}
	}
}

.actions {
	display: flex;
	gap: 1rem;
	margin-top: 2rem;

	@media (max-width: 768px) {
		flex-direction: column;
		gap: 0.75rem;

		> * {
			width: 100%;
		}
	}
}

.loading {
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 200px;
}
</style>

<template>
	<MkSpacer :content-max="800" :margin-min="16" :margin-max="32">
		<div v-if="loading" class="loading">
			<MkLoading/>
		</div>
		<div v-else>
			<div class="title">
				{{ i18n.ts.schoolSettings || 'School Settings' }}
			</div>
			<div class="description">
				{{ i18n.ts.schoolSettingsDescription || 'Configure your school registration, LMS integration, and graduation settings' }}
			</div>

			<div class="settings-sections">
				<!-- Registration Settings -->
				<div class="settings-card">
					<div class="card-header">
						<i class="ph-user-plus ph-lg"></i>
						<div class="header-info">
							<div class="header-title">{{ i18n.ts.registrationSettings || 'Registration Settings' }}</div>
							<div class="header-subtitle">{{ i18n.ts.registrationSettingsDescription || 'Control how students can join your school' }}</div>
						</div>
					</div>
					<div class="card-content">
						<div class="setting-item">
							<div class="setting-label">
								{{ i18n.ts.allowDomainSignups || 'Allow signups from school domain' }}
							</div>
							<div class="setting-description">
								{{ i18n.ts.allowDomainSignupsDescription || 'Students with your school email domain can register automatically' }}
							</div>
							<MkSwitch v-model="settings.registrationSettings.allowDomainSignups" @update:model-value="onSettingsChange"/>
						</div>

						<div class="setting-item">
							<div class="setting-label">
								{{ i18n.ts.allowStudentsChooseUsername || 'Allow students to choose their own username' }}
							</div>
							<div class="setting-description">
								{{ i18n.ts.allowStudentsChooseUsernameDescription || 'When enabled, students can choose their own username during signup' }}
							</div>
							<MkSwitch v-model="settings.registrationSettings.allowStudentsChooseUsername" @update:model-value="onSettingsChange"/>
						</div>
					</div>
				</div>

				<!-- LMS Integration -->
				<div class="settings-card">
					<div class="card-header">
						<i class="ph-database ph-lg"></i>
						<div class="header-info">
							<div class="header-title">{{ i18n.ts.lmsIntegration }}</div>
							<div class="header-subtitle">{{ i18n.ts.lmsIntegrationDescription || 'Connect your Learning Management System' }}</div>
						</div>
					</div>
					<div class="card-content">
						<div v-if="lmsStatus.connected" class="lms-connected">
							<div class="lms-status">
								<i class="ph-check-circle ph-lg" style="color: var(--success);"></i>
								<div class="lms-info">
									<div class="lms-name">{{ lmsStatus.connection.name || lmsStatus.connection.type }}</div>
									<div class="lms-url">{{ lmsStatus.connection.apiUrl }}</div>
									<div v-if="lmsStatus.connection.lastSyncAt" class="lms-last-sync">
										Last synced: {{ new Date(lmsStatus.connection.lastSyncAt).toLocaleString() }}
									</div>
									<div class="lms-connection-status" :class="lmsStatus.connection.connectionStatus">
										{{ lmsStatus.connection.connectionStatus }}
									</div>
								</div>
							</div>
							<div class="lms-actions">
								<MkButton @click="syncNow" :disabled="syncing">
									<i :class="syncing ? 'ph-spinner ph-lg fa-spin' : 'ph-arrows-clockwise ph-lg'"></i>
									{{ syncing ? 'Syncing...' : 'Sync Now' }}
								</MkButton>
								<MkButton danger @click="disconnectLMS">
									<i class="ph-plug-slash ph-lg"></i>
									Disconnect
								</MkButton>
							</div>
						</div>

						<div v-else class="lms-disconnected">
							<div class="empty-state">
								<i class="ph-database ph-3x"></i>
								<h4>No LMS Connected</h4>
								<p>Connect your Learning Management System to automatically sync student data, verify enrollments, and manage graduations.</p>
								<MkInfo class="lms-info">
									<strong>OneRoster Compatibility:</strong> If your school uses Canvas, Blackbaud, Schoology, PowerSchool, or another major LMS, select "OneRoster" as the platform type. Most modern LMS platforms support the OneRoster standard!
								</MkInfo>
								<MkButton primary rounded full @click="showLMSSetup">
									<i class="ph-plug ph-lg"></i>
									{{ i18n.ts.connectLMS || 'Connect LMS' }}
								</MkButton>
							</div>
						</div>

						<div v-if="lmsStatus.connected || settings.registrationSettings.requireLMSValidation" class="setting-item lms-validation">
							<div class="setting-label">
								{{ i18n.ts.requireLMSValidation || 'Require LMS Validation' }}
							</div>
							<div class="setting-description">
								{{ i18n.ts.requireLMSValidationDescription || 'Require students to be verified in your LMS before registering' }}
							</div>
							<MkSwitch
								v-model="settings.registrationSettings.requireLMSValidation"
								@update:model-value="onSettingsChange"
								:disabled="!lmsStatus.connected"
							/>
						</div>
					</div>
				</div>

				<!-- Location Settings -->
				<div class="settings-card">
					<div class="card-header">
						<i class="ph-map-pin ph-lg"></i>
						<div class="header-info">
							<div class="header-title">{{ i18n.ts.schoolLocation || 'School Location' }}</div>
							<div class="header-subtitle">{{ i18n.ts.schoolLocationDescription || 'Set your school location for timeline boosting' }}</div>
						</div>
					</div>
					<div class="card-content">
						<div class="form-group">
							<label>{{ i18n.ts.location || 'Location' }}</label>
							<MkInput v-model="settings.location" @update:model-value="onSettingsChange">
								<template #caption>{{ i18n.ts.locationCaption || 'City, State, Country' }}</template>
							</MkInput>
						</div>

						<div class="coordinates-section">
							<div class="coordinates-grid">
								<div class="form-group">
									<label>{{ i18n.ts.latitude || 'Latitude' }}</label>
									<MkInput v-model="coordinatesInput.latitude" type="number" step="any" @update:model-value="onCoordinatesChange"/>
								</div>
								<div class="form-group">
									<label>{{ i18n.ts.longitude || 'Longitude' }}</label>
									<MkInput v-model="coordinatesInput.longitude" type="number" step="any" @update:model-value="onCoordinatesChange"/>
								</div>
							</div>
							<div class="location-buttons">
								<MkButton @click="geocodeAddress" :disabled="geocoding || !settings.location">
									<i class="ph-map-pin ph-lg"></i>
									{{ geocoding ? 'Getting coordinates...' : (i18n.ts.geocodeAddress || 'Get coordinates from address') }}
								</MkButton>
								<MkButton @click="setCurrentLocation" :disabled="gettingLocation">
									<i class="ph-crosshairs ph-lg"></i>
									{{ gettingLocation ? 'Getting location...' : (i18n.ts.useCurrentLocation || 'Use current location') }}
								</MkButton>
							</div>
						</div>
					</div>
				</div>

				<!-- Graduation Management -->
				<div class="settings-card">
					<div class="card-header">
						<i class="ph-graduation-cap ph-lg"></i>
						<div class="header-info">
							<div class="header-title">{{ i18n.ts.graduationManagement || 'Graduation Management' }}</div>
							<div class="header-subtitle">{{ i18n.ts.graduationManagementDescription || 'Automatically manage student graduations' }}</div>
						</div>
					</div>
					<div class="card-content">
						<div class="setting-item">
							<div class="setting-label">
								{{ i18n.ts.autoGraduationEnabled || 'Automatically process graduations' }}
							</div>
							<div class="setting-description">
								{{ i18n.ts.autoGraduationDescription || 'Students will be automatically graduated and their data archived after a 30-day grace period' }}
							</div>
							<MkSwitch v-model="settings.registrationSettings.autoGraduationEnabled" @update:model-value="onSettingsChange"/>
						</div>
					</div>
				</div>
			</div>

			<!-- Save Button -->
			<div class="actions">
				<MkButton @click="saveSettings" :disabled="!hasChanges || saving" primary>
					<i v-if="saving" class="ph-spinner ph-lg fa-spin"></i>
					<i v-else class="ph-floppy-disk ph-lg"></i>
					{{ saving ? (i18n.ts.saving || 'Saving...') : (i18n.ts.save || 'Save Settings') }}
				</MkButton>
			</div>
		</div>
	</MkSpacer>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/form/input.vue';
import MkSwitch from '@/components/form/switch.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { $i } from '@/account';

const loading = ref(true);
const saving = ref(false);
const hasChanges = ref(false);
const gettingLocation = ref(false);
const geocoding = ref(false);

// LMS state
const lmsStatus = ref({
	connected: false,
	connection: null as any,
});
const syncing = ref(false);

const settings = ref({
	registrationSettings: {
		allowDomainSignups: true,
		requireInvitation: false,
		autoGraduationEnabled: true,
		allowStudentsChooseUsername: true,
		requireLMSValidation: false
	},
	location: '',
	coordinates: null as { latitude: number; longitude: number } | null
});

const originalSettings = ref({});

const coordinatesInput = ref({
	latitude: '',
	longitude: ''
});

definePageMetadata({
	title: i18n.ts.schoolSettings || 'School Settings',
	icon: 'ph-gear-six ph-lg',
});

function onSettingsChange() {
	hasChanges.value = true;
}

function onCoordinatesChange() {
	const lat = parseFloat(coordinatesInput.value.latitude);
	const lng = parseFloat(coordinatesInput.value.longitude);

	if (!isNaN(lat) && !isNaN(lng)) {
		settings.value.coordinates = { latitude: lat, longitude: lng };
		onSettingsChange();
	} else if (coordinatesInput.value.latitude === '' && coordinatesInput.value.longitude === '') {
		settings.value.coordinates = null;
		onSettingsChange();
	}
}

async function setCurrentLocation() {
	if (!navigator.geolocation) {
		os.alert({
			type: 'error',
			text: 'Geolocation is not supported by this browser'
		});
		return;
	}

	gettingLocation.value = true;

	try {
		const position = await new Promise<GeolocationPosition>((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 60000
			});
		});

		coordinatesInput.value.latitude = position.coords.latitude.toString();
		coordinatesInput.value.longitude = position.coords.longitude.toString();
		onCoordinatesChange();

		os.success();
	} catch (err) {
		os.alert({
			type: 'error',
			text: 'Failed to get current location'
		});
	} finally {
		gettingLocation.value = false;
	}
}

async function geocodeAddress() {
	if (!settings.value.location || settings.value.location.trim().length === 0) {
		os.alert({
			type: 'error',
			text: 'Please enter an address first'
		});
		return;
	}

	geocoding.value = true;

	try {
		const result = await os.api('geocoding/address-to-coordinates', {
			address: settings.value.location
		});

		if (result) {
			coordinatesInput.value.latitude = result.latitude.toString();
			coordinatesInput.value.longitude = result.longitude.toString();
			onCoordinatesChange();

			os.toast(`Coordinates updated from ${result.displayName}`);
		} else {
			os.alert({
				type: 'error',
				text: 'Could not find coordinates for this address'
			});
		}
	} catch (err) {
		os.alert({
			type: 'error',
			text: 'Failed to get coordinates from address'
		});
	} finally {
		geocoding.value = false;
	}
}

async function loadSettings() {
	if (!$i?.isSchoolAdmin || !$i?.adminForSchoolId) {
		loading.value = false;
		return;
	}

	loading.value = true;

	try {
		const result = await os.api('schools/get-settings', {
			schoolId: $i.adminForSchoolId
		});

		settings.value = {
			registrationSettings: result.registrationSettings || {
				allowDomainSignups: true,
				requireInvitation: false,
				autoGraduationEnabled: true,
				allowStudentsChooseUsername: true,
				requireLMSValidation: false
			},
			location: result.location || '',
			coordinates: result.coordinates || null
		};

		if (settings.value.coordinates) {
			coordinatesInput.value.latitude = settings.value.coordinates.latitude.toString();
			coordinatesInput.value.longitude = settings.value.coordinates.longitude.toString();
		} else {
			coordinatesInput.value.latitude = '';
			coordinatesInput.value.longitude = '';
		}

		originalSettings.value = JSON.parse(JSON.stringify(settings.value));
		hasChanges.value = false;

	} catch (err) {
		console.error('Failed to load school settings:', err);
		os.alert({
			type: 'error',
			text: 'Failed to load settings'
		});
	} finally {
		loading.value = false;
	}
}

async function saveSettings() {
	if (!hasChanges.value || saving.value) return;

	saving.value = true;

	try {
		const result = await os.api('schools/update-settings', {
			schoolId: $i.adminForSchoolId,
			registrationSettings: settings.value.registrationSettings,
			location: settings.value.location || null,
			coordinates: settings.value.coordinates
		});

		if (result.autoGeocodingSucceeded && result.settings.coordinates) {
			settings.value.coordinates = result.settings.coordinates;
			coordinatesInput.value.latitude = result.settings.coordinates.latitude.toString();
			coordinatesInput.value.longitude = result.settings.coordinates.longitude.toString();

			os.toast('Location saved and coordinates automatically added!');
		} else {
			os.success();
		}

		originalSettings.value = JSON.parse(JSON.stringify(settings.value));
		hasChanges.value = false;
	} catch (err) {
		console.error('Failed to save school settings:', err);
		os.alert({
			type: 'error',
			text: 'Failed to save settings'
		});
	} finally {
		saving.value = false;
	}
}

// LMS Functions
async function loadLMSStatus() {
	if (!$i?.isSchoolAdmin) return;
	try {
		const status = await os.api('schools/lms/status', {});
		lmsStatus.value = status;
	} catch (err) {
		console.error('Failed to load LMS status:', err);
	}
}

async function showLMSSetup() {
	const { canceled, result } = await os.form('Connect LMS', {
		lmsType: { type: 'enum', label: 'LMS Platform', enum: [
			{ label: 'OneRoster', value: 'oneroster' },
			{ label: 'Canvas', value: 'canvas' },
			{ label: 'Blackbaud', value: 'blackbaud' },
			{ label: 'Schoology', value: 'schoology' },
			{ label: 'PowerSchool', value: 'powerschool' },
			{ label: 'Google Classroom', value: 'google-classroom' },
			{ label: 'Microsoft Teams for Education', value: 'microsoft-teams' },
			{ label: 'Moodle', value: 'moodle' },
			{ label: 'Brightspace/D2L', value: 'brightspace' },
			{ label: 'Sakai', value: 'sakai' },
		]},
		apiUrl: { type: 'string', label: 'API URL' },
		clientId: { type: 'string', label: 'Client ID' },
		clientSecret: { type: 'string', label: 'Client Secret' },
	});
	if (canceled) return;

	try {
		await os.apiWithDialog('schools/lms/connect', { ...result, autoSync: false, syncFrequency: 'daily' });
		os.success(i18n.ts.lmsConnected || 'LMS connected successfully');
		await loadLMSStatus();
	} catch (err: any) {
		os.alert({ type: 'error', text: err.message || 'Failed to connect LMS' });
	}
}

async function syncNow() {
	syncing.value = true;
	try {
		const result = await os.apiWithDialog('schools/lms/sync', {});
		os.success(`Synced ${result.syncLog.recordsUpdated} students`);
		await loadLMSStatus();
	} catch (err: any) {
		os.alert({ type: 'error', text: err.message || 'Failed to sync' });
	} finally {
		syncing.value = false;
	}
}

async function disconnectLMS() {
	const { canceled } = await os.confirm({ type: 'warning', text: 'Are you sure you want to disconnect the LMS?' });
	if (canceled) return;
	try {
		await os.apiWithDialog('schools/lms/disconnect', {});
		os.success(i18n.ts.lmsDisconnected || 'LMS disconnected');
		await loadLMSStatus();
		if (settings.value.registrationSettings.requireLMSValidation) {
			settings.value.registrationSettings.requireLMSValidation = false;
			onSettingsChange();
		}
	} catch (err: any) {
		os.alert({ type: 'error', text: err.message || 'Failed' });
	}
}

watch(settings, () => {
	const current = JSON.stringify(settings.value);
	const original = JSON.stringify(originalSettings.value);
	hasChanges.value = current !== original;
}, { deep: true });

onMounted(async () => {
	await loadSettings();
	await loadLMSStatus();
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

.loading {
	text-align: center;
	padding: 32px;
}

.settings-sections {
	display: grid;
	gap: 1.5rem;
	margin-bottom: 2rem;
}

.settings-card {
	background: var(--panel);
	border-radius: 12px;
	border: 1px solid var(--divider);
	overflow: hidden;

	.card-header {
		padding: 1.5rem;
		background: var(--bg);
		border-bottom: 1px solid var(--divider);
		display: flex;
		align-items: center;
		gap: 1rem;

		> i {
			font-size: 1.5rem;
			color: var(--accent);
		}

		.header-info {
			flex: 1;

			.header-title {
				font-weight: 600;
				font-size: 1.1em;
			}

			.header-subtitle {
				opacity: 0.7;
				font-size: 0.9em;
				margin-top: 0.25rem;
			}
		}
	}

	.card-content {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
}

.setting-item {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 1rem;
	padding: 1rem;
	background: var(--bg);
	border-radius: 8px;

	.setting-label {
		font-weight: 600;
		flex: 1;
	}

	.setting-description {
		flex: 2;
		opacity: 0.7;
		font-size: 0.9em;
		line-height: 1.5;
	}
}

.lms-connected {
	display: flex;
	flex-direction: column;
	gap: 1rem;

	.lms-status {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: var(--bg);
		border-radius: 8px;

		> i {
			font-size: 2rem;
		}

		.lms-info {
			flex: 1;

			.lms-name {
				font-weight: 600;
				font-size: 1.1em;
			}

			.lms-url {
				opacity: 0.7;
				font-size: 0.9em;
				margin-top: 0.25rem;
			}

			.lms-last-sync {
				opacity: 0.7;
				font-size: 0.85em;
				margin-top: 0.5rem;
			}

			.lms-connection-status {
				display: inline-block;
				padding: 0.25rem 0.5rem;
				border-radius: 4px;
				font-size: 0.85em;
				font-weight: 600;
				margin-top: 0.5rem;

				&.active {
					background: var(--success);
					color: #fff;
				}

				&.error {
					background: var(--error);
					color: #fff;
				}

				&.pending {
					background: var(--warn);
					color: #fff;
				}
			}
		}
	}

	.lms-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
	}
}

.lms-disconnected {
	.empty-state {
		text-align: center;
		padding: 3rem 2rem;

		> i {
			font-size: 3rem;
			color: var(--accent);
			display: block;
			margin-bottom: 1rem;
		}

		h4 {
			margin: 0 0 0.5rem 0;
			font-size: 1.2em;
		}

		p {
			opacity: 0.7;
			margin-bottom: 1.5rem;
		}

		.lms-info {
			margin-bottom: 1.5rem;
		}
	}
}

.lms-validation {
	background: var(--info);
}

.form-group {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;

	label {
		font-weight: 600;
		font-size: 0.9em;
	}
}

.coordinates-section {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.coordinates-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 1rem;
}

.location-buttons {
	display: flex;
	gap: 0.75rem;
	flex-wrap: wrap;
}

.actions {
	display: flex;
	justify-content: center;
	gap: 1rem;
	padding-top: 1rem;
}

@media (max-width: 768px) {
	.settings-sections {
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.settings-card {
		.card-header {
			padding: 1rem;
		}

		.card-content {
			padding: 1rem;
		}
	}

	.setting-item {
		flex-direction: column;
		gap: 0.75rem;
	}

	.coordinates-grid {
		grid-template-columns: 1fr;
	}

	.location-buttons {
		flex-direction: column;
	}

	.lms-actions {
		flex-direction: column;
	}
}
</style>

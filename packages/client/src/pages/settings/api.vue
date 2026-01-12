<template>
<div>
	<MkSpacer :content-max="700" :margin-min="16" :margin-max="32">
		<!-- API Token Generation Section -->
		<FormSection>
			<template #label>{{ i18n.ts.generateAccessToken }}</template>
			<div class="_formRoot">
				<FormButton primary class="_formBlock" @click="generateToken">{{ i18n.ts.generateAccessToken }}</FormButton>
				<FormLink to="/settings/apps" class="_formBlock">{{ i18n.ts.manageAccessTokens }}</FormLink>
				<FormLink to="/api-console" :behavior="isDesktop ? 'window' : null" class="_formBlock">API console</FormLink>
			</div>
		</FormSection>

		<!-- OAuth2 Applications Section -->
		<FormSection>
			<template #label>{{ i18n.ts.oauth2Applications }}</template>
			<div class="_gaps_m">
				<MkLoading v-if="loading" />
				<MkInfo v-else-if="appsWithOAuth2.length === 0" class="info">{{ i18n.ts.noApps }}</MkInfo>
				<div v-else class="_gaps_s">
					<div v-for="app in appsWithOAuth2" :key="app.id" class="app _panel">
						<div class="header">
							<div class="name">{{ app.name }}</div>
							<div class="buttons">
								<MkButton class="button" @click="showAppDetails(app)"><i class="ph-eye-bold ph-lg"></i></MkButton>
								<MkButton class="button" danger @click="deleteApp(app)"><i class="ph-trash-bold ph-lg"></i></MkButton>
							</div>
						</div>
						<div class="content">
							<div class="description">{{ app.description }}</div>
							<div class="id">ID: {{ app.id }}</div>
							<div class="secret">Secret: <Mfm :text="`$[blur ${app.secret}]`" /></div>
							<div class="redirects" v-if="app.redirectUris?.length > 0">
								<div class="label">{{ i18n.ts.redirectUri }}:</div>
								<div v-for="uri in app.redirectUris" :key="uri" class="uri">{{ uri }}</div>
							</div>
							<div class="permissions">
								<div class="label">{{ i18n.ts.permissions }}:</div>
								<div v-for="permission in app.permission" :key="permission" class="permission">{{ i18n.t(`_permissions.${permission}`) }}</div>
							</div>
						</div>
					</div>
				</div>
			
			</div>
		</FormSection>

		<!-- Create OAuth2 Application Section -->
		<FormSection>
			<template #label>{{ i18n.ts.createOAuthApp || 'Create OAuth2 Application' }}</template>

			<MkInput v-model="newApp.name" class="_formBlock">
				<template #label>{{ i18n.ts.name }}</template>
			</MkInput>

			<MkInput v-model="newApp.description" class="_formBlock">
				<template #label>{{ i18n.ts.description }}</template>
			</MkInput>

			<div class="_formBlock">
				<div class="_formLinksGrid">
					<MkButton @click="addRedirectUri()"><i class="ph-plus-bold ph-lg"></i> {{ i18n.ts.addRedirectUri }}</MkButton>
				</div>
			</div>

			<div v-if="newApp.redirectUris.length > 0" class="_formBlock">
				<div class="redirectUris _gaps_s">
					<div v-for="(uri, i) in newApp.redirectUris" :key="i" class="redirectUri _panel">
						<MkInput v-model="newApp.redirectUris[i]">
							<template #label>{{ i18n.ts.redirectUri }} #{{ i + 1 }}</template>
							<template #suffix>
								<button class="_button" @click="removeRedirectUri(i)">
									<i class="ph-trash-bold ph-lg"></i>
								</button>
							</template>
						</MkInput>
					</div>
				</div>
			</div>

			<!-- Consistent Permission Selection -->
			<div class="_section">
				<div style="margin-bottom: 16px;"><b>{{ i18n.ts.permission }}</b></div>
				<div class="permissions-grid">
					<MkSwitch v-for="kind in permissionKinds" :key="kind" v-model="newApp.permissions[kind]">{{ i18n.t(`_permissions.${kind}`) }}</MkSwitch>
				</div>
			</div>

			<MkSwitch v-model="newApp.oauth2" class="_formBlock">OAuth2</MkSwitch>

			<FormButton primary class="_formBlock" @click="createApp">{{ i18n.ts.create }}</FormButton>
		</FormSection>
	</MkSpacer>
</div>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, ref, computed, reactive } from 'vue';
import FormLink from '@/components/form/link.vue';
import FormButton from '@/components/MkButton.vue';
import FormSection from '@/components/form/section.vue';
import MkInput from '@/components/form/input.vue';
import MkSwitch from '@/components/form/switch.vue';
import MkInfo from '@/components/MkInfo.vue';
import Mfm from '@/components/global/MkMisskeyFlavoredMarkdown.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { permissions as permissionKinds } from 'calckey-js';

const isDesktop = ref(window.innerWidth >= 1100);

// App management
let loading = ref(true);
let apps = ref<any[]>([]);
let appsWithOAuth2 = computed(() => apps.value.filter(app => app.oauth2 === true));

// New app creation
const newApp = reactive({
	name: '',
	description: '',
	redirectUris: [] as string[],
	permissions: {} as Record<string, boolean>,
	oauth2: true
});

// Initialize permissions
for (const kind of permissionKinds) {
	newApp.permissions[kind] = false;
}

function init() {
	loading.value = true;
	// Fetch OAuth applications
	os.api('my/apps', {
		limit: 100
	}).then(response => {
		apps.value = response;
		
		// If the redirectUris property wasn't being returned before, we might
		// need to fetch more detailed information for OAuth2 apps
		const oauth2Apps = response.filter(app => app.oauth2 === true);
		
		// Fetch detailed information for each OAuth2 app
		if (oauth2Apps.length > 0) {
			Promise.all(oauth2Apps.map(app => 
				os.api('app/show', { appId: app.id, includeSecret: true })
			)).then(detailedApps => {
				// Update apps with more detailed info
				apps.value = apps.value.map(app => {
					const detailedApp = detailedApps.find(a => a.id === app.id);
					return detailedApp || app;
				});
			}).catch(console.error);
		}
	}).catch(err => {
		os.alert({
			type: 'error',
			text: err.message,
		});
	}).finally(() => {
		loading.value = false;
	});
}



function generateToken() {
	os.popup(defineAsyncComponent(() => import('@/components/MkTokenGenerateWindow.vue')), {}, {
		done: async result => {
			const { name, permissions } = result;
			const { token } = await os.api('miauth/gen-token', {
				session: null,
				name: name,
				permission: permissions,
			});

			os.alert({
				type: 'success',
				title: i18n.ts.token,
				text: token,
			});
		},
	}, 'closed');
}

function createApp() {
	// Validation
	if (newApp.name === '') {
		os.alert({
			type: 'error',
			text: i18n.ts.required,
		});
		return;
	}

	if (newApp.description === '') {
		os.alert({
			type: 'error',
			text: i18n.ts.required,
		});
		return;
	}

	if (newApp.oauth2 && newApp.redirectUris.length === 0) {
		os.alert({
			type: 'error',
			text: i18n.ts.oauth2RedirectRequired || "At least one redirect URI is required for OAuth2 applications",
		});
		return;
	}

	const selectedPermissions = Object.keys(newApp.permissions).filter(p => newApp.permissions[p]);
	
	if (selectedPermissions.length === 0) {
		os.alert({
			type: 'error',
			text: i18n.ts.required,
		});
		return;
	}

	os.api('app/create', {
		name: newApp.name,
		description: newApp.description,
		permission: selectedPermissions,
		redirectUris: newApp.redirectUris,
		oauth2: newApp.oauth2,
	}).then((app) => {
		// Show application details in a popup using our dedicated component
		os.popup(defineAsyncComponent(() => import('@/components/BkOAuthAppDetailsDialog.vue')), {
			app: app,
			isNewApp: true,
		}, {}, 'closed').then(() => {
			// Reset form
			newApp.name = '';
			newApp.description = '';
			newApp.redirectUris = [];
			Object.keys(newApp.permissions).forEach(key => {
				newApp.permissions[key] = false;
			});
			newApp.oauth2 = true;
			init();
		});
	}).catch(err => {
		os.alert({
			type: 'error',
			text: err.message || 'Failed to create application',
		});
	});
}

function deleteApp(app) {
	os.confirm({
		type: 'warning',
		text: i18n.t('deleteAreYouSure', { x: app.name }),
	}).then(({ canceled }) => {
		if (canceled) return;
		os.apiWithDialog('app/delete', {
			appId: app.id,
		}).then(() => {
			init();
		});
	});
}

function addRedirectUri() {
	newApp.redirectUris.push('');
}

function removeRedirectUri(i: number) {
	newApp.redirectUris.splice(i, 1);
}

function showAppDetails(app) {
	os.api('app/show', {
		appId: app.id,
		includeSecret: true
	}).then(details => {
		// Show application details in a popup using our dedicated component
		os.popup(defineAsyncComponent(() => import('@/components/BkOAuthAppDetailsDialog.vue')), {
			app: details,
			isNewApp: false,
		}, {}, 'closed');
	}).catch(err => {
		os.alert({
			type: 'error',
			text: err.message,
		});
	});
}

function disableAllPermissions() {
	for (const p in newApp.permissions) {
		newApp.permissions[p] = false;
	}
}

function enableAllPermissions() {
	for (const p in newApp.permissions) {
		newApp.permissions[p] = true;
	}
}

// Initialize data
init();

const headerActions = $computed(() => []);
const headerTabs = $computed(() => []);

definePageMetadata({
	title: 'API',
	icon: 'ph-key-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.app {
	&:not(:last-child) {
		margin-bottom: 16px;
	}

	.header {
		display: flex;
		padding: 10px 16px;
		background: var(--panel);

		.name {
			flex: 1;
			font-weight: bold;
		}

		.buttons {
			flex-shrink: 0;
			margin-left: 16px;

			.button {
				margin-left: 8px;
			}
		}
	}

	.content {
		padding: 16px;

		.description {
			margin-bottom: 8px;
		}

		.id, .secret {
			font-family: monospace;
			margin-bottom: 8px;
		}

		.redirects, .permissions {
			margin-top: 16px;

			.label {
				font-weight: bold;
				margin-bottom: 4px;
			}

			.uri, .permission {
				margin-left: 16px;
			}
		}
	}
}

.redirectUris {
	.redirectUri {
		padding: 16px;
	}
}

.permissions-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	gap: 8px;
	margin-top: 12px;
}

.scope-note {
	margin-top: 16px;
	
	code {
		font-family: monospace;
		background: var(--bg);
		padding: 2px 4px;
		border-radius: 4px;
	}
}
</style>

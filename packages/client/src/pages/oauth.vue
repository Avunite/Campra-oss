<template>
<MkSpacer :content-max="700">
	<div v-if="$i">
		<div v-if="authState == 'waiting'" class="waiting status-section _section">
			<div class="_content">
				<i class="ph-hourglass-medium-bold ph-2x status-icon animate-pulse"></i>
				<h3>{{ i18n.ts._auth.processing || 'Processing' }}</h3>
				<MkLoading/>
			</div>
		</div>
		<div v-else-if="authState == 'denied'" class="denied status-section _section">
			<div class="_content">
				<i class="ph-x-circle-bold ph-2x status-icon"></i>
				<h3>{{ i18n.ts._auth.accessDenied || 'Access Denied' }}</h3>
				<p>{{ i18n.ts._auth.denied }}</p>
				<MkButton class="return-button" @click="() => window.history.back()">{{ i18n.ts.goBack || 'Go Back' }}</MkButton>
			</div>
		</div>
		<div v-else-if="authState == 'accepted'" class="accepted status-section _section">
			<div class="_content">
				<i class="ph-check-circle-bold ph-2x status-icon"></i>
				<h3>{{ i18n.ts._auth.accessGranted || 'Access Granted' }}</h3>
				<p v-if="redirectUri">{{ i18n.ts._auth.redirect }}<MkEllipsis/></p>
				<p v-else>{{ i18n.ts._auth.pleaseGoBack }}</p>
			</div>
		</div>
		<div v-else class="_section oauth-container">
			<div v-if="app" class="_title">{{ i18n.t('_auth.shareAccess', { name: app.name }) }}</div>
			<div v-else class="_title">{{ i18n.ts._auth.shareAccessAsk }}</div>
			
			<div class="_content app-details" v-if="app">
				<!-- Banner image if available -->
				<div class="banner" v-if="app.banner_image">
					<img :src="app.banner_image" alt="App banner" />
				</div>
				
				<div class="app-header">
					<!-- Logo image if available -->
					<div class="app-logo" v-if="app.logo_image">
						<img :src="app.logo_image" alt="App logo" />
					</div>
					<div class="app-logo app-default-icon" v-else>
						<i class="ph-app-window-bold ph-lg"></i>
					</div>
					<div class="app-info">
						<h2>{{ app.name }}</h2>
						<p class="id">
							<i class="ph-key-bold"></i> 
							{{ clientId }}
						</p>
					</div>
				</div>
				
				<p class="description">{{ app.description }}</p>
			</div>
			
			<div class="_content permissions-section">
				<h3>
					<i class="ph-key-bold ph-lg"></i> 
					{{ i18n.ts._auth.permissionAsk }}
				</h3>
				<div v-if="_scope && _scope.length > 0">
					<div class="permissions-list" v-if="validScopes.length > 0">
						<div class="permission-item" v-for="p in validScopes" :key="p">
							<i class="ph-check-circle-bold ph-lg"></i>
							<span>{{ i18n.t(`_permissions.${p}`) }}</span>
						</div>
					</div>
					
					<div class="unknown-permissions" v-if="invalidScopes.length > 0">
						<h4>
							<i class="ph-warning-bold ph-lg"></i>
							{{ i18n.ts._auth.unknownPermissions || 'Unknown Permissions' }}
						</h4>
						<div class="permissions-list">
							<div class="permission-item unknown" v-for="p in invalidScopes" :key="p">
								<i class="ph-question-circle-bold ph-lg"></i>
								<span>{{ p }}</span>
							</div>
						</div>
						<p class="caution">
							<i class="ph-info-bold"></i>
							{{ i18n.ts._auth.unknownPermissionsWarning || 'Please be cautious when granting unknown permissions' }}
						</p>
					</div>
				</div>
				<p class="no-permissions" v-else>{{ i18n.ts._auth.noPermissionsRequested || 'No specific permissions requested' }}</p>
			</div>
			
			<div class="_footer">
				<MkButton inline @click="deny">
					<i class="ph-x-bold ph-lg"></i> {{ i18n.ts.cancel }}
				</MkButton>
				<MkButton inline primary @click="accept">
					<i class="ph-check-bold ph-lg"></i> {{ i18n.ts.accept }}
				</MkButton>
			</div>
		</div>
	</div>
	<div v-else class="signin">
		<MkSignin @login="onLogin"/>
	</div>
</MkSpacer>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import MkSignin from '@/components/MkSignin.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os';
import { $i, login } from '@/account';
import { i18n } from '@/i18n';

const clientId = $ref<string>(new URLSearchParams(window.location.search).get('client_id') || '');
const redirectUri = $ref<string>(new URLSearchParams(window.location.search).get('redirect_uri') || '');
const responseType = $ref<string>(new URLSearchParams(window.location.search).get('response_type') || 'code');
const scope = $ref<string>(new URLSearchParams(window.location.search).get('scope') || '');
const state = $ref<string | null>(new URLSearchParams(window.location.search).get('state'));
const codeChallenge = $ref<string | null>(new URLSearchParams(window.location.search).get('code_challenge'));
const codeChallengeMethod = $ref<string | null>(new URLSearchParams(window.location.search).get('code_challenge_method'));

const _scope = $ref<string[]>(scope ? scope.split(' ') : []);
const validScopes = $ref<string[]>([]);
const invalidScopes = $ref<string[]>([]);
const app = $ref<any | null>(null);
const authState = $ref<string | null>(null);
const sessionToken = $ref<string | null>(null);

onMounted(async () => {
	try {
		// First, create an authorization session
		const authSession = await os.api('oauth/authorize', {
			clientId,
			redirectUri,
			responseType,
			scope,
			state,
			codeChallenge,
			codeChallengeMethod,
		});
		
		sessionToken = authSession.token;
		
		// Fetch application info
		app = await os.api('app/show', {
			id: clientId,
		});

		// Validate scopes by checking if we have translations for them
		if (_scope.length > 0) {
			for (const s of _scope) {
				try {
					// Check if the permission has a translation
					const permissionText = i18n.t(`_permissions.${s}`);
					
					// If the translation key is returned unchanged, it means no translation exists
					if (permissionText !== `_permissions.${s}`) {
						validScopes.push(s);
					} else {
						invalidScopes.push(s);
					}
				} catch {
					invalidScopes.push(s);
				}
			}
		}
	} catch (error) {
		os.alert({
			type: 'error',
			text: error.message || 'Failed to initialize OAuth authorization',
		});
	}
});

async function accept(): Promise<void> {
	if (!sessionToken) return;
	
	authState = 'waiting';
	
	try {
		const response = await os.api('auth/accept', {
			token: sessionToken,
		});
		
		authState = 'accepted';
		
		if (response.redirectUri) {
			// Redirect to the provided redirect URI
			window.location.href = response.redirectUri;
		}
	} catch (error) {
		authState = null;
		os.alert({
			type: 'error',
			text: error.message || 'Failed to authorize application',
		});
	}
}

function deny(): void {
	authState = 'denied';
	
	// Redirect back to the redirectUri with an error if provided
	if (redirectUri) {
		const url = new URL(redirectUri);
		url.searchParams.append('error', 'access_denied');
		if (state) url.searchParams.append('state', state);
		window.location.href = url.toString();
	}
}

function onLogin(res): void {
	login(res.i);
}
</script>

<style lang="scss" scoped>
.status-section {
	max-width: 500px;
	margin: 0 auto;
	padding: 2.5rem 1.5rem;
	text-align: center;
	border-radius: 16px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

	.status-icon {
		font-size: 3.5rem;
		margin-bottom: 1rem;
	}

	h3 {
		font-size: 1.5rem;
		margin-bottom: 1rem;
		font-weight: 600;
	}

	.waiting .status-icon {
		color: var(--accent);
	}

	.accepted .status-icon {
		color: var(--success);
	}

	.denied .status-icon {
		color: var(--error);
	}

	.return-button {
		margin-top: 1.5rem;
	}

	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
}
.oauth-container {
	border-radius: 16px;
	overflow: hidden;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
	max-width: 700px;
	margin: 0 auto;
	padding-bottom: 1rem;
}

.banner {
	width: 100%;
	height: 180px;
	overflow: hidden;
	margin-bottom: 2rem;
	border-radius: 12px;
	box-shadow: 0 2px 8px var(--shadow);
	
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
}

.app-details {
	padding: 0 1rem;
}

.app-header {
	display: flex;
	align-items: center;
	margin-bottom: 1.5rem;
}

.app-logo {
	width: 72px;
	height: 72px;
	border-radius: 14px;
	overflow: hidden;
	margin-right: 1.25rem;
	flex-shrink: 0;
	box-shadow: 0 2px 6px var(--shadow);
	
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	
	&.app-default-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent);
		color: var(--accentForeground);
		
		i {
			font-size: 36px;
		}
	}
}

.app-info {
	flex: 1;

	h2 {
		margin: 0 0 0.4rem;
		font-size: 1.6rem;
		font-weight: 600;
		line-height: 1.2;
	}
}

.id {
	opacity: 0.7;
	font-size: 0.9em;
	margin: 0;
	display: flex;
	align-items: center;
	
	i {
		margin-right: 6px;
		opacity: 0.8;
	}
}

.description {
	margin: 1.5em 0;
	line-height: 1.6;
	font-size: 1.05rem;
	padding: 0 0.5rem;
}

.permissions-section {
	margin-top: 2rem;
	padding: 1.75rem 1.5rem 0.5rem;
	border-top: 1px solid var(--divider);
	background: var(--bg);
	border-radius: 12px;
	
	h3 {
		margin-top: 0;
		margin-bottom: 1.25rem;
		font-weight: bold;
		display: flex;
		align-items: center;
		font-size: 1.25rem;
		
		i {
			margin-right: 10px;
			color: var(--accent);
		}
	}
}

.permissions-list {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
	gap: 1rem;
	margin-bottom: 1.5rem;
}

.permission-item {
	display: flex;
	align-items: center;
	padding: 0.875rem 1rem;
	border-radius: 10px;
	background: var(--panel);
	transition: transform 0.2s ease, box-shadow 0.2s ease;
	box-shadow: 0 1px 3px var(--shadow);
	
	&:hover {
		transform: translateY(-2px);
		box-shadow: 0 3px 8px var(--shadow);
	}
	
	i {
		color: var(--accent);
		margin-right: 0.75rem;
		flex-shrink: 0;
		font-size: 1.1rem;
	}
	
	span {
		flex: 1;
		font-size: 0.95rem;
	}
}

.no-permissions {
	opacity: 0.7;
	font-style: italic;
	padding: 1rem;
	text-align: center;
	background: var(--panel);
	border-radius: 10px;
	margin-bottom: 1.5rem;
}

.unknown-permissions {
	margin-top: 2rem;
	padding: 1.5rem;
	border-top: 1px dashed var(--divider);
	background: var(--panelWarning);
	border-radius: 12px;
	margin-bottom: 1.5rem;
	
	h4 {
		margin-top: 0;
		margin-bottom: 1rem;
		font-weight: bold;
		color: var(--warn);
		display: flex;
		align-items: center;
		
		i {
			margin-right: 8px;
		}
	}
	
	.permission-item.unknown {
		background-color: var(--panel);
		border: 1px solid var(--warn);
		
		i {
			color: var(--warn);
		}
	}
	
	.caution {
		margin-top: 1rem;
		color: var(--warn);
		font-size: 0.9em;
		padding: 0.75rem;
		background: rgba(var(--warnRgb), 0.1);
		border-radius: 8px;
		display: flex;
		align-items: center;
		
		i {
			margin-right: 8px;
			flex-shrink: 0;
		}
	}
}

._footer {
	display: flex;
	justify-content: flex-end;
	gap: 1rem;
	margin-top: 1.5rem;
	padding: 1.25rem 1.5rem;
	border-top: 1px solid var(--divider);
	background: var(--panel);
}
</style>

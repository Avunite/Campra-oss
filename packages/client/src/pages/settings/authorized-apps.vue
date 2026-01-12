<template>
<div class="_formRoot">
	<FormSection>
		<template #label>{{ i18n.ts.authorizedApps }}</template>
		<div class="_gaps">
			<div v-if="loading" class="text-center">
				<MkLoading/>
			</div>
			<div v-else-if="sessions.length === 0" class="_fullinfo">
				<img src="/static-assets/badges/info.png" class="_ghost" alt="Info"/>
				<div>{{ i18n.ts.nothing }}</div>
			</div>
			<div v-else v-for="session in sessions" :key="session.id" class="_panel session-card">
				<div class="session-header">
					<div class="app-info">
						<img v-if="session.app.iconUrl" class="app-icon" :src="session.app.iconUrl" alt=""/>
						<i v-else class="ph-app-window-bold ph-lg app-icon-default"></i>
						<div class="app-details">
							<div class="app-name">{{ session.app.name }}</div>
							<div class="app-id">{{ session.app.id }}</div>
						</div>
					</div>
					<div class="session-actions">
						<MkButton class="danger" inline @click="revokeSession(session)">
							<i class="ph-trash-bold ph-lg"></i> {{ i18n.ts.revoke }}
						</MkButton>
					</div>
				</div>
				<div class="session-metadata">
					<div class="session-date">
						<i class="ph-calendar-bold ph-lg"></i>
						{{ i18n.ts.authorizedAt }}: <MkTime :time="session.createdAt" mode="detail"/>
					</div>
					<div v-if="session.app.description" class="session-description">
						{{ session.app.description }}
					</div>
				</div>
			</div>
		</div>
	</FormSection>
</div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import MkButton from '@/components/MkButton.vue';
import FormSection from '@/components/form/section.vue';

const sessions = ref<any[]>([]);
const loading = ref(true);

async function fetchSessions() {
	loading.value = true;
	try {
		sessions.value = await os.api('i/authorized-sessions', {
			limit: 100,
		});
	} catch (err) {
		os.alert({
			type: 'error',
			text: err.message,
		});
	} finally {
		loading.value = false;
	}
}

async function revokeSession(session: any) {
	os.confirm({
		type: 'warning',
		text: i18n.ts.revokeAreYouSure ? i18n.ts.revokeAreYouSure.replace('{x}', session.app.name) : `Are you sure you want to revoke access for "${session.app.name}"?`,
	}).then(({ canceled }) => {
		if (canceled) return;
		
		os.apiWithDialog('i/revoke-session', {
			sessionId: session.id,
		}).then(() => {
			fetchSessions();
		});
	});
}

onMounted(() => {
	fetchSessions();
});

const headerActions = $computed(() => []);
const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.authorizedApps,
	icon: 'ph-key-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.session-card {
	padding: 16px;
	margin-bottom: 16px;
	border-radius: 8px;
}

.session-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;
}

.app-info {
	display: flex;
	align-items: center;
}

.app-icon {
	width: 48px;
	height: 48px;
	border-radius: 8px;
	margin-right: 12px;
	object-fit: cover;
}

.app-icon-default {
	width: 48px;
	height: 48px;
	border-radius: 8px;
	margin-right: 12px;
	display: flex;
	justify-content: center;
	align-items: center;
	background: var(--accent);
	color: var(--accentForeground);
	font-size: 24px;
}

.app-details {
	display: flex;
	flex-direction: column;
}

.app-name {
	font-weight: bold;
	font-size: 1.1em;
}

.app-id {
	font-size: 0.85em;
	opacity: 0.7;
	margin-top: 2px;
}

.session-metadata {
	margin-top: 12px;
}

.session-date {
	display: flex;
	align-items: center;
	font-size: 0.9em;
	opacity: 0.8;
	
	i {
		margin-right: 4px;
	}
}

.session-description {
	margin-top: 8px;
	padding: 8px;
	background: var(--bg);
	border-radius: 6px;
	font-size: 0.95em;
}

.session-actions {
	flex-shrink: 0;
}

.danger {
	background: var(--error) !important;
	color: #fff !important;
}
</style>

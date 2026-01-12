<template>
<div class="login-page">
	<div class="login-container">
		<div class="logo-section">
			<img v-if="meta?.logoImageUrl" 
				 class="logo-image" 
				 :src="meta.logoImageUrl" 
				 :alt="meta.name + ' logo'">
			<div v-else class="logo-placeholder">
				<i class="ph-chat-circle-bold ph-lg"></i>
			</div>
		</div>
		<h1 class="login-title">{{ i18n.ts.login }}</h1>
		<p class="login-subtitle">{{ meta?.name || 'Campra' }}</p>
		
		<div class="login-form">
			<MkSignin/>
		</div>
		
		<div class="login-footer">
			<p>{{ i18n.ts.dontHaveAnAccount }} <MkA to="/" class="signup-link">{{ i18n.ts.signup }}</MkA></p>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import MkSignin from '@/components/MkSignin.vue';
import { i18n } from '@/i18n';
import * as os from '@/os';
import { definePageMetadata } from '@/scripts/page-metadata';

const meta = ref<any>(null);

onMounted(async () => {
	try {
		meta.value = await os.api('meta', {});
	} catch (error) {
		console.error('Failed to fetch meta information:', error);
	}
});

definePageMetadata(computed(() => ({
	title: i18n.ts.login,
	icon: 'ph-sign-in-bold',
})));
</script>

<style lang="scss" scoped>
.login-page {
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--bg);
	padding: 16px;
}

.login-container {
	width: 100%;
	max-width: 400px;
	background: var(--panel);
	border-radius: 12px;
	padding: 32px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
	text-align: center;
}

.logo-section {
	margin-bottom: 24px;
}

.logo-image {
	height: 64px;
	width: auto;
}

.logo-placeholder {
	font-size: 48px;
	color: var(--accent);
	margin-bottom: 8px;
}

.login-title {
	font-size: 24px;
	font-weight: 700;
	margin-bottom: 8px;
	color: var(--fg);
}

.login-subtitle {
	color: var(--fgTransparentWeak);
	margin-bottom: 32px;
}

.login-form {
	margin-bottom: 24px;
}

.login-footer {
	color: var(--fgTransparentWeak);
	font-size: 14px;
}

.signup-link {
	color: var(--accent);
	text-decoration: none;
	font-weight: 500;
	
	&:hover {
		text-decoration: underline;
	}
}
</style>
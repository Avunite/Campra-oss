<template>
<MkSpacer :content-max="700" :margin-min="16" :margin-max="32">
	<MkInfo>
		OAuth2 functionality has been integrated into the API settings page.
		<div style="margin-top: 12px;">
			<MkButton primary @click="redirect">Go to API settings</MkButton>
		</div>
	</MkInfo>
</MkSpacer>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRouter } from '@/router';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

const router = useRouter();

function redirect() {
	router.replace('/settings/api');
}

onMounted(() => {
	// Automatically redirect after a brief delay
	setTimeout(() => {
		redirect();
	}, 1000);
});

definePageMetadata({
	title: i18n.ts.oauth2Applications,
	icon: 'ph-lock-key-bold ph-lg',
});
</script>



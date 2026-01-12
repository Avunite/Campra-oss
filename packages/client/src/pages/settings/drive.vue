<template>
<div class="_formRoot">
	<FormSection>
		<template #label>{{ i18n.ts.statistics }}</template>
		<MkChart src="per-user-drive" :args="{ user: $i }" span="day" :limit="7 * 5" :bar="true" :stacked="true" :detailed="false" :aspect-ratio="6"/>
	</FormSection>

	<FormLink to="/my/drive" class="_formBlock"><template #icon><i class="ph-cloud-bold ph-lg"></i></template>{{ i18n.ts.drive }}</FormLink>
	<FormSection>
		<FormLink @click="chooseUploadFolder()">
			{{ i18n.ts.uploadFolder }}
			<template #suffix>{{ uploadFolder ? uploadFolder.name : '-' }}</template>
			<template #suffixIcon><i class="ph-folder-notch-open-bold ph-lg"></i></template>
		</FormLink>
		<FormSwitch v-model="keepOriginalUploading" class="_formBlock">
			<template #label>{{ i18n.ts.keepOriginalUploading }}</template>
			<template #caption>{{ i18n.ts.keepOriginalUploadingDescription }}</template>
		</FormSwitch>
	</FormSection>
</div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import tinycolor from 'tinycolor2';
import FormLink from '@/components/form/link.vue';
import FormSwitch from '@/components/form/switch.vue';
import FormSection from '@/components/form/section.vue';
import MkKeyValue from '@/components/MkKeyValue.vue';
import FormSplit from '@/components/form/split.vue';
import * as os from '@/os';
import bytes from '@/filters/bytes';
import { defaultStore } from '@/store';
import MkChart from '@/components/MkChart.vue';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { $i } from '@/account';

const fetching = ref(true);
const usage = ref<any>(null);
const capacity = ref<any>(null);
const uploadFolder = ref<any>(null);
let alwaysMarkNsfw = $ref($i.alwaysMarkNsfw);
let autoSensitive = $ref($i.autoSensitive);

const meterStyle = computed(() => {
	return {
		width: `${usage.value / capacity.value * 100}%`,
		background: tinycolor({
			h: 180 - (usage.value / capacity.value * 180),
			s: 0.7,
			l: 0.5,
		}),
	};
});

const keepOriginalUploading = computed(defaultStore.makeGetterSetter('keepOriginalUploading'));

os.api('drive').then(info => {
	capacity.value = info.capacity;
	usage.value = info.usage;
	fetching.value = false;
});

if (defaultStore.state.uploadFolder) {
	os.api('drive/folders/show', {
		folderId: defaultStore.state.uploadFolder,
	}).then(response => {
		uploadFolder.value = response;
	});
}

function chooseUploadFolder() {
	os.selectDriveFolder(false).then(async folder => {
		defaultStore.set('uploadFolder', folder ? folder.id : null);
		os.success();
		if (defaultStore.state.uploadFolder) {
			uploadFolder.value = await os.api('drive/folders/show', {
				folderId: defaultStore.state.uploadFolder,
			});
		} else {
			uploadFolder.value = null;
		}
	});
}

function saveProfile() {
	os.api('i/update', {
		alwaysMarkNsfw: !!alwaysMarkNsfw,
		autoSensitive: !!autoSensitive,
	});
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.drive,
	icon: 'ph-cloud-bold ph-lg',
});
</script>

<style lang="scss" scoped>

@use "sass:math";

.uawsfosz {

	> .meter {
		$size: 12px;
		background: rgba(0, 0, 0, 0.1);
		border-radius: math.div($size, 2);
		overflow: hidden;

		> div {
			height: $size;
			border-radius: math.div($size, 2);
		}
	}
}
</style>

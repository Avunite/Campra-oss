<template>
	<MkModalWindow
		ref="dialog"
		:width="400"
		:height="450"
		@close="cancel"
		@closed="emit('closed')"
	>
		<template #header>{{ i18n.ts.avatarDecorations }}</template>
	
		<div :class="$style.content">
			<div :class="$style.scrollable">
				<MkSpacer :marginMin="20" :marginMax="28">
					<div style="text-align: center;">
						<div :class="$style.name">{{ decoration.name }}</div>
						<MkAvatar 
							v-if="user" 
							style="width: 64px; height: 64px; margin-bottom: 20px;" 
							:user="user" 
							:decorations="[decorationForPreview]" 
							:disable-link="true"
							forceShowDecoration
						/>
					</div>
					<div class="_gaps_s">
						<MkRange 
							v-model="angle" 
							:min="-0.5" 
							:max="0.5" 
							:step="0.025" 
							:textConverter="(v) => `${Math.floor(v * 360)}°`"
							@input="updatePreview"
						>
							<template #label>{{ i18n.ts.angle }}</template>
						</MkRange>
						<MkRange 
							v-model="offsetX" 
							:min="-0.25" 
							:max="0.25" 
							:step="0.025" 
							:textConverter="(v) => `${Math.floor(v * 100)}%`"
							@input="updatePreview"
						>
							<template #label>X {{ i18n.ts.position }}</template>
						</MkRange>
						<MkRange 
							v-model="offsetY" 
							:min="-0.25" 
							:max="0.25" 
							:step="0.025" 
							:textConverter="(v) => `${Math.floor(v * 100)}%`"
							@input="updatePreview"
						>
							<template #label>Y {{ i18n.ts.position }}</template>
						</MkRange>
						<MkSwitch v-model="flipH" @update:modelValue="updatePreview">
							<template #label>{{ i18n.ts.flip }}</template>
						</MkSwitch>
					</div>
				</MkSpacer>
			</div>

			<div :class="$style.footer">
				<div :class="$style.buttonContainer">
					<template v-if="usingIndex != null">
						<MkButton primary rounded @click="update"><i class="ti ti-check"></i> {{ i18n.ts.save }}</MkButton>
						<MkButton rounded @click="detach"><i class="ti ti-x"></i> {{ i18n.ts.delete }}</MkButton>
					</template>
					<MkButton v-else :disabled="exceeded" primary rounded @click="attach"><i class="ti ti-check"></i> {{ i18n.ts.save }}</MkButton>
				</div>
			</div>
		</div>
	</MkModalWindow>
</template>

<script lang="ts" setup>
import { shallowRef, ref, computed, onMounted, watch } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkSwitch from '@/components/form/switch.vue';
import { i18n } from '@/i18n';
import MkRange from '@/components/form/range.vue';
import * as os from '@/os';
import { $i } from '@/account';

const props = defineProps<{
	usingIndex: number | null;
	decoration: {
		id: string;
		url: string;
		name: string;
	};
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const dialog = shallowRef<InstanceType<typeof MkModalWindow>>();
const user = ref(null);
const exceeded = computed(() => {
	if (!user.value || !user.value.policies) return false;
	return (user.value.policies.avatarDecorationLimit - (user.value.avatarDecorations?.length || 0)) <= 0;
});
const angle = ref(0);
const flipH = ref(false);
const offsetX = ref(0);
const offsetY = ref(0);

onMounted(async () => {
	try {
		const response = await os.api('i');
		user.value = response;
		if (props.usingIndex != null && user.value.avatarDecorations && user.value.avatarDecorations[props.usingIndex]) {
			const currentDecoration = user.value.avatarDecorations[props.usingIndex];
			angle.value = currentDecoration.angle ?? 0;
			flipH.value = currentDecoration.flipH ?? false;
			offsetX.value = currentDecoration.offsetX ?? 0;
			offsetY.value = currentDecoration.offsetY ?? 0;
		}
	} catch (error) {
		console.error('Error fetching user data:', error);
	}
});

const decorationForPreview = ref({
	id: props.decoration.id,
	url: props.decoration.url,
	angle: angle.value,
	flipH: flipH.value,
	offsetX: offsetX.value,
	offsetY: offsetY.value,
});

function updatePreview() {
	decorationForPreview.value = {
		...decorationForPreview.value,
		angle: angle.value,
		flipH: flipH.value,
		offsetX: offsetX.value,
		offsetY: offsetY.value,
	};
}

// Initial update and watch for changes
updatePreview();
watch([angle, flipH, offsetX, offsetY], updatePreview);

function cancel() {
	dialog.value?.close();
}

async function update() {
	if (!user.value || !user.value.avatarDecorations) return;
	const updatedDecorations = [...user.value.avatarDecorations];
	updatedDecorations[props.usingIndex] = decorationForPreview.value;
	
	try {
		await os.apiWithDialog('i/update', {
			avatarDecorations: updatedDecorations,
		});
		user.value.avatarDecorations = updatedDecorations;
		dialog.value?.close();
	} catch (error) {
		console.error('Error updating decoration:', error);
	}
}

async function attach() {
	if (!user.value || !user.value.avatarDecorations) return;
	const updatedDecorations = [...user.value.avatarDecorations, decorationForPreview.value];
	
	try {
		await os.apiWithDialog('i/update', {
			avatarDecorations: updatedDecorations,
		});
		user.value.avatarDecorations = updatedDecorations;
		dialog.value?.close();
	} catch (error) {
		console.error('Error attaching decoration:', error);
	}
}

async function detach() {
	if (!user.value || !user.value.avatarDecorations) return;
	const updatedDecorations = user.value.avatarDecorations.filter((_, index) => index !== props.usingIndex);
	
	try {
		await os.apiWithDialog('i/update', {
			avatarDecorations: updatedDecorations,
		});
		user.value.avatarDecorations = updatedDecorations;
		dialog.value?.close();
	} catch (error) {
		console.error('Error detaching decoration:', error);
	}
}
</script>

<style lang="scss" module>
.content {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.scrollable {
	flex-grow: 1;
	overflow-y: auto;
}

.name {
	position: relative;
	z-index: 10;
	font-weight: bold;
	margin-bottom: 28px;
}

.footer {
	flex-shrink: 0;
	padding: 12px;
	border-top: solid 0.5px var(--divider);
	-webkit-backdrop-filter: var(--blur, blur(15px));
	backdrop-filter: var(--blur, blur(15px));
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 60px;
}

.buttonContainer {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 8px;
	width: 100%;
}
</style>
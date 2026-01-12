<template>
	<MkStickyContainer>
		<template #header><MkPageHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs"/></template>
		<MkSpacer :content-max="700">
			<swiper
				:modules="[Virtual]"
				:space-between="20"
				:virtual="true"
				:allow-touch-move="!(deviceKind === 'desktop' && !defaultStore.state.swipeOnDesktop)"
				@swiper="setSwiperRef"
				@slideChange="onSlideChange"
			>
				<swiper-slide v-for="tabKey in tabs" :key="tabKey">
					<div v-if="tabKey === 'edit'" class="_formRoot">
						<MkInput v-model="name" class="_formBlock">
							<template #label>{{ i18n.ts._channel.name }}</template>
						</MkInput>
						<MkTextarea v-model="description" class="_formBlock">
							<template #label>{{ i18n.ts._channel.description }}</template>
						</MkTextarea>
						<div class="banner">
							<MkButton v-if="bannerId == null" @click="setBannerImage"><i class="ph-plus-bold ph-lg"></i> {{ i18n.ts._channel.setBanner }}</MkButton>
							<div v-else-if="bannerUrl">
								<img :src="bannerUrl" style="width: 100%;"/>
								<MkButton @click="removeBannerImage()"><i class="ph-trash-bold ph-lg"></i> {{ i18n.ts._channel.removeBanner }}</MkButton>
							</div>
						</div>
						<div class="_formBlock">
							<MkButton primary @click="save()"><i class="ph-floppy-disk-back-bold ph-lg"></i> {{ channelId ? i18n.ts._channel.save : i18n.ts._channel.create }}</MkButton>
						</div>
						<div v-if="channel" class="_formBlock">
							<MkButton v-if="!channel.isArchived" @click="archiveChannel"><i class="ph-archive-box-bold ph-lg"></i> {{ i18n.ts._channel.archive }}</MkButton>
							<MkButton v-else @click="unarchiveChannel"><i class="ph-archive-box-bold ph-lg"></i> {{ i18n.ts._channel.unarchive }}</MkButton>
						</div>
					</div>
					<div v-else-if="tabKey === 'admins'" class="_formRoot">
						<MkButton @click="openAddAdminDialog"><i class="ph-user-plus-bold ph-lg"></i> {{ i18n.ts._channel.addAdmin }}</MkButton>
						<div v-for="user in admins" :key="user.id" class="user-item">
							<span>{{ user.username }}</span>
							<MkButton @click="removeUserRole(user.id, 'admin')"><i class="ph-x-bold ph-lg"></i> {{ i18n.ts._channel.removeAdmin }}</MkButton>
						</div>
					</div>
					<div v-else-if="tabKey === 'mods'" class="_formRoot">
						<MkButton @click="openAddModDialog"><i class="ph-user-plus-bold ph-lg"></i> {{ i18n.ts._channel.addModerator }}</MkButton>
						<div v-for="user in moderators" :key="user.id" class="user-item">
							<span>{{ user.username }}</span>
							<MkButton @click="removeUserRole(user.id, 'moderator')"><i class="ph-x-bold ph-lg"></i> {{ i18n.ts._channel.removeModerator }}</MkButton>
						</div>
					</div>
					<div v-else-if="tabKey === 'bans'" class="_formRoot">
						<MkButton @click="openBanUserDialog"><i class="ph-prohibit-bold ph-lg"></i> {{ i18n.ts._channel.banUser }}</MkButton>
						<div v-for="user in bannedUsers" :key="user.id" class="user-item">
							<span>{{ user.username }}</span>
							<MkButton @click="unbanUser(user.id)"><i class="ph-check-bold ph-lg"></i> {{ i18n.ts._channel.unban }}</MkButton>
						</div>
					</div>
				</swiper-slide>
			</swiper>
		</MkSpacer>
	</MkStickyContainer>
	</template>
	
	<script lang="ts" setup>
	import { ref, computed, onMounted, watch } from 'vue';
	import { Virtual } from 'swiper';
	import { Swiper, SwiperSlide } from 'swiper/vue';
	import MkTextarea from '@/components/form/textarea.vue';
	import MkButton from '@/components/MkButton.vue';
	import MkInput from '@/components/form/input.vue';
	import { selectFile } from '@/scripts/select-file';
	import * as os from '@/os';
	import { useRouter } from '@/router';
	import { definePageMetadata } from '@/scripts/page-metadata';
	import { i18n } from '@/i18n';
	import { deviceKind } from '@/scripts/device-kind';
	import { defaultStore } from '@/store';
	import 'swiper/scss';
	import 'swiper/scss/virtual';
	
	const router = useRouter();
	const props = defineProps<{
		channelId?: string;
	}>();
	
	const tabs = ref(['edit', 'admins', 'mods', 'bans']);
	const tab = ref('edit');
	let swiperRef = $ref(null);
	let channel = $ref(null);
	let name = $ref(null);
	let description = $ref(null);
	let bannerUrl = $ref<string | null>(null);
	let bannerId = $ref<string | null>(null);
	let bannedUsers = $ref([]);
	let moderators = $ref([]);
	let admins = $ref([]);
	
	watch($$(tab), () => {
		if (swiperRef) {
			swiperRef.slideTo(tabs.value.indexOf(tab.value));
		}
	});
	
	onMounted(() => {
		fetchChannel();
		fetchBannedUsers();
		fetchModerators();
		fetchAdmins();
	});
	
	async function fetchChannel() {
		if (props.channelId == null) return;
		channel = await os.api('channels/show', { channelId: props.channelId });
		name = channel.name;
		description = channel.description;
		bannerId = channel.bannerId;
		bannerUrl = channel.bannerUrl;
	}
	
	async function fetchBannedUsers() {
		if (props.channelId == null) return;
		bannedUsers = await os.api('channels/ban-list', { channelId: props.channelId });
	}
	
	async function fetchModerators() {
		if (props.channelId == null) return;
		moderators = await os.api('channels/mod-list', { channelId: props.channelId });
	}
	
	async function fetchAdmins() {
		if (props.channelId == null) return;
		admins = await os.api('channels/admin-list', { channelId: props.channelId });
	}
	
	function save() {
		const params = {
			name: name,
			description: description,
			bannerId: bannerId,
		};
		if (props.channelId) {
			params.channelId = props.channelId;
			os.api('channels/update', params).then(() => {
				os.success();
				fetchChannel();
			});
		} else {
			os.api('channels/create', params).then(created => {
				os.success();
				router.push(`/channels/${created.id}`);
			});
		}
	}
	
	function setBannerImage(evt) {
		selectFile(evt.currentTarget ?? evt.target, null).then(file => {
			bannerId = file.id;
		});
	}
	
	function removeBannerImage() {
		bannerId = null;
	}
	
	async function openBanUserDialog() {
		const { canceled, result: userId } = await os.selectUser();
		if (canceled) return;
		await os.api('channels/ban-user', { channelId: props.channelId, userId });
		fetchBannedUsers();
	}
	
	async function unbanUser(userId) {
		await os.api('channels/unban-user', { channelId: props.channelId, userId });
		fetchBannedUsers();
	}
	
	async function openAddModDialog() {
		const { canceled, result: userId } = await os.selectUser();
		if (canceled) return;
		await os.api('channels/user-role-add', { channelId: props.channelId, userId, role: 'moderator' });
		fetchModerators();
	}
	
	async function openAddAdminDialog() {
		const { canceled, result: userId } = await os.selectUser();
		if (canceled) return;
		await os.api('channels/user-role-add', { channelId: props.channelId, userId, role: 'admin' });
		fetchAdmins();
	}
	
	async function removeUserRole(userId, role) {
		await os.api('channels/user-role-remove', { channelId: props.channelId, userId, role });
		if (role === 'moderator') fetchModerators();
		if (role === 'admin') fetchAdmins();
	}
	
	async function archiveChannel() {
		await os.api('channels/archive', { channelId: props.channelId });
		fetchChannel();
	}
	
	async function unarchiveChannel() {
		await os.api('channels/un-archive', { channelId: props.channelId });
		fetchChannel();
	}
	
	function setSwiperRef(swiper) {
		swiperRef = swiper;
		syncSlide(tabs.value.indexOf(tab.value));
	}
	
	function onSlideChange() {
		tab.value = tabs.value[swiperRef.activeIndex];
	}
	
	function syncSlide(index) {
		if (swiperRef) {
			swiperRef.slideTo(index);
		}
	}
	
	const headerActions = $computed(() => []);
	
	const headerTabs = $computed(() => [
		{
			key: 'edit',
			title: i18n.ts._channel.edit,
			icon: 'ph-pencil-bold ph-lg',
		},
		{
			key: 'admins',
			title: i18n.ts._channel.admins,
			icon: 'ph-user-gear-bold ph-lg',
		},
		{
			key: 'mods',
			title: i18n.ts._channel.moderators,
			icon: 'ph-shield-bold ph-lg',
		},
		{
			key: 'bans',
			title: i18n.ts._channel.bans,
			icon: 'ph-prohibit-bold ph-lg',
		},
	]);
	
	definePageMetadata(computed(() => props.channelId ? {
		title: i18n.ts._channel.edit,
		icon: 'ph-television-bold ph-lg',
	} : {
		title: i18n.ts._channel.create,
		icon: 'ph-television-bold ph-lg',
	}));
	</script>
	
	<style lang="scss" scoped>
	.user-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}
	</style>
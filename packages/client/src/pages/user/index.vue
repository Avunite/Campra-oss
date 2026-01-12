<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader
				v-model:tab="tab"
				:actions="headerActions"
				:tabs="headerTabs"
			/>
		</template>
		<div>
			<transition name="fade" mode="out-in">
				<div v-if="user">
					<XHome v-if="tab === 'home'" :user="user"/>
					<XReactions v-else-if="tab === 'reactions'" :user="user"/>
					<XClips v-else-if="tab === 'clips'" :user="user"/>
				</div>
				<MkError v-else-if="error" @retry="fetchUser()"/>
				<MkLoading v-else/>
			</transition>
		</div>
	</MkStickyContainer>
	</template>
	
	<script lang="ts" setup>
	import { defineAsyncComponent, computed, watch, onMounted, onUnmounted, ref, onActivated, onDeactivated } from 'vue';
	import calcAge from 's-age';
	import * as Acct from 'calckey-js/built/acct';
	import type * as misskey from 'calckey-js';
	import { getScrollPosition } from '@/scripts/scroll';
	import number from '@/filters/number';
	import { userPage, acct as getAcct } from '@/filters/user';
	import * as os from '@/os';
	import { useRouter } from '@/router';
	import { definePageMetadata } from '@/scripts/page-metadata';
	import { i18n } from '@/i18n';
	import { $i } from '@/account';
	import { defaultStore } from '@/store';
	
	const XHome = defineAsyncComponent(() => import('./home.vue'));
	const XReactions = defineAsyncComponent(() => import('./reactions.vue'));
	const XClips = defineAsyncComponent(() => import('./clips.vue'));
	const XPages = defineAsyncComponent(() => import('./pages.vue'));
	const XGallery = defineAsyncComponent(() => import('./gallery.vue'));
	
	const props = withDefaults(
		defineProps<{
			acct: string;
			page?: string;
		}>(),
		{
			page: 'home',
		},
	);
	
	const router = useRouter();
	
	const tab = ref(props.page);
	const user = ref<null | (misskey.entities.UserDetailed & { isPlus?: boolean; profileCss?: string })>(null);
	const error = ref(null);
	const customStyleElement = ref<HTMLStyleElement | null>(null);
	const isActive = ref(true);
	
	function fetchUser(): void {
		console.log('fetchUser - renderProfileCSS:', defaultStore.state.renderProfileCSS);
		if (props.acct == null) return;
		user.value = null;
		os.api('users/show', Acct.parse(props.acct))
			.then((u) => {
				user.value = u;
				if (isActive.value) {
					updateCustomCSS();
				}
			})
			.catch((err) => {
				error.value = err;
			});
	}
	
	function updateCustomCSS() {
		console.log('updateCustomCSS - renderProfileCSS:', defaultStore.state.renderProfileCSS);
		if (shouldRenderCSS()) {
			console.log('Applying custom CSS');
			applyCustomCSS();
		} else {
			console.log('Removing custom CSS');
			removeCustomCSS();
		}
	}
	
	function applyCustomCSS() {
		console.log('applyCustomCSS - renderProfileCSS:', defaultStore.state.renderProfileCSS);
		removeCustomCSS(); // Ensure we don't have duplicate style elements
		if (user.value?.profileCss) {
			customStyleElement.value = document.createElement('style');
			customStyleElement.value.setAttribute('data-user-css', user.value.id);
			customStyleElement.value.textContent = user.value.profileCss;
			document.head.appendChild(customStyleElement.value);
			console.log('Custom CSS applied');
		}
	}
	
	function removeCustomCSS() {
		console.log('removeCustomCSS - renderProfileCSS:', defaultStore.state.renderProfileCSS);
		if (customStyleElement.value) {
			document.head.removeChild(customStyleElement.value);
			customStyleElement.value = null;
			console.log('Custom CSS removed');
		}
	}
	
	function shouldRenderCSS(): boolean {
		console.log('shouldRenderCSS - renderProfileCSS:', defaultStore.state.renderProfileCSS);
		const should = !!(
			user.value?.isPlus &&
			user.value.profileCss &&
			isActive.value &&
			defaultStore.state.renderProfileCSS
		);
		console.log('Should render CSS:', should);
		return should;
	}
	
	watch(() => props.acct, (newAcct, oldAcct) => {
		console.log('acct watcher - renderProfileCSS:', defaultStore.state.renderProfileCSS);
		if (newAcct !== oldAcct) {
			fetchUser();
		}
	}, { immediate: true });
	
	watch(user, () => {
		console.log('user watcher - renderProfileCSS:', defaultStore.state.renderProfileCSS);
		if (isActive.value) {
			updateCustomCSS();
		}
	}, { deep: true });
	
	watch(() => defaultStore.state.renderProfileCSS, (newValue) => {
		console.log('renderProfileCSS watcher - new value:', newValue);
		updateCustomCSS();
	});
	
	watch(() => router.currentRoute.value.path, (newPath) => {
		console.log('route watcher - renderProfileCSS:', defaultStore.state.renderProfileCSS);
		if (!newPath.startsWith('/@')) {
			removeCustomCSS();
		}
	});
	
	onMounted(() => {
		console.log('onMounted - renderProfileCSS:', defaultStore.state.renderProfileCSS);
		if (router.currentRoute.value.path.startsWith('/@')) {
			fetchUser();
		}
	});
	
	onUnmounted(() => {
		console.log('onUnmounted - renderProfileCSS:', defaultStore.state.renderProfileCSS);
		removeCustomCSS();
	});
	
	onActivated(() => {
		console.log('onActivated - renderProfileCSS:', defaultStore.state.renderProfileCSS);
		isActive.value = true;
		updateCustomCSS();
	});
	
	onDeactivated(() => {
		console.log('onDeactivated - renderProfileCSS:', defaultStore.state.renderProfileCSS);
		isActive.value = false;
		removeCustomCSS();
	});
	
	const headerActions = computed(() => []);
	
	const headerTabs = computed(() =>
		user.value
			? [
				{
					key: 'home',
					title: i18n.ts.overview,
					icon: 'ph-user-bold ph-lg',
				},
				...(($i && $i.id === user.value.id) || user.value.publicReactions
					? [{
						key: 'reactions',
						title: i18n.ts.reaction,
						icon: 'ph-smiley-bold ph-lg',
					}] : []),
				...(user.value.instance == null ? [{
					key: 'clips',
					title: i18n.ts.clips,
					icon: 'ph-paperclip-bold ph-lg',
				}] : []),
			]
			: null,
	);
	
	definePageMetadata(
		computed(() =>
			user.value
				? {
					icon: 'ph-user-bold ph-lg',
					title: user.value.name
						? `${user.value.name} (@${user.value.username})`
						: `@${user.value.username}`,
					subtitle: `@${getAcct(user.value)}`,
					userName: user.value,
					avatar: user.value,
					path: `/@${user.value.username}`,
					share: {
						title: user.value.name,
					},
				}
				: null,
		),
	);
	</script>
	
	<style lang="scss" scoped>
	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.125s ease;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}
	</style>
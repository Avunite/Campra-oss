<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader :actions="headerActions" :tabs="headerTabs" />
		</template>
		<MkSpacer :content-max="900" :margin-min="20" :margin-max="32">
			<div ref="el" class="school-admin-index" :class="{ wide: !narrow }">
				<div class="body">
					<div v-if="!narrow || currentPage?.route.name == null" class="nav">
						<div class="nav-content">
							<div class="banner">
								<i class="ph-graduation-cap-bold ph-lg icon"></i>
							</div>

							<MkInfo v-if="$i && !$i.isSchoolAdmin" warn class="info">{{
								i18n.ts.schoolAdminAccessRequired }}
							</MkInfo>
							<MkInfo v-if="$i && $i.isSchoolAdmin && !$i.adminForSchoolId" warn class="info">{{
								i18n.ts.schoolAdminAccessRequired }} - No school assigned</MkInfo>

							<MkSuperMenu :def="menuDef" :grid="currentPage?.route.name == null"></MkSuperMenu>
						</div>
					</div>
					<div v-if="!(narrow && currentPage?.route.name == null)" class="main">
						<div class="main-content">
							<RouterView />
						</div>
					</div>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import { i18n } from '@/i18n';
import MkSuperMenu from '@/components/MkSuperMenu.vue';
import MkInfo from '@/components/MkInfo.vue';
import { $i } from '@/account'
import { useRouter } from '@/router';
import { definePageMetadata, provideMetadataReceiver } from '@/scripts/page-metadata';

const router = useRouter();

const indexInfo = {
	title: i18n.ts.schoolAdministration,
	icon: 'ph-graduation-cap-bold ph-lg',
	hideHeader: true,
};

provide('shouldOmitHeaderTitle', false);

const narrow = ref(false);
const el = ref<HTMLElement>();
const currentPage = computed(() => router.currentRef.value.child);

const NARROW_THRESHOLD = 600;
const ro = new ResizeObserver((entries, observer) => {
	if (entries.length === 0) return;
	narrow.value = entries[0].borderBoxSize[0].inlineSize < NARROW_THRESHOLD;
});

const menuDef = computed(() => [{
	title: i18n.ts.schoolManagement || 'School Management',
	items: [{
		icon: 'ph-gauge-bold ph-lg',
		text: i18n.ts.dashboard,
		to: '/school-admin/dashboard',
		active: currentPage.value?.route.name === 'school-admin-dashboard',
	}, {
		icon: 'ph-users-bold ph-lg',
		text: i18n.ts.students,
		to: '/school-admin/students',
		active: currentPage.value?.route.name === 'school-admin-students',
	}, {
		icon: 'ph-chalkboard-teacher-bold ph-lg',
		text: i18n.ts.teachers || 'Staff',
		to: '/school-admin/teachers',
		active: currentPage.value?.route.name === 'school-admin-teachers',
	}, {
		icon: 'ph-shield-warning-bold ph-lg',
		text: i18n.ts.moderation || 'Moderation',
		to: '/school-admin/moderation',
		active: currentPage.value?.route.name === 'school-admin-moderation',
	}, {
		icon: 'ph-credit-card-bold ph-lg',
		text: i18n.ts.billing || 'Billing',
		to: '/school-admin/billing',
		active: currentPage.value?.route.name === 'school-admin-billing',
	}, {
		icon: 'ph-gear-bold ph-lg',
		text: i18n.ts.settings || 'Settings',
		to: '/school-admin/settings',
		active: currentPage.value?.route.name === 'school-admin-settings',
	}],
}]);

watch(narrow, () => {
	if (currentPage.value?.route.name == null && !narrow.value) {
		if ($i && $i.isSchoolAdmin && $i.adminForSchoolId) {
			router.push('/school-admin/dashboard');
		}
	}
});

onMounted(() => {
	if (el.value) {
		ro.observe(el.value);
		narrow.value = el.value.offsetWidth < NARROW_THRESHOLD;
	}

	// Redirect to dashboard if no specific page and not narrow
	if (currentPage.value?.route.name == null && !narrow.value) {
		if ($i && $i.isSchoolAdmin && $i.adminForSchoolId) {
			router.push('/school-admin/dashboard');
		}
	}
});

onUnmounted(() => {
	ro.disconnect();
});

const headerActions = computed(() => []);
const headerTabs = computed(() => []);

provideMetadataReceiver((info) => {
	// Handle metadata updates
});

definePageMetadata(indexInfo);

defineExpose({
	header: {
		title: i18n.ts.schoolAdministration,
	},
});
</script>

<style lang="scss" scoped>
.school-admin-index {
	>.body {
		>.nav {
			.nav-content {
				>.info {
					margin: 16px 0;
				}

				>.banner {
					margin: 16px;
					text-align: center;

					>.icon {
						display: block;
						margin: auto;
						font-size: 42px;
						color: var(--accent);
					}
				}
			}
		}

		>.main {
			.main-content {
				// Main content styles
			}
		}
	}

	&.wide {
		>.body {
			display: flex;
			height: 100%;

			>.nav {
				width: 34%;
				padding-right: 32px;
				box-sizing: border-box;
			}

			>.main {
				flex: 1;
				min-width: 0;
			}
		}
	}
}
</style>

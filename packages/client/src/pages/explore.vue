<template>
	<MkStickyContainer>
	  <template #header>
		<MkPageHeader :actions="headerActions"/>
	  </template>
	  <MkSpacer :content-max="800">
		<MkInput v-model="searchQuery" :debounce="true" type="search" class="_formBlock">
		  <template #prefix><i class="ph-magnifying-glass-bold ph-lg"></i></template>
		  <template #label>{{ i18n.ts.search }}</template>
		</MkInput>
  
		<template v-if="!searchQuery">
		  <div v-if="trends && trends.length > 0">
			<h3>{{ i18n.ts._widgets.trends }}</h3>
			<Trending :show-header="false" style="max-height: 195px"/>
		  </div>
		  <MkTab v-if="isLoggedIn" v-model="contentTab" style="margin-bottom: var(--margin);">
			<option value="notes">{{ i18n.ts.notes }}</option>
			<option value="polls">{{ i18n.ts.poll }}</option>
		  </MkTab>
		  <XNotes v-if="contentTab === 'notes'" :pagination="paginationForNotes"/>
		  <XNotes v-else-if="contentTab === 'polls'" :pagination="paginationForPolls"/>
		</template>
  
		<template v-else>
		  <HorizontalUserList :users="searchUsers" :title="i18n.ts.users"/>
		  <HorizontalChannelList :channels="searchChannels" :title="i18n.ts.channel"/>
		  <XNotes :pagination="searchNotes"/>
		</template>
	  </MkSpacer>
	</MkStickyContainer>
  </template>
  
  <script lang="ts" setup>
  import { ref, computed, watch, onMounted } from 'vue';
  import { $i } from '@/account';
  import XNotes from '@/components/MkNotes.vue';
  import MkTab from '@/components/MkTab.vue';
  import MkInput from '@/components/form/input.vue';
  import Trending from '@/widgets/trends.vue';
  import HorizontalUserList from '@/components/BkHorizontalUserList.vue';
  import HorizontalChannelList from '@/components/BkHorizontalChannelList.vue';
  import { i18n } from '@/i18n';
  import * as os from '@/os';
  import { definePageMetadata } from '@/scripts/page-metadata';
  
  const tab = ref('featured');
  const contentTab = ref('notes');
  const trends = ref(null);
  const popularUsers = ref([]);
  const searchQuery = ref('');
  const searchUsers = ref([]);
  const searchChannels = ref([]);
  
  const paginationForNotes = {
	endpoint: 'notes/featured' as const,
	limit: 10,
	offsetMode: true,
  };
  
  const paginationForPolls = {
	endpoint: 'notes/polls/recommendation' as const,
	limit: 10,
	offsetMode: true,
  };
  
  const searchNotes = computed(() => ({
	endpoint: 'notes/search' as const,
	limit: 10,
	params: {
	  query: searchQuery.value,
	},
  }));
  
  const isLoggedIn = computed(() => !!$i);
  const headerActions = [];
  const headerTabs = [{
	key: 'featured',
	icon: 'ph-lightning-bold ph-lg',
	title: i18n.ts.featured,
  }, {
	key: 'users',
	icon: 'ph-users-bold ph-lg',
	title: i18n.ts.users,
  }, {
	key: 'search',
	icon: 'ph-magnifying-glass-bold ph-lg',
	title: i18n.ts.search,
  }];
  
  watch(searchQuery, async (newQuery) => {
	if (newQuery) {
	  try {
		const [users, channels] = await Promise.all([
		  os.api('users/search', { query: newQuery, limit: 10 }),
		  os.api('channels/search', { query: newQuery, limit: 10 }),
		]);
		searchUsers.value = users;
		searchChannels.value = channels;
	  } catch (error) {
		console.error('Failed to fetch search results:', error);
	  }
	} else {
	  searchUsers.value = [];
	  searchChannels.value = [];
	}
  });
  
  onMounted(async () => {
	try {
	  const [trendData, userData] = await Promise.all([
		os.api('hashtags/trend'),
		os.api('users', {
		  limit: 10,
		  sort: '+follower',
		  state: 'alive',
		  origin: 'local',
		}),
	  ]);
	  trends.value = trendData.length > 0 ? trendData : null;
	  popularUsers.value = userData;
	} catch (error) {
	  console.error('Failed to fetch initial data:', error);
	}
  });
  
  definePageMetadata(computed(() => ({
	title: i18n.ts.explore,
	icon: 'ph-hash-bold ph-lg',
  })));
  </script>
  
  <style lang="scss" scoped>
  /* Add any necessary styles here */
  </style>
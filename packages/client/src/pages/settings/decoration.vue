<template>
  <div>
    <div v-if="!loading" class="_gaps">
      <div :class="$style.avatarContainer">
        <MkAvatar :class="$style.avatar"
        :user="$i"
        :disable-link="true"
        forceShowDecoration/>
      </div>

      <div v-if="$i.avatarDecorations && $i.avatarDecorations.length > 0" v-panel :class="$style.current" class="_gaps_s">
        <div>{{ i18n.ts.inUse }}</div>

        <div :class="$style.decorations">
          <XDecoration
            v-for="(decoration, i) in $i.avatarDecorations"
            :key="decoration.id"
            :decoration="availableDecorations.find(d => d.id === decoration.id)"
            :angle="decoration.angle"
            :flipH="decoration.flipH"
            :offsetX="decoration.offsetX"
            :offsetY="decoration.offsetY"
            :active="true"
            :userIsPlus="$i.isPlus"
            :userIsMPlus="$i.isMPlus"
            @click="openDecoration(decoration, i)"
          />
        </div>

        <MkButton danger @click="detachAllDecorations" :class="$style.detachButton">{{ i18n.ts.detachAll }}</MkButton>
      </div>

      <div v-for="category in sortedCategories" :key="category">
        <FormFolder :default-open="false" class="_formBlock">
          <template #icon><i class="ph-sparkle-bold ph-lg"></i></template>
          <template #label>{{ category }}</template>

          <div :class="$style.decorations">
            <div v-for="decoration in getSortedDecorations(category)" :key="decoration.id" class="decoration-wrapper">
              <XDecoration
                :decoration="decoration"
                :userIsPlus="$i.isPlus"
                :userIsMPlus="$i.isMPlus"
                @click="openDecoration(decoration)"
              />
              <div v-if="decoration.creditUname" :class="$style.creditName">
                <Mfm :text="i18n.ts.credit + ': @' + decoration.creditUname" :author="$i" :i="$i"/>
              </div>
            </div>
          </div>
        </FormFolder>
      </div>
    </div>
    <div v-else>
      <MkLoading/>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, defineAsyncComponent, computed } from 'vue';
import * as Misskey from 'calckey-js';
import XDecoration from './avatar-decoration.decoration.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import MkInfo from '@/components/MkInfo.vue';
import { definePageMetadata } from '@/scripts/page-metadata.js';
import { $i } from '@/account';
import FormFolder from '@/components/form/folder.vue';

const loading = ref(true);
const availableDecorations = ref([]);

const decorationsByCategory = computed(() => {
  const grouped = {};
  availableDecorations.value.forEach(decoration => {
    const category = decoration.category || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(decoration);
  });
  return grouped;
});

const sortedCategories = computed(() => {
  const categories = Object.keys(decorationsByCategory.value);
  return categories.sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });
});

function getSortedDecorations(category) {
  return decorationsByCategory.value[category].sort((a, b) => {
    // First sort by MPlus status
    if (a.isMPlus && !b.isMPlus) return -1;
    if (!a.isMPlus && b.isMPlus) return 1;
    
    // Then sort by Plus status
    if (a.isPlus && !b.isPlus) return -1;
    if (!a.isPlus && b.isPlus) return 1;
    
    // Finally sort alphabetically by name
    return a.name.localeCompare(b.name);
  });
}

os.api('decorations', { detail: false }).then(decorations => {
  availableDecorations.value = decorations || [];
  loading.value = false;
});

function openDecoration(decoration, index?: number) {
  // Check if user has access to the decoration
  const canUseDecoration = 
    (!decoration.isPlus && !decoration.isMPlus) || // Free decoration
    ($i.isPlus) || // Plus users can use all decorations
    ($i.isMPlus && !decoration.isPlus); // MPlus users can use free and MPlus decorations, but not Plus

  if (!canUseDecoration) return;

  const { dispose } = os.popup(defineAsyncComponent(() => import('./avatar-decoration.dialog.vue')), {
    decoration: decoration,
    usingIndex: index,
  }, {
    'attach': async (payload) => {
      const newDecoration = {
        id: decoration.id,
        angle: payload.angle,
        flipH: payload.flipH,
        offsetX: payload.offsetX,
        offsetY: payload.offsetY,
      };
      const update = [...($i.avatarDecorations || []), newDecoration];
      await os.apiWithDialog('i/update', {
        avatarDecorations: update,
      });
      $i.avatarDecorations = update;
    },
    'update': async (payload) => {
      if (!$i.avatarDecorations) return;
      const updatedDecoration = {
        id: decoration.id,
        angle: payload.angle,
        flipH: payload.flipH,
        offsetX: payload.offsetX,
        offsetY: payload.offsetY,
      };
      const update = [...$i.avatarDecorations];
      update[index] = updatedDecoration;
      await os.apiWithDialog('i/update', {
        avatarDecorations: update,
      });
      $i.avatarDecorations = update;
    },
    'detach': async () => {
      if (!$i.avatarDecorations) return;
      const update = [...$i.avatarDecorations];
      update.splice(index, 1);
      await os.apiWithDialog('i/update', {
        avatarDecorations: update,
      });
      $i.avatarDecorations = update;
    },
    closed: () => dispose(),
  });
}

function detachAllDecorations() {
  os.confirm({
    type: 'warning',
    text: i18n.ts.resetAllDecos,
  }).then(async ({ canceled }) => {
    if (canceled) return;
    await os.apiWithDialog('i/update', {
      avatarDecorations: [],
    });
    $i.avatarDecorations = [];
  });
}

const headerActions = computed(() => []);
const headerTabs = computed(() => []);

definePageMetadata(() => ({
  title: i18n.ts.avatarDecorations,
  icon: 'ph-sparkle-bold ph-lg',
}));
</script>

<style lang="scss" module>
.avatarContainer {
  display: flex;
  justify-content: center;
  width: 100%;
  margin: 16px 0;
}

.avatar {
  width: 132px;
  height: 132px;
}

.current {
  padding: 16px;
  border-radius: var(--radius);
}

.decorations {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  grid-gap: 12px;
  margin-top: 16px;
}

.creditName {
  text-align: center;
  margin-top: 4px;
  font-size: 0.9em;
  color: var(--fg);
  opacity: 0.8;
}

.decoration-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
<template>
    <div class="gqvgzcve" :style="{ maxHeight: maxHeight ? maxHeight + 'px' : undefined }">
      <input
        v-model.trim="searchQuery"
        class="search"
        :placeholder="i18n.ts.search"
        type="search"
        @keyup.enter="searchGifs"
      >
      <div class="gifs">
        <div v-if="loading" class="loading">{{ i18n.ts.loading }}</div>
        <div v-else-if="gifs.length === 0" class="empty">{{ i18n.ts.noGifsFound }}</div>
        <div class="waterfall">
          <div class="column">
            <button
              v-for="gif in leftColumnGifs"
              :key="gif.id"
              class="gif"
              @click="chosen(gif)"
            >
              <img :src="gif.media_formats.tinygif.url" :alt="gif.title">
            </button>
          </div>
          <div class="column">
            <button
              v-for="gif in rightColumnGifs"
              :key="gif.id"
              class="gif"
              @click="chosen(gif)"
            >
              <img :src="gif.media_formats.tinygif.url" :alt="gif.title">
            </button>
          </div>
        </div>
      </div>
      <div class="footer">
        <span>{{ i18n.ts.poweredBy }}</span>
        <a href="https://tenor.com" target="_blank" rel="noopener noreferrer">Tenor</a>
      </div>
    </div>
  </template>
  
  <script lang="ts" setup>
  import { ref, onMounted, watch, computed } from 'vue';
  import * as Misskey from 'calckey-js';
  import * as os from '@/os';
  import { i18n } from '@/i18n';
  import { defaultStore } from '@/store';
  import { uploadFile } from '@/scripts/upload';
  
  const props = defineProps<{
    maxHeight?: number;
    maxWidth?: number;
  }>();
  
  const emit = defineEmits<{
    (ev: 'chosen', v: Misskey.entities.DriveFile): void;
  }>();
  
  const searchQuery = ref('');
  const gifs = ref([]);
  const loading = ref(false);
  
  const leftColumnGifs = computed(() => gifs.value.filter((_, index) => index % 2 === 0));
  const rightColumnGifs = computed(() => gifs.value.filter((_, index) => index % 2 !== 0));
  
  async function fetchGifs(endpoint: 'gifs/search' | 'gifs/popular', params: object = {}) {
    loading.value = true;
    try {
      const response = await os.api(endpoint, params);
      gifs.value = response;
    } catch (error) {
      os.alert({
        type: 'error',
        text: i18n.ts.failedToFetchGifs,
      });
    }
    loading.value = false;
  }
  
  async function searchGifs() {
    if (searchQuery.value.trim() === '') {
      await fetchPopularGifs();
    } else {
      await fetchGifs('gifs/search', { query: searchQuery.value, limit: 50 });
    }
  }
  
  async function fetchPopularGifs() {
    await fetchGifs('gifs/popular', { limit: 50 });
  }
  
  async function chosen(gif: any) {
    try {
      loading.value = true;
      const response = await fetch(gif.media_formats.gif.url);
      const blob = await response.blob();
      const file = new File([blob], `${gif.title || 'untitled'}.gif`, { type: 'image/gif' });
      const altText = `${gif.content_description || "Powered by Tenor"}`;
  
      const driveFile = await uploadFile(file, defaultStore.state.uploadFolder, altText);
      emit('chosen', driveFile);
    } catch (error) {
      console.error('Error uploading GIF:', error);
      os.alert({
        type: 'error',
        text: i18n.ts.failedToUploadGif,
      });
    } finally {
      loading.value = false;
    }
  }
  
  function reset() {
    searchQuery.value = '';
    fetchPopularGifs();
  }
  
  function focus() {
    const searchInput = document.querySelector('.gqvgzcve .search') as HTMLInputElement;
    if (searchInput) searchInput.focus();
  }
  
  onMounted(() => {
    fetchPopularGifs();
  });
  
  watch(searchQuery, (newQuery, oldQuery) => {
    if (newQuery.trim() === '') {
      fetchPopularGifs();
    }
  });
  
  defineExpose({
    reset,
    focus,
  });
  </script>
  
  <style lang="scss" scoped>
  .gqvgzcve {
    display: flex;
    flex-direction: column;
    height: 100%;
  
    > .search {
      width: 100%;
      padding: 10px;
      margin-bottom: 10px;
      box-sizing: border-box;
      font-size: 16px;
      border: none;
      border-bottom: solid 1px var(--divider);
      background: transparent;
      color: var(--fg);
    }
  
    > .gifs {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
  
      > .loading,
      > .empty {
        text-align: center;
        padding: 20px;
      }
  
      > .waterfall {
        display: flex;
        gap: 10px;
  
        > .column {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
  
          > .gif {
            width: 100%;
            padding: 0;
            border: none;
            background: none;
            cursor: pointer;
            border-radius: 8px;
            overflow: hidden;
  
            &:hover {
              opacity: 0.8;
            }
  
            > img {
              width: 100%;
              height: auto;
              object-fit: cover;
              border-radius: 8px;
            }
          }
        }
      }
    }
  
    > .footer {
      padding: 10px;
      text-align: center;
      font-size: 12px;
      opacity: 0.7;
  
      > a {
        color: inherit;
        text-decoration: none;
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
  </style>
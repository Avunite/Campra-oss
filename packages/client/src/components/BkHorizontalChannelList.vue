<template>
    <div class="horizontal-channel-list" v-if="channels.length > 0">
      <h3>{{ title }}</h3>
      <div class="channel-scroll">
        <div v-for="channel in channels" :key="channel.id" class="channel">
          <MkChannelPreview :channel="channel" />
        </div>
      </div>
    </div>
  </template>
  
  <script lang="ts" setup>
  import MkChannelPreview from '@/components/MkChannelPreview.vue';
  
  defineProps<{
    channels: any[]
    title: string
  }>();
  </script>
  
  <style lang="scss" scoped>
  .horizontal-channel-list {
    margin-bottom: var(--margin);
  
    h3 {
      margin-bottom: 0.5em;
    }
  
    .channel-scroll {
      display: flex;
      overflow-x: auto;
      gap: 1rem;
      padding-bottom: 0.5rem;
  
      &::-webkit-scrollbar {
        height: 4px;
      }
  
      &::-webkit-scrollbar-thumb {
        background-color: var(--scrollbarThumb);
        border-radius: 4px;
      }
  
      &::-webkit-scrollbar-track {
        background-color: var(--scrollbarTrack);
      }
  
      .channel {
        flex: 0 0 auto;
        width: 200px;
      }
    }
  }
  </style>
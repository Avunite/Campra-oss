<template>
    <div class="mk-avatar-decorations">
      <img
        v-for="decoration in decorations"
        :key="decoration.id"
        class="decoration"
        :src="getDecorationUrl(decoration)"
        :style="{
          rotate: getDecorationAngle(decoration),
          scale: getDecorationScale(decoration),
          translate: getDecorationOffset(decoration),
        }"
        alt=""
      >
    </div>
  </template>
  
  <script lang="ts" setup>
  import { computed } from 'vue';
  import * as misskey from 'calckey-js';
  import { getStaticImageUrl } from '@/scripts/get-static-image-url';
  import { defaultStore } from '@/store';
  
  const props = defineProps<{
    user: misskey.entities.User;
    dontShowDeco?: boolean;
  }>();
  
  const decorations = computed(() => {
    if (props.dontShowDeco) return [];
    return props.user.avatarDecorations || [];
  });
  
  function getDecorationUrl(decoration: misskey.entities.UserDetailed['avatarDecorations'][number]) {
    if (defaultStore.state.disableShowingAnimatedImages) return getStaticImageUrl(decoration.url);
    return decoration.url;
  }
  
  function getDecorationAngle(decoration: misskey.entities.UserDetailed['avatarDecorations'][number]) {
    const angle = decoration.angle ?? 0;
    return angle === 0 ? undefined : `${angle * 360}deg`;
  }
  
  function getDecorationScale(decoration: misskey.entities.UserDetailed['avatarDecorations'][number]) {
    const scaleX = decoration.flipH ? -1 : 1;
    return scaleX === 1 ? undefined : `${scaleX} 1`;
  }
  
  function getDecorationOffset(decoration: misskey.entities.UserDetailed['avatarDecorations'][number]) {
    const offsetX = decoration.offsetX ?? 0;
    const offsetY = decoration.offsetY ?? 0;
    return offsetX === 0 && offsetY === 0 ? undefined : `${offsetX * 100}% ${offsetY * 100}%`;
  }
  </script>
  
  <style lang="scss" scoped>
  .mk-avatar-decorations {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
  
    .decoration {
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
    }
  }
  </style>
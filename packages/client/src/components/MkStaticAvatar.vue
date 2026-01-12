<template>
    <div
      class="mk-static-avatar"
      :class="{ cat: user.isCat, square: $store.state.squareAvatars }"
      :style="{ color }"
    >
      <img class="inner" :src="url" decoding="async" alt="User avatar"/>
      <img
        v-for="decoration in decorationsToShow"
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
  import { computed, watch, ref } from 'vue';
  import * as misskey from 'calckey-js';
  import { getStaticImageUrl } from '@/scripts/get-static-image-url';
  import { extractAvgColorFromBlurhash } from '@/scripts/extract-avg-color-from-blurhash';
  import { defaultStore } from '@/store';
  
  const props = defineProps<{
    user: misskey.entities.User;
    decorations?: misskey.entities.UserDetailed['avatarDecorations'];
    disableDecorations?: boolean;
  }>();
  
  const url = computed(() => defaultStore.state.disableShowingAnimatedImages
    ? getStaticImageUrl(props.user.avatarUrl)
    : props.user.avatarUrl);
  
  const decorationsToShow = computed(() => {
    if (props.disableDecorations) return [];
    if (props.decorations) return props.decorations;
    return props.user.avatarDecorations || [];
  });
  
  function getDecorationUrl(decoration: misskey.entities.UserDetailed['avatarDecorations'][number]) {
    if (!decoration || !decoration.url) return '';
    return defaultStore.state.disableShowingAnimatedImages
      ? getStaticImageUrl(decoration.url)
      : decoration.url;
  }
  
  function getDecorationAngle(decoration: misskey.entities.UserDetailed['avatarDecorations'][number]) {
    const angle = decoration?.angle ?? 0;
    return angle === 0 ? undefined : `${angle * 360}deg`;
  }
  
  function getDecorationScale(decoration: misskey.entities.UserDetailed['avatarDecorations'][number]) {
    const scaleX = decoration?.flipH ? -1 : 1;
    return scaleX === 1 ? undefined : `${scaleX} 1`;
  }
  
  function getDecorationOffset(decoration: misskey.entities.UserDetailed['avatarDecorations'][number]) {
    const offsetX = decoration?.offsetX ?? 0;
    const offsetY = decoration?.offsetY ?? 0;
    return offsetX === 0 && offsetY === 0 ? undefined : `${offsetX * 100}% ${offsetY * 100}%`;
  }
  
  const color = ref();
  
  watch(() => props.user.avatarBlurhash, () => {
    color.value = extractAvgColorFromBlurhash(props.user.avatarBlurhash);
  }, {
    immediate: true,
  });
  </script>
  
  <style lang="scss" scoped>
  .mk-static-avatar {
    position: relative;
    display: inline-block;
    vertical-align: bottom;
    flex-shrink: 0;
    border-radius: 100%;
    line-height: 16px;
    pointer-events: none;
  
    > .inner {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      top: 0;
      border-radius: 100%;
      z-index: 1;
      overflow: hidden;
      object-fit: cover;
      width: 100%;
      height: 100%;
    }
  
    > .decoration {
      position: absolute;
      z-index: 2;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      pointer-events: none;
      object-fit: contain;
    }
  
    &.square {
      border-radius: 20%;
      > .inner {
        border-radius: 20%;
      }
    }
  
    &.cat {
      &:before, &:after {
        background: #ebbcba;
        border: solid 4px currentColor;
        box-sizing: border-box;
        content: '';
        display: inline-block;
        height: 50%;
        width: 50%;
        pointer-events: none;
      }
  
      &:before {
        border-radius: 0 75% 75%;
        transform: rotate(37.5deg) skew(30deg);
      }
  
      &:after {
        border-radius: 75% 0 75% 75%;
        transform: rotate(-37.5deg) skew(-30deg);
      }
    }
  }
  </style>
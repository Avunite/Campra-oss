<template>
	<span v-if="disableLink" v-user-preview="disablePreview ? undefined : user.id" class="eiwwqkts _noSelect" :class="{ cat: user.isCat, square: $store.state.squareAvatars, live: user.isLive }" :style="{ color }" :title="acct(user)" @click="onClick">
	  <img class="inner" :src="url" decoding="async"/>
	  <MkUserOnlineIndicator v-if="showIndicator" class="indicator" :user="user"/>
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
	</span>
	<MkA v-else v-user-preview="disablePreview ? undefined : user.id" class="eiwwqkts _noSelect" :class="{ cat: user.isCat, square: $store.state.squareAvatars, live: user.isLive }" :style="{ color }" :to="userPage(user)" :title="acct(user)" :target="target">
	  <img class="inner" :src="url" decoding="async"/>
	  <MkUserOnlineIndicator v-if="showIndicator" class="indicator" :user="user"/>
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
	</MkA>
  </template>
  
  <script lang="ts" setup>
  import { computed, watch, onMounted } from 'vue';
  import * as misskey from 'calckey-js';
  import { getStaticImageUrl } from '@/scripts/get-static-image-url';
  import { extractAvgColorFromBlurhash } from '@/scripts/extract-avg-color-from-blurhash';
  import { acct, userPage } from '@/filters/user';
  import MkUserOnlineIndicator from '@/components/MkUserOnlineIndicator.vue';
  import { defaultStore } from '@/store';
  
  const props = withDefaults(defineProps<{
	user: misskey.entities.User;
	target?: string | null;
	disableLink?: boolean;
	disablePreview?: boolean;
	showIndicator?: boolean;
	decorations?: misskey.entities.UserDetailed['avatarDecorations'];
	disableDecorations?: boolean;
  }>(), {
	target: null,
	disableLink: false,
	disablePreview: false,
	showIndicator: false,
	decorations: undefined,
	disableDecorations: false,
  });
  
  const emit = defineEmits<{
	(ev: 'click', v: MouseEvent): void;
  }>();
  
  const url = computed(() => defaultStore.state.disableShowingAnimatedImages
	? getStaticImageUrl(props.user.avatarUrl)
	: props.user.avatarUrl);
  
  const decorationsToShow = computed(() => {
	if (props.disableDecorations) return [];
	if (props.decorations) return props.decorations;
	return props.user.avatarDecorations || [];
  });
  
  function onClick(ev: MouseEvent) {
	emit('click', ev);
  }
  
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
  
  let color = $ref();
  
  watch(() => props.user.avatarBlurhash, () => {
	color = extractAvgColorFromBlurhash(props.user.avatarBlurhash);
  }, {
	immediate: true,
  });
  </script>
  
  <style lang="scss" scoped>
  @keyframes earwiggleleft {
	from { transform: rotate(37.6deg) skew(30deg); }
	25% { transform: rotate(10deg) skew(30deg); }
	50% { transform: rotate(20deg) skew(30deg); }
	75% { transform: rotate(0deg) skew(30deg); }
	to { transform: rotate(37.6deg) skew(30deg); }
  }
  
  @keyframes earwiggleright {
	from { transform: rotate(-37.6deg) skew(-30deg); }
	30% { transform: rotate(-10deg) skew(-30deg); }
	55% { transform: rotate(-20deg) skew(-30deg); }
	75% { transform: rotate(0deg) skew(-30deg); }
	to { transform: rotate(-37.6deg) skew(-30deg); }
  }
  
  @keyframes pulse {
	0% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.4); }
	70% { box-shadow: 0 0 0 6px rgba(255, 0, 0, 0); }
	100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
  }
  
  .eiwwqkts {
	position: relative;
	display: inline-block;
	vertical-align: bottom;
	flex-shrink: 0;
	border-radius: 100%;
	line-height: 16px;
  
	&.live {
	  &::before {
		content: '';
		position: absolute;
		top: -3px;
		left: -3px;
		right: -3px;
		bottom: -3px;
		border-radius: inherit;
		border: 2px solid #ff0000;
		z-index: 2;
		animation: pulse 2s infinite;
	  }
	}
  
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
  
	> .indicator {
	  position: absolute;
	  z-index: 3;
	  bottom: 0;
	  left: 0;
	  width: 20%;
	  height: 20%;
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
	  }
  
	  &:before {
		border-radius: 0 75% 75%;
		transform: rotate(37.5deg) skew(30deg);
	  }
  
	  &:after {
		border-radius: 75% 0 75% 75%;
		transform: rotate(-37.5deg) skew(-30deg);
	  }
  
	  &:hover {
		&:before {
		  animation: earwiggleleft 1s infinite;
		}
		&:after {
		  animation: earwiggleright 1s infinite;
		}
	  }
  
	  &.live::before {
		all: unset;
		content: '';
		position: absolute;
		top: -3px;
		left: -3px;
		right: -3px;
		bottom: -3px;
		border-radius: inherit;
		border: 2px solid #ff0000;
		z-index: 2;
		animation: pulse 2s infinite;
	  }
	}
  }
  </style>
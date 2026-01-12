<template>
	<div
	  :class="[$style.root, { [$style.active]: active, [$style.disabled]: isDisabled }]"
	  @click="handleClick"
	>
	  <div :class="$style.name">
		<MkCondensedLine :minScale="0.5">{{ decoration.name }}</MkCondensedLine>
	  </div>
	  <MkAvatar
		style="width: 60px; height: 60px;"
		:user="$i"
		:decorations="[{ url: decoration.url, angle, flipH, offsetX, offsetY }]"
		:disable-link="true"
		forceShowDecoration
	  />
	  <i v-if="isDisabled" class="ph-dog-bold ph-lg" :class="$style.plusIcon"></i>
	</div>
  </template>
  
  <script lang="ts" setup>
  import { computed } from 'vue';
  import { $i } from '@/account';
  
  const props = defineProps<{
	active?: boolean;
	decoration: {
	  id: string;
	  url: string;
	  name: string;
	  isPlus?: boolean;
	  isMPlus?: boolean;
	};
	angle?: number;
	flipH?: boolean;
	offsetX?: number;
	offsetY?: number;
	userIsPlus?: boolean;
	userIsMPlus?: boolean;
  }>();
  
  const emit = defineEmits<{
	(ev: 'click'): void;
  }>();
  
  const isDisabled = computed(() => {
	if (props.userIsPlus) return false; // Plus users can use all decorations
	if (props.userIsMPlus) {
	  // MPlus users can use free and MPlus decorations, but not Plus decorations
	  return props.decoration.isPlus;
	}
	// Free users can only use free decorations
	return props.decoration.isPlus || props.decoration.isMPlus;
  });
  
  const handleClick = () => {
	if (!isDisabled.value) {
	  emit('click');
	}
  };
  </script>
  
  <style lang="scss" module>
  .root {
	cursor: pointer;
	padding: 16px 16px 28px 16px;
	border: solid 2px var(--divider);
	border-radius: 8px;
	text-align: center;
	font-size: 90%;
	overflow: clip;
	contain: content;
	position: relative;
  }
  
  .active {
	background-color: var(--accentedBg);
	border-color: var(--accent);
  }
  
  .disabled {
	opacity: 0.6;
	cursor: not-allowed;
  }
  
  .name {
	position: relative;
	z-index: 10;
	font-weight: bold;
	margin-bottom: 20px;
  }
  
  .plusIcon {
	position: absolute;
	top: 8px;
	right: 8px;
	color: var(--accent);
  }
  </style>
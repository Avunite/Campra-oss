<template>
  <span class="mk-user-name" :class="{ nowrap }">
    <Mfm :text="user.name || user.username" :plain="true" :nowrap="false" :custom-emojis="user.emojis" />
    <span v-if="user.school" v-tooltip="user.school.name" class="school-badge">
      <img v-if="user.school.logoUrl" :src="user.school.logoUrl" :alt="user.school.name" class="school-logo"/>
      <i v-else class="ph-graduation-cap-bold school-icon"></i>
    </span>
    <i v-if="user.isVerified && !user.isStaff" class="ph-circle-wavy-check verified" title="Verified"></i>
    <i v-if="user.isOG && !user.isVerified" class="ph-bold ph-flower-lotus og" title="OG"></i>
    <span v-if="user.isTranslator"><i class="ph-translate-bold"></i></span>
    <span v-if="user.isPlus && !user.isStaff || user.isMPlus && !user.isStaff"><i class="ph-dog-bold"></i></span>
  </span>
</template>

<script lang="ts" setup>
import * as misskey from 'calckey-js';

const { user, nowrap = false } = defineProps<{
  user: misskey.entities.User;
  nowrap?: boolean;
}>();
</script>

<style scoped>
.mk-user-name {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  max-width: 100%;
  justify-content: flex-start;
  overflow: hidden;
}

.mk-user-name.nowrap {
  white-space: nowrap;
}

/* Ensure the name text can truncate properly */
.mk-user-name :deep(.mfm) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 auto;
  min-width: 0;
}

.verified, .og, .staff-icon, .ph-translate-bold, .ph-dog-bold, .school-badge {
  margin-left: 4px;
  font-size: 17px; /* Reduced font size */
  vertical-align: middle; /* Vertically center the badges */
  display: inline-flex;
  flex: 0 0 auto;
  flex-shrink: 0;
}

.school-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;

  .school-logo {
    width: 24px;
    height: 24px;
    border-radius: 2px;
    object-fit: contain;
  }

  .school-icon {
    color: var(--accent);
    font-size: 14px;
  }
}

.staff-icon {
  display: inline-block;
  width: 16px; /* Reduced size */
  height: 16px;
  vertical-align: middle; /* Vertically center the staff icon */
}

.ph-dog-bold {
  color: var(--accent); /* Change the color of the dog badge */
}
</style>
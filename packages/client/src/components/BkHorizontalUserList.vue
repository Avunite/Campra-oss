<template>
    <div class="horizontal-user-list" v-if="users.length > 0">
      <h3>{{ i18n.ts.popularUsers }}</h3>
      <div class="user-scroll">
        <MkUserInfo v-for="user in users" :key="user.id" class="user" :user="user"/>
      </div>
    </div>
  </template>
  
  <script lang="ts" setup>
  import MkUserInfo from '@/components/MkUserInfo.vue';
  import { i18n } from '@/i18n';
  
  defineProps<{
    users: any[]
  }>();
  </script>
  
  <style lang="scss" scoped>
  .horizontal-user-list {
    margin-bottom: var(--margin);
  
    h3 {
      margin-bottom: 0.5em;
    }
  
    .user-scroll {
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
  
      .user {
        flex: 0 0 auto;
        width: 200px;
      }
    }
  }
  </style>
<template>
    <MkModal
      ref="modal"
      v-slot="{ type, maxHeight }"
      :z-priority="'middle'"
      :prefer-type="'auto'"
      :transparent-bg="true"
      :manual-showing="manualShowing"
      :src="src"
      @click="modal?.close()"
      @opening="opening"
      @close="emit('close')"
      @closed="emit('closed')"
    >
      <BkGifPicker
        ref="picker"
        class="gqvgzcve _popup _shadow"
        :class="{ drawer: type === 'drawer' }"
        :max-height="348"
        :max-width="2048"
        @chosen="chosen"
      />
    </MkModal>
  </template>
  
  <script lang="ts" setup>
  import { ref } from 'vue';
  import MkModal from '@/components/MkModal.vue';
  import BkGifPicker from '@/components/BkGifPicker.vue';
  
  withDefaults(defineProps<{
    manualShowing?: boolean | null;
    src?: HTMLElement;
  }>(), {
    manualShowing: null,
  });
  
  const emit = defineEmits<{
    (ev: 'done', v: any): void;
    (ev: 'close'): void;
    (ev: 'closed'): void;
  }>();
  
  const modal = ref<InstanceType<typeof MkModal>>();
  const picker = ref<InstanceType<typeof BkGifPicker>>();
  
  function chosen(gif: any) {
    emit('done', gif);
    modal.value?.close();
  }
  
  function opening() {
    picker.value?.reset();
    picker.value?.focus();
  }
  </script>
  
  <style lang="scss" scoped>
  .gqvgzcve {
    &.drawer {
      border-radius: 24px;
      border-bottom-right-radius: 0;
      border-bottom-left-radius: 0;
    }
  }
  </style>
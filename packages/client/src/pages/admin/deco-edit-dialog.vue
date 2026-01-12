<template>
    <XModalWindow
        ref="dialog"
        :width="370"
        :with-ok-button="true"
        @close="$refs.dialog.close()"
        @closed="$emit('closed')"
        @ok="ok()"
    >
        <template #header>{{ deco.name }}</template>
        <div class="_monolithic_">
            <div class="yigymqpb _section">
                <img :src="deco.url" class="img"/>
                <MkInput v-model="name" class="_formBlock">
                    <template #label>{{ i18n.ts.name }}</template>
                </MkInput>
                <MkInput v-model="category" class="_formBlock" :datalist="categories">
                    <template #label>{{ i18n.ts.category }}</template>
                </MkInput>
                <MkInput v-model="credit" class="_formBlock" :datalist="credit">
                    <template #label>{{ i18n.ts.credit }}</template>
                </MkInput>
                <MkSwitch v-model="isPlus" class="_formBlock">
                    <template #label>{{ i18n.ts.plusOnly }}</template>
                </MkSwitch>
                <MkSwitch v-model="isMPlus" class="_formBlock">
                    <template #label>{{ i18n.ts.mplusOnly }}</template>
                </MkSwitch>
                <MkButton danger @click="del()"><i class="ph-trash-bold ph-lg"></i> {{ i18n.ts.delete }}</MkButton>
            </div>
        </div>
    </XModalWindow>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import XModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/form/input.vue';
import MkSwitch from '@/components/form/switch.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';

const props = defineProps<{
    deco: any,
}>();

let dialog = ref(null);
let name = ref(props.deco.name);
let category = ref(props.deco.category);
let credit = ref(props.deco.credit);
let isPlus = ref(props.deco.isPlus);
let isMPlus = ref(props.deco.isMPlus);
let categories = ref([]); // You might want to fetch decoration categories from the server

const emit = defineEmits<{
    (ev: 'done', v: { deleted?: boolean, updated?: any }): void,
    (ev: 'closed'): void
}>();

function ok() {
    update();
}

async function update() {
    await os.apiWithDialog('admin/deco/edit', {
        id: props.deco.id,
        name: name.value,
        credit: credit.value,
        category: category.value,
        isPlus: isPlus.value,
        isMPlus: isMPlus.value,
    });
    emit('done', {
        updated: {
            id: props.deco.id,
            name: name.value,
            credit: credit.value,
            category: category.value,
            isPlus: isPlus.value,
            isMPlus: isMPlus.value,
        },
    });
    dialog.value.close();
}

async function del() {
    const { canceled } = await os.confirm({
        type: 'warning',
        text: i18n.t('removeAreYouSure', { x: name.value }),
    });
    if (canceled) return;
    os.api('admin/deco/delete', {
        id: props.deco.id,
    }).then(() => {
        emit('done', {
            deleted: true,
        });
        dialog.value.close();
    });
}
</script>

<style lang="scss" scoped>
.yigymqpb {
    > .img {
        display: block;
        height: 64px;
        margin: 0 auto;
    }
}
</style>
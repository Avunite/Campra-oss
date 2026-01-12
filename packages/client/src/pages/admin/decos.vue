<template>
    <div>
        <MkStickyContainer>
            <template #header><MkPageHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs"/></template>
            <MkSpacer :content-max="900">
                <div class="ogwlenmc">
                    <div class="local">
                        <MkInput v-model="query" :debounce="true" type="search">
                            <template #prefix><i class="ph-magnifying-glass-bold ph-lg"></i></template>
                            <template #label>{{ i18n.ts.search }}</template>
                        </MkInput>
                        <div v-if="selectMode" style="display: flex; gap: var(--margin); flex-wrap: wrap;">
                            <MkButton inline @click="selectAll">Select all</MkButton>
                            <MkButton inline @click="setCategoryBulk">Set category</MkButton>
                            <MkButton inline danger @click="delBulk">Delete</MkButton>
                        </div>
                        <MkPagination ref="decosPaginationComponent" :pagination="pagination">
                            <template #empty><span>{{ i18n.ts.noCustomDecos }}</span></template>
                            <template #default="{items}">
                                <div class="ldhfsamy">
                                    <button v-for="deco in items" :key="deco.id" class="deco _panel _button" :class="{ selected: selectedDecos.includes(deco.id) }" @click="selectMode ? toggleSelect(deco) : edit(deco)">
                                        <img :src="deco.url" class="img" :alt="deco.name"/>
                                        <div class="body">
                                            <div class="name _monospace">{{ deco.name }}</div>
                                            <div class="info">{{ deco.category }}</div>
                                        </div>
                                    </button>
                                </div>
                            </template>
                        </MkPagination>
                    </div>
                </div>
            </MkSpacer>
        </MkStickyContainer>
    </div>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, ref } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/form/input.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkSwitch from '@/components/form/switch.vue';
import { selectFile } from '@/scripts/select-file';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

const decosPaginationComponent = ref<InstanceType<typeof MkPagination>>();

const query = ref(null);
const selectMode = ref(false);
const selectedDecos = ref<string[]>([]);

const pagination = {
    endpoint: 'admin/deco/list' as const,
    limit: 30,
    params: computed(() => ({
        query: (query.value && query.value !== '') ? query.value : null,
    })),
};

const selectAll = () => {
    if (selectedDecos.value.length > 0) {
        selectedDecos.value = [];
    } else {
        selectedDecos.value = decosPaginationComponent.value.items.map(item => item.id);
    }
};

const toggleSelect = (deco) => {
    if (selectedDecos.value.includes(deco.id)) {
        selectedDecos.value = selectedDecos.value.filter(x => x !== deco.id);
    } else {
        selectedDecos.value.push(deco.id);
    }
};

const add = async (ev: MouseEvent) => {
    const file = await selectFile(ev.currentTarget ?? ev.target);

    const promise = os.api('admin/deco/add', {
        fileId: file.id,
    });
    promise.then(() => {
        decosPaginationComponent.value.reload();
    });
    os.promiseDialog(promise);
};

const edit = (deco) => {
    os.popup(defineAsyncComponent(() => import('./deco-edit-dialog.vue')), {
        deco: deco,
    }, {
        done: result => {
            if (result.updated) {
                decosPaginationComponent.value.updateItem(result.updated.id, (oldDeco: any) => ({
                    ...oldDeco,
                    ...result.updated,
                }));
            } else if (result.deleted) {
                decosPaginationComponent.value.removeItem((item) => item.id === deco.id);
            }
        },
    }, 'closed');
};

const setCategoryBulk = () => {
    os.inputText({
        title: 'Set category for selected decorations',
        placeholder: 'Category name',
    }).then(({ canceled, result: category }) => {
        if (canceled) return;
        os.apiWithDialog('admin/deco/edit', {
            ids: selectedDecos.value,
            category: category,
        });
    });
};

const delBulk = () => {
    os.confirm({
        type: 'warning',
        text: 'Delete selected decorations?',
    }).then(({ canceled }) => {
        if (canceled) return;
        os.apiWithDialog('admin/deco/delete', {
            ids: selectedDecos.value,
        });
    });
};

const headerActions = $computed(() => [{
    asFullButton: true,
    icon: 'ph-plus-bold ph-lg',
    text: i18n.ts.addDeco,
    handler: add,
}]);

const headerTabs = $computed(() => [{
    key: 'local',
    icon: 'ph-hand-fist-bold ph-lg',
    title: i18n.ts.local,
}]);

definePageMetadata(computed(() => ({
    title: i18n.ts.avatarDecorations,
    icon: 'ph-sparkle-bold ph-lg',
})));
</script>

<style lang="scss" scoped>
.ogwlenmc {
    > .local {
        .empty {
            margin: var(--margin);
        }

        .ldhfsamy {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
            grid-gap: 12px;
            margin: var(--margin) 0;
    
            > .deco {
                display: flex;
                align-items: center;
                padding: 11px;
                text-align: left;
                border: solid 1px var(--panel);

                &:hover {
                    border-color: var(--inputBorderHover);
                }

                &.selected {
                    border-color: var(--accent);
                }

                > .img {
                    width: 42px;
                    height: 42px;
                }

                > .body {
                    padding: 0 0 0 8px;
                    white-space: nowrap;
                    overflow: hidden;

                    > .name {
                        text-overflow: ellipsis;
                        overflow: hidden;
                    }

                    > .info {
                        opacity: 0.5;
                        text-overflow: ellipsis;
                        overflow: hidden;
                    }
                }
            }
        }
    }
}
</style>
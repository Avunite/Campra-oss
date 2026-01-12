<template>
    <MkStickyContainer>
      <template #header><MkPageHeader :actions="headerActions" :tabs="headerTabs"/></template>
      <MkSpacer :content-max="700" :margin-min="16" :margin-max="32">
        <div class="_formRoot">
          <FormSection>
            <template #label>{{ i18n.ts.emailContent }}</template>
            <FormInput v-model="subject" class="_formBlock">
              <template #label>{{ i18n.ts.subject }}</template>
            </FormInput>
            <FormTextarea v-model="body" tall class="_formBlock">
              <template #label>{{ i18n.ts.body }}</template>
            </FormTextarea>
            <FormSwitch v-model="useHtml" class="_formBlock">
              <template #label>{{ i18n.ts.useHtmlContent }}</template>
            </FormSwitch>
          </FormSection>
  
          <FormSection>
            <template #label>{{ i18n.ts.recipientSelection }}</template>
            <FormSwitch v-model="sendToAll" class="_formBlock">
              <template #label>{{ i18n.ts.sendToAllUsers }}</template>
            </FormSwitch>
            
            <template v-if="!sendToAll">
              <FormSelect v-model="userAttributes" multiple class="_formBlock">
                <template #label>{{ i18n.ts.userAttributes }}</template>
                <option value="isPlus">{{ i18n.ts.plus }}</option>
                <option value="isStaff">{{ i18n.ts.staff }}</option>
                <option value="isVerified">{{ i18n.ts.verified }}</option>
                <option value="isModerator">{{ i18n.ts.moderator }}</option>
                <option value="isTranslator">{{ i18n.ts.translator }}</option>
                <option value="isSilenced">{{ i18n.ts.silenced }}</option>
                <option value="isSuspended">{{ i18n.ts.suspended }}</option>
              </FormSelect>
  
              <FormSplit :min-width="280">
                <MkSelect v-model="sort">
                  <template #label>{{ i18n.ts.sort }}</template>
                  <option value="-follower">{{ i18n.ts.followerCount }} ({{ i18n.ts.descendingOrder }})</option>
                  <option value="+follower">{{ i18n.ts.followerCount }} ({{ i18n.ts.ascendingOrder }})</option>
                  <option value="-createdAt">{{ i18n.ts.registeredDate }} ({{ i18n.ts.descendingOrder }})</option>
                  <option value="+createdAt">{{ i18n.ts.registeredDate }} ({{ i18n.ts.ascendingOrder }})</option>
                  <option value="-updatedAt">{{ i18n.ts.lastUsed }} ({{ i18n.ts.descendingOrder }})</option>
                  <option value="+updatedAt">{{ i18n.ts.lastUsed }} ({{ i18n.ts.ascendingOrder }})</option>
                  <option value="-isTranslator">{{ i18n.ts.translator }} ({{ i18n.ts.descendingOrder }})</option>
                  <option value="+isTranslator">{{ i18n.ts.translator }} ({{ i18n.ts.ascendingOrder }})</option>
                  <option value="-isPlus">{{ i18n.ts.plus }} ({{ i18n.ts.descendingOrder }})</option>
                  <option value="+isPlus">{{ i18n.ts.plus }} ({{ i18n.ts.ascendingOrder }})</option>
                  <option value="-isVerified">{{ i18n.ts.verified }} ({{ i18n.ts.descendingOrder }})</option>
                  <option value="+isVerified">{{ i18n.ts.verified }} ({{ i18n.ts.ascendingOrder }})</option>
                  <option value="-isSilenced">{{ i18n.ts.silenced }} ({{ i18n.ts.descendingOrder }})</option>
                  <option value="+isSilenced">{{ i18n.ts.silenced }} ({{ i18n.ts.ascendingOrder }})</option>
                  <option value="-isSuspended">{{ i18n.ts.suspended }} ({{ i18n.ts.descendingOrder }})</option>
                  <option value="+isSuspended">{{ i18n.ts.suspended }} ({{ i18n.ts.ascendingOrder }})</option>
                </MkSelect>
                <MkSelect v-model="state">
                  <template #label>{{ i18n.ts.state }}</template>
                  <option value="all">{{ i18n.ts.all }}</option>
                  <option value="available">{{ i18n.ts.normal }}</option>
                  <option value="admin">{{ i18n.ts.administrator }}</option>
                  <option value="moderator">{{ i18n.ts.moderator }}</option>
                  <option value="silenced">{{ i18n.ts.silence }}</option>
                  <option value="suspended">{{ i18n.ts.suspend }}</option>
                </MkSelect>
              </FormSplit>
  
              <FormSplit :min-width="280">
                <MkInput v-model="searchUsername" type="text">
                  <template #prefix>@</template>
                  <template #label>{{ i18n.ts.username }}</template>
                </MkInput>
                <MkInput v-model="searchHost" type="text">
                  <template #prefix>@</template>
                  <template #label>{{ i18n.ts.host }}</template>
                </MkInput>
              </FormSplit>
  
              <MkPagination v-slot="{items}" ref="userList" :pagination="userPagination" class="users">
                <div v-for="user in items" :key="user.id" class="user">
                  <MkUserCardMini :user="user"/>
                  <FormSwitch v-model="selectedUsers[user.id]">
                    <template #label>{{ i18n.ts.select }}</template>
                  </FormSwitch>
                </div>
              </MkPagination>
            </template>
          </FormSection>
        </div>
      </MkSpacer>
    </MkStickyContainer>
  </template>
  
  <script lang="ts" setup>
  import { ref, computed } from 'vue';
  import FormInput from '@/components/form/input.vue';
  import FormTextarea from '@/components/form/textarea.vue';
  import FormSwitch from '@/components/form/switch.vue';
  import FormSelect from '@/components/form/select.vue';
  import FormSection from '@/components/form/section.vue';
  import FormSplit from '@/components/form/split.vue';
  import MkSelect from '@/components/form/select.vue';
  import MkInput from '@/components/form/input.vue';
  import MkPagination from '@/components/MkPagination.vue';
  import MkUserCardMini from '@/components/MkUserCardMini.vue';
  import * as os from '@/os';
  import { i18n } from '@/i18n';
  import { definePageMetadata } from '@/scripts/page-metadata';
  
  const subject = ref('');
  const body = ref('');
  const useHtml = ref(false);
  const sendToAll = ref(false);
  const userAttributes = ref([]);
  const sort = ref('-createdAt');
  const state = ref('all');
  const searchUsername = ref('');
  const searchHost = ref('');
  const selectedUsers = ref({});
  
  const userPagination = computed(() => ({
    endpoint: 'admin/show-users' as const,
    limit: 10,
    params: computed(() => ({
      sort: sort.value,
      state: state.value,
      origin: 'combined',
      username: searchUsername.value,
      hostname: searchHost.value,
      ...Object.fromEntries(userAttributes.value.map(attr => [attr, true]))
    })),
  }));
  
  async function sendEmails() {
    const userIds = sendToAll.value ? [] : Object.keys(selectedUsers.value).filter(id => selectedUsers.value[id]);
    
    await os.apiWithDialog('admin/mass-email', {
      userIds: userIds,
      subject: subject.value,
      text: body.value,
      html: useHtml.value ? body.value : null,
    });
  }
  
  const headerActions = computed(() => [{
    icon: 'ph-paper-plane-tilt-bold ph-lg',
    text: i18n.ts.send,
    handler: sendEmails,
  }]);
  
  const headerTabs = computed(() => []);
  
  definePageMetadata({
    title: i18n.ts.massEmail,
    icon: 'ph-envelope-simple-bold ph-lg',
  });
  </script>
  
  <style lang="scss" scoped>
  .users {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
    grid-gap: 12px;
    margin-top: var(--margin);
  
    > .user {
      display: flex;
      flex-direction: column;
      
      &:hover {
        text-decoration: none;
      }
    }
  }
  </style>
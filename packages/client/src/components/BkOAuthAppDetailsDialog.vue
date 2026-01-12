<template>
<MkModal ref="modal" :prefer-type="'dialog'" :z-priority="'high'" @closed="emit('closed')">
  <div class="mk-oauth-app-details">
    <div v-if="isNewApp" class="introduction-section">
      <h3>{{ i18n.ts.oauthAppCreated }}</h3>
      <p>{{ i18n.ts.oauthAppCreatedDescription  }}</p>
    </div>
    
    <div class="section credentials-section">
      <div class="field">
        <div class="label">{{ i18n.ts.clientId || 'Client ID' }}:</div>
        <div class="value monospace">
          <span>{{ app.id }}</span>
          <button v-tooltip="i18n.ts.copy" class="_button copy-button" @click="copyWithNotify(app.id)">
            <i class="ph-copy-bold ph-lg"></i>
          </button>
        </div>
      </div>
      <div class="field">
        <div class="label">{{ i18n.ts.clientSecret || 'Client Secret' }}:</div>
        <div class="value monospace">
          <Mfm :text="`$[blur ${app.secret}]`" />
          <button v-tooltip="i18n.ts.copy" class="_button copy-button" @click="copyWithNotify(app.secret)">
            <i class="ph-copy-bold ph-lg"></i>
          </button>
        </div>
      </div>
    </div>
    
    <div class="section redirect-section">
      <div class="label">{{ i18n.ts.redirectUris || 'Redirect URIs' }}:</div>
      <div v-if="app.redirectUris?.length > 0" class="value uri-list">
        <div v-for="uri in app.redirectUris" :key="uri" class="uri">
          <span>• {{ uri }}</span>
          <button v-tooltip="i18n.ts.copy" class="_button copy-button" @click="copyWithNotify(uri)">
            <i class="ph-copy-bold ph-lg"></i>
          </button>
        </div>
      </div>
      <div v-else class="value">{{ i18n.ts.none || 'None' }}</div>
    </div>
    
    <div class="section endpoints-section">
      <div class="field">
        <div class="label">{{ i18n.ts.authorizationUrl || 'OAuth2 Authorization URL' }}:</div>
        <div class="value monospace">
          <span>{{ authUrl }}</span>
          <button v-tooltip="i18n.ts.copy" class="_button copy-button" @click="copyWithNotify(authUrl)">
            <i class="ph-copy-bold ph-lg"></i>
          </button>
        </div>
      </div>
      <div class="field">
        <div class="label">{{ i18n.ts.tokenUrl || 'OAuth2 Token URL' }}:</div>
        <div class="value monospace">
          <span>{{ tokenUrl }}</span>
          <button v-tooltip="i18n.ts.copy" class="_button copy-button" @click="copyWithNotify(tokenUrl)">
            <i class="ph-copy-bold ph-lg"></i>
          </button>
        </div>
      </div>
    </div>
    
    <div class="section scope-section">
      <div class="label">{{ i18n.ts.scope || 'Scope' }}:</div>        <div class="value monospace">
          <span>{{ scopeString }}</span>
          <button v-tooltip="i18n.ts.copy" class="_button copy-button" @click="copyWithNotify(scopeString)">
            <i class="ph-copy-bold ph-lg"></i>
          </button>
        </div>
      <div class="permissions">
        <div v-for="permission in app.permission" :key="permission" class="permission-item">
          <i class="ph-check-circle-bold ph-lg"></i>
          <span>{{ i18n.t(`_permissions.${permission}`) }}</span>
        </div>
      </div>
    </div>
    
    <div class="section example-section">
      <div class="label">{{ i18n.ts.authCodeFlowExample  }}:</div>
      <div class="value">
        <div class="example-step">1. {{ i18n.ts.redirectUserTo }}:</div>
        <div class="code">
          <div class="code-content">{{ authExample }}</div>
          <button v-tooltip="i18n.ts.copy" class="_button copy-button" @click="copyWithNotify(authExample)">
            <i class="ph-copy-bold ph-lg"></i>
          </button>
        </div>
        
        <div class="example-step">2. {{ i18n.ts.exchangeCodeForToken }}:</div>
        <div class="code">
          <div class="code-content">{{ tokenExample }}</div>
          <button v-tooltip="i18n.ts.copy" class="_button copy-button" @click="copyWithNotify(tokenExample)">
            <i class="ph-copy-bold ph-lg"></i>
          </button>
        </div>
      </div>
    </div>
    
    <div class="buttons">
      <MkButton primary @click="close">{{ i18n.ts.close }}</MkButton>
    </div>
  </div>
</MkModal>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import MkModal from '@/components/MkModal.vue';
import MkButton from '@/components/MkButton.vue';
import Mfm from '@/components/global/MkMisskeyFlavoredMarkdown.vue';
import { i18n } from '@/i18n';
import { url } from '@/config';
import copyToClipboard from '@/scripts/copy-to-clipboard';
import * as os from '@/os';

const props = defineProps<{
  app: {
    id: string;
    secret: string;
    name: string;
    description?: string;
    permission: string[];
    redirectUris?: string[];
  };
  isNewApp?: boolean;
}>();

const emit = defineEmits<{
  (ev: 'closed'): void;
}>();

const modal = ref<InstanceType<typeof MkModal>>();

// Ensure scope is displayed in the format expected by the OAuth backend
// The backend expects a space-separated list of permissions for the scope parameter
const permissions = computed(() => props.app.permission || []);

// Format the permissions as a space-separated string for OAuth scope
const scopeString = computed(() => permissions.value.join(' '));

// Use the instance URL from config rather than window.location.origin
const authUrl = computed(() => `${url}/oauth/authorize`);
const tokenUrl = computed(() => `${url}/oauth/token`); // OAuth token endpoint without redundant /api prefix

const defaultRedirectUri = computed(() => props.app.redirectUris?.[0] || '');

const authExample = computed(() => {
  return `${authUrl.value}?client_id=${props.app.id}&redirect_uri=${encodeURIComponent(defaultRedirectUri.value)}&response_type=code&scope=${encodeURIComponent(scopeString.value)}`;
});

const tokenExample = computed(() => {
  return `POST ${tokenUrl.value}\nclient_id=${props.app.id}&client_secret=${props.app.secret}&redirect_uri=${encodeURIComponent(defaultRedirectUri.value)}&grant_type=authorization_code&code=CODE`;
});

const close = () => {
  modal.value?.close();
};

// Show notification when copying
const notify = (content: string) => {
  const truncated = content.length > 30 ? content.substring(0, 30) + '...' : content;
  os.toast(i18n.ts.copied);
};

const copyWithNotify = (text: string) => {
  copyToClipboard(text);
  notify(text);
};
</script>

<style lang="scss" scoped>
.mk-oauth-app-details {
  padding: 32px;
  max-width: 650px;
  
  @media (max-width: 600px) {
    padding: 20px;
  }
  
  .introduction-section {
    margin-bottom: 24px;
    
    h3 {
      margin-top: 0;
      margin-bottom: 12px;
      font-weight: bold;
      font-size: 1.2em;
    }
    
    p {
      margin: 0;
      opacity: 0.8;
    }
  }
  
  .section {
    margin-bottom: 24px;
    
    .field {
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      
      @media (min-width: 600px) {
        flex-direction: row;
      }
      
      .label {
        font-weight: bold;
        min-width: 140px;
        margin-bottom: 4px;
        
        @media (min-width: 600px) {
          margin-bottom: 0;
        }
      }
      
      .value {
        flex: 1;
        display: flex;
        align-items: center;
        
        span {
          flex: 1;
          overflow-wrap: break-word;
          word-break: break-all;
        }
      }
    }
    
    .label {
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .value {
      &.monospace {
        font-family: monospace;
        background: var(--bg);
        padding: 8px;
        border-radius: 6px;
        word-break: break-all;
        display: flex;
        align-items: center;
        
        span {
          flex: 1;
        }
      }
      
      &.uri-list {
        .uri {
          margin-left: 1rem;
          display: flex;
          align-items: center;
          
          span {
            flex: 1;
          }
        }
      }
    }
    
    &.example-section {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--divider);
      
      .example-step {
        margin-top: 12px;
        margin-bottom: 6px;
        font-weight: bold;
      }
      
      .code {
        font-family: monospace;
        background: var(--bg);
        padding: 8px;
        border-radius: 6px;
        margin-bottom: 16px;
        display: flex;
        align-items: flex-start;
        
        .code-content {
          flex: 1;
          white-space: pre-wrap;
          word-break: break-all;
        }
      }
    }
    
    .permissions {
      margin-top: 12px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 8px;
      
      .permission-item {
        display: flex;
        align-items: center;
        gap: 8px;
        
        i {
          color: var(--success);
        }
      }
    }
  }
  
  .copy-button {
    opacity: 0.7;
    margin-left: 8px;
    
    &:hover {
      opacity: 1;
    }
  }
  
  .buttons {
    margin-top: 24px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>

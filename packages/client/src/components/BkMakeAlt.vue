<template>
    <form class="eppvobhk _monolithic_" :class="{ generating }" @submit.prevent="onSubmit">
        <div class="auth _section _formRoot">
            <MkInfo v-if="message">
                {{ message }}
            </MkInfo>
            <div class="normal-signin">
                <MkInput v-model="username" class="_formBlock" type="text" pattern="^[a-zA-Z0-9_]{1,20}$" :spellcheck="false" required data-cy-signup-username @update:modelValue="onChangeUsername">
                    <template #label>{{ i18n.ts.username }} <div v-tooltip:dialog="i18n.ts.usernameInfo" class="_button _help"><i class="ph-question-bold"></i></div></template>
                    <template #prefix>@</template>
                    <template #suffix>@{{ host }}</template>
                    <template #caption>
                        <span v-if="usernameState === 'wait'" style="color:#6e6a86"><i class="ph-circle-notch-bold ph-lg fa-pulse ph-fw ph-lg"></i> {{ i18n.ts.checking }}</span>
                        <span v-else-if="usernameState === 'ok'" style="color: var(--success)"><i class="ph-check-bold ph-lg ph-fw ph-lg"></i> {{ i18n.ts.available }}</span>
                        <span v-else-if="usernameState === 'unavailable'" style="color: var(--error)"><i class="ph-warning-bold ph-lg ph-fw ph-lg"></i> {{ i18n.ts.unavailable }}</span>
                        <span v-else-if="usernameState === 'error'" style="color: var(--error)"><i class="ph-warning-bold ph-lg ph-fw ph-lg"></i> {{ i18n.ts.error }}</span>
                        <span v-else-if="usernameState === 'invalid-format'" style="color: var(--error)"><i class="ph-warning-bold ph-lg ph-fw ph-lg"></i> {{ i18n.ts.usernameInvalidFormat }}</span>
                        <span v-else-if="usernameState === 'min-range'" style="color: var(--error)"><i class="ph-warning-bold ph-lg ph-fw ph-lg"></i> {{ i18n.ts.tooShort }}</span>
                        <span v-else-if="usernameState === 'max-range'" style="color: var(--error)"><i class="ph-warning-bold ph-lg ph-fw ph-lg"></i> {{ i18n.ts.tooLong }}</span>
                    </template>
                </MkInput>
                <MkInput v-model="password" class="_formBlock" :placeholder="i18n.ts.currentPassword" type="password" :with-password-toggle="true" required data-cy-signin-password>
                    <template #prefix><i class="ph-lock-bold ph-lg"></i></template>
                </MkInput>
                <MkButton type="submit" :disabled="generating" primary style="margin: 0 auto;">{{ signing ? i18n.ts.loggingIn : i18n.ts.login }}</MkButton>
            </div>
        </div>
    </form>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { toUnicode } from 'punycode/';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/form/input.vue';
import MkInfo from '@/components/MkInfo.vue';
import * as os from '@/os';
import { login } from '@/account';
import { instance } from '@/instance';
import { i18n } from '@/i18n';
import * as config from '@/config';

const emit = defineEmits<{
    (ev: 'login', v: any): void;
}>();

const props = defineProps({
    autoSet: {
        type: Boolean,
        required: false,
        default: false,
    },
    message: {
        type: String,
        required: false,
        default: '',
    },
});

const host = toUnicode(config.host);
const meta = computed(() => instance);

const username = ref('');
const password = ref('');
const usernameState = ref<null | 'wait' | 'ok' | 'unavailable' | 'error' | 'invalid-format' | 'min-range' | 'max-range'>(null);
const generating = ref(false);

function onChangeUsername(): void {
    if (username.value === '') {
        usernameState.value = null;
        return;
    }

    const err =
        !username.value.match(/^[a-zA-Z0-9_]+$/) ? 'invalid-format' :
        username.value.length < 1 ? 'min-range' :
        username.value.length > 20 ? 'max-range' :
        null;

    if (err) {
        usernameState.value = err;
        return;
    }

    usernameState.value = 'wait';

    os.api('username/available', {
        username: username.value,
    }).then(result => {
        usernameState.value = result.available ? 'ok' : 'unavailable';
    }).catch(() => {
        usernameState.value = 'error';
    });
}

async function onSubmit(): Promise<void> {
    if (generating.value) return;
    generating.value = true;

    try {
        // First, create the alt account
        const altAccount = await os.api('i/gen-alt', {
            altUsername: username.value,
            password: password.value,
        });

        // Then, immediately sign in with the new account
        const signinResult = await os.api('signin', {
            username: username.value,
            password: password.value,
        });

        emit('login', signinResult);

        os.alert({
            type: 'success',
            text: i18n.ts.altAccountCreated,
        });

        if (props.autoSet) {
            await login(signinResult.i);
        }
    } catch (err) {
        if (err.id === 'INCORRECT_PASSWORD') {
            os.alert({
                type: 'error',
                text: i18n.ts.incorrectPassword,
            });
        } else if (err.id === 'UNAVAILABLE') {
            os.alert({
                type: 'error',
                text: i18n.ts.maxAltAccountsReached,
            });
        } else if (err.id === 'USERNAME_TAKEN') {
            os.alert({
                type: 'error',
                text: i18n.ts.usernameTaken,
            });
        } else {
            os.alert({
                type: 'error',
                text: err.message || i18n.ts.somethingHappened,
            });
        }
    } finally {
        generating.value = false;
    }
}
</script>

<style lang="scss" scoped>
.eppvobhk {
    > .auth {
        > .avatar {
            margin: 0 auto 0 auto;
            width: 64px;
            height: 64px;
            background: #ddd;
            background-position: center;
            background-size: cover;
            border-radius: 100%;
        }
    }
}
</style>
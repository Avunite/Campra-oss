<template>
  <div class="payment-failed-container">
    <div class="content">
      <div class="logo">
        <img :src="logoSrc" :alt="logoAlt" />
      </div>
      <h1>{{ i18n.ts._plus.paymentFailed }}</h1>
      <div class="error-message">
        <i class="ph-warning-circle"></i>
        <p>{{ errorMessage }}</p>
      </div>
      <div class="features">
        <h2>{{ i18n.ts._plus.whatToDo }}</h2>
        <ul>
          <li><i class="ph-credit-card"></i> {{ i18n.ts._plus.checkPaymentMethod }}</li>
          <li><i class="ph-arrows-clockwise"></i> {{ i18n.ts._plus.tryAgainLater }}</li>
          <li><i class="ph-question"></i> {{ i18n.ts._plus.contactSupport }}</li>
        </ul>
      </div>
      <div class="button-container">
        <MkButton 
          primary 
          class="manage-button" 
          :link="retryLink"
          @click="ripple"
        >
          {{ retryButtonText }}
        </MkButton>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, defineProps } from 'vue';
import MkButton from '@/components/MkButton.vue';
import FormSelect from '@/components/form/select.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import Ripple from '@/components/MkRipple.vue';

const props = defineProps({
  plan: {
    type: String,
    default: 'plus'
  }
});

// Default to monthly subscription for retrying
const subscriptionType = ref('month');

const subscriptionPricing = computed(() => {
  return subscriptionType.value === 'month'
    ? i18n.ts._plus.monthlyPrice
    : i18n.ts._plus.yearlyPrice;
});

// Determine logo source based on plan type
const logoSrc = computed(() => {
  if (props.plan === 'mplus') {
    return '/client-assets/badges/mini-campra-plus-logo.png'; // Adjust this path as needed
  }
  return '/client-assets/badges/campra-plus-logo.png';
});

// Alt text for the logo
const logoAlt = computed(() => {
  if (props.plan === 'mplus') {
    return i18n.ts._plus.miniCampraPlusLogo || 'Mini Campra+ Logo';
  }
  return i18n.ts._plus.campraPlusLogo || 'Campra+ Logo';
});

// Error message based on purchase type
const errorMessage = computed(() => {
  if (props.isGift) {
    return i18n.ts._plus.gift.paymentFailedMessage || 
      'Your gift purchase could not be completed. Your payment method was not charged.';
  }
  return i18n.ts._plus.paymentFailedMessage;
});

// Retry button text
const retryButtonText = computed(() => {
  if (props.isGift) {
    return i18n.ts._plus.gift.retryGiftPurchase || 'Try Gift Purchase Again';
  }
  return i18n.ts._plus.retryPayment;
});

// Retry link
const retryLink = computed(() => {
  if (props.isGift) {
    return '/about';
  }
  return '/settings/manage-plus';
});

async function retryPayment(ev?: MouseEvent) {
  const el = ev && (ev.currentTarget ?? ev.target) as HTMLElement | null | undefined;
  const rect = el?.getBoundingClientRect();
  const x = rect ? rect.left + (el.offsetWidth / 2) : 0;
  const y = rect ? rect.top + (el.offsetHeight / 2) : 0;
  os.popup(Ripple, { x, y }, {}, 'end');

  try {
    const response = await os.api('plus/checkout', { subscriptionType: subscriptionType.value });
    if (response.url) {
      window.open(response.url, '_blank');
    }
  } catch (error) {
    console.error('Error during payment retry:', error);
    os.alert({
      type: 'error',
      text: i18n.ts._plus.retryPaymentError,
    });
  }
}
</script>

<style lang="scss" scoped>
.payment-failed-container {
  position: relative;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--bg);
  
  &.gift-container {
    .logo img {
      filter: hue-rotate(25deg);
    }
    
    .error-message {
      border-left-color: #e4a672;
    }
  }
}

.content {
  background: var(--panel);
  border-radius: 20px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  max-width: 600px;
  width: 90%;
}

.logo img {
  width: 150px;
  margin-bottom: 1rem;
}

h1 {
  font-size: 2.5rem;
  color: var(--error);
  margin-bottom: 1rem;
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2rem;
  padding: 1rem;
  background-color: var(--error);
  color: white;
  border-radius: 10px;

  i {
    font-size: 2rem;
    margin-right: 1rem;
  }

  p {
    font-size: 1.2rem;
    margin: 0;
  }
}

.features {
  margin-bottom: 2rem;
  
  h2 {
    font-size: 1.8rem;
    margin-bottom: 1rem;
    color: var(--fg);
  }

  ul {
    list-style-type: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  li {
    font-size: 1.1rem;
    padding: 0.5rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--fg);

    i {
      color: var(--accent);
      font-size: 1.5rem;
    }
  }
}

.subscription-section {
  margin-bottom: 1.5rem;

  .subscription-select {
    margin-bottom: 0.5rem;
  }

  .pricing-info {
    font-size: 1.1rem;
    color: var(--accent);
  }
}

.button-container {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.retry-button, .contact-button {
  font-size: 1.2rem;
  padding: 0.75rem 1.5rem;
}
</style>
<template>
  <div class="cancelled-container">
    <div class="content">
      <div class="logo">
        <img :src="logoSrc" :alt="logoAlt" />
      </div>
      <h1>{{ headerText }}</h1>
      <p>{{ cancellationMessage }}</p>
      <div class="button-container">
        <MkButton primary class="back-button" :link="backLink">
          {{ backButtonText }}
        </MkButton>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, PropType } from 'vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n';

export default defineComponent({
  components: {
    MkButton,
  },
  props: {
    plan: {
      type: String as PropType<'plus' | 'mplus' | undefined>,
      default: 'plus'
    },
    isGift: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
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

    // Header text based on purchase type
    const headerText = computed(() => {
      if (props.isGift) {
        return i18n.ts._plus.gift.giftPurchaseCancelled || 'Gift Purchase Cancelled';
      } else if (props.plan === 'mplus') {
        return i18n.ts._plus.miniPlusCancelled || 'Mini Campra+ Cancelled';
      } else {
        return i18n.ts._plus.plusCancelled || 'Campra+ Cancelled';
      }
    });

    // Cancellation message based on purchase type
    const cancellationMessage = computed(() => {
      if (props.isGift) {
        return i18n.ts._plus.gift.giftCancellationMessage || 
          'Your gift purchase has been cancelled. Your payment method was not charged.';
      }
      return i18n.ts._plus.cancellationMessage;
    });

    // Back button text and link based on purchase type
    const backButtonText = computed(() => {
      if (props.isGift) {
        return i18n.ts._plus.gift.backToGiftPurchase || 'Back to Gift Purchase';
      }
      return i18n.ts._plus.backToPlus;
    });

    const backLink = computed(() => {
      if (props.isGift) {
        return '/about';
      }
      return '/settings/manage-plus';
    });

    return {
      i18n,
      logoSrc,
      logoAlt,
      headerText,
      cancellationMessage,
      backButtonText,
      backLink
    };
  },
});
</script>

<style lang="scss" scoped>
.cancelled-container {
  position: relative;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--bg);
  
  &.gift-container {
    .logo img {
      filter: hue-rotate(25deg);
      opacity: 0.65;
    }
    
    h1 {
      color: #e4a672;
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
  opacity: 0.5;
}

h1 {
  font-size: 2.5rem;
  color: var(--fg);
  margin-bottom: 1rem;
}

p {
  font-size: 1.2rem;
  margin-bottom: 2rem;
  color: var(--fg);
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
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
  }

  li {
    font-size: 1.1rem;
    background: var(--X2);
    padding: 0.5rem 1rem;
    border-radius: 50px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--fg);
    opacity: 0.7;

    i {
      color: var(--fg);
    }
  }
}

.button-container {
  display: flex;
  justify-content: center;
}

.back-button {
  font-size: 1.2rem;
  padding: 0.75rem 1.5rem;
}
</style>
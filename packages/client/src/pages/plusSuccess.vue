<template>
  <div class="success-container">
    <div class="confetti-container">
      <div v-for="n in 50" :key="n" class="confetti" :style="{ 
        '--delay': `${Math.random() * 5}s`, 
        '--rotation': `${Math.random() * 360}deg`,
        '--left': `${Math.random() * 100}%`
      }"></div>
    </div>
    <div class="content">
      <div class="logo">
        <img 
          :src="logoSrc" 
          :alt="logoAlt" 
        />
      </div>
      
      <h1>{{ headerText }}</h1>

      <div class="button-container">
        <MkButton 
          primary 
          class="manage-button" 
          link="/settings/teams" 
          @click="ripple"
        >
          {{ buttonText }}
        </MkButton>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, PropType } from 'vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n';
import Ripple from '@/components/MkRipple.vue';
import * as os from '@/os';

function ripple(ev?: MouseEvent){
  const el = ev && (ev.currentTarget ?? ev.target) as HTMLElement | null | undefined;
    const rect = el?.getBoundingClientRect();
    const x = rect ? rect.left + (el.offsetWidth / 2) : 0;
    const y = rect ? rect.top + (el.offsetHeight / 2) : 0;
    os.popup(Ripple, { x, y }, {}, 'end');
}

export default defineComponent({
  components: {
    MkButton,
  },
  props: {
    sessionId: String,
    plan: {
      type: String as PropType<'plus' | 'mplus' | undefined>,
      default: 'plus'
    },
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
        return 'Mini Campra+ Logo';
      }
      return 'Campra+ Logo';
    });

    // Text for the header based on plan type
    const headerText = computed(() => {
      if (props.plan === 'mplus') {
        return i18n.ts._plus.welcomeToCampraPlus || 'Welcome to Mini Campra+';
      } else {
        return i18n.ts._plus.welcomeToCampraPlus || 'Welcome to Campra+';
      }
    });

    // Button text for team management
    const buttonText = computed(() => {
      return 'Manage Teams';
    });

    return {
      i18n,
      ripple,
      logoSrc,
      logoAlt,
      headerText,
      buttonText
    };
  },
});
</script>

<style lang="scss" scoped>
.success-container {
  position: relative;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  background: linear-gradient(135deg, var(--accent) 0%, var(--bg) 100%);
  animation: gradient-animation 15s ease infinite;
  background-size: 400% 400%;
}

.confetti-container {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;
}

.confetti {
  position: absolute;
  width: 10px;
  height: 10px;
  background-color: var(--accent);
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  opacity: 0.7;
  animation: 
    confetti-fall 5s linear infinite, 
    confetti-shake 3s ease-in-out infinite alternate, 
    confetti-rotate 1s linear infinite;
  animation-delay: var(--delay);
  transform: rotate(var(--rotation));
  left: var(--left);
}

@keyframes confetti-fall {
  0% {
    top: -10%;
    transform: translateZ(0) rotateX(0deg);
  }
  100% {
    top: 110%;
    transform: translateZ(100px) rotateX(360deg);
  }
}

@keyframes confetti-shake {
  0%, 100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(80px);
  }
}

@keyframes confetti-rotate {
  0% {
    transform: rotateY(0deg);
  }
  100% {
    transform: rotateY(360deg);
  }
}

@keyframes gradient-animation {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.content {
  background: var(--panel);
  border-radius: 20px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  z-index: 1;
  max-width: 600px;
  width: 90%;
}

.logo img {
  width: 150px;
  margin-bottom: 5rem;
}

h1 {
  font-size: 2.5rem;
  color: var(--accent);
  margin-bottom: 1rem;
  animation: bounce 0.3s ease infinite alternate;
  text-shadow: 0 1px 0 #a0375b,
               0 2px 0 #a0375b,
               0 3px 0 #a0375b,
               0 4px 0 #a0375b,
               0 5px 0 #a0375b,
               0 6px 0 transparent,
               0 7px 0 transparent,
               0 8px 0 transparent,
               0 9px 0 transparent,
               0 10px 10px rgba(0, 0, 0, .6);
}

.features {
  margin-bottom: 2rem;
  
  h2 {
    font-size: 1.8rem;
    margin-bottom: 1rem;
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

    i {
      color: var(--accent);
    }
  }
}

.button-container {
  display: flex;
  justify-content: center;
}

.manage-button {
  font-size: 1.2rem;
  padding: 0.75rem 1.5rem;
}

/* Animation keyframes */
@keyframes bounce {
  100% {
    transform: translateY(-10px);
    text-shadow: 0 1px 0 #a0375b,
                0 2px 0 #a0375b,
                0 3px 0 #a0375b,
                0 4px 0 #a0375b,
                0 5px 0 #a0375b,
                0 6px 0 #a0375b,
                0 7px 0 #a0375b,
                0 8px 0 #a0375b,
                0 9px 0 #a0375b,
                0 30px 30px rgba(0, 0, 0, .3);
  }
}
</style>
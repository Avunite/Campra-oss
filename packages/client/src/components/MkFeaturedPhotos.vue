<template>
<div v-if="meta && meta.backgroundImageUrl" class="xfbouadm">
  <picture>
    <source v-if="optimizedBackgroundUrl" :srcset="optimizedBackgroundUrl" type="image/webp">
    <img 
      v-if="meta.backgroundImageUrl" 
      :src="meta.backgroundImageUrl" 
      alt="Featured background" 
      fetchpriority="high"
      loading="eager"
      decoding="async"
      importance="high"
    />
  </picture>
</div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import * as os from '@/os';

// Define a minimal interface for metadata to avoid dependency on calckey-js
interface InstanceMetadata {
  backgroundImageUrl?: string;
  [key: string]: any;
}

const meta = ref<InstanceMetadata | null>(null);
const imageLoaded = ref(false);

// Function to generate optimized image URL or WebP version if possible
const optimizedBackgroundUrl = computed(() => {
  if (!meta.value?.backgroundImageUrl) return null;
  
  // Check if URL contains any common image CDNs that support optimization
  const url = meta.value.backgroundImageUrl;
  
  // If URL contains query parameters, attempt to add optimization
  if (url.includes('?')) {
    return `${url}&format=webp&optimize=medium`;
  } else {
    return `${url}?format=webp&optimize=medium`;
  }
});

// Optimized image loading with priority hints
onMounted(async () => {
  // Add preload link with high priority
  const preloadLink = document.createElement('link');
  preloadLink.rel = 'preload';
  preloadLink.as = 'image';
  preloadLink.href = location.origin + '/static/splash.webp'; // Default image
  preloadLink.fetchPriority = 'high';
  document.head.appendChild(preloadLink);
  
  // Fetch metadata with high priority
  try {
    // Use Promise.race to ensure we don't wait too long
    const metaPromise = os.api('meta', { detail: true });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Metadata fetch timeout')), 3000)
    );
    
    meta.value = await Promise.race([metaPromise, timeoutPromise]) as any;
    
    // Update preload link once we have the real image
    if (meta.value?.backgroundImageUrl) {
      preloadLink.href = meta.value.backgroundImageUrl;
      
      // Create additional image object to start loading immediately
      const img = new Image();
      img.src = meta.value.backgroundImageUrl;
      img.onload = () => {
        imageLoaded.value = true;
      };
    }
  } catch (error) {
    console.error('Failed to fetch metadata:', error);
    // Load default fallback image
    meta.value = { backgroundImageUrl: '/static/splash.webp' } as any;
  }
});
</script>

<style lang="scss" scoped>
.xfbouadm {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  contain: paint layout size; /* Improve performance by isolating this element */
  
  > picture {
    width: 100%;
    height: 100%;
    display: block;
  }
  
  > picture > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background-position: center;
    background-size: cover;
    will-change: transform; /* Optimize for GPU acceleration */
    transform: translateZ(0); /* Force GPU rendering */
    backface-visibility: hidden; /* Reduce paint complexity */
    image-rendering: auto; /* Optimize image quality-speed balance */
  }
}
</style>

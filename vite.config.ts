import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('vue')) return 'vue';
            if (id.includes('chart.js')) return 'chart';
            if (id.includes('@tensorflow/tfjs')) return 'tensorflow';
            if (id.includes('katex')) return 'katex';
            if (id.includes('phosphor-icons')) return 'icons';
            if (id.includes('@bull-board')) return 'bull-board';
          }
          
          // Feature-based chunks
          if (id.includes('MkUrlPreview')) return 'url-preview';
          if (id.includes('MkFormulaCore')) return 'formula';
          if (id.includes('MkChart')) return 'chart';
          
          // Default vendor chunk for other node_modules
          if (id.includes('node_modules')) return 'vendor';
        }
      }
    }
  }
}); 
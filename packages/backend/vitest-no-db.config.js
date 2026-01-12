import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// Custom Vitest configuration that doesn't require a database
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup-no-db.js'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    mockReset: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});

#!/usr/bin/env node

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure test paths
const testFiles = [
  resolve(__dirname, 'test/**/*.test.{js,ts}')
];

// Run Vitest programmatically
import { run } from 'vitest';

run({
  include: testFiles,
  environment: 'node',
  globals: true,
  root: __dirname,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});

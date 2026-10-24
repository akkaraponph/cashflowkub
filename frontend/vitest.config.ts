import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' } },
      {
        extends: true,
        test: {
          name: 'api',
          include: ['tests/api/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/setup/env.ts'],
          globalSetup: ['tests/setup/global-setup.ts'],
          fileParallelism: false,
        },
      },
      { extends: true, test: { name: 'e2e', include: ['tests/e2e/**/*.test.ts'], environment: 'node' } },
    ],
  },
});

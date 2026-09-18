import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import solid from 'vite-plugin-solid';
export default defineConfig({
  plugins: [solid()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'], restoreMocks: true },
});

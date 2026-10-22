import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwind()],
  server: { proxy: { '/api': 'http://localhost:3000', '/uploads': 'http://localhost:3000' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    css: false,
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, statements: 80, branches: 80, functions: 80 },
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/test-setup.ts', 'src/main.tsx', 'src/lib/types.ts'],
    },
  },
});

/**
 * @file playwright.config.js
 * @brief Configuration Playwright pour les tests end-to-end (E2E)
 * Configure les navigateurs, timeouts, parallélisme et reporting pour les tests E2E
 * Optimisé pour des tests rapides avec 8 workers en parallèle
 */

// @ts-check
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  
  // Timeout par test
  timeout: 30 * 1000,
  
  // Expect timeout
  expect: {
    timeout: 5000
  },
  
  // Configuration parallélisme optimisé
  fullyParallel: true, // Activer le parallélisme pour accélérer les tests
  forbidOnly: false,
  retries: 0,
  workers: 8, // 8 workers pour accélérer les tests E2E
  
  // Reporter
  reporter: 'html',
  
  use: {
    // Screenshots et vidéos en cas d'échec
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],
})

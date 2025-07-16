/**
 * @file vitest.config.js
 * @brief Configuration Vitest pour les tests unitaires et d'intégration
 * Configure l'environnement JSDOM, les patterns de fichiers de test, la couverture de code
 * et exclut les tests E2E qui sont gérés par Playwright
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Environnement DOM pour tester les interactions SVG/Canvas
    environment: 'jsdom',
    
    // Variables globales (describe, it, expect)
    globals: true,
    
    // Setup files
    setupFiles: ['./test/setup.js'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'html/',
        'latex/',
        'build/'
      ]
    },
    
    // Test files patterns - inclut unit et integration, exclut E2E
    include: [
      'test/unit/**/*.{test,spec}.{js,ts}',
      'test/integration/**/*.{test,spec}.{js,ts}',
      'test/**/*.{test,spec}.{js,ts}'
    ],
    exclude: ['test/e2e/**/*'],
    
    // Mock les modules externes si nécessaire
    server: {
      deps: {
        external: ['electron']
      }
    }
  }
})

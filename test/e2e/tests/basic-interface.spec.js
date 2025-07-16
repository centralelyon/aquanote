import { test, expect } from '../fixtures.js'
import { getTestData, loadTestRace } from '../helpers/test-helpers.js'
import { setupMocks, setupBasicMocks, setupDiagnosticListeners, initializeBasicApplication, mockConfigurations } from '../helpers/mock-setup.js'

/**
 * @file basic-interface.spec.js
 * @brief Tests E2E pour l'interface principale et navigation de base
 * @details Teste le chargement de l'interface, responsivité et sélection de données
 * Valide les interactions utilisateur fondamentales de l'application
 */
test.describe('Interface principale - Tests de base', () => {
  test.beforeEach(async ({ page, server }) => {
    // Configuration des mocks simplifiés pour éviter les problèmes de timeout
    await setupBasicMocks(page);
    setupDiagnosticListeners(page);

    // Navigation vers l'application via le serveur de développement
    await page.goto(server);
    await initializeBasicApplication(page);
  })

  test('devrait charger l\'interface principale', async ({ page }) => {
    // Test de diagnostic : vérifier que les mocks fonctionnent
    console.log('=== Test de diagnostic ===');
    
    // Vérifier que la page de base est chargée
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#competition')).toBeVisible();
    
    // Vérifier que les éléments de contrôle sont présents
    await expect(page.locator('#run_part1')).toBeVisible();
    await expect(page.locator('#run_part2')).toBeVisible();
    await expect(page.locator('#run_part3')).toBeVisible();
    await expect(page.locator('#run_part4')).toBeVisible();
    
    // Vérifier que le bouton de chargement est présent
    await expect(page.locator('#loadbtn')).toBeVisible();
    
    // Tester une requête de compétitions pour vérifier que les mocks fonctionnent
    const competitionOptions = await page.locator('#competition option').count();
    console.log(`Nombre d'options de compétition: ${competitionOptions}`);
    
    if (competitionOptions > 1) {
      const options = await page.locator('#competition option').allTextContents();
      console.log('Options de compétition disponibles:', options);
    }
  })

  test('devrait être responsive', async ({ page }) => {
    // Test avec différentes tailles d'écran
    await page.setViewportSize({ width: 1200, height: 800 })
    await expect(page.locator('#competition')).toBeVisible()

    await page.setViewportSize({ width: 800, height: 600 })
    await expect(page.locator('#competition')).toBeVisible()

    await page.setViewportSize({ width: 400, height: 600 })
    await expect(page.locator('#competition')).toBeVisible()
    
    // Vérifier que les éléments de base restent visibles sur mobile
    await expect(page.locator('#loadbtn')).toBeVisible()
  })

  test('devrait gérer le chargement de données JSON', async ({ page }) => {
    // Pour ce test, nous avons besoin de mocks plus complets
    const { testData, testDataPath, testVideoPath } = getTestData();
    await setupMocks(page, testData, testDataPath, testVideoPath, mockConfigurations.fullData);
    
    // Utiliser la fonction helper pour charger la course de test
    await loadTestRace(page)
    
    // Cliquer sur l'onglet de vérification des graphiques pour les rendre visibles
    await page.click('#tab-verification-charts')
    
    await page.waitForSelector('#stats', { timeout: 20000 })
    
    // Vérifier que les données JSON sont bien gérées
    await expect(page.locator('#stats')).toBeVisible()
    await expect(page.locator('#cyclebar')).toBeVisible()
  })

  test('devrait permettre de sélectionner une compétition, une course, la charger puis changer les paramètres', async ({ page }) => {
    // Pour ce test complexe, nous avons besoin de mocks complets
    const { testData, testDataPath, testVideoPath } = getTestData();
    await setupMocks(page, testData, testDataPath, testVideoPath, mockConfigurations.fullData);
    
    // 1. Charger la première configuration
    await loadTestRace(page)
    
    // Cliquer sur l'onglet de vérification des graphiques pour les rendre visibles
    await page.click('#tab-verification-charts')
    
    // Attendre que la première course soit chargée
    await page.waitForSelector('#stats', { timeout: 20000 })
    await expect(page.locator('#stats')).toBeVisible()
    
    // 2. Tester le changement de configuration avec la même compétition
    // Attendre que le sélecteur de nageur soit disponible
    await page.waitForFunction(() => {
      const select = document.querySelector('#swim_switch');
      return select && select.options.length > 1;
    }, { timeout: 10000 });
    
    // Changer de nageur pour tester la réactivité
    await page.locator('#swim_switch').selectOption({ index: 1 })
    await page.waitForTimeout(1000)
    
    // Vérifier que les graphiques sont toujours fonctionnels
    await expect(page.locator('#stats')).toBeVisible()
    await expect(page.locator('#cyclebar')).toBeVisible()
  })
})

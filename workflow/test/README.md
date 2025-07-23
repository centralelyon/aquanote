# Documentation des Tests - Projet Neptune

Ce document présente l'ensemble des tests du projet d'annotation de natation Neptune, leur organisation et leur couverture.

## 📁 Structure des Tests

```
test/
├── README.md                           # Cette documentation
├── setup.js                            # Configuration Vitest
├── utils/
│   └── video-generator.js              # Utilitaire de génération de vidéos MP4 pour tests
├── unit/                               # Tests unitaires
│   ├── cycles_handler.test.js          # Tests logiques cycles_handler
│   ├── homography_handler.test.js      # Tests logiques homography_handler
│   ├── side_views.test.js              # Tests logiques side_views
│   └── svg_rendering.test.js           # Tests de rendu SVG/D3
├── integration/                        # Tests d'intégration
│   ├── cycles_handler.test.js          # Tests intégration cycles_handler
│   └── IMPROVEMENTS.md                 # Documentation améliorations tests
└── e2e/                               # Tests End-to-End (Playwright)
    ├── fixtures.js                     # Configuration commune E2E
    ├── annotation.spec.js              # Tests complets d'annotation
    ├── basic.spec.js                   # Tests de base serveur
    ├── bars-functionality.spec.js      # Tests fonctionnalités barres
    ├── complete.spec.js                # Tests complets avec vidéos
    └── video.spec.js                   # Tests spécifiques vidéo
```

## 🧪 Types de Tests

### Tests Unitaires (`unit/`)

#### `cycles_handler.test.js`
**Objectif** : Tester la logique pure des fonctions de gestion des cycles  
**Framework** : Vitest  
**Couverture** :
- ✅ Logique `findCycleIndexAtFrame` (recherche de cycles par frame)
- ✅ Formatage et validation des données de cycles
- ✅ Calculs mathématiques de base

**Tests inclus** :
- Recherche de cycle par numéro de frame
- Gestion des cas limites (frames négatives, cycles vides)
- Validation de la logique de tri temporel

#### `homography_handler.test.js`
**Objectif** : Tester les transformations géométriques et calculs de perspective  
**Framework** : Vitest  
**Couverture** :
- ✅ Logique de transformation de coordonnées (`getPoolBar`)
- ✅ Calculs de mise à l'échelle (pool_vid_xscale, pool_vid_yscale)
- ✅ Gestion des transformations de perspective (PerspT)

**Tests inclus** :
- Calculs de coordonnées transformées
- Gestion des cas limites (bords de l'image)
- Validation des paramètres de transformation

#### `side_views.test.js` 
**Objectif** : Tester les fonctions de vues latérales et statistiques  
**Framework** : Vitest  
**Couverture** :
- ✅ Formatage des temps (mm:ss.cc)
- ✅ Calculs de distances entre points
- ✅ Conversions d'unités et validations

**Tests inclus** :
- Formatage temporel avec gestion des centisecondes
- Calculs de distances euclidiennes
- Gestion des valeurs limites et erreurs

#### `svg_rendering.test.js`
**Objectif** : Tester le rendu SVG et les interactions D3.js  
**Framework** : Vitest + D3  
**Couverture** :
- ✅ Création d'éléments SVG
- ✅ Ajout de barres de cycles
- ✅ Transformations et animations D3

**Tests inclus** :
- Création et configuration des conteneurs SVG
- Rendu des barres de cycles avec données dynamiques
- Validation des attributs et styles D3

### Tests d'Intégration (`integration/`)

#### `cycles_handler.test.js`
**Objectif** : Tester l'intégration des fonctions `cycles_handler.js`  
**Framework** : Vitest avec mocks complets  

**Fonctions testées complètement** :
- ✅ `findCycleIndexAtFrame` - Recherche de cycles (performance, robustesse, cas limites)
- ✅ `mode_color` - Dictionnaire de couleurs (intégrité, format, cohérence)
- ✅ `edit_lab_flipper` - Contrôle d'affichage des labels
- ✅ `highlightCycle` / `resetHigh` - Interactions D3 de surlignage

**Fonctions testées partiellement** :
- ⚠️ `updateBarsFromEvent` - Tests structurels (logique de filtrage, paramètres)
- ⚠️ `makeBar` - Tests de structure (données, calculs de base)

**Pourquoi certaines fonctions ne sont que partiellement testées** :
- Couplage DOM fort (manipulation directe via `document.getElementById`)
- Dépendances multiples (jQuery, D3, Canvas API, variables globales)
- État global partagé (modification de variables affectant d'autres modules)

**Tests spéciaux** :
- 🚀 Tests de performance avec 1000+ éléments
- 🛡️ Tests de robustesse (données corrompues, types mixtes)
- 🔄 Tests d'intégration entre fonctions
- 📊 Tests de cohérence temporelle et visuelle

### Tests End-to-End (`e2e/`)

#### `annotation.spec.js` (Tests principaux)
**Objectif** : Tests complets de l'application d'annotation  
**Framework** : Playwright  
**Navigateurs** : Chromium, Firefox, WebKit

**Scénarios testés** :
- ✅ Chargement interface principale
- ✅ Sélection et chargement de courses complètes
- ✅ Navigation entre compétitions (Budapest ↔ Montpellier)
- ✅ Affichage des graphiques et barres de cycles
- ✅ Sélection de nageurs et synchronisation des vues
- ✅ Interactions avec les barres de cycles
- ✅ Chargement et initialisation de vidéos
- ✅ Tests de responsivité (1200px → 400px)
- ✅ **Mise à jour dynamique des graphiques lors d'ajout de barres/annotations**
- ✅ **Navigation vidéo via clic sur graphiques (barres/points dans #stats, #cyclebar, #cycle_stats)**
- ✅ **Synchronisation temps réel graphiques-annotations-vidéo**
- ✅ **Tests d'interaction utilisateur avec éléments SVG (rect, circle, path)**
- ✅ **Vérification de synchronisation timebar-vidéo lors de clics sur graphiques**
- ✅ **Tests des tableaux de données synchronisés avec graphiques**
- ✅ **Navigation entre onglets avec persistance des graphiques**

**Tests de graphiques spécialisés** :
- 📊 **#cyclebar** : Distance par cycle (interactions rect/circle)
- 📊 **#stats** : Distance par seconde (interactions rect/circle/path)  
- 📊 **#cycle_stats** : Fréquence de cycle par vitesse (interactions circle)
- 🎯 **Synchronisation bidirectionnelle** : Graphiques ↔ Vidéo ↔ Timeline
- ⚙️ **Tests modes d'affichage** : swim/last/all avec validation graphiques
- 🔄 **Persistance état** : Navigation onglets sans perte de données

**Données mockées** :
- Vidéos MP4 générées dynamiquement
- Métadonnées de compétitions (Budapest, Montpellier)
- Données de nageurs et cycles
- Modèles ML pour prédiction

#### `bars-functionality.spec.js`
**Objectif** : Tests spécifiques des fonctionnalités de barres  
**Framework** : Playwright

**Fonctionnalités testées** :
- ✅ Création et affichage des barres de cycles
- ✅ Interactions utilisateur (clic, sélection)
- ✅ Synchronisation entre vues multiples
- ✅ Mise à jour dynamique lors des changements

**Helpers inclus** :
- `loadTestRace()` - Chargement standard d'une course
- `createMockBarData()` - Génération de données de test

#### `complete.spec.js`
**Objectif** : Tests complets avec intégration vidéo  
**Framework** : Playwright

**Scénarios avancés** :
- ✅ Chargement complet application + vidéo
- ✅ Tests avec vidéos longues (5+ secondes)
- ✅ Validation du cycle complet de l'application

#### `video.spec.js`
**Objectif** : Tests spécifiques du système vidéo  
**Framework** : Playwright

**Tests vidéo** :
- ✅ Chargement et affichage de vidéos mockées
- ✅ Contrôles vidéo (play/pause/seek)
- ✅ Synchronisation vidéo-annotations

#### `basic.spec.js`
**Objectif** : Tests de base du serveur et connectivité  
**Framework** : Playwright

**Tests fondamentaux** :
- ✅ Chargement application via HTTP
- ✅ Mocks de base (package.json, endpoints essentiels)
- ✅ Validation de la connectivité serveur

## 🛠️ Utilitaires de Test

#### `utils/video-generator.js`
**Objectif** : Génération de vidéos MP4 minimales pour tests  
**Fonctionnalités** :
- Création de vidéos MP4 valides avec durée/résolution personnalisées
- Optimisation pour tests rapides
- Format compatible avec les navigateurs

#### `fixtures.js`
**Objectif** : Configuration commune pour tests E2E  
**Fonctionnalités** :
- Configuration serveur de développement
- Mocks réseau partagés
- Utilities communes Playwright

## 📊 Couverture de Test

### ✅ Complètement Testé
- **Logique pure** : Calculs, transformations, formatage
- **Fonctions simples** : `findCycleIndexAtFrame`, `mode_color`, formatage temps
- **Rendu SVG** : Création éléments, attributs D3
- **Interface utilisateur** : Navigation, sélections, chargements

### ⚠️ Partiellement Testé  
- **Fonctions complexes** : `updateBarsFromEvent`, `makeBar`
- **Intégrations lourdes** : Modules avec nombreuses dépendances

### 🎯 Recommandations E2E
- **Rendu visuel complet** : Validation de l'affichage réel
- **Interactions utilisateur complexes** : Workflows complets
- **Performance** : Tests avec vraies données volumineuses

## 🚀 Exécution des Tests

### Tests Unitaires et Intégration
```bash
# Tous les tests Vitest
npm test

# Tests unitaires seulement
npm test unit/

# Tests d'intégration seulement  
npm test integration/

# Mode watch pour développement
npm test --watch
```

### Tests E2E
```bash
# Tous les tests E2E
npx playwright test

# Tests spécifiques
npx playwright test annotation.spec.js
npx playwright test bars-functionality.spec.js

# Mode debug
npx playwright test --debug

# Tests avec interface graphique
npx playwright test --ui
```

### Configuration et Mocks
```bash
# Installation des dépendances
npm install

# Setup Playwright
npx playwright install
```

## 📈 Métriques de Test

### Performance
- **Tests unitaires** : < 100ms par test
- **Tests intégration** : < 500ms par test  
- **Tests E2E** : < 30s par scénario complet

### Robustesse
- **Cas limites** : Données vides, valeurs extrêmes, types invalides
- **Gestion d'erreurs** : Exceptions, timeouts, échecs réseau
- **Compatibilité** : Multi-navigateurs, résolutions diverses

## 🔄 Maintenance

### Mise à jour de cette documentation
Ce fichier doit être mis à jour lors de :
- ✅ Ajout de nouveaux tests
- ✅ Modification de la structure des tests
- ✅ Changement des objectifs de couverture
- ✅ Évolution des outils de test

### Bonnes pratiques
- **Nommage** : Tests descriptifs avec objectifs clairs
- **Isolation** : Chaque test doit être indépendant  
- **Mocks** : Minimiser les dépendances externes
- **Documentation** : Expliquer les choix de test complexes

---

**Dernière mise à jour** : Juillet 2025  
**Maintenu par** : Équipe Neptune  
**Outils** : Vitest, Playwright, D3.js
# Lancer les tests E2E
npm run test:e2e

# Tests E2E en mode headed (avec navigateur visible)
npx playwright test --headed

# Tests E2E d'un fichier spécifique
npx playwright test test/e2e/bars-functionality.spec.js
```

### Tous les tests

```bash
# Lancer tous les tests (Vitest + Playwright)
npm run test:all
```

## Types de Tests

### Tests Unitaires (`test/unit/`)

Testent des fonctions individuelles en isolation :
- **homography_handler.test.js** : Tests des transformations homographiques
- **side_views.test.js** : Tests des fonctions de vue latérale et statistiques
- **svg_rendering.test.js** : Tests du rendu SVG

### Tests d'Intégration (`test/integration/`)

Testent l'interaction entre plusieurs composants :
- **cycles_handler.test.js** : Tests de la gestion des cycles et barres d'annotation

### Tests E2E (`test/e2e/`)

Testent l'application complète dans un navigateur :
- **annotation.spec.js** : Tests généraux de l'application
- **bars-functionality.spec.js** : Tests spécifiques aux barres d'annotation

## Configuration

### Vitest (vitest.config.js)

- **Environnement** : jsdom pour simuler le DOM
- **Globaux** : describe, it, expect disponibles sans import
- **Setup** : Fichier `test/setup.js` chargé automatiquement
- **Coverage** : Rapport de couverture avec v8

### Playwright (playwright.config.js)

- **Navigateurs** : Chrome, Firefox, Safari
- **Serveur local** : Démarre automatiquement un serveur HTTP
- **Fixtures** : Gestion automatique des ports et ressources

## Mocking et Fixtures

### Variables Globales Mockées

Le fichier `test/setup.js` configure automatiquement :
- DOM via jsdom
- jQuery et plugins UI
- D3.js
- PerspT (transformations de perspective)
- fetch API
- ResizeObserver

### Fixtures Playwright

Le fichier `test/e2e/fixtures.js` fournit :
- Serveur HTTP local avec gestion automatique des ports
- Génération de vidéos MP4 minimales pour les tests
- Mocking des requêtes réseau

## CI/CD (GitHub Actions)

Le workflow `.github/workflows/ci.yml` exécute automatiquement :

1. **Setup** : Installation des dépendances
2. **Lint** : Vérification du code avec ESLint  
3. **Tests Vitest** : Tests unitaires et d'intégration
4. **Coverage** : Génération du rapport de couverture
5. **Tests E2E** : Tests Playwright
6. **Documentation** : Génération de la documentation Doxygen

## Bonnes Pratiques

### Écriture de Tests

1. **Nommage** : Utilisez des descriptions claires
   ```javascript
   describe('FunctionName', () => {
     it('devrait faire quelque chose de spécifique', () => {
       // test
     })
   })
   ```

2. **Isolation** : Chaque test doit être indépendant
   ```javascript
   beforeEach(() => {
     // Reset des mocks/état
   })
   ```

3. **Assertions claires** : Utilisez des matchers expressifs
   ```javascript
   expect(result).toBeInstanceOf(Array)
   expect(result).toHaveLength(2)
   expect(result[0]).toBeTypeOf('number')
   ```

### Debugging

1. **Mode UI** : `npm run test:ui` pour interface graphique
2. **Tests spécifiques** : `npx vitest run test/unit/specific.test.js`
3. **Mode debug E2E** : `npx playwright test --headed --debug`

## Migration depuis Mocha

✅ **Terminé** : Tous les tests Mocha ont été migrés vers Vitest
- Suppression des fichiers `test_mocha.mjs` et `test_homography.mjs`
- Nouvelle structure organisée en `unit/` et `integration/`
- Workflow GitHub mis à jour
- Commentaires dans le code source nettoyés

## Ressources

- [Documentation Vitest](https://vitest.dev/)
- [Documentation Playwright](https://playwright.dev/)
- [Matchers Vitest](https://vitest.dev/api/expect.html)
- [API Playwright](https://playwright.dev/docs/api/class-page)

## 📈 Tests Spécialisés des Graphiques

### Tests de Mise à Jour Dynamique des Graphiques

#### `devrait mettre à jour dynamiquement les graphiques lors de l'ajout de barres`
**Objectif** : Vérifier que les graphiques se mettent à jour en temps réel lors de l'ajout d'annotations/barres

**Graphiques testés** :
- `#cyclebar` - Distance par cycle (SVG ViewBox 0 0 200 200)
- `#stats` - Distance par seconde (SVG ViewBox 0 0 200 200)  
- `#cycle_stats` - Fréquence de cycle par vitesse (SVG ViewBox 0 0 200 200)

**Processus de test** :
1. Chargement complet d'une course (Budapest brasse hommes 100m finaleA)
2. Activation mode cycle (`#btn-cycle`)
3. Comptage initial des éléments graphiques
4. Simulation d'ajout d'annotations via déplacement timeline + clics vidéo
5. Vérification que le nombre d'éléments graphiques ≥ nombre initial
6. Validation des ViewBox SVG correctes

### Tests d'Interaction avec les Graphiques

#### `devrait permettre de cliquer sur les barres et points des graphiques pour naviguer dans la vidéo`
**Objectif** : Vérifier que les clics sur éléments graphiques déclenchent la navigation vidéo

**Éléments interactifs testés** :
- `#cyclebar rect` - Barres de cycles (rectangles)
- `#cyclebar circle` - Points de cycles (cercles)
- `#stats rect|circle|path` - Tous éléments graphiques de vitesse
- `#cycle_stats circle|path` - Éléments de fréquence

**Processus de test** :
1. Chargement complet d'une course avec vidéo
2. Enregistrement temps vidéo initial (`video.currentTime`)
3. Détection et comptage des éléments cliquables par graphique
4. Simulation de clics sur chaque type d'élément
5. Vérification changement de temps vidéo après chaque clic
6. Validation synchronisation `#timebar` avec navigation

**Logs de debug inclus** :
```javascript
console.log('Éléments cyclebar:', {rects, circles, lines, paths})
console.log(`Temps vidéo initial: ${initialVideoTime}`)
console.log(`Temps vidéo après clic: ${newVideoTime}`)
```

### Tests de Synchronisation Graphiques-Annotations-Vidéo

#### `devrait synchroniser les graphiques avec les annotations et la vidéo en temps réel`
**Objectif** : Vérifier la synchronisation complète entre tous les éléments de l'interface

**Scénarios de synchronisation testés** :
1. **Changement de nageur** : Sélection via `#swim_switch` → mise à jour graphiques
2. **Modes d'affichage** : `#kmod` (swim/last/aucun) → adaptation graphiques
3. **Types d'annotations** : `#btn-respi` ↔ `#btn-cycle` → cohérence visuelle
4. **Navigation onglets** : `#tab-data-plot-tout` ↔ `#tab-verification-charts` → persistance

**Validations continues** :
- Visibilité maintenue des 3 graphiques après chaque changement
- Fonctionnalité `#timebar` et `#vid` préservée
- Classes CSS actives correctes sur boutons de mode

## 🎯 Spécificités Techniques des Tests de Graphiques

### Éléments SVG Supportés
- **Rectangles** (`rect`) : Barres de cycles, segments de données
- **Cercles** (`circle`) : Points de données, marqueurs temporels
- **Chemins** (`path`) : Courbes de tendance, lignes de données
- **Lignes** (`line`) : Axes, séparateurs, connexions

### Assertions Clés
```javascript
// Vérification ViewBox correctes
expect(statsViewBox).toBe('0 0 200 200')

// Vérification mise à jour éléments
expect(finalElements).toBeGreaterThanOrEqual(initialElements)

// Vérification navigation vidéo
expect(finalVideoTime).not.toBe(initialVideoTime)

// Vérification visibilité maintenue
await expect(page.locator('#stats')).toBeVisible()
```

### Gestion des Cas Limites
- **Graphiques vides** : Tests fonctionnent même sans éléments graphiques
- **Données manquantes** : Validation que les conteneurs SVG restent valides
- **Changements rapides** : `waitForTimeout()` pour stabilisation DOM
- **États transitoires** : Vérifications multiples avec retry automatique

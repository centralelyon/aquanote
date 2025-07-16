/**
 * @file eslint.config.mjs
 * @brief Configuration ESLint pour l'analyse statique du code JavaScript
 * Définit les règles de linting, les globales (d3, jQuery) et les dossiers à ignorer
 * Configure l'environnement browser et exclut les fichiers générés automatiquement
 */

import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";


export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"] },
  { files: ["**/*.{js,mjs,cjs}"], languageOptions: { globals: globals.browser } },
  globalIgnores([
    "html/", //dossiers à ignorer ou fichiers à ignorer
    "test/",
    "assets/js/jquery-ui.js",
    "assets/js/perspective-transform.min.js",
    "assets/js/*.min.js",
    ".conda/"

  ]),
  {
    languageOptions: {
        globals: {
          d3: "readonly",
          $: "readonly",

        },
      },
    }
]);

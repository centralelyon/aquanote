/**
 * @file preload.cjs
 * @brief Script de préchargement Electron pour exposer les APIs système au renderer
 * Fournit un pont sécurisé entre le processus principal et le renderer via contextBridge
 * Expose les fonctions de lecture de fichiers, navigation de dossiers et gestion des courses
 */

const { contextBridge, ipcRenderer } = require('electron');

const fs = require('fs');
const path = require('path');
contextBridge.exposeInMainWorld('myAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  getLocalRuns: (base, comp) => {
    try {
      const dir = path.join(base, comp);
      return fs.readdirSync(dir)
        .filter(f => fs.statSync(path.join(dir, f)).isDirectory())
        .map(f => ({ name: f, type: "directory" }));
    } catch (e) {
      console.error("Erreur lecture runs :", e);
      return [];
    }
  },
  getLocalFiles: (base, comp, run) => {
    try {
      const dir = path.join(base, comp, run);
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.csv'))
        .map(f => ({ name: f, type: "file" }));
    } catch (e) {
      console.error("Erreur lecture fichiers :", e);
      return [];
    }
  },
  readJsonFile: (base, comp, run, file) => {
    return new Promise((resolve, reject) => {
      const filePath = path.join(base, comp, run, file);
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return reject(err);
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
  },
  readCsvFile: (base, comp, run, file) => {
    return new Promise((resolve, reject) => {
      const filePath = path.join(base, comp, run, file);
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return reject(err);
        try {
          const parsed = d3.csvParse(data, { header: true, dynamicTyping: true });
          resolve(parsed.data);
        } catch (e) {
          reject(e);
        }
      });
    });
  },
  getLocalCompetitions: (dirPath) => {
  if (!dirPath) return [];
  try {
    return fs.readdirSync(dirPath)
      .filter(f => fs.statSync(path.join(dirPath, f)).isDirectory())
      .map(f => ({ name: f }));
  } catch (e) {
    console.error("Erreur lecture dossier:", e);
    return [];
  }
}
});
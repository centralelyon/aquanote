/**
 * @file index.js
 * @brief Processus principal Electron pour l'application d'annotation natation
 * Gère la création des fenêtres, les dialogs de sélection de dossier et les événements du cycle de vie
 * Configure la sécurité avec contextIsolation et preload script
 */

/* global process */
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { ipcMain,dialog,} from 'electron';

ipcMain.handle('dialog:openFolder', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory', 'dontAddToRecent', 'modal'],
    message: 'Choisissez le dossier racine contenant vos compétitions et runs.'
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      //enableRemoteModule: false,
      preload: path.join(__dirname, './preload.cjs') 
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

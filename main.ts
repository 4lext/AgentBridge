import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import * as nativeHostRegistry from './native-host-registry';
import * as store from './store';
import fs from 'fs';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// --- Helper Functions ---
/**
 * Gets the absolute path to the bundled generic host script.
 * In dev mode, it points to the .js file in the electron folder.
 * In production, it points to the file packed by electron-builder.
 */
function getGenericHostScriptPath(): string {
  let scriptPath: string;
  if (!app.isPackaged) {
    // Development mode
    scriptPath = path.join(__dirname, 'agent-bridge-host.js');
  } else {
    // Production mode
    // This script is bundled into the 'build' dir, and `electron-builder`
    // will pack it. We need to tell electron-builder to include it
    // as an "extraResource" so it's in a predictable location.
    scriptPath = path.join(process.resourcesPath, 'agent-bridge-host.js');
  }
  
  // Ensure the host script is executable (for macOS/Linux)
  if (process.platform !== 'win32') {
    try {
      // Only chmod if the file exists
      if (fs.existsSync(scriptPath)) {
        fs.chmodSync(scriptPath, 0o755);
      }
    } catch (err) {
      console.error(`Could not set executable bit on ${scriptPath}: ${err.message}`);
    }
  }
  return scriptPath;
}


const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the index.html of the app.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built React app
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }
};

// --- App Lifecycle ---
app.on('ready', () => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- IPC Handlers ---

/**
 * Get all registered hosts from the store.
 */
ipcMain.handle('get-hosts', async () => {
  return store.getHosts();
});

/**
 * Install a new host.
 * This does two things:
 * 1. Installs the *generic* agent-bridge-host.js with the OS (Registry/manifest).
 * 2. Saves the *user's* script path to the config file for the generic host to read.
 */
ipcMain.handle('install-host', async (event, config: store.HostConfig) => {
  try {
    const genericHostScriptPath = getGenericHostScriptPath();
    if (!genericHostScriptPath || !fs.existsSync(genericHostScriptPath)) {
      throw new Error(`Could not find generic host script at ${genericHostScriptPath}`);
    }

    // 1. Install the manifest pointing to *our* generic host
    const manifestPath = await nativeHostRegistry.installHost({
      hostName: config.hostName,
      description: config.description,
      scriptPath: genericHostScriptPath, // This is the key!
      allowedOrigins: config.allowedOrigins,
    });

    // 2. Save the user's config for our generic host to find
    store.addHost(config);
    
    return { success: true, path: manifestPath };
  } catch (error) {
    console.error('Failed to install host:', error);
    return { success: false, error: (error as Error).message };
  }
});

/**
 * Uninstall a host.
 * This does two things:
 * 1. Uninstalls the host from the OS (Registry/manifest).
 * 2. Removes the host from the config file.
 */
ipcMain.handle('uninstall-host', async (event, hostName: string) => {
   try {
    // 1. Uninstall from OS
    await nativeHostRegistry.uninstallHost(hostName);

    // 2. Remove from config
    store.removeHost(hostName);

    return { success: true };
  } catch (error) {
    console.error('Failed to uninstall host:', error);
    return { success: false, error: (error as Error).message };
  }
});

/**
 * Show a file dialog to pick a script.
 */
ipcMain.handle('pick-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: 'Select script to execute',
  });
  if (canceled || filePaths.length === 0) {
    return null;
  }
  return filePaths[0];
});

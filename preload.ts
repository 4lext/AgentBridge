import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Define the API that will be exposed to the renderer process
const electronAPI = {
  // Main process -> Renderer (one-way)
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on(channel, listener);
  },
  // Renderer -> Main process (two-way)
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },
};

// Securely expose the API to the renderer process
try {
  contextBridge.exposeInMainWorld('electron', electronAPI);
} catch (error) {
  console.error('Failed to expose Electron API:', error);
}

// Define types for the exposed API on the window object
declare global {
  interface Window {
    electron: typeof electronAPI;
  }
}

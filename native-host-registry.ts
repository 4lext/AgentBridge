/**
 * Core Logic for managing Native Messaging Hosts.
 *
 * This file contains the platform-specific logic for installing, uninstalling,
 * and checking the status of native messaging host manifests for Chrome.
 *
 * This is a generic rewrite based on the logic from hi-desktop.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import WinReg from 'winreg';

export interface HostDefinition {
  hostName: string;
  description: string;
  scriptPath: string;
  allowedOrigins: string[];
}

/**
 * Gets the platform-specific root directory for Chrome's native messaging manifests.
 * @returns The absolute path to the manifest directory.
 * @throws {Error} if the platform is not supported.
 */
function getChromeNativeMessagingPath(): string {
  const homeDir = os.homedir();
  switch (process.platform) {
    case 'win32':
      // On Windows, the path is defined by the registry, not a specific folder.
      // We return the registry key path.
      return `HKEY_CURRENT_USER\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts`;
    case 'darwin':
      return path.join(
        homeDir,
        'Library',
        'Application Support',
        'Google',
        'Chrome',
        'NativeMessagingHosts'
      );
    case 'linux':
      return path.join(
        homeDir,
        '.config',
        'google-chrome',
        'NativeMessagingHosts'
      );
    default:
      throw new Error('Unsupported platform for Chrome Native Messaging.');
  }
}

/**
 * Gets the full path where a specific host's manifest file should be.
 * @param hostName The name of the host (e.g., "com.my_app.host").
 * @returns The absolute path to the .json manifest file.
 */
function getNativeHostManifestPath(hostName: string): string {
  const rootPath = getChromeNativeMessagingPath();
  if (process.platform === 'win32') {
    // On Windows, the path is the registry key itself.
    return path.join(rootPath, hostName);
  }
  // On macOS and Linux, it's a file in the directory.
  return path.join(rootPath, `${hostName}.json`);
}

/**
 * Writes the native host manifest file.
 * @param definition The host definition.
 * @param manifestPath The path to write the file to (for non-Windows).
 */
async function writeNativeHostManifest(
  definition: HostDefinition,
  manifestPath: string
): Promise<void> {
  const manifest = {
    name: definition.hostName,
    description: definition.description,
    path: definition.scriptPath,
    type: 'stdio',
    allowed_origins: definition.allowedOrigins.map(
      (origin) => `chrome-extension://${origin}/`
    ),
  };

  const manifestContent = JSON.stringify(manifest, null, 2);
  
  if (process.platform !== 'win32') {
    // On macOS/Linux, ensure the directory exists and write the file.
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, manifestContent);
    // Ensure the script is executable
    try {
      await fs.chmod(definition.scriptPath, 0o755);
    } catch (err) {
      console.warn(`Could not set executable bit on ${definition.scriptPath}: ${err.message}`);
    }
  }
}

/**
 * Registers the host in the Windows Registry.
 * @param hostName The name of the host.
 *Read(manifestPath) The path to the manifest .json file.
 */
async function registerRegistry(hostName: string, manifestPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const regKey = new WinReg({
      hive: WinReg.HKCU,
      key: `\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\${hostName}`,
    });

    regKey.create((err) => {
      if (err) return reject(new Error(`Failed to create registry key: ${err.message}`));
      
      regKey.set(WinReg.DEFAULT_VALUE, WinReg.REG_SZ, manifestPath, (err) => {
        if (err) return reject(new Error(`Failed to set registry value: ${err.message}`));
        resolve();
      });
    });
  });
}

/**
 * Un-registers the host from the Windows Registry.
 * @param hostName The name of the host.
 */
async function unregisterRegistry(hostName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const regKey = new WinReg({
      hive: WinReg.HKCU,
      key: `\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\${hostName}`,
    });

    regKey.destroy((err) => {
      // Ignore "key or value does not exist" errors, as it means it's already gone.
      if (err && !err.message.includes('key or value does not exist')) {
        return reject(new Error(`Failed to destroy registry key: ${err.message}`));
      }
      resolve();
    });
  });
}

/**
 * Installs a native messaging host for Chrome.
 * This handles platform-specific logic (Registry for Windows, .json for macOS/Linux).
 * @param definition The host definition.
 * @returns The path to the created manifest (file path or registry key).
 */
export async function installHost(definition: HostDefinition): Promise<string> {
  const manifestPath = getNativeHostManifestPath(definition.hostName);

  if (process.platform === 'win32') {
    // On Windows, we must create a *separate* manifest file AND register it.
    // We'll store the manifest file in the app's user data directory.
    const appDataBase = app.getPath('userData');
    const winManifestDir = path.join(appDataBase, 'NativeMessagingHosts');
    await fs.mkdir(winManifestDir, { recursive: true });
    
    const winManifestPath = path.join(winManifestDir, `${definition.hostName}.json`);
    await writeNativeHostManifest(definition, winManifestPath);
    
    // Now, register that file's path in the registry.
    await registerRegistry(definition.hostName, winManifestPath);
    return manifestPath; // Return the registry key path
  } else {
    // On macOS/Linux, just write the manifest to the correct directory.
    await writeNativeHostManifest(definition, manifestPath);
    return manifestPath; // Return the file path
  }
}

/**
 * Uninstalls a native messaging host.
 * @param hostName The name of the host to uninstall.
 */
export async function uninstallHost(hostName: string): Promise<void> {
  const manifestPath = getNativeHostManifestPath(hostName);

  if (process.platform === 'win32') {
    // On Windows, we must remove the registry key.
    // We can also try to remove the .json file we created.
    try {
      const regKey = new WinReg({
        hive: WinReg.HKCU,
        key: `\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\${hostName}`,
      });
      
      const winManifestPath = await new Promise<string>((resolve, reject) => {
        regKey.get(WinReg.DEFAULT_VALUE, (err, item) => {
          if (err) return reject(new Error(`Could not read registry key to find manifest: ${err.message}`));
          resolve(item.value);
        });
      });
      
      if (winManifestPath) {
        await fs.unlink(winManifestPath);
      }
    } catch (err) {
      console.warn(`Could not clean up manifest file: ${err.message}`);
    }
    // Finally, remove the registry key.
    await unregisterRegistry(hostName);

  } else {
    // On macOS/Linux, just delete the .json file.
    try {
      await fs.unlink(manifestPath);
    } catch (err) {
      if (err.code !== 'ENOENT') { // Ignore "file not found"
        throw new Error(`Failed to delete manifest file: ${err.message}`);
      }
    }
  }
}

/**
 * Checks if a native messaging host is correctly installed.
 * @param hostName The name of the host.
 * @returns A promise that resolves to true if installed, false otherwise.
 */
export async function checkHostStatus(hostName: string): Promise<boolean> {
  const manifestPath = getNativeHostManifestPath(hostName);

  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      const regKey = new WinReg({
        hive: WinReg.HKCU,
        key: `\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\${hostName}`,
      });
      regKey.keyExists((err, exists) => {
        if (err) {
          console.error(err);
          return resolve(false);
        }
        resolve(exists);
      });
    });
  } else {
    try {
      await fs.access(manifestPath, fs.constants.F_OK);
      return true;
    } catch (err) {
      return false;
    }
  }
}

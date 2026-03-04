import { ipcMain, dialog, shell, BrowserWindow } from "electron";
import * as fs from "fs";
import { getSaveDir, setSaveDir } from "../transfer";

interface AppConfig {
  saveDir?: string;
  useNativeFrame?: boolean;
  autoAcceptConnections?: boolean;
  minimizeToTray?: boolean;
  theme?: "dark" | "light";
}

export function registerSettingsHandlers(
  getMainWindow: () => BrowserWindow | null,
  loadConfig: () => AppConfig,
  saveConfig: (config: AppConfig) => void,
  connectionAuth: { setAutoAccept: (enabled: boolean) => void }
) {
  ipcMain.handle("open-save-dir", () => {
    shell.openPath(getSaveDir());
  });

  ipcMain.handle("get-save-dir", () => {
    return getSaveDir();
  });

  ipcMain.handle("select-save-dir", async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory", "createDirectory"],
      title: "选择下载目录",
    });
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle("set-save-dir", (_event, dir: string) => {
    try {
      setSaveDir(dir);
      const config = loadConfig();
      config.saveDir = dir;
      saveConfig(config);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle("get-window-frame-setting", () => {
    const config = loadConfig();
    return config.useNativeFrame ?? false;
  });

  ipcMain.handle("set-window-frame-setting", (_event, useNativeFrame: boolean) => {
    try {
      const config = loadConfig();
      config.useNativeFrame = useNativeFrame;
      saveConfig(config);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle("get-auto-accept-setting", () => {
    const config = loadConfig();
    return config.autoAcceptConnections ?? false;
  });

  ipcMain.handle("set-auto-accept-setting", (_event, enabled: boolean) => {
    try {
      const config = loadConfig();
      config.autoAcceptConnections = enabled;
      saveConfig(config);
      connectionAuth.setAutoAccept(enabled);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle("get-minimize-to-tray-setting", () => {
    const config = loadConfig();
    return config.minimizeToTray ?? false;
  });

  ipcMain.handle("set-minimize-to-tray-setting", (_event, enabled: boolean) => {
    try {
      const config = loadConfig();
      config.minimizeToTray = enabled;
      saveConfig(config);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle("get-theme-setting", () => {
    const config = loadConfig();
    return config.theme ?? "dark";
  });

  ipcMain.handle("set-theme-setting", (_event, theme: "dark" | "light") => {
    try {
      const config = loadConfig();
      config.theme = theme;
      saveConfig(config);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle("open-path", (_e, p: string) => {
    if (fs.existsSync(p)) {
      shell.showItemInFolder(p);
      return true;
    }
    return false;
  });

  ipcMain.handle("delete-file", async (_e, p: string) => {
    try {
      if (fs.existsSync(p)) {
        await fs.promises.unlink(p);
        return { success: true };
      }
      return { success: false, error: "File not found" };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle("delete-folder", async (_e, p: string) => {
    try {
      if (fs.existsSync(p)) {
        await fs.promises.rm(p, { recursive: true, force: true });
        return { success: true };
      }
      return { success: false, error: "Folder not found" };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });
}

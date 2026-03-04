import { ipcMain, BrowserWindow, app } from "electron";

export function registerWindowHandlers(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle("window-minimize", () => {
    getMainWindow()?.minimize();
  });

  ipcMain.handle("window-maximize", () => {
    const mainWindow = getMainWindow();
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });

  ipcMain.handle("window-close", () => {
    getMainWindow()?.close();
  });

  ipcMain.handle("restart-app", () => {
    app.relaunch();
    app.exit(0);
  });
}

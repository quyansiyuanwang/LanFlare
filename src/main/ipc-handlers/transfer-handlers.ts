import { ipcMain, dialog, BrowserWindow } from "electron";
import * as fs from "fs";
import { sendFile, sendFolder, sendText } from "../transfer";
import { getDeviceName } from "../utils";
import { Discovery } from "../discovery";
import { ConnectionAuth } from "../connection-auth";

export function registerTransferHandlers(
  getMainWindow: () => BrowserWindow | null,
  discovery: Discovery,
  connectionAuth: ConnectionAuth
) {
  ipcMain.handle("select-files", async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
    });
    return result.filePaths;
  });

  ipcMain.handle("select-folder", async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle(
    "send-files",
    async (
      _event,
      {
        deviceIp,
        devicePort,
        filePaths,
      }: { deviceIp: string; devicePort: number; filePaths: string[] }
    ) => {
      const fromName = getDeviceName();
      try {
        const devices = discovery.getDeviceList(true);
        const targetDevice = devices.find((d) => d.ip === deviceIp);

        if (targetDevice && !connectionAuth.isAuthorized(targetDevice.id)) {
          return { success: false, error: "未授权连接，请先请求连接" };
        }

        for (const filePath of filePaths) {
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            await sendFolder(deviceIp, devicePort, filePath, fromName);
          } else {
            await sendFile(deviceIp, devicePort, filePath, fromName);
          }
        }
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle(
    "send-folder",
    async (
      _event,
      {
        deviceIp,
        devicePort,
        folderPath,
      }: { deviceIp: string; devicePort: number; folderPath: string }
    ) => {
      const fromName = getDeviceName();
      try {
        const devices = discovery.getDeviceList(true);
        const targetDevice = devices.find((d) => d.ip === deviceIp);

        if (targetDevice && !connectionAuth.isAuthorized(targetDevice.id)) {
          return { success: false, error: "未授权连接，请先请求连接" };
        }

        await sendFolder(deviceIp, devicePort, folderPath, fromName);
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle(
    "send-text",
    async (
      _event,
      { deviceIp, devicePort, text }: { deviceIp: string; devicePort: number; text: string }
    ) => {
      const fromName = getDeviceName();
      try {
        const devices = discovery.getDeviceList(true);
        const targetDevice = devices.find((d) => d.ip === deviceIp);

        if (targetDevice && !connectionAuth.isAuthorized(targetDevice.id)) {
          return { success: false, error: "未授权连接，请先请求连接" };
        }

        await sendText(deviceIp, devicePort, text, fromName);
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );
}

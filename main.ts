import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  clipboard,
  nativeImage,
  Notification,
  shell,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import { Discovery } from "./src/main/discovery";
import {
  TransferServer,
  sendFile,
  sendFolder,
  sendText,
  sendClipboardData,
  SAVE_DIR,
} from "./src/main/transfer";
import { ClipboardSync } from "./src/main/clipboard-sync";
import { ConnectionAuth } from "./src/main/connection-auth";
import { WebReceiver, WEB_PORT } from "./src/main/web-receiver";
import { getDeviceName, getLocalIP } from "./src/main/utils";

let mainWindow: BrowserWindow | null;
let discovery: Discovery | null = null;
let transferServer: TransferServer | null = null;
let clipboardSync: ClipboardSync | null = null;
let connectionAuth: ConnectionAuth | null = null;
let webReceiver: WebReceiver | null = null;

// Web receiver settings (runtime state)
let webEnabled = false;
let webPassword = '';

// Notification debounce for multi-file / folder transfers
let notifTimer: NodeJS.Timeout | null = null;
let pendingNotifs: Array<{ type: string; fileName?: string; from: string; savePath?: string; folderName?: string; totalFiles?: number }> = [];

function scheduleNotification(info: { type: string; fileName?: string; from: string; savePath?: string; folderName?: string; totalFiles?: number }): void {
  if (!Notification.isSupported()) return;

  // Folder complete → immediate notification
  if (info.type === 'folder') {
    const body = `收到文件夹 "${info.folderName}" (${info.totalFiles} 个文件) 来自 ${info.from}`;
    const notif = new Notification({ title: "LanFlare", body });
    notif.on("click", () => {
      if (info.savePath) shell.showItemInFolder(info.savePath);
    });
    notif.show();
    return;
  }

  // Accumulate individual file notifications and debounce
  pendingNotifs.push(info);

  if (notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(() => {
    const items = pendingNotifs.splice(0);
    if (items.length === 0) return;

    let body: string;
    let clickPath: string | undefined;

    if (items.length === 1) {
      const item = items[0];
      body = item.type === 'text' || item.type === 'clipboard-text'
        ? `收到文本 来自 ${item.from}`
        : `收到 ${item.fileName} 来自 ${item.from}`;
      clickPath = item.savePath;
    } else {
      const from = items[0].from;
      body = `收到 ${items.length} 个文件 来自 ${from}`;
      clickPath = items[items.length - 1].savePath;
    }

    const notif = new Notification({ title: "LanFlare", body });
    notif.on("click", () => {
      if (clickPath) shell.showItemInFolder(clickPath);
    });
    notif.show();
    notifTimer = null;
  }, 1500);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: "#0a0a1a",
    webPreferences: {
      preload: path.join(__dirname, "src", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(
      __dirname, "..", "build",
      process.platform === "win32" ? "icon.ico" : "icon.png"
    ),
  });

  mainWindow.loadFile(path.join(__dirname, "..", "src", "renderer", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function startServices(): void {
  // Discovery
  discovery = new Discovery();
  discovery.start();
  discovery.on("devices-changed", (devices) => {
    if (mainWindow && discovery) {
      const includeSelf = !app.isPackaged;
      mainWindow.webContents.send("devices-changed", discovery?.getDeviceList(includeSelf));
    }
  });

  // Connection Authorization
  connectionAuth = new ConnectionAuth(discovery.deviceId);
  connectionAuth.start();
  connectionAuth.on("connection-request", (request) => {
    if (mainWindow) {
      mainWindow.webContents.send("connection-request", request);
    }
  });

  // Transfer Server
  transferServer = new TransferServer();
  transferServer.start();
  transferServer.on("transfer-start", (info) => {
    if (mainWindow) mainWindow.webContents.send("transfer-start", info);
  });
  transferServer.on("transfer-progress", (info) => {
    if (mainWindow) mainWindow.webContents.send("transfer-progress", info);
  });
  transferServer.on("transfer-complete", (info) => {
    if (mainWindow) mainWindow.webContents.send("transfer-complete", info);
    // Show system notification (debounced)
    scheduleNotification(info);
  });

  // Clipboard Sync
  clipboardSync = new ClipboardSync();
  clipboardSync.startServer();
  clipboardSync.on("clipboard-received", (info) => {
    if (mainWindow) mainWindow.webContents.send("clipboard-synced", info);
  });
  clipboardSync.on("peer-connected", (deviceId) => {
    if (mainWindow)
      mainWindow.webContents.send("clipboard-peer-status", {
        deviceId,
        connected: true,
      });
  });
  clipboardSync.on("peer-disconnected", (deviceId) => {
    if (mainWindow)
      mainWindow.webContents.send("clipboard-peer-status", {
        deviceId,
        connected: false,
      });
  });

  // Web Receiver
  webReceiver = new WebReceiver(transferServer);
  webReceiver.start();
}

// ---- IPC Handlers ----

ipcMain.handle("get-devices", () => {
  const includeSelf = !app.isPackaged;
  return discovery ? discovery.getDeviceList(includeSelf) : [];
});

ipcMain.handle("get-device-info", () => {
  return {
    name: getDeviceName(),
    ip: getLocalIP(),
    id: discovery ? discovery.deviceId : "",
    webUrl: `http://${getLocalIP()}:${WEB_PORT}`,
  };
});

ipcMain.handle("select-files", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile", "multiSelections"],
  });
  return result.filePaths;
});

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
  });
  return result.filePaths[0] ?? null;
});

// ---- Connection Authorization ----

ipcMain.handle(
  "request-connection",
  async (_event, { deviceIp, deviceId }: { deviceIp: string; deviceId: string }) => {
    try {
      if (!connectionAuth) throw new Error("连接授权服务未启动");
      const approved = await connectionAuth.requestConnection(deviceIp, deviceId);
      return { approved };
    } catch (e) {
      throw e;
    }
  }
);

ipcMain.handle("approve-connection", (_event, requestId: string) => {
  connectionAuth?.approveRequest(requestId);
  return { success: true };
});

ipcMain.handle("reject-connection", (_event, requestId: string) => {
  connectionAuth?.rejectRequest(requestId);
  return { success: true };
});

// ---- Send Operations ----

ipcMain.handle(
  "send-files",
  async (
    _event,
    {
      deviceIp,
      devicePort,
      filePaths,
    }: { deviceIp: string; devicePort: number; filePaths: string[] },
  ) => {
    const fromName = getDeviceName();
    try {
      // Find device by IP to check authorization
      const devices = discovery?.getDeviceList(true) || [];
      const targetDevice = devices.find(d => d.ip === deviceIp);
      
      if (targetDevice && connectionAuth && !connectionAuth.isAuthorized(targetDevice.id)) {
        return { success: false, error: "未授权连接，请先请求连接" };
      }
      
      for (const filePath of filePaths) {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          // Dropped folder — delegate to sendFolder
          await sendFolder(deviceIp, devicePort, filePath, fromName);
        } else {
          await sendFile(deviceIp, devicePort, filePath, fromName);
        }
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
);

ipcMain.handle(
  "send-folder",
  async (
    _event,
    {
      deviceIp,
      devicePort,
      folderPath,
    }: { deviceIp: string; devicePort: number; folderPath: string },
  ) => {
    const fromName = getDeviceName();
    try {
      // Find device by IP to check authorization
      const devices = discovery?.getDeviceList(true) || [];
      const targetDevice = devices.find(d => d.ip === deviceIp);
      
      if (targetDevice && connectionAuth && !connectionAuth.isAuthorized(targetDevice.id)) {
        return { success: false, error: "未授权连接，请先请求连接" };
      }
      
      await sendFolder(deviceIp, devicePort, folderPath, fromName);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
);

ipcMain.handle(
  "send-text",
  async (
    _event,
    {
      deviceIp,
      devicePort,
      text,
    }: { deviceIp: string; devicePort: number; text: string },
  ) => {
    const fromName = getDeviceName();
    try {
      // Find device by IP to check authorization
      const devices = discovery?.getDeviceList(true) || [];
      const targetDevice = devices.find(d => d.ip === deviceIp);
      
      if (targetDevice && connectionAuth && !connectionAuth.isAuthorized(targetDevice.id)) {
        return { success: false, error: "未授权连接，请先请求连接" };
      }
      
      await sendText(deviceIp, devicePort, text, fromName);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
);

ipcMain.handle(
  "send-clipboard",
  async (
    _event,
    data: { webMode?: boolean; baseUrl?: string; deviceIp?: string; devicePort?: number },
  ) => {
    const fromName = getDeviceName();
    try {
      const text = clipboard.readText();
      const img = clipboard.readImage();

      // Web receiver mode: only text clipboard supported
      if (data.webMode && data.baseUrl) {
        if (text) {
          await httpPost(`${data.baseUrl}/text`, text, { "Content-Type": "text/plain; charset=utf-8" });
          return { success: true };
        }
        return { success: false, error: "剪贴板为空或内容为图片，浏览器接收端仅支持文本" };
      }

      const { deviceIp, devicePort } = data as { deviceIp: string; devicePort: number };
      
      // Find device by IP to check authorization
      const devices = discovery?.getDeviceList(true) || [];
      const targetDevice = devices.find(d => d.ip === deviceIp);
      
      if (targetDevice && connectionAuth && !connectionAuth.isAuthorized(targetDevice.id)) {
        return { success: false, error: "未授权连接，请先请求连接" };
      }
      
      if (!img.isEmpty()) {
        await sendClipboardData(
          deviceIp,
          devicePort,
          { type: "image", imageBuffer: img.toPNG() },
          fromName,
        );
      } else if (text) {
        await sendClipboardData(
          deviceIp,
          devicePort,
          { type: "text", text },
          fromName,
        );
      } else {
        return { success: false, error: "Clipboard is empty" };
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
);

ipcMain.handle(
  "toggle-clipboard-sync",
  (
    _event,
    {
      enabled,
      deviceId,
      deviceIp,
      wsPort,
    }: {
      enabled: boolean;
      deviceId?: string;
      deviceIp?: string;
      wsPort?: number;
    },
  ) => {
    if (!clipboardSync) return { success: false };
    if (enabled && deviceId && deviceIp && wsPort !== undefined) {
      clipboardSync.setEnabled(true, getDeviceName());
      clipboardSync.connectToPeer(deviceIp, wsPort, deviceId);
    } else {
      if (deviceId) clipboardSync.disconnectPeer(deviceId);
      if (clipboardSync.connectedPeers.size === 0) {
        clipboardSync.setEnabled(false);
      }
    }
    return { success: true };
  },
);

ipcMain.handle("open-save-dir", () => {
  shell.openPath(SAVE_DIR);
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

// Helper: HTTP POST to web receiver
function httpPost(url: string, body: Buffer | string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const bodyBuf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: "POST",
      headers: { "Content-Length": bodyBuf.length, ...headers },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(bodyBuf);
    req.end();
  });
}

ipcMain.handle("upload-file-to-web", async (_e, { baseUrl, filePath }: { baseUrl: string; filePath: string }) => {
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      // Dropped folder — use folder upload logic
      const folderName = path.basename(filePath);
      const allFiles = collectAllFiles(filePath);
      let successCount = 0, failedCount = 0;
      for (const fp of allFiles) {
        try {
          const relativePath = path.relative(filePath, fp).replace(/\\/g, "/");
          const fStat = fs.statSync(fp);
          const fileBuffer = fs.readFileSync(fp);
          await httpPost(`${baseUrl}/upload`, fileBuffer, {
            "Content-Type": "application/octet-stream",
            "X-Filename": encodeURIComponent(path.basename(fp)),
            "X-Filesize": String(fStat.size),
            "X-Relative-Path": encodeURIComponent(relativePath),
            "X-Folder-Name": encodeURIComponent(folderName),
          });
          successCount++;
        } catch { failedCount++; }
      }
      return { success: failedCount === 0, count: successCount };
    }
    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    await httpPost(`${baseUrl}/upload`, fileBuffer, {
      "Content-Type": "application/octet-stream",
      "X-Filename": encodeURIComponent(fileName),
      "X-Filesize": String(stat.size),
    });
    return { success: true, count: 1 };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
});

function collectAllFiles(dirPath: string): string[] {
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) files.push(...collectAllFiles(full));
      else files.push(full);
    }
  } catch {}
  return files;
}

ipcMain.handle("upload-folder-to-web", async (_e, { baseUrl, folderPath }: { baseUrl: string; folderPath: string }) => {
  const folderName = path.basename(folderPath);
  const allFiles = collectAllFiles(folderPath);
  let successCount = 0, failedCount = 0;
  for (const filePath of allFiles) {
    try {
      const relativePath = path.relative(folderPath, filePath).replace(/\\/g, "/");
      const stat = fs.statSync(filePath);
      const fileBuffer = fs.readFileSync(filePath);
      await httpPost(`${baseUrl}/upload`, fileBuffer, {
        "Content-Type": "application/octet-stream",
        "X-Filename": encodeURIComponent(path.basename(filePath)),
        "X-Filesize": String(stat.size),
        "X-Relative-Path": encodeURIComponent(relativePath),
        "X-Folder-Name": encodeURIComponent(folderName),
      });
      successCount++;
    } catch { failedCount++; }
  }
  return { success: failedCount === 0, successCount, failedCount, totalCount: allFiles.length };
});

ipcMain.handle("upload-text-to-web", async (_e, { baseUrl, text }: { baseUrl: string; text: string }) => {
  try {
    await httpPost(`${baseUrl}/text`, text, { "Content-Type": "text/plain; charset=utf-8" });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
});

ipcMain.handle("get-web-settings", () => {
  return { webEnabled, webPassword };
});

ipcMain.handle(
  "set-web-settings",
  (_event, settings: { webEnabled: boolean; webPassword: string }) => {
    webEnabled = settings.webEnabled;
    webPassword = settings.webPassword;
    if (webReceiver) {
      webReceiver.setEnabled(webEnabled);
      webReceiver.setPassword(webPassword);
    }
    return { success: true };
  },
);

ipcMain.handle("window-minimize", () => {
  mainWindow?.minimize();
});
ipcMain.handle("window-maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle("window-close", () => {
  mainWindow?.close();
});

// ---- App Lifecycle ----

app.whenReady().then(() => {
  createWindow();
  startServices();
});

app.on("window-all-closed", () => {
  if (discovery) discovery.stop();
  if (transferServer) transferServer.stop();
  if (clipboardSync) clipboardSync.stop();
  if (connectionAuth) connectionAuth.stop();
  if (webReceiver) webReceiver.stop();
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

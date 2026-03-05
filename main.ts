import { app, BrowserWindow, Notification, shell, Tray, Menu, nativeImage } from "electron";
import * as path from "path";
import * as fs from "fs";
import { Discovery } from "./src/main/discovery";
import { TransferServer, getSaveDir, setSaveDir } from "./src/main/transfer";
import { ClipboardSync } from "./src/main/clipboard-sync";
import { ConnectionAuth } from "./src/main/connection-auth";
import { WebReceiver } from "./src/main/web-receiver";
import { registerDeviceHandlers } from "./src/main/ipc-handlers/device-handlers";
import { registerTransferHandlers } from "./src/main/ipc-handlers/transfer-handlers";
import { registerConnectionHandlers } from "./src/main/ipc-handlers/connection-handlers";
import { registerClipboardHandlers } from "./src/main/ipc-handlers/clipboard-handlers";
import { registerSettingsHandlers } from "./src/main/ipc-handlers/settings-handlers";
import { registerWebHandlers } from "./src/main/ipc-handlers/web-handlers";
import { registerWindowHandlers } from "./src/main/ipc-handlers/window-handlers";

// Config file path
const CONFIG_DIR = path.join(app.getPath("userData"));
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// App state
let isQuitting = false;

interface AppConfig {
  saveDir?: string;
  useNativeFrame?: boolean;
  autoAcceptConnections?: boolean;
  minimizeToTray?: boolean;
  theme?: "dark" | "light";
}

// Load config from file
function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to load config:", e);
  }
  return {};
}

// Save config to file
function saveConfig(config: AppConfig): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save config:", e);
  }
}

let mainWindow: BrowserWindow | null;
let tray: Tray | null = null;
let discovery: Discovery | null = null;
let transferServer: TransferServer | null = null;
let clipboardSync: ClipboardSync | null = null;
let connectionAuth: ConnectionAuth | null = null;
let webReceiver: WebReceiver | null = null;

// Web receiver settings (runtime state)
let webEnabled = false;
let webPassword = "";

// Notification debounce for multi-file / folder transfers
let notifTimer: NodeJS.Timeout | null = null;
let pendingNotifs: Array<{
  type: string;
  fileName?: string;
  from: string;
  savePath?: string;
  folderName?: string;
  totalFiles?: number;
}> = [];

function scheduleNotification(info: {
  type: string;
  fileName?: string;
  from: string;
  savePath?: string;
  folderName?: string;
  totalFiles?: number;
}): void {
  if (!Notification.isSupported()) return;

  // Folder complete → immediate notification
  if (info.type === "folder") {
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
      body =
        item.type === "text" || item.type === "clipboard-text"
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

function createTray(): void {
  const iconPath = path.join(
    __dirname,
    "..",
    "build",
    "icons",
    process.platform === "win32" ? "icon.ico" : "icon.png"
  );

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示窗口",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip("LanFlare");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function createWindow(): void {
  const config = loadConfig();
  const useNativeFrame = config.useNativeFrame ?? false;

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    frame: useNativeFrame,
    autoHideMenuBar: true,
    transparent: false,
    backgroundColor: "#0a0a1a",
    webPreferences: {
      preload: path.join(__dirname, "src", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(
      __dirname,
      "..",
      "build",
      process.platform === "win32" ? "icon.ico" : "icon.png"
    ),
  });

  // Load Vite dev server in development, built files in production
  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "renderer", "index.html"));
  }

  mainWindow.on("close", (event) => {
    const config = loadConfig();
    const minimizeToTray = config.minimizeToTray ?? false;

    if (minimizeToTray && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function startServices(): void {
  // Load config and apply saved settings
  const config = loadConfig();
  if (config.saveDir) {
    setSaveDir(config.saveDir);
  }

  // Ensure save directory exists
  const saveDir = getSaveDir();
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }

  // Discovery
  discovery = new Discovery();
  discovery.start();
  discovery.on("devices-changed", () => {
    if (mainWindow && discovery) {
      const includeSelf = !app.isPackaged;
      const devices = discovery.getDeviceList(includeSelf);

      // Map device properties to match frontend expectations
      const mappedDevices = devices.map((device) => ({
        id: device.id,
        name: device.name,
        ip: device.ip,
        platform: device.platform,
        transferPort: device.tcpPort,
        clipboardPort: device.wsPort,
      }));

      mainWindow.webContents.send("devices-changed", mappedDevices);
    }
  });

  // Connection Authorization
  const autoAccept = config.autoAcceptConnections ?? false;
  connectionAuth = new ConnectionAuth(discovery.deviceId, autoAccept);
  connectionAuth.start();
  connectionAuth.on("connection-request", (request) => {
    if (mainWindow) {
      mainWindow.webContents.send("connection-request", request);
    }
  });
  connectionAuth.on("connection-auto-accepted", (request) => {
    if (mainWindow) {
      mainWindow.webContents.send("connection-auto-accepted", request);
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
    scheduleNotification(info);
  });

  // Clipboard Sync
  clipboardSync = new ClipboardSync();
  clipboardSync.startServer();
  clipboardSync.on("clipboard-received", (info) => {
    if (mainWindow) {
      mainWindow.webContents.send("clipboard-synced", info);
    }
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

  // Register IPC handlers
  registerDeviceHandlers(discovery);
  registerTransferHandlers(() => mainWindow, discovery, connectionAuth);
  registerConnectionHandlers(connectionAuth);
  registerClipboardHandlers(discovery, connectionAuth, clipboardSync);
  registerSettingsHandlers(() => mainWindow, loadConfig, saveConfig, connectionAuth);
  registerWebHandlers(
    () => ({ webEnabled, webPassword }),
    (settings) => {
      webEnabled = settings.webEnabled;
      webPassword = settings.webPassword;
    },
    webReceiver
  );
  registerWindowHandlers(() => mainWindow);
}

// ---- App Lifecycle ----

app.whenReady().then(() => {
  createTray();
  createWindow();
  startServices();
});

app.on("before-quit", () => {
  isQuitting = true;

  // Clear notification timer
  if (notifTimer) {
    clearTimeout(notifTimer);
    notifTimer = null;
  }

  // Stop all services synchronously
  console.log("Stopping all services...");

  if (discovery) {
    discovery.stop();
    discovery = null;
  }

  if (transferServer) {
    transferServer.stop();
    transferServer = null;
  }

  if (clipboardSync) {
    clipboardSync.stop();
    clipboardSync = null;
  }

  if (connectionAuth) {
    connectionAuth.stop();
    connectionAuth = null;
  }

  if (webReceiver) {
    webReceiver.stop();
    webReceiver = null;
  }

  console.log("All services stopped");
});

app.on("will-quit", () => {
  console.log("App will quit, forcing cleanup...");

  // Immediately force exit - services already stopped in before-quit
  process.exit(0);
});

app.on("window-all-closed", () => {
  const config = loadConfig();
  const minimizeToTray = config.minimizeToTray ?? false;

  if (!minimizeToTray || process.platform !== "darwin") {
    // Services already stopped in before-quit
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

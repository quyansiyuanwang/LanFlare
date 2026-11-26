import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  // Device discovery
  getDevices: () => ipcRenderer.invoke("get-devices"),
  getDeviceInfo: () => ipcRenderer.invoke("get-device-info"),
  onDevicesChanged: (cb: (devices: unknown[]) => void) =>
    ipcRenderer.on("devices-changed", (_, devices) => cb(devices)),

  // File operations
  selectFiles: () => ipcRenderer.invoke("select-files"),
  selectFolder: () => ipcRenderer.invoke("select-folder"),

  // Send operations
  sendFiles: (data: unknown) => ipcRenderer.invoke("send-files", data),
  sendFolder: (data: unknown) => ipcRenderer.invoke("send-folder", data),
  sendText: (data: unknown) => ipcRenderer.invoke("send-text", data),
  sendClipboard: (data: unknown) => ipcRenderer.invoke("send-clipboard", data),

  // Transfer events
  onTransferStart: (cb: (info: unknown) => void) =>
    ipcRenderer.on("transfer-start", (_, info) => cb(info)),
  onTransferProgress: (cb: (info: unknown) => void) =>
    ipcRenderer.on("transfer-progress", (_, info) => cb(info)),
  onTransferComplete: (cb: (info: unknown) => void) =>
    ipcRenderer.on("transfer-complete", (_, info) => cb(info)),

  // Clipboard sync
  toggleClipboardSync: (data: unknown) => ipcRenderer.invoke("toggle-clipboard-sync", data),
  onClipboardSynced: (cb: (info: unknown) => void) => {
    const listener = (_: unknown, info: unknown) => cb(info);
    ipcRenderer.on("clipboard-synced", listener);
    return () => ipcRenderer.removeListener("clipboard-synced", listener);
  },
  onClipboardPeerStatus: (cb: (info: unknown) => void) => {
    const listener = (_: unknown, info: unknown) => cb(info);
    ipcRenderer.on("clipboard-peer-status", listener);
    return () => ipcRenderer.removeListener("clipboard-peer-status", listener);
  },

  // Connection authorization
  requestConnection: (deviceIp: string, deviceId: string) =>
    ipcRenderer.invoke("request-connection", { deviceIp, deviceId }),
  approveConnection: (requestId: string) => ipcRenderer.invoke("approve-connection", requestId),
  rejectConnection: (requestId: string) => ipcRenderer.invoke("reject-connection", requestId),
  onConnectionRequest: (cb: (request: unknown) => void) =>
    ipcRenderer.on("connection-request", (_, request) => cb(request)),
  onConnectionAutoAccepted: (cb: (request: unknown) => void) =>
    ipcRenderer.on("connection-auto-accepted", (_, request) => cb(request)),

  // Utility
  openSaveDir: () => ipcRenderer.invoke("open-save-dir"),
  openPath: (p: string) => ipcRenderer.invoke("open-path", p),
  deleteFile: (p: string) => ipcRenderer.invoke("delete-file", p),
  deleteFolder: (p: string) => ipcRenderer.invoke("delete-folder", p),

  // Settings
  getSaveDir: () => ipcRenderer.invoke("get-save-dir"),
  selectSaveDir: () => ipcRenderer.invoke("select-save-dir"),
  setSaveDir: (dir: string) => ipcRenderer.invoke("set-save-dir", dir),
  getWindowFrameSetting: () => ipcRenderer.invoke("get-window-frame-setting"),
  setWindowFrameSetting: (useNativeFrame: boolean) =>
    ipcRenderer.invoke("set-window-frame-setting", useNativeFrame),
  getAutoAcceptSetting: () => ipcRenderer.invoke("get-auto-accept-setting"),
  setAutoAcceptSetting: (enabled: boolean) =>
    ipcRenderer.invoke("set-auto-accept-setting", enabled),
  getMinimizeToTraySetting: () => ipcRenderer.invoke("get-minimize-to-tray-setting"),
  setMinimizeToTraySetting: (enabled: boolean) =>
    ipcRenderer.invoke("set-minimize-to-tray-setting", enabled),
  getThemeSetting: () => ipcRenderer.invoke("get-theme-setting"),
  setThemeSetting: (theme: "dark" | "light") => ipcRenderer.invoke("set-theme-setting", theme),

  // Web receiver settings
  getWebSettings: () => ipcRenderer.invoke("get-web-settings"),
  setWebSettings: (data: unknown) => ipcRenderer.invoke("set-web-settings", data),

  // Upload to remote web receiver
  uploadFileToWeb: (data: { baseUrl: string; filePath: string }) =>
    ipcRenderer.invoke("upload-file-to-web", data),
  uploadTextToWeb: (data: { baseUrl: string; text: string }) =>
    ipcRenderer.invoke("upload-text-to-web", data),
  uploadFolderToWeb: (data: { baseUrl: string; folderPath: string }) =>
    ipcRenderer.invoke("upload-folder-to-web", data),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowMaximize: () => ipcRenderer.invoke("window-maximize"),
  windowClose: () => ipcRenderer.invoke("window-close"),
  restartApp: () => ipcRenderer.invoke("restart-app"),
});

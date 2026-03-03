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
  onClipboardSynced: (cb: (info: unknown) => void) =>
    ipcRenderer.on("clipboard-synced", (_, info) => cb(info)),
  onClipboardPeerStatus: (cb: (info: unknown) => void) =>
    ipcRenderer.on("clipboard-peer-status", (_, info) => cb(info)),

  // Connection authorization
  requestConnection: (deviceIp: string, deviceId: string) =>
    ipcRenderer.invoke("request-connection", { deviceIp, deviceId }),
  approveConnection: (requestId: string) => ipcRenderer.invoke("approve-connection", requestId),
  rejectConnection: (requestId: string) => ipcRenderer.invoke("reject-connection", requestId),
  onConnectionRequest: (cb: (request: unknown) => void) =>
    ipcRenderer.on("connection-request", (_, request) => cb(request)),

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
});

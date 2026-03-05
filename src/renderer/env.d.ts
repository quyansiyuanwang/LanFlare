/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface Window {
  api: {
    // Device
    getDevices: () => Promise<Device[]>;
    getDeviceInfo: () => Promise<DeviceInfo>;
    onDevicesChanged: (callback: (devices: Device[]) => void) => void;

    // File operations
    selectFiles: () => Promise<string[]>;
    selectFolder: () => Promise<string | null>;

    // Send operations
    sendFiles: (data: {
      deviceIp: string;
      devicePort: number;
      filePaths: string[];
    }) => Promise<{ success: boolean; error?: string }>;
    sendFolder: (data: {
      deviceIp: string;
      devicePort: number;
      folderPath: string;
    }) => Promise<{ success: boolean; error?: string }>;
    sendText: (data: {
      deviceIp: string;
      devicePort: number;
      text: string;
    }) => Promise<{ success: boolean; error?: string }>;
    sendClipboard: (data: any) => Promise<{ success: boolean; error?: string }>;

    // Transfer events
    onTransferStart: (callback: (info: any) => void) => void;
    onTransferProgress: (callback: (info: any) => void) => void;
    onTransferComplete: (callback: (info: any) => void) => void;

    // Clipboard sync
    toggleClipboardSync: (data: any) => Promise<{ success: boolean }>;
    onClipboardSynced: (callback: (info: any) => void) => () => void;
    onClipboardPeerStatus: (callback: (info: any) => void) => () => void;

    // Connection
    requestConnection: (
      deviceIp: string,
      deviceId: string
    ) => Promise<{ approved: boolean; error?: string }>;
    approveConnection: (requestId: string) => Promise<void>;
    rejectConnection: (requestId: string) => Promise<void>;
    onConnectionRequest: (callback: (request: any) => void) => void;
    onConnectionAutoAccepted: (callback: (request: any) => void) => void;

    // Settings
    getSaveDir: () => Promise<string>;
    selectSaveDir: () => Promise<string | null>;
    setSaveDir: (dir: string) => Promise<{ success: boolean; error?: string }>;
    openSaveDir: () => Promise<void>;
    openPath: (path: string) => Promise<boolean>;
    deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
    deleteFolder: (path: string) => Promise<{ success: boolean; error?: string }>;

    getWindowFrameSetting: () => Promise<boolean>;
    setWindowFrameSetting: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
    getAutoAcceptSetting: () => Promise<boolean>;
    setAutoAcceptSetting: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
    getMinimizeToTraySetting: () => Promise<boolean>;
    setMinimizeToTraySetting: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
    getThemeSetting: () => Promise<"dark" | "light">;
    setThemeSetting: (theme: "dark" | "light") => Promise<{ success: boolean; error?: string }>;

    // Web receiver
    getWebSettings: () => Promise<{ webEnabled: boolean; webPassword: string }>;
    setWebSettings: (data: {
      webEnabled: boolean;
      webPassword: string;
    }) => Promise<{ success: boolean }>;
    uploadFileToWeb: (data: {
      baseUrl: string;
      filePath: string;
    }) => Promise<{ success: boolean; error?: string; count?: number }>;
    uploadTextToWeb: (data: {
      baseUrl: string;
      text: string;
    }) => Promise<{ success: boolean; error?: string }>;
    uploadFolderToWeb: (data: {
      baseUrl: string;
      folderPath: string;
    }) => Promise<{
      success: boolean;
      error?: string;
      successCount?: number;
      failedCount?: number;
      totalCount?: number;
    }>;

    // Window controls
    windowMinimize: () => Promise<void>;
    windowMaximize: () => Promise<void>;
    windowClose: () => Promise<void>;
    restartApp: () => Promise<void>;
  };
}

interface Device {
  id: string;
  name: string;
  ip: string;
  platform: string;
  transferPort: number;
  clipboardPort: number;
}

interface DeviceInfo {
  name: string;
  ip: string;
  id: string;
  webUrl: string;
}

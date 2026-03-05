import { defineStore } from "pinia";
import type { Device } from "../types";

export const useAppStore = defineStore("app", {
  state: () => ({
    devices: [] as Device[],
    selectedDevice: null as Device | null,
    receiveHistory: [] as any[],
    syncingDevices: new Set<string>(),
    webTargetUrl: null as string | null,
    deviceInfo: null as any,
    clipboardLogs: [] as any[],
  }),

  actions: {
    setDevices(devices: Device[]) {
      this.devices = devices;
    },

    setSelectedDevice(device: Device | null) {
      this.selectedDevice = device;
    },

    addReceiveHistory(item: any) {
      this.receiveHistory.unshift(item);
      // Memory optimization: limit to 100 items
      if (this.receiveHistory.length > 100) {
        this.receiveHistory = this.receiveHistory.slice(0, 100);
      }
    },

    toggleSyncDevice(deviceId: string) {
      if (this.syncingDevices.has(deviceId)) {
        this.syncingDevices.delete(deviceId);
      } else {
        this.syncingDevices.add(deviceId);
      }
    },

    setWebTargetUrl(url: string | null) {
      this.webTargetUrl = url;
    },

    setDeviceInfo(info: any) {
      this.deviceInfo = info;
    },

    addClipboardLog(log: any) {
      this.clipboardLogs.unshift(log);
      // Memory optimization: limit to 50 items
      if (this.clipboardLogs.length > 50) {
        this.clipboardLogs = this.clipboardLogs.slice(0, 50);
      }
    },
  },

  getters: {
    isSyncing: (state) => (deviceId: string) => state.syncingDevices.has(deviceId),
  },
});

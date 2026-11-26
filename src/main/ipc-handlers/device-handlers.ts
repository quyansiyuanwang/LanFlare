import { ipcMain, app } from "electron";
import { Discovery } from "../discovery";
import { getDeviceName, getLocalIP } from "../utils";
import { WEB_PORT } from "../web-receiver";

export function registerDeviceHandlers(discovery: Discovery) {
  ipcMain.handle("get-devices", () => {
    const includeSelf = !app.isPackaged;
    const devices = discovery.getDeviceList(includeSelf);

    // Map device properties to match frontend expectations
    return devices.map((device) => ({
      id: device.id,
      name: device.name,
      ip: device.ip,
      platform: device.platform,
      transferPort: device.tcpPort,
      clipboardPort: device.wsPort,
    }));
  });

  ipcMain.handle("get-device-info", () => {
    return {
      name: getDeviceName(),
      ip: getLocalIP(),
      id: discovery.deviceId,
      webUrl: `http://${getLocalIP()}:${WEB_PORT}`,
    };
  });
}

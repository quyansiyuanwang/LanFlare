import { ipcMain } from "electron";
import { Discovery } from "../discovery";
import { getDeviceName, getLocalIP } from "../utils";
import { WEB_PORT } from "../web-receiver";

export function registerDeviceHandlers(discovery: Discovery) {
  ipcMain.handle("get-devices", () => {
    const includeSelf = !require("electron").app.isPackaged;
    return discovery.getDeviceList(includeSelf);
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

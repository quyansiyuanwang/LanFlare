import { ipcMain } from "electron";
import { ConnectionAuth } from "../connection-auth";

export function registerConnectionHandlers(connectionAuth: ConnectionAuth) {
  ipcMain.handle(
    "request-connection",
    async (_event, { deviceIp, deviceId }: { deviceIp: string; deviceId: string }) => {
      try {
        const approved = await connectionAuth.requestConnection(deviceIp, deviceId);
        return { approved };
      } catch (e) {
        const error = e as Error;
        console.error("Connection request error:", error.message);
        return { approved: false, error: error.message };
      }
    }
  );

  ipcMain.handle("approve-connection", (_event, requestId: string) => {
    connectionAuth.approveRequest(requestId);
    return { success: true };
  });

  ipcMain.handle("reject-connection", (_event, requestId: string) => {
    connectionAuth.rejectRequest(requestId);
    return { success: true };
  });
}

import { ipcMain, clipboard } from "electron";
import * as http from "http";
import * as https from "https";
import { sendClipboardData } from "../transfer";
import { getDeviceName } from "../utils";
import { Discovery } from "../discovery";
import { ConnectionAuth } from "../connection-auth";
import { ClipboardSync } from "../clipboard-sync";

function httpPost(
  url: string,
  body: Buffer | string,
  headers: Record<string, string>
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const bodyBuf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: "POST",
        headers: { "Content-Length": bodyBuf.length, ...headers },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.write(bodyBuf);
    req.end();
  });
}

export function registerClipboardHandlers(
  discovery: Discovery,
  connectionAuth: ConnectionAuth,
  clipboardSync: ClipboardSync
) {
  ipcMain.handle(
    "send-clipboard",
    async (
      _event,
      data: {
        webMode?: boolean;
        baseUrl?: string;
        deviceIp?: string;
        devicePort?: number;
      }
    ) => {
      const fromName = getDeviceName();
      try {
        const text = clipboard.readText();
        const img = clipboard.readImage();

        if (data.webMode && data.baseUrl) {
          if (text) {
            await httpPost(`${data.baseUrl}/text`, text, {
              "Content-Type": "text/plain; charset=utf-8",
            });
            return { success: true };
          }
          return {
            success: false,
            error: "剪贴板为空或内容为图片，浏览器接收端仅支持文本",
          };
        }

        const { deviceIp, devicePort } = data as {
          deviceIp: string;
          devicePort: number;
        };

        const devices = discovery.getDeviceList(true);
        const targetDevice = devices.find((d) => d.ip === deviceIp);

        if (targetDevice && !connectionAuth.isAuthorized(targetDevice.id)) {
          return { success: false, error: "未授权连接，请先请求连接" };
        }

        if (!img.isEmpty()) {
          await sendClipboardData(
            deviceIp,
            devicePort,
            { type: "image", imageBuffer: img.toPNG() },
            fromName
          );
        } else if (text) {
          await sendClipboardData(deviceIp, devicePort, { type: "text", text }, fromName);
        } else {
          return { success: false, error: "Clipboard is empty" };
        }

        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
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
      }
    ) => {
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
    }
  );
}

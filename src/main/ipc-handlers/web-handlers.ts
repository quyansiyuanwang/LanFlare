import { ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as https from "https";
import { WebReceiver } from "../web-receiver";

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

function collectAllFiles(dirPath: string): string[] {
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) files.push(...collectAllFiles(full));
      else files.push(full);
    }
  } catch (err) {
    console.error("Error collecting files:", err);
  }
  return files;
}

export function registerWebHandlers(
  getWebSettings: () => { webEnabled: boolean; webPassword: string },
  setWebSettings: (settings: { webEnabled: boolean; webPassword: string }) => void,
  webReceiver: WebReceiver
) {
  ipcMain.handle("get-web-settings", () => {
    return getWebSettings();
  });

  ipcMain.handle(
    "set-web-settings",
    (_event, settings: { webEnabled: boolean; webPassword: string }) => {
      setWebSettings(settings);
      webReceiver.setEnabled(settings.webEnabled);
      webReceiver.setPassword(settings.webPassword);
      return { success: true };
    }
  );

  ipcMain.handle(
    "upload-file-to-web",
    async (_e, { baseUrl, filePath }: { baseUrl: string; filePath: string }) => {
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          const folderName = path.basename(filePath);
          const allFiles = collectAllFiles(filePath);
          let successCount = 0,
            failedCount = 0;
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
            } catch {
              failedCount++;
            }
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
    }
  );

  ipcMain.handle(
    "upload-folder-to-web",
    async (_e, { baseUrl, folderPath }: { baseUrl: string; folderPath: string }) => {
      const folderName = path.basename(folderPath);
      const allFiles = collectAllFiles(folderPath);
      let successCount = 0,
        failedCount = 0;
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
        } catch {
          failedCount++;
        }
      }
      return {
        success: failedCount === 0,
        successCount,
        failedCount,
        totalCount: allFiles.length,
      };
    }
  );

  ipcMain.handle(
    "upload-text-to-web",
    async (_e, { baseUrl, text }: { baseUrl: string; text: string }) => {
      try {
        await httpPost(`${baseUrl}/text`, text, {
          "Content-Type": "text/plain; charset=utf-8",
        });
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );
}

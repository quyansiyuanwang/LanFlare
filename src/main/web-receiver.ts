import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { getLocalIP, getDeviceName } from "./utils";
import { TransferServer } from "./transfer";

export const WEB_PORT = 53321;
const SAVE_DIR = path.join(os.homedir(), "Downloads", "LanFlare");

// Load the HTML template once at startup
const HTML_TEMPLATE_PATH = path.join(__dirname, "..", "assets", "web-receiver.html");

function getWebUI(deviceName: string, ip: string): string {
  const url = `http://${ip}:${WEB_PORT}`;
  const template = fs.readFileSync(HTML_TEMPLATE_PATH, "utf-8");
  return template
    .replace(/\{\{DEVICE_NAME\}\}/g, deviceName)
    .replace(/\{\{IP\}\}/g, ip)
    .replace(/\{\{WEB_PORT\}\}/g, String(WEB_PORT))
    .replace(/\{\{URL\}\}/g, url);
}

function getLoginPage(error: boolean): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LanFlare – 访问验证</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#070d1a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#e2e8f0}.card{background:#0f1d35;border:1px solid rgba(59,130,246,0.2);border-radius:16px;padding:36px 32px;width:340px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4)}.logo{font-size:32px;margin-bottom:8px}h2{color:#3b82f6;font-size:20px;margin-bottom:6px}p{color:#64748b;font-size:13px;margin-bottom:24px}input{width:100%;background:#0b1425;border:1px solid rgba(59,130,246,0.3);color:#e2e8f0;padding:11px 14px;border-radius:8px;font-size:14px;margin-bottom:12px;outline:none;transition:border-color .2s}input:focus{border-color:#3b82f6}button{width:100%;background:linear-gradient(135deg,#2563eb,#0ea5e9);color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;transition:opacity .2s}button:hover{opacity:.9}.err{color:#f87171;font-size:13px;margin-top:10px}</style>
</head><body>
<div class="card">
  <div class="logo">🔒</div>
  <h2>LanFlare</h2>
  <p>此设备已设置访问密码，请输入密码继续</p>
  <form method="POST" action="/auth">
    <input type="password" name="password" placeholder="访问密码" autofocus>
    <button type="submit">确认访问</button>
  </form>
  ${error ? '<div class="err">密码错误，请重试</div>' : ""}
</div>
</body></html>`;
}

interface FileEntry {
  name: string;
  size: number;
  mtime: number;
}

interface FolderEntry {
  name: string;
  count: number;
  size: number;
  mtime: number;
}

export class WebReceiver {
  private transferServer: TransferServer;
  private server: http.Server | null = null;
  private enabled: boolean = true;
  private password: string = "";
  private sessions: Map<string, number> = new Map(); // token → expiry ms
  private readonly SESSION_TTL = 24 * 60 * 60 * 1000; // 24 h

  constructor(transferServer: TransferServer) {
    this.transferServer = transferServer;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.server) {
      this.stop();
    } else if (enabled && !this.server) {
      this.start();
    }
  }

  setPassword(password: string): void {
    this.password = password;
    this.sessions.clear(); // invalidate all existing sessions
  }

  isEnabled(): boolean {
    return this.enabled;
  }
  getPassword(): string {
    return this.password;
  }

  private _generateToken(): string {
    return crypto.randomBytes(24).toString("hex");
  }

  private _parseCookieToken(cookie: string): string | null {
    const match = cookie.match(/wrsession=([a-f0-9]+)/);
    return match ? match[1] : null;
  }

  private _isAuthenticated(req: http.IncomingMessage): boolean {
    if (!this.password) return true;
    const cookie = (req.headers["cookie"] as string) || "";
    const token = this._parseCookieToken(cookie);
    if (!token) return false;
    const expiry = this.sessions.get(token);
    if (expiry === undefined || expiry < Date.now()) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  private _handleAuth(req: http.IncomingMessage, res: http.ServerResponse): void {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const params = new URLSearchParams(body);
      const submitted = params.get("password") || "";
      if (submitted === this.password) {
        const token = this._generateToken();
        this.sessions.set(token, Date.now() + this.SESSION_TTL);
        res.writeHead(302, {
          Location: "/",
          "Set-Cookie": `wrsession=${token}; Path=/; HttpOnly; Max-Age=86400`,
        });
        res.end();
      } else {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(getLoginPage(true));
      }
    });
    req.on("error", () => {
      res.writeHead(400);
      res.end();
    });
  }

  start(): void {
    if (this.server) return; // already running
    const deviceName = getDeviceName();
    const ip = getLocalIP();

    this.server = http.createServer((req, res) => {
      // CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename, X-Filesize");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = req.url?.split("?")[0] ?? "/";

      // Auth endpoint – always accessible
      if (req.method === "POST" && url === "/auth") {
        this._handleAuth(req, res);
        return;
      }

      // Logout
      if (req.method === "GET" && url === "/logout") {
        const cookie = (req.headers["cookie"] as string) || "";
        const token = this._parseCookieToken(cookie);
        if (token) this.sessions.delete(token);
        res.writeHead(302, {
          Location: "/",
          "Set-Cookie": "wrsession=; Path=/; HttpOnly; Max-Age=0",
        });
        res.end();
        return;
      }

      // Auth gate
      if (!this._isAuthenticated(req)) {
        const isApiRoute =
          url === "/files" ||
          url.startsWith("/folder-files") ||
          url === "/upload" ||
          url === "/text" ||
          url.startsWith("/download/");
        if (isApiRoute) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
        } else {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(getLoginPage(false));
        }
        return;
      }

      if (req.method === "GET" && (url === "/" || url === "/index.html")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(getWebUI(deviceName, ip));
        return;
      }

      if (req.method === "POST" && url === "/upload") {
        this._handleFileUpload(req, res);
        return;
      }

      if (req.method === "POST" && url === "/text") {
        this._handleTextUpload(req, res);
        return;
      }

      if (req.method === "GET" && url === "/files") {
        this._handleFileList(req, res);
        return;
      }

      if (req.method === "GET" && url.startsWith("/folder-files")) {
        this._handleFolderFiles(req, res);
        return;
      }

      if (req.method === "GET" && url.startsWith("/download/")) {
        this._handleFileDownload(req, res);
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    this.server.listen(WEB_PORT, "0.0.0.0", () => {
      console.log(`Web receiver at http://${ip}:${WEB_PORT}`);
    });
  }

  private _ensureSaveDir(): void {
    if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });
  }

  private _handleFileUpload(req: http.IncomingMessage, res: http.ServerResponse): void {
    const rawName = (req.headers["x-filename"] as string) || `upload_${Date.now()}`;
    const fileName = decodeURIComponent(rawName).replace(/[/\\?%*:|"<>]/g, "_");
    const fileSize = parseInt((req.headers["x-filesize"] as string) || "0");
    const rawRelPath = (req.headers["x-relative-path"] as string) || "";
    const rawFolderName = (req.headers["x-folder-name"] as string) || "";
    this._ensureSaveDir();

    let savePath: string;
    if (rawRelPath && rawFolderName) {
      const folderName = decodeURIComponent(rawFolderName).replace(/[/\\?%*:|"<>]/g, "_");
      const relParts = decodeURIComponent(rawRelPath)
        .split(/[/\\]/)
        .map((p) => p.replace(/[?%*:|"<>]/g, "_"))
        .filter((p) => p && p !== ".." && p !== ".");
      if (relParts.length === 0) {
        res.writeHead(400);
        res.end("Bad relative path");
        return;
      }
      savePath = path.join(SAVE_DIR, folderName, ...relParts);
      fs.mkdirSync(path.dirname(savePath), { recursive: true });
    } else {
      savePath = path.join(SAVE_DIR, fileName);
    }

    const writeStream = fs.createWriteStream(savePath);
    let received = 0;

    req.on("data", (chunk: Buffer) => {
      writeStream.write(chunk);
      received += chunk.length;
    });

    req.on("end", () => {
      writeStream.end(() => {
        if (this.transferServer) {
          this.transferServer.emit("transfer-complete", {
            id: Date.now().toString(36),
            type: "file",
            from: "Web Browser",
            fileName: path.basename(savePath),
            fileSize: fileSize || received,
            savePath,
            timestamp: Date.now(),
          });
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, size: received }));
      });
    });

    req.on("error", (err) => {
      writeStream.destroy();
      console.error("Upload error:", err);
      res.writeHead(500);
      res.end("Upload failed");
    });
  }

  private _handleTextUpload(req: http.IncomingMessage, res: http.ServerResponse): void {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (this.transferServer) {
        this.transferServer.emit("transfer-complete", {
          id: Date.now().toString(36),
          type: "text",
          from: "Web Browser",
          content: body,
          timestamp: Date.now(),
        });
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    });
    req.on("error", () => {
      res.writeHead(500);
      res.end();
    });
  }

  private _handleFileList(_req: http.IncomingMessage, res: http.ServerResponse): void {
    this._ensureSaveDir();
    try {
      const entries = fs.readdirSync(SAVE_DIR, { withFileTypes: true });
      const files: FileEntry[] = [];
      const folders: FolderEntry[] = [];
      for (const entry of entries) {
        const fullPath = path.join(SAVE_DIR, entry.name);
        try {
          if (entry.isFile()) {
            const stat = fs.statSync(fullPath);
            files.push({
              name: entry.name,
              size: stat.size,
              mtime: stat.mtimeMs,
            });
          } else if (entry.isDirectory()) {
            const allFiles = this._getAllFiles(fullPath);
            let totalSize = 0,
              maxMtime = 0;
            for (const f of allFiles) {
              try {
                const s = fs.statSync(f);
                totalSize += s.size;
                if (s.mtimeMs > maxMtime) maxMtime = s.mtimeMs;
              } catch (err) {
                console.error("Error reading file stats:", err);
              }
            }
            folders.push({
              name: entry.name,
              count: allFiles.length,
              size: totalSize,
              mtime: maxMtime,
            });
          }
        } catch (err) {
          console.error("Error processing directory entry:", err);
        }
      }
      files.sort((a, b) => b.mtime - a.mtime);
      folders.sort((a, b) => b.mtime - a.mtime);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          files: files.slice(0, 200),
          folders: folders.slice(0, 100),
        })
      );
    } catch (err) {
      const error = err as Error;
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  private _handleFolderFiles(req: http.IncomingMessage, res: http.ServerResponse): void {
    const qs = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
    const folderRaw = decodeURIComponent(qs.get("name") ?? "");
    const folderName = path.basename(folderRaw);
    if (!folderName) {
      res.writeHead(400);
      res.end("Bad Request");
      return;
    }
    const folderPath = path.join(SAVE_DIR, folderName);
    if (
      !folderPath.startsWith(SAVE_DIR + path.sep) ||
      !fs.existsSync(folderPath) ||
      !fs.statSync(folderPath).isDirectory()
    ) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    const allFiles = this._getAllFiles(folderPath);
    const result = allFiles
      .map((f) => {
        try {
          const stat = fs.statSync(f);
          return {
            name: path.relative(folderPath, f).replace(/\\/g, "/"),
            size: stat.size,
            mtime: stat.mtimeMs,
          };
        } catch {
          return null;
        }
      })
      .filter((f): f is { name: string; size: number; mtime: number } => f !== null);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ files: result, folderName }));
  }

  private _getAllFiles(dirPath: string): string[] {
    const files: string[] = [];
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) files.push(...this._getAllFiles(fullPath));
        else if (entry.isFile()) files.push(fullPath);
      }
    } catch (err) {
      console.error("Error reading directory:", err);
    }
    return files;
  }

  private _handleFileDownload(req: http.IncomingMessage, res: http.ServerResponse): void {
    const rawPath = decodeURIComponent((req.url ?? "").slice("/download/".length));
    const parts = rawPath
      .split(/[\/\\]/)
      .map((p) => p.trim())
      .filter((p) => p && p !== ".." && p !== ".");
    if (parts.length === 0) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    const filePath = path.join(SAVE_DIR, ...parts);

    if (
      !filePath.startsWith(SAVE_DIR + path.sep) ||
      !fs.existsSync(filePath) ||
      !fs.statSync(filePath).isFile()
    ) {
      res.writeHead(404);
      res.end("File not found");
      return;
    }

    const stat = fs.statSync(filePath);
    const displayName = parts[parts.length - 1];
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(displayName)}`,
      "Content-Length": stat.size,
    });
    fs.createReadStream(filePath).pipe(res);
  }

  stop(): void {
    console.log("Stopping web receiver...");
    if (this.server) {
      // Unref the server to allow process to exit
      this.server.unref();
      this.server.close(() => {
        console.log("Web receiver server closed");
      });
      this.server = null;
    }
    this.sessions.clear();
  }
}

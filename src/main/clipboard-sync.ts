import WebSocket, { WebSocketServer } from "ws";
import { clipboard, nativeImage } from "electron";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";

const WS_PORT = 53320;
const POLL_INTERVAL = 500;

interface ClipboardMessage {
  type: "clipboard-update";
  contentType: "text" | "image" | "files" | "folder";
  content: string;
  from: string;
  timestamp: number;
  messageId: string;
  folderInfo?: {
    name: string;
    fileCount: number;
    totalSize: number;
  };
}

export class ClipboardSync extends EventEmitter {
  private wsServer: WebSocketServer | null;
  private enabled: boolean;
  private lastClipText: string;
  private lastImageHash: string;
  private lastFilePaths: string;
  private lastFolderPath: string;
  private pollTimer: NodeJS.Timeout | null;
  public connectedPeers: Map<string, WebSocket>;
  private suppressNextChange: boolean;
  private deviceName: string;
  private receivedMessageIds: Set<string>;

  constructor() {
    super();
    this.wsServer = null;
    this.enabled = false;
    this.lastClipText = "";
    this.lastImageHash = "";
    this.lastFilePaths = "";
    this.lastFolderPath = "";
    this.pollTimer = null;
    this.connectedPeers = new Map();
    this.suppressNextChange = false;
    this.deviceName = "Unknown";
    this.receivedMessageIds = new Set();
  }

  startServer(): void {
    this.wsServer = new WebSocketServer({ port: WS_PORT, host: "0.0.0.0" });

    this.wsServer.on("connection", (ws, req) => {
      console.log(`Clipboard sync peer connected: ${req.socket.remoteAddress}`);

      ws.on("message", (data) => {
        try {
          const msg: ClipboardMessage = JSON.parse(data.toString());
          if (msg.type === "clipboard-update" && this.enabled) {
            // Deduplicate by message ID
            if (this.receivedMessageIds.has(msg.messageId)) return;
            this.receivedMessageIds.add(msg.messageId);
            // Clean old IDs (keep last 100)
            if (this.receivedMessageIds.size > 100) {
              const arr = Array.from(this.receivedMessageIds);
              this.receivedMessageIds = new Set(arr.slice(-100));
            }

            this.suppressNextChange = true;
            if (msg.contentType === "text") {
              clipboard.writeText(msg.content);
              this.lastClipText = msg.content;
            } else if (msg.contentType === "image") {
              const imgBuf = Buffer.from(msg.content, "base64");
              const img = nativeImage.createFromBuffer(imgBuf);
              clipboard.writeImage(img);
              this.lastImageHash = this._getImageHash(img);
            } else if (msg.contentType === "files") {
              // Write file paths as text (Electron limitation)
              clipboard.writeText(msg.content);
              this.lastFilePaths = msg.content;
            } else if (msg.contentType === "folder") {
              // Write folder path as text
              clipboard.writeText(msg.content);
              this.lastFolderPath = msg.content;
            }
            this.emit("clipboard-received", {
              contentType: msg.contentType,
              from: msg.from,
              preview:
                msg.contentType === "text"
                  ? msg.content.substring(0, 100)
                  : msg.contentType === "image"
                    ? "[图片]"
                    : msg.contentType === "folder"
                      ? `[文件夹: ${msg.folderInfo?.name || ""}]`
                      : "[文件路径]",
              folderInfo: msg.folderInfo,
            });
          }
        } catch {
          // ignore
        }
      });

      ws.on("close", () => {
        console.log("Clipboard sync peer disconnected");
      });
    });

    this.wsServer.on("error", (err) => {
      console.error("Clipboard sync server error:", err);
    });
  }

  connectToPeer(ip: string, port: number, deviceId: string): void {
    if (this.connectedPeers.has(deviceId)) return;

    const ws = new WebSocket(`ws://${ip}:${port}`);

    ws.on("open", () => {
      this.connectedPeers.set(deviceId, ws);
      this.emit("peer-connected", deviceId);
    });

    ws.on("message", (data) => {
      try {
        const msg: ClipboardMessage = JSON.parse(data.toString());
        if (msg.type === "clipboard-update" && this.enabled) {
          // Deduplicate by message ID
          if (this.receivedMessageIds.has(msg.messageId)) return;
          this.receivedMessageIds.add(msg.messageId);
          if (this.receivedMessageIds.size > 100) {
            const arr = Array.from(this.receivedMessageIds);
            this.receivedMessageIds = new Set(arr.slice(-100));
          }

          this.suppressNextChange = true;
          if (msg.contentType === "text") {
            clipboard.writeText(msg.content);
            this.lastClipText = msg.content;
          } else if (msg.contentType === "image") {
            const imgBuf = Buffer.from(msg.content, "base64");
            const img = nativeImage.createFromBuffer(imgBuf);
            clipboard.writeImage(img);
            this.lastImageHash = this._getImageHash(img);
          } else if (msg.contentType === "files") {
            clipboard.writeText(msg.content);
            this.lastFilePaths = msg.content;
          } else if (msg.contentType === "folder") {
            clipboard.writeText(msg.content);
            this.lastFolderPath = msg.content;
          }
          this.emit("clipboard-received", {
            contentType: msg.contentType,
            from: msg.from,
            preview:
              msg.contentType === "text"
                ? msg.content.substring(0, 100)
                : msg.contentType === "image"
                  ? "[图片]"
                  : msg.contentType === "folder"
                    ? `[文件夹: ${msg.folderInfo?.name || ""}]`
                    : "[文件路径]",
            folderInfo: msg.folderInfo,
          });
        }
      } catch {
        // ignore
      }
    });

    ws.on("close", () => {
      this.connectedPeers.delete(deviceId);
      this.emit("peer-disconnected", deviceId);
    });

    ws.on("error", () => {
      this.connectedPeers.delete(deviceId);
    });
  }

  disconnectPeer(deviceId: string): void {
    const ws = this.connectedPeers.get(deviceId);
    if (ws) {
      ws.close();
      this.connectedPeers.delete(deviceId);
    }
  }

  setEnabled(enabled: boolean, deviceName?: string): void {
    this.enabled = enabled;
    if (deviceName) this.deviceName = deviceName;

    if (enabled && !this.pollTimer) {
      this.lastClipText = clipboard.readText() || "";
      const img = clipboard.readImage();
      this.lastImageHash = img.isEmpty() ? "" : this._getImageHash(img);
      this.lastFilePaths = "";
      this.lastFolderPath = "";
      this.pollTimer = setInterval(() => this._pollClipboard(), POLL_INTERVAL);
    } else if (!enabled && this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private _pollClipboard(): void {
    if (!this.enabled) return;
    if (this.suppressNextChange) {
      this.suppressNextChange = false;
      return;
    }

    const currentText = clipboard.readText() || "";
    const currentImage = clipboard.readImage();
    const currentImageHash = currentImage.isEmpty() ? "" : this._getImageHash(currentImage);

    // Check for folder path (Windows/Mac/Linux format)
    const folderCheck = this._checkIfFolder(currentText);
    if (folderCheck.isFolder && currentText !== this.lastFolderPath) {
      this.lastFolderPath = currentText;
      this.lastClipText = "";
      this.lastImageHash = "";
      this._broadcast({
        type: "clipboard-update",
        contentType: "folder",
        content: currentText,
        from: this.deviceName,
        timestamp: Date.now(),
        messageId: this._generateMessageId(),
        folderInfo: folderCheck.info,
      });
    }
    // Check for file paths
    else if (
      currentText &&
      this._looksLikeFilePaths(currentText) &&
      currentText !== this.lastFilePaths
    ) {
      this.lastFilePaths = currentText;
      this.lastClipText = "";
      this.lastImageHash = "";
      this._broadcast({
        type: "clipboard-update",
        contentType: "files",
        content: currentText,
        from: this.deviceName,
        timestamp: Date.now(),
        messageId: this._generateMessageId(),
      });
    }
    // Check text change
    else if (
      currentText &&
      currentText !== this.lastClipText &&
      currentImageHash === "" &&
      !this._looksLikeFilePaths(currentText)
    ) {
      this.lastClipText = currentText;
      this.lastImageHash = "";
      this.lastFolderPath = "";
      this._broadcast({
        type: "clipboard-update",
        contentType: "text",
        content: currentText,
        from: this.deviceName,
        timestamp: Date.now(),
        messageId: this._generateMessageId(),
      });
    }
    // Check image change
    else if (currentImageHash && currentImageHash !== this.lastImageHash) {
      this.lastImageHash = currentImageHash;
      this.lastClipText = "";
      this.lastFolderPath = "";
      const imgBase64 = currentImage.toPNG().toString("base64");
      this._broadcast({
        type: "clipboard-update",
        contentType: "image",
        content: imgBase64,
        from: this.deviceName,
        timestamp: Date.now(),
        messageId: this._generateMessageId(),
      });
    }
  }

  private _broadcast(msg: ClipboardMessage): void {
    const data = JSON.stringify(msg);

    if (this.wsServer) {
      this.wsServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }

    for (const [, ws] of this.connectedPeers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  private _getImageHash(img: Electron.NativeImage): string {
    // Simple hash based on image size
    const size = img.getSize();
    return `${size.width}x${size.height}_${img.toPNG().length}`;
  }

  private _generateMessageId(): string {
    return `${this.deviceName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private _looksLikeFilePaths(text: string): boolean {
    // Check if text looks like file paths
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return false;

    // Windows path pattern: C:\path\to\file or \\server\share
    // Unix/Mac path pattern: /path/to/file
    const pathPattern = /^([a-zA-Z]:\\|\\\\|\/).+/;

    return lines.every((line) => pathPattern.test(line.trim()));
  }

  private _checkIfFolder(text: string): {
    isFolder: boolean;
    info?: { name: string; fileCount: number; totalSize: number };
  } {
    if (!text || text.includes("\n")) return { isFolder: false }; // Only single line

    const trimmed = text.trim();
    const pathPattern = /^([a-zA-Z]:\\|\\\\|\/).+/;

    if (!pathPattern.test(trimmed)) return { isFolder: false };

    try {
      const stat = fs.statSync(trimmed);
      if (stat.isDirectory()) {
        const info = this._getFolderInfo(trimmed);
        return { isFolder: true, info };
      }
    } catch {
      // Path doesn't exist or not accessible
    }

    return { isFolder: false };
  }

  private _getFolderInfo(folderPath: string): {
    name: string;
    fileCount: number;
    totalSize: number;
  } {
    const name = path.basename(folderPath);
    let fileCount = 0;
    let totalSize = 0;

    try {
      const countFiles = (dir: string) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              countFiles(fullPath);
            } else {
              fileCount++;
              totalSize += stat.size;
            }
          } catch {
            // Skip inaccessible files
          }
        }
      };

      countFiles(folderPath);
    } catch {
      // Error reading folder
    }

    return { name, fileCount, totalSize };
  }

  stop(): void {
    console.log("Stopping clipboard sync...");
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const [, ws] of this.connectedPeers) {
      try {
        ws.close();
      } catch (e) {
        console.error("Error closing peer connection:", e);
      }
    }
    this.connectedPeers.clear();
    if (this.wsServer) {
      // Close all client connections first
      this.wsServer.clients.forEach((client) => {
        try {
          client.close();
        } catch (e) {
          console.error("Error closing client:", e);
        }
      });
      // Then close the server
      this.wsServer.close(() => {
        console.log("Clipboard sync server closed");
      });
    }
  }
}

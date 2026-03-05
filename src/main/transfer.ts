import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { EventEmitter } from "events";
import { generateId } from "./utils";

export const TRANSFER_PORT = 53319;
let SAVE_DIR = path.join(os.homedir(), "Downloads", "LanFlare");

// Allow changing save directory
export function setSaveDir(dir: string): void {
  SAVE_DIR = dir;
  // Ensure directory exists
  if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
  }
}

export function getSaveDir(): string {
  return SAVE_DIR;
}

// ---- Types ----

export interface TransferHeader {
  type: "file" | "text" | "clipboard-text" | "clipboard-image";
  fileName?: string;
  fileSize?: number;
  from: string;
  folderName?: string;
  relativePath?: string;
  totalFiles?: number;
}

export interface TransferStartInfo {
  id: string;
  type: string;
  from: string;
  fileName?: string;
  fileSize?: number;
  totalFiles?: number;
}

export interface TransferProgressInfo {
  id: string;
  received: number;
  total: number;
  percent: number;
}

export interface TransferCompleteInfo {
  id: string;
  type: string;
  from: string;
  content?: string;
  fileName?: string;
  fileSize?: number;
  savePath?: string;
  timestamp: number;
  // Folder info
  folderName?: string;
  totalFiles?: number;
  folderSavePath?: string;
}

export interface ClipboardData {
  type: "text" | "image";
  text?: string;
  imageBuffer?: Buffer;
}

// ---- Server ----

interface PendingFolder {
  folderName: string;
  from: string;
  totalFiles: number;
  receivedFiles: number;
  totalSize: number;
  folderSavePath: string;
  timer: NodeJS.Timeout;
}

export class TransferServer extends EventEmitter {
  private server: net.Server | null;
  private pendingFolders: Map<string, PendingFolder>;

  constructor() {
    super();
    this.server = null;
    this.pendingFolders = new Map();
  }

  start(): void {
    if (!fs.existsSync(SAVE_DIR)) {
      fs.mkdirSync(SAVE_DIR, { recursive: true });
    }

    this.server = net.createServer((socket) => {
      this._handleConnection(socket);
    });

    this.server.listen(TRANSFER_PORT, "0.0.0.0", () => {
      console.log(`Transfer server listening on port ${TRANSFER_PORT}`);
    });

    this.server.on("error", (err) => {
      console.error("Transfer server error:", err);
    });
  }

  private _handleConnection(socket: net.Socket): void {
    let headerBuf = Buffer.alloc(0);
    let header: TransferHeader | null = null;
    let fileStream: fs.WriteStream | null = null;
    let receivedBytes = 0;
    const transferId = generateId();

    socket.on("data", (chunk: Buffer) => {
      if (!header) {
        headerBuf = Buffer.concat([headerBuf, chunk]);
        const delimIndex = headerBuf.indexOf("\n\n");
        if (delimIndex !== -1) {
          try {
            header = JSON.parse(headerBuf.slice(0, delimIndex).toString()) as TransferHeader;
          } catch {
            socket.destroy();
            return;
          }
          const remaining = headerBuf.slice(delimIndex + 2);

          // For folder files, suppress per-file start — folder-start is emitted in _trackFolderFile
          if (!(header.folderName && header.totalFiles && header.totalFiles > 1)) {
            this._initReceive(header, transferId);
          }

          if (header.type === "text" || header.type === "clipboard-text") {
            headerBuf = remaining;
          } else if (header.type === "file" || header.type === "clipboard-image") {
            const savePath = this._getSavePath(header);
            const dir = path.dirname(savePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fileStream = fs.createWriteStream(savePath);
            if (remaining.length > 0) {
              fileStream.write(remaining);
              receivedBytes += remaining.length;
              this._emitProgress(transferId, header, receivedBytes);
            }
          }
        }
      } else {
        if (header.type === "text" || header.type === "clipboard-text") {
          headerBuf = Buffer.concat([headerBuf, chunk]);
        } else if (fileStream) {
          fileStream.write(chunk);
          receivedBytes += chunk.length;
          this._emitProgress(transferId, header, receivedBytes);
        }
      }
    });

    socket.on("end", () => {
      if (header) {
        if (header.type === "text" || header.type === "clipboard-text") {
          const text = headerBuf.toString();
          const info: TransferCompleteInfo = {
            id: transferId,
            type: header.type,
            from: header.from,
            content: text,
            timestamp: Date.now(),
          };
          this.emit("transfer-complete", info);
        } else if (fileStream) {
          fileStream.end();

          // Check if this is part of a folder transfer
          if (header.folderName && header.totalFiles && header.totalFiles > 1) {
            this._trackFolderFile(header, transferId);
          } else {
            const info: TransferCompleteInfo = {
              id: transferId,
              type: header.type,
              from: header.from,
              fileName: header.fileName,
              fileSize: header.fileSize,
              savePath: this._getSavePath(header),
              timestamp: Date.now(),
            };
            this.emit("transfer-complete", info);
          }
        }
      }
    });

    socket.on("error", (err) => {
      if (fileStream) fileStream.end();
      console.error("Transfer socket error:", err);
    });
  }

  private _getSavePath(header: TransferHeader): string {
    if (header.relativePath) {
      return path.join(SAVE_DIR, header.folderName ?? "received", header.relativePath);
    }
    return path.join(SAVE_DIR, header.fileName ?? `clipboard_${Date.now()}.png`);
  }

  private _initReceive(header: TransferHeader, transferId: string): void {
    const info: TransferStartInfo = {
      id: transferId,
      type: header.type,
      from: header.from,
      fileName: header.fileName,
      fileSize: header.fileSize,
      totalFiles: header.totalFiles,
    };
    this.emit("transfer-start", info);
  }

  private _emitProgress(transferId: string, header: TransferHeader, received: number): void {
    if (header.fileSize && header.fileSize > 0) {
      const info: TransferProgressInfo = {
        id: transferId,
        received,
        total: header.fileSize,
        percent: Math.round((received / header.fileSize) * 100),
      };
      this.emit("transfer-progress", info);
    }
  }

  stop(): void {
    if (this.server) {
      // Unref the server to allow process to exit
      this.server.unref();
      // Force close all connections
      this.server.close(() => {
        console.log("Transfer server closed");
      });
    }
    for (const pf of this.pendingFolders.values()) {
      clearTimeout(pf.timer);
    }
    this.pendingFolders.clear();
  }

  private _trackFolderFile(header: TransferHeader, transferId: string): void {
    const key = `${header.from}::${header.folderName}`;
    let pf = this.pendingFolders.get(key);

    if (!pf) {
      pf = {
        folderName: header.folderName!,
        from: header.from,
        totalFiles: header.totalFiles!,
        receivedFiles: 0,
        totalSize: 0,
        folderSavePath: path.join(SAVE_DIR, header.folderName!),
        timer: setTimeout(() => {
          // Safety: emit what we have if timeout (e.g. sender crashed)
          this._emitFolderComplete(key);
        }, 60000),
      };
      this.pendingFolders.set(key, pf);

      // Emit a folder-start event
      this.emit("transfer-start", {
        id: transferId,
        type: "folder",
        from: header.from,
        fileName: header.folderName,
        totalFiles: header.totalFiles,
      });
    }

    pf.receivedFiles++;
    pf.totalSize += header.fileSize || 0;

    // Emit progress for folder
    this.emit("transfer-progress", {
      id: transferId,
      received: pf.receivedFiles,
      total: pf.totalFiles,
      percent: Math.round((pf.receivedFiles / pf.totalFiles) * 100),
    });

    if (pf.receivedFiles >= pf.totalFiles) {
      this._emitFolderComplete(key);
    }
  }

  private _emitFolderComplete(key: string): void {
    const pf = this.pendingFolders.get(key);
    if (!pf) return;

    clearTimeout(pf.timer);
    this.pendingFolders.delete(key);

    const info: TransferCompleteInfo = {
      id: generateId(),
      type: "folder",
      from: pf.from,
      fileName: pf.folderName,
      fileSize: pf.totalSize,
      savePath: pf.folderSavePath,
      folderName: pf.folderName,
      totalFiles: pf.receivedFiles,
      folderSavePath: pf.folderSavePath,
      timestamp: Date.now(),
    };
    this.emit("transfer-complete", info);
  }
}

// ---- Transfer Client (sender) ----

export function sendFile(
  targetIp: string,
  targetPort: number,
  filePath: string,
  fromName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("sendFile called with:", { targetIp, targetPort, filePath, fromName });

    // Validate parameters
    if (!targetIp || !targetPort) {
      reject(new Error(`Invalid connection parameters: ip=${targetIp}, port=${targetPort}`));
      return;
    }

    const stat = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const header = JSON.stringify({
      type: "file",
      fileName,
      fileSize: stat.size,
      from: fromName,
    } satisfies TransferHeader);

    console.log("Creating connection to:", targetIp, targetPort);
    const socket = net.createConnection({ port: targetPort, host: targetIp }, () => {
      console.log("Connected, sending file:", fileName);
      socket.write(header + "\n\n");
      const readStream = fs.createReadStream(filePath);
      readStream.pipe(socket);
      readStream.on("end", () => {
        socket.end();
      });
    });

    socket.on("close", () => {
      console.log("Connection closed");
      resolve();
    });
    socket.on("error", (err) => {
      console.error("Socket error:", err);
      reject(err);
    });
  });
}

export async function sendFolder(
  targetIp: string,
  targetPort: number,
  folderPath: string,
  fromName: string
): Promise<void> {
  console.log("sendFolder called with:", { targetIp, targetPort, folderPath, fromName });

  // Validate parameters
  if (!targetIp || !targetPort) {
    throw new Error(`Invalid connection parameters: ip=${targetIp}, port=${targetPort}`);
  }

  const folderName = path.basename(folderPath);
  const files = getAllFiles(folderPath);

  for (const filePath of files) {
    const relativePath = path.relative(folderPath, filePath);
    const stat = fs.statSync(filePath);

    await new Promise<void>((resolve, reject) => {
      const header = JSON.stringify({
        type: "file",
        fileName: path.basename(filePath),
        fileSize: stat.size,
        from: fromName,
        folderName,
        relativePath,
        totalFiles: files.length,
      } satisfies TransferHeader);

      const socket = net.createConnection({ port: targetPort, host: targetIp }, () => {
        socket.write(header + "\n\n");
        const readStream = fs.createReadStream(filePath);
        readStream.pipe(socket);
        readStream.on("end", () => socket.end());
      });

      socket.on("close", () => resolve());
      socket.on("error", reject);
    });
  }
}

export function sendText(
  targetIp: string,
  targetPort: number,
  text: string,
  fromName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("sendText called with:", { targetIp, targetPort, fromName });

    // Validate parameters
    if (!targetIp || !targetPort) {
      reject(new Error(`Invalid connection parameters: ip=${targetIp}, port=${targetPort}`));
      return;
    }

    const header = JSON.stringify({
      type: "text",
      from: fromName,
      fileSize: Buffer.byteLength(text),
    } satisfies TransferHeader);

    const socket = net.createConnection({ port: targetPort, host: targetIp }, () => {
      socket.write(header + "\n\n");
      socket.write(text);
      socket.end();
    });

    socket.on("close", () => resolve());
    socket.on("error", reject);
  });
}

export function sendClipboardData(
  targetIp: string,
  targetPort: number,
  clipData: ClipboardData,
  fromName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("sendClipboardData called with:", { targetIp, targetPort, type: clipData.type, fromName });

    // Validate parameters
    if (!targetIp || !targetPort) {
      reject(new Error(`Invalid connection parameters: ip=${targetIp}, port=${targetPort}`));
      return;
    }

    if (clipData.type === "text" && clipData.text !== undefined) {
      const header = JSON.stringify({
        type: "clipboard-text",
        from: fromName,
        fileSize: Buffer.byteLength(clipData.text),
      } satisfies TransferHeader);
      const socket = net.createConnection({ port: targetPort, host: targetIp }, () => {
        socket.write(header + "\n\n");
        socket.write(clipData.text!);
        socket.end();
      });
      socket.on("close", () => resolve());
      socket.on("error", reject);
    } else if (clipData.type === "image" && clipData.imageBuffer !== undefined) {
      const header = JSON.stringify({
        type: "clipboard-image",
        fileName: `clipboard_${Date.now()}.png`,
        fileSize: clipData.imageBuffer.length,
        from: fromName,
      } satisfies TransferHeader);
      const socket = net.createConnection({ port: targetPort, host: targetIp }, () => {
        socket.write(header + "\n\n");
        socket.write(clipData.imageBuffer!);
        socket.end();
      });
      socket.on("close", () => resolve());
      socket.on("error", reject);
    } else {
      reject(new Error("Invalid clipboard data"));
    }
  });
}

function getAllFiles(dirPath: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

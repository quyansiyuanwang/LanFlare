import { EventEmitter } from "events";
import WebSocket from "ws";
import { getDeviceName, generateId } from "./utils";

const AUTH_PORT = 53322;
const AUTH_TIMEOUT = 30000; // 30 seconds for user to respond

export interface ConnectionRequest {
  requestId: string;
  fromDeviceId: string;
  fromDeviceName: string;
  fromIp: string;
  timestamp: number;
}

interface AuthMessage {
  type: "connection-request" | "connection-response";
  requestId: string;
  fromDeviceId: string;
  fromDeviceName: string;
  fromIp?: string;
  approved?: boolean;
  timestamp: number;
}

interface PendingRequest {
  requestId: string;
  fromDeviceId: string;
  fromDeviceName: string;
  fromIp: string;
  timestamp: number;
  timeoutHandle: NodeJS.Timeout;
}

export class ConnectionAuth extends EventEmitter {
  private server: WebSocket.Server | null;
  private deviceId: string;
  private authorizedConnections: Map<string, number>; // deviceId -> expireTimestamp
  private pendingRequests: Map<string, PendingRequest>; // requestId -> request info
  private outgoingRequestSockets: Map<string, WebSocket>; // requestId -> socket
  private autoAcceptEnabled: boolean;

  constructor(deviceId: string, autoAcceptEnabled = false) {
    super();
    this.server = null;
    this.deviceId = deviceId;
    this.authorizedConnections = new Map();
    this.pendingRequests = new Map();
    this.outgoingRequestSockets = new Map();
    this.autoAcceptEnabled = autoAcceptEnabled;
  }

  setAutoAccept(enabled: boolean): void {
    this.autoAcceptEnabled = enabled;
  }

  getAutoAccept(): boolean {
    return this.autoAcceptEnabled;
  }

  start(): void {
    this.server = new WebSocket.Server({ port: AUTH_PORT });

    this.server.on("connection", (socket: WebSocket, req) => {
      const clientIp = req.socket.remoteAddress?.replace("::ffff:", "") || "unknown";

      socket.on("message", (data: WebSocket.RawData) => {
        try {
          const msg: AuthMessage = JSON.parse(data.toString());

          if (msg.type === "connection-request") {
            this._handleConnectionRequest(msg, clientIp, socket);
          } else if (msg.type === "connection-response") {
            this._handleConnectionResponse(msg);
          }
        } catch (err) {
          console.error("Error handling auth message:", err);
        }
      });

      socket.on("error", (err: Error) => {
        console.error("Auth WebSocket error:", err);
      });
    });

    console.log(`Connection auth server listening on port ${AUTH_PORT}`);

    // Cleanup expired authorizations every minute
    setInterval(() => {
      const now = Date.now();
      for (const [deviceId, expireTime] of this.authorizedConnections.entries()) {
        if (now > expireTime) {
          this.authorizedConnections.delete(deviceId);
          this.emit("authorization-expired", deviceId);
        }
      }
    }, 60000);
  }

  // Request connection to another device
  async requestConnection(deviceIp: string, targetDeviceId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const requestId = generateId();
      const ws = new WebSocket(`ws://${deviceIp}:${AUTH_PORT}`);

      const timeout = setTimeout(() => {
        ws.close();
        this.outgoingRequestSockets.delete(requestId);
        reject(new Error("连接请求超时"));
      }, AUTH_TIMEOUT);

      ws.on("open", () => {
        const request: AuthMessage = {
          type: "connection-request",
          requestId,
          fromDeviceId: this.deviceId,
          fromDeviceName: getDeviceName(),
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(request));
        this.outgoingRequestSockets.set(requestId, ws);
      });

      ws.on("message", (data: WebSocket.RawData) => {
        try {
          const msg: AuthMessage = JSON.parse(data.toString());
          if (msg.type === "connection-response" && msg.requestId === requestId) {
            clearTimeout(timeout);
            ws.close();
            this.outgoingRequestSockets.delete(requestId);

            if (msg.approved) {
              // Grant authorization for 1 hour
              this.authorizedConnections.set(targetDeviceId, Date.now() + 3600000);
              resolve(true);
            } else {
              reject(new Error("连接请求被拒绝"));
            }
          }
        } catch (err) {
          console.error("Error parsing response:", err);
        }
      });

      ws.on("error", (err: Error) => {
        clearTimeout(timeout);
        this.outgoingRequestSockets.delete(requestId);
        reject(err);
      });
    });
  }

  // Handle incoming connection request
  private _handleConnectionRequest(msg: AuthMessage, fromIp: string, socket: WebSocket): void {
    const requestId = msg.requestId;

    // Check if already authorized
    const existingAuth = this.authorizedConnections.get(msg.fromDeviceId);
    if (existingAuth && Date.now() < existingAuth) {
      // Already authorized, auto-approve
      const response: AuthMessage = {
        type: "connection-response",
        requestId,
        fromDeviceId: this.deviceId,
        fromDeviceName: getDeviceName(),
        approved: true,
        timestamp: Date.now(),
      };
      socket.send(JSON.stringify(response));
      return;
    }

    // Auto-accept if enabled
    if (this.autoAcceptEnabled) {
      // Grant authorization for 1 hour
      this.authorizedConnections.set(msg.fromDeviceId, Date.now() + 3600000);

      const response: AuthMessage = {
        type: "connection-response",
        requestId,
        fromDeviceId: this.deviceId,
        fromDeviceName: getDeviceName(),
        approved: true,
        timestamp: Date.now(),
      };
      socket.send(JSON.stringify(response));

      // Still emit event for logging/notification purposes
      this.emit("connection-auto-accepted", {
        requestId,
        fromDeviceId: msg.fromDeviceId,
        fromDeviceName: msg.fromDeviceName,
        fromIp,
        timestamp: msg.timestamp,
      });
      return;
    }

    // Create timeout for pending request
    const timeoutHandle = setTimeout(() => {
      this.pendingRequests.delete(requestId);
      // Auto-reject on timeout
      const response: AuthMessage = {
        type: "connection-response",
        requestId,
        fromDeviceId: this.deviceId,
        fromDeviceName: getDeviceName(),
        approved: false,
        timestamp: Date.now(),
      };
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(response));
      }
    }, AUTH_TIMEOUT);

    // Store pending request
    const pendingRequest: PendingRequest = {
      requestId,
      fromDeviceId: msg.fromDeviceId,
      fromDeviceName: msg.fromDeviceName,
      fromIp,
      timestamp: msg.timestamp,
      timeoutHandle,
    };
    this.pendingRequests.set(requestId, pendingRequest);

    // Store socket for later response
    (socket as any).__requestId = requestId;

    // Emit event for UI to show approval dialog
    this.emit("connection-request", {
      requestId,
      fromDeviceId: msg.fromDeviceId,
      fromDeviceName: msg.fromDeviceName,
      fromIp,
      timestamp: msg.timestamp,
    });
  }

  // Handle connection response (from remote device)
  private _handleConnectionResponse(_msg: AuthMessage): void {
    // This is handled in the requestConnection promise
  }

  // Approve a pending connection request
  approveRequest(requestId: string): void {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    clearTimeout(request.timeoutHandle);
    this.pendingRequests.delete(requestId);

    // Grant authorization for 1 hour
    this.authorizedConnections.set(request.fromDeviceId, Date.now() + 3600000);

    // Send approval response
    const response: AuthMessage = {
      type: "connection-response",
      requestId,
      fromDeviceId: this.deviceId,
      fromDeviceName: getDeviceName(),
      approved: true,
      timestamp: Date.now(),
    };

    // Find the socket with this requestId
    if (this.server) {
      this.server.clients.forEach((client) => {
        if ((client as any).__requestId === requestId && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(response));
        }
      });
    }

    this.emit("connection-approved", request.fromDeviceId);
  }

  // Reject a pending connection request
  rejectRequest(requestId: string): void {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    clearTimeout(request.timeoutHandle);
    this.pendingRequests.delete(requestId);

    // Send rejection response
    const response: AuthMessage = {
      type: "connection-response",
      requestId,
      fromDeviceId: this.deviceId,
      fromDeviceName: getDeviceName(),
      approved: false,
      timestamp: Date.now(),
    };

    // Find the socket with this requestId
    if (this.server) {
      this.server.clients.forEach((client) => {
        if ((client as any).__requestId === requestId && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(response));
        }
      });
    }

    this.emit("connection-rejected", request.fromDeviceId);
  }

  // Check if a device is authorized
  isAuthorized(deviceId: string): boolean {
    const expireTime = this.authorizedConnections.get(deviceId);
    if (!expireTime) return false;

    if (Date.now() > expireTime) {
      this.authorizedConnections.delete(deviceId);
      return false;
    }

    return true;
  }

  // Manually revoke authorization
  revokeAuthorization(deviceId: string): void {
    this.authorizedConnections.delete(deviceId);
    this.emit("authorization-revoked", deviceId);
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }

    // Clear all pending requests
    for (const request of this.pendingRequests.values()) {
      clearTimeout(request.timeoutHandle);
    }
    this.pendingRequests.clear();

    // Close all outgoing sockets
    for (const socket of this.outgoingRequestSockets.values()) {
      socket.close();
    }
    this.outgoingRequestSockets.clear();
  }
}

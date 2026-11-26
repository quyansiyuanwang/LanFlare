import * as dgram from "dgram";
import { EventEmitter } from "events";
import { getLocalIP, getBroadcastAddress, getDeviceName, generateId } from "./utils";

const DISCOVERY_PORT = 53318;
const BROADCAST_INTERVAL = 2000;
const DEVICE_TIMEOUT = 6000;

export interface DeviceInfo {
  id: string;
  name: string;
  ip: string;
  tcpPort: number;
  wsPort: number;
  platform: string;
  lastSeen?: number;
}

interface DiscoveryMessage {
  id: string;
  name: string;
  tcpPort: number;
  wsPort: number;
  platform: string;
}

export class Discovery extends EventEmitter {
  public readonly deviceId: string;
  private devices: Map<string, DeviceInfo>;
  private socket: dgram.Socket | null;
  private broadcastTimer: NodeJS.Timeout | null;
  private cleanupTimer: NodeJS.Timeout | null;

  constructor() {
    super();
    this.deviceId = generateId();
    this.devices = new Map();
    this.socket = null;
    this.broadcastTimer = null;
    this.cleanupTimer = null;
  }

  start(): void {
    this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

    this.socket.on("message", (msg, rinfo) => {
      try {
        const data: DiscoveryMessage = JSON.parse(msg.toString());
        if (data.id === this.deviceId) return;

        const device: DeviceInfo = {
          id: data.id,
          name: data.name,
          ip: rinfo.address,
          tcpPort: data.tcpPort,
          wsPort: data.wsPort,
          platform: data.platform,
          lastSeen: Date.now(),
        };

        const isNew = !this.devices.has(device.id);
        this.devices.set(device.id, device);

        if (isNew) {
          this.emit("devices-changed", this.getDeviceList());
        }
      } catch {
        // ignore malformed messages
      }
    });

    this.socket.on("error", (err) => {
      console.error("Discovery socket error:", err);
    });

    this.socket.bind(DISCOVERY_PORT, () => {
      this.socket!.setBroadcast(true);
      this._startBroadcasting();
      this._startCleanup();
    });
  }

  private _startBroadcasting(): void {
    const broadcast = () => {
      const message = JSON.stringify({
        id: this.deviceId,
        name: getDeviceName(),
        tcpPort: 53319,
        wsPort: 53320,
        platform: process.platform,
      });
      const buf = Buffer.from(message);
      const broadcastAddr = getBroadcastAddress();
      this.socket!.send(buf, 0, buf.length, DISCOVERY_PORT, broadcastAddr);
    };

    broadcast();
    this.broadcastTimer = setInterval(broadcast, BROADCAST_INTERVAL);
  }

  private _startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, device] of this.devices) {
        if (now - (device.lastSeen ?? 0) > DEVICE_TIMEOUT) {
          this.devices.delete(id);
          changed = true;
        }
      }
      if (changed) {
        this.emit("devices-changed", this.getDeviceList());
      }
    }, 3000);
  }

  getDeviceList(includeSelf?: boolean): Omit<DeviceInfo, "lastSeen">[] {
    const list = Array.from(this.devices.values()).map((d) => ({
      id: d.id,
      name: d.name,
      ip: d.ip,
      tcpPort: d.tcpPort,
      wsPort: d.wsPort,
      platform: d.platform,
    }));

    if (includeSelf) {
      list.push({
        id: this.deviceId,
        name: getDeviceName(),
        ip: getLocalIP(),
        tcpPort: 53319,
        wsPort: 53320,
        platform: process.platform,
      });
    }

    return list;
  }

  stop(): void {
    console.log("Stopping discovery...");
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        console.error("Error closing discovery socket:", e);
      }
      this.socket = null;
    }
    this.devices.clear();
  }
}

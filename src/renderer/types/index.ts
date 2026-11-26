export interface Device {
  id: string;
  name: string;
  ip: string;
  platform: string;
  transferPort: number;
  clipboardPort: number;
}

export interface DeviceInfo {
  name: string;
  ip: string;
  id: string;
  webUrl: string;
}

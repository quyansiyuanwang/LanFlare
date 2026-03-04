// Global state
export let selectedDevice = null;
export let devices = [];
export let receiveHistory = [];
export let syncingDevices = new Set();
export let webTargetUrl = null;

export function setSelectedDevice(device) {
  selectedDevice = device;
}

export function setDevices(newDevices) {
  devices = newDevices;
}

export function addReceiveHistory(item) {
  receiveHistory.push(item);
}

export function setWebTargetUrl(url) {
  webTargetUrl = url;
}

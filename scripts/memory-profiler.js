const { app, BrowserWindow } = require("electron");
const v8 = require("v8");
const process = require("process");

// Memory profiling utility
class MemoryProfiler {
  constructor() {
    this.snapshots = [];
  }

  takeSnapshot(label) {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    const snapshot = {
      label,
      timestamp: Date.now(),
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      heapLimit: heapStats.heap_size_limit,
      percentage: ((memUsage.heapUsed / heapStats.heap_size_limit) * 100).toFixed(2),
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  formatBytes(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }

  printSnapshot(snapshot) {
    console.log(`\n=== Memory Snapshot: ${snapshot.label} ===`);
    console.log(`RSS: ${this.formatBytes(snapshot.rss)}`);
    console.log(`Heap Total: ${this.formatBytes(snapshot.heapTotal)}`);
    console.log(`Heap Used: ${this.formatBytes(snapshot.heapUsed)} (${snapshot.percentage}%)`);
    console.log(`External: ${this.formatBytes(snapshot.external)}`);
    console.log(`Heap Limit: ${this.formatBytes(snapshot.heapLimit)}`);
  }

  printComparison(label1, label2) {
    const snap1 = this.snapshots.find((s) => s.label === label1);
    const snap2 = this.snapshots.find((s) => s.label === label2);

    if (!snap1 || !snap2) {
      console.log("Snapshots not found");
      return;
    }

    console.log(`\n=== Memory Comparison: ${label1} vs ${label2} ===`);
    console.log(`RSS: ${this.formatBytes(snap2.rss - snap1.rss)}`);
    console.log(`Heap Used: ${this.formatBytes(snap2.heapUsed - snap1.heapUsed)}`);
  }

  printAll() {
    console.log("\n=== All Memory Snapshots ===");
    this.snapshots.forEach((snapshot) => {
      console.log(`\n${snapshot.label}:`);
      console.log(`  RSS: ${this.formatBytes(snapshot.rss)}`);
      console.log(`  Heap Used: ${this.formatBytes(snapshot.heapUsed)}`);
    });
  }
}

// Export for use in main process
if (typeof module !== "undefined" && module.exports) {
  module.exports = MemoryProfiler;
}

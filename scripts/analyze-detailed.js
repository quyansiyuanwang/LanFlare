const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("=== Detailed Build Analysis ===\n");

// 1. Analyze compiled output
console.log("📦 Compiled Output:");
const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  const mainJs = path.join(distPath, "main.js");
  if (fs.existsSync(mainJs)) {
    const size = fs.statSync(mainJs).size;
    console.log(`  main.js: ${formatBytes(size)}`);
  }

  const srcPath = path.join(distPath, "src");
  if (fs.existsSync(srcPath)) {
    const srcSize = getDirSize(srcPath);
    console.log(`  src/: ${formatBytes(srcSize)}`);
  }

  const rendererPath = path.join(distPath, "renderer");
  if (fs.existsSync(rendererPath)) {
    const files = fs.readdirSync(rendererPath);
    files.forEach((file) => {
      const filePath = path.join(rendererPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        console.log(`  renderer/${file}: ${formatBytes(stats.size)}`);
      }
    });
  }

  const totalDist = getDirSize(distPath);
  console.log(`  Total: ${formatBytes(totalDist)}\n`);
}

// 2. Analyze dependencies
console.log("📚 Dependencies:");
const wsPath = path.join(__dirname, "..", "node_modules", "ws");
if (fs.existsSync(wsPath)) {
  const wsSize = getDirSize(wsPath);
  console.log(`  ws: ${formatBytes(wsSize)}`);

  // List ws contents
  const wsFiles = fs.readdirSync(wsPath);
  const wsDetails = wsFiles
    .map((file) => {
      const filePath = path.join(wsPath, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.isDirectory() ? getDirSize(filePath) : stats.size,
        isDir: stats.isDirectory(),
      };
    })
    .sort((a, b) => b.size - a.size);

  console.log("  Top files/dirs in ws:");
  wsDetails.slice(0, 5).forEach((item) => {
    console.log(`    ${item.name}: ${formatBytes(item.size)} ${item.isDir ? "(dir)" : ""}`);
  });
  console.log();
}

// 3. Analyze source files
console.log("📄 Source Files:");
const srcFiles = [
  "src/renderer/index.html",
  "src/renderer/assets/styles.css",
  "src/renderer/app.js",
  "src/assets/web-receiver.html",
];

srcFiles.forEach((file) => {
  const filePath = path.join(__dirname, "..", file);
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    console.log(`  ${file}: ${formatBytes(size)}`);
  }
});
console.log();

// 4. Estimate final package size
console.log("📊 Estimated Package Sizes:");
const electronSize = 120 * 1024 * 1024; // ~120MB for Electron runtime
const appSize = getDirSize(distPath) + getDirSize(wsPath);
const totalEstimate = electronSize + appSize;

console.log(`  Electron runtime: ~${formatBytes(electronSize)}`);
console.log(`  Application code: ${formatBytes(appSize)}`);
console.log(`  Total estimate: ~${formatBytes(totalEstimate)}`);
console.log();

// 5. Check for optimization opportunities
console.log("💡 Optimization Opportunities:");
let opportunities = [];

// Check for large files
function findLargeFiles(dir, threshold = 100 * 1024) {
  const large = [];
  function traverse(currentPath) {
    try {
      const files = fs.readdirSync(currentPath);
      files.forEach((file) => {
        const filePath = path.join(currentPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile() && stats.size > threshold) {
          large.push({
            path: path.relative(path.join(__dirname, ".."), filePath),
            size: stats.size,
          });
        } else if (stats.isDirectory()) {
          traverse(filePath);
        }
      });
    } catch (e) {
      // Ignore errors
    }
  }
  traverse(dir);
  return large;
}

const largeFiles = findLargeFiles(distPath, 50 * 1024);
if (largeFiles.length > 0) {
  console.log("  Large files (>50KB):");
  largeFiles.forEach((file) => {
    console.log(`    ${file.path}: ${formatBytes(file.size)}`);
  });
} else {
  console.log("  ✓ No large files found");
}

console.log("\n=== Analysis Complete ===");

// Helper functions
function getDirSize(dirPath) {
  let size = 0;
  function traverse(currentPath) {
    try {
      const stats = fs.statSync(currentPath);
      if (stats.isFile()) {
        size += stats.size;
      } else if (stats.isDirectory()) {
        const files = fs.readdirSync(currentPath);
        files.forEach((file) => traverse(path.join(currentPath, file)));
      }
    } catch (e) {
      // Ignore errors
    }
  }
  traverse(dirPath);
  return size;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

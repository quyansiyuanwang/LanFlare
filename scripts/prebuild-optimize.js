const fs = require("fs");
const path = require("path");

console.log("=== Pre-build Optimization ===\n");

// 1. Clean up node_modules/ws to remove unnecessary files
const wsPath = path.join(__dirname, "..", "node_modules", "ws");
if (fs.existsSync(wsPath)) {
  const filesToRemove = [
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    ".travis.yml",
    "browser.js",
    "test",
    "benchmarks",
  ];

  let removedSize = 0;
  filesToRemove.forEach((file) => {
    const filePath = path.join(wsPath, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        removedSize += getDirSize(filePath);
        fs.rmSync(filePath, { recursive: true, force: true });
        console.log(`✓ Removed directory: ${file}`);
      } else {
        removedSize += stats.size;
        fs.unlinkSync(filePath);
        console.log(`✓ Removed file: ${file}`);
      }
    }
  });
  console.log(`\nWS module cleaned: ${formatBytes(removedSize)} removed\n`);
}

console.log("=== Optimization Complete ===");

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

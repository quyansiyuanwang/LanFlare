const fs = require("fs");
const path = require("path");

// Analyze build output
function analyzeBuild() {
  const distPath = path.join(__dirname, "..", "dist");
  const releasePath = path.join(__dirname, "..", "release");

  console.log("=== Build Analysis ===\n");

  // Check dist directory
  if (fs.existsSync(distPath)) {
    const distSize = getDirSize(distPath);
    console.log(`Compiled output (dist): ${formatBytes(distSize)}`);
  }

  // Check release directory
  if (fs.existsSync(releasePath)) {
    console.log("\nRelease packages:");
    const files = fs.readdirSync(releasePath);
    files.forEach((file) => {
      const filePath = path.join(releasePath, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        console.log(`  ${file}: ${formatBytes(stats.size)}`);
      }
    });
  }

  // Analyze dependencies
  console.log("\n=== Dependencies Analysis ===\n");
  const packageJson = require("../package.json");

  console.log("Production dependencies:");
  if (packageJson.dependencies) {
    Object.keys(packageJson.dependencies).forEach((dep) => {
      const depPath = path.join(__dirname, "..", "node_modules", dep);
      if (fs.existsSync(depPath)) {
        const size = getDirSize(depPath);
        console.log(`  ${dep}: ${formatBytes(size)}`);
      }
    });
  }

  // Check source files
  console.log("\n=== Source Files ===\n");
  const srcPath = path.join(__dirname, "..", "src");
  if (fs.existsSync(srcPath)) {
    const srcSize = getDirSize(srcPath);
    console.log(`Source code: ${formatBytes(srcSize)}`);
  }

  const rendererPath = path.join(__dirname, "..", "src", "renderer");
  if (fs.existsSync(rendererPath)) {
    console.log("\nRenderer files:");
    ["index.html", "assets/styles.css", "app.js"].forEach((file) => {
      const filePath = path.join(rendererPath, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`  ${file}: ${formatBytes(stats.size)}`);
      }
    });
  }
}

// Get directory size recursively
function getDirSize(dirPath) {
  let size = 0;

  function traverse(currentPath) {
    const stats = fs.statSync(currentPath);

    if (stats.isFile()) {
      size += stats.size;
    } else if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      files.forEach((file) => {
        traverse(path.join(currentPath, file));
      });
    }
  }

  try {
    traverse(dirPath);
  } catch (e) {
    // Ignore errors
  }

  return size;
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

analyzeBuild();

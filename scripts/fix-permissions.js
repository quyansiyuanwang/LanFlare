const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("=== Fixing app-builder permissions ===\n");

// Only run on Linux
if (process.platform !== "linux") {
  console.log("Not on Linux, skipping permission fix\n");
  process.exit(0);
}

const appBuilderPaths = [
  "node_modules/app-builder-bin/linux/x64/app-builder",
  "node_modules/app-builder-bin/linux/arm64/app-builder",
];

let fixed = 0;

appBuilderPaths.forEach((filePath) => {
  const fullPath = path.join(__dirname, "..", filePath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.chmodSync(fullPath, 0o755);
      console.log(`✓ Fixed permissions: ${filePath}`);
      fixed++;
    } catch (err) {
      console.log(`✗ Failed to fix: ${filePath} - ${err.message}`);
    }
  }
});

console.log(`\n✅ Fixed ${fixed} app-builder binaries\n`);

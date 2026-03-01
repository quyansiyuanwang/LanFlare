# LanFlare 构建与发布

本文档介绍如何构建不同平台的 LanFlare 安装包，以及通过 GitHub Actions 自动发布。

## 本地构建

### 前置要求

- Node.js 16+
- npm
- 各平台图标文件（见[资源准备](#资源准备)）

### 安装依赖

```bash
npm install
```

### 平台构建命令

```bash
# 仅当前平台（自动检测）
npm run build

# Windows（NSIS 安装包 + 便携版）
npm run build:win

# macOS（DMG + ZIP）
npm run build:mac

# Linux（AppImage + DEB + RPM）
npm run build:linux

# 全平台（需在对应平台或 CI 环境中运行）
npm run build:all
```

### 构建输出

构建完成后，安装包输出到 `dist/` 目录：

| 平台 | 文件 |
|------|------|
| Windows | `dist/LanFlare Setup 1.0.0.exe` |
| Windows portable | `dist/LanFlare 1.0.0.exe` |
| macOS | `dist/LanFlare-1.0.0.dmg` |
| macOS zip | `dist/LanFlare-1.0.0-mac.zip` |
| Linux AppImage | `dist/LanFlare-1.0.0.AppImage` |
| Linux DEB | `dist/lanflare_1.0.0_amd64.deb` |
| Linux RPM | `dist/lanflare-1.0.0.x86_64.rpm` |

## 资源准备

### 应用图标

electron-builder 需要以下图标文件（放置在 `build/` 目录）：

| 文件 | 用途 | 尺寸 |
|------|------|------|
| `build/icon.ico` | Windows | 256x256 (多尺寸嵌入) |
| `build/icon.icns` | macOS | 512x512 (多分辨率) |
| `build/icon.png` | Linux | 512x512 |

**生成图标工具**:
- [electron-icon-maker](https://www.npmjs.com/package/electron-icon-maker)
- [iconutil](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html) (macOS)
- [GIMP](https://www.gimp.org/) (多平台)

**使用 electron-icon-maker 生成**:

```bash
npm install --global electron-icon-maker

# 从 1024x1024 PNG 生成所有格式
electron-icon-maker --input=./icon-source.png --output=./build
```

> 注意：目前应用使用 Electron 默认图标，功能正常运行。

### 代码签名（可选）

#### Windows 签名

需要购买代码签名证书（DigiCert、Sectigo 等）：

```json
// package.json build.win 中添加
"win": {
  "certificateFile": "path/to/cert.pfx",
  "certificatePassword": "${WINDOWS_CERT_PASSWORD}"
}
```

或使用环境变量（CI/CD 中推荐）：
```
CSC_LINK=base64编码的.pfx文件
CSC_KEY_PASSWORD=证书密码
```

#### macOS 签名

需要 Apple Developer 账号：

```
CSC_LINK=Developer ID Application 证书
CSC_KEY_PASSWORD=证书密码
APPLE_ID=your@email.com
APPLE_ID_PASSWORD=应用专用密码
APPLE_TEAM_ID=TEAM_ID
```

## 版本管理

### 更新版本号

修改 `package.json` 中的 `version` 字段：

```json
{
  "version": "1.1.0"
}
```

版本格式遵循 [Semantic Versioning](https://semver.org/)：
- **Major**: 不兼容的 API 变更
- **Minor**: 向下兼容的新功能
- **Patch**: 向下兼容的 Bug 修复

### Git 标签

```bash
# 打 tag
git tag v1.1.0

# 推送 tag 到远程（触发 CI/CD 自动构建）
git push origin v1.1.0
```

## GitHub Actions 自动构建

项目配置了 GitHub Actions 自动构建，位于 `.github/workflows/`。

### 当前 CI 流程

推送 tag（格式 `v*.*.*`）时自动触发：

1. 在 Windows、macOS、Linux 三个环境并行构建
2. 上传构建产物到 GitHub Release

### 完整 CI/CD 配置示例

如需配置自动发布，可使用以下工作流：

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build Windows
        run: npm run build:win
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: windows-build
          path: |
            dist/*.exe
            
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build macOS
        run: npm run build:mac
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: macos-build
          path: |
            dist/*.dmg
            dist/*.zip
            
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build Linux
        run: npm run build:linux
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: linux-build
          path: |
            dist/*.AppImage
            dist/*.deb
            dist/*.rpm
            
  create-release:
    needs: [build-windows, build-macos, build-linux]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        
      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            windows-build/*.exe
            macos-build/*.dmg
            macos-build/*.zip
            linux-build/*.AppImage
            linux-build/*.deb
            linux-build/*.rpm
          draft: false
          prerelease: false
          generate_release_notes: true
```

### 本地构建发布（无 CI）

```bash
# 不发布到远程，仅本地构建
npm run build:win -- -p never
npm run build:mac -- -p never
npm run build:linux -- -p never

# 发布到 GitHub Releases
GITHUB_TOKEN=your_token npm run build:win -- -p always
```

## electron-builder 配置说明

`package.json` 中的 `build` 字段：

```json
{
  "build": {
    "appId": "com.lanflare.app",
    "productName": "LanFlare",
    "directories": {
      "output": "dist"
    },
    "files": [
      "dist/main.js",
      "dist/src/**/*",
      "src/renderer/**/*",
      "node_modules/**/*"
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "build/icon.ico"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "build/icon.icns",
      "category": "public.app-category.utilities"
    },
    "linux": {
      "target": ["AppImage", "deb", "rpm"],
      "icon": "build/icon.png",
      "category": "Utility"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true
    }
  }
}
```

### 常用配置项

#### 排除开发依赖

electron-builder 默认只打包 `dependencies`，不包含 `devDependencies`，无需特殊配置。

#### 额外挂载文件

```json
"extraResources": [
  {
    "from": "resources/",
    "to": "resources/"
  }
]
```

#### 协议关联

```json
"protocols": [
  {
    "name": "LanFlare",
    "schemes": ["lanflare"]
  }
]
```

## 构建故障排除

### NSIS 打包失败

**问题**: Windows 上 NSIS 打包时找不到安装程序

**解决**: electron-builder 会自动下载 NSIS。如网络问题，手动设置缓存目录：

```powershell
$env:ELECTRON_BUILDER_CACHE = "D:\electron-builder-cache"
```

### DEB 打包需要 email

**问题**: `Please specify author 'email' in the application package.json`

**解决**: 在 `package.json` 中指定带邮箱的 author：

```json
{
  "author": "Your Name <your@email.com>"
}
```

或在 `build.linux` 中指定 maintainer：

```json
{
  "build": {
    "linux": {
      "maintainer": "Your Name <your@email.com>"
    }
  }
}
```

### AppImage 在 Windows 上构建失败

**原因**: AppImage 需要 `mksquashfs` 工具，该工具仅在 Linux 上可用。

**解决**: 在 Linux 环境（或 CI）中构建 AppImage。

### macOS DMG 在非 macOS 上构建失败

**原因**: DMG 格式需要 macOS 特有工具。

**解决**: 在 macOS 环境中构建，或使用 GitHub Actions macOS runner。

### 打包体积过大

**优化建议**:

1. 检查 `node_modules` 中是否打包了不必要的模块：

```json
"files": [
  "!node_modules/**/{CHANGELOG.md,README.md,README,readme.md,readme}",
  "!node_modules/**/{test,__tests__,tests,powered-test,example,examples}",
  "!node_modules/**/.{editorconfig,eslintrc,flowconfig,travis.yml}",
  "!node_modules/**/LICENSE",
  "!node_modules/**/*.{ts,map,md}"
]
```

2. 使用 `electron-builder` 的 `asarUnpack` 只解包必要文件：

```json
"asarUnpack": [
  "**/*.node"
]
```

3. 分析打包内容：

```bash
npx asar extract dist/mac/LanFlare.app/Contents/Resources/app.asar ./extracted
# 检查 ./extracted 目录的内容
```

## 发布检查清单

发布新版本前确认：

- [ ] 更新 `package.json` 中的 `version`
- [ ] 更新 `CHANGELOG.md`（如有）
- [ ] 编译没有错误: `npm run tsc`
- [ ] 在 Windows/macOS/Linux 上手动测试核心功能
  - [ ] 设备发现正常
  - [ ] 文件发送/接收正常
  - [ ] 文件夹发送/接收正常
  - [ ] 剪贴板同步正常
  - [ ] Web 接收端正常
  - [ ] 连接授权正常
- [ ] 本地构建成功（至少测试当前平台）
- [ ] 提交所有更改: `git commit -am "chore: release v1.x.x"`
- [ ] 打标签: `git tag v1.x.x`
- [ ] 推送: `git push && git push --tags`
- [ ] 验证 CI/CD 流程成功
- [ ] 验证 GitHub Release 页面的下载包

## 安装说明（供文档参考）

### Windows

1. 下载 `LanFlare Setup 1.0.0.exe`
2. 运行安装程序
3. 选择安装目录
4. 完成安装后桌面出现快捷方式

或使用便携版（无需安装）：
1. 下载 `LanFlare 1.0.0.exe`
2. 直接运行

### macOS

1. 下载 `LanFlare-1.0.0.dmg`
2. 打开 DMG
3. 拖拽 `LanFlare.app` 到 Applications 文件夹

遇到"无法打开"提示（未签名）:
```bash
xattr -cr /Applications/LanFlare.app
```

### Linux (AppImage)

```bash
# 添加执行权限
chmod +x LanFlare-1.0.0.AppImage

# 运行
./LanFlare-1.0.0.AppImage
```

或集成到系统：
```bash
# 使用 AppImageLauncher 工具
sudo apt install appimagelauncher
```

### Linux (DEB - Ubuntu/Debian)

```bash
sudo dpkg -i lanflare_1.0.0_amd64.deb

# 运行
lanflare
```

### Linux (RPM - Fedora/CentOS)

```bash
sudo rpm -i lanflare-1.0.0.x86_64.rpm

# 运行
lanflare
```

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

构建完成后，安装包输出到 `dist/` 目录。文件名格式：`LanFlare-{version}-{平台}-{arch}.{ext}`

| 平台 | 架构 | 文件 |
|------|------|------|
| Windows | x64 | `LanFlare-1.0.0-Windows-x64-Setup.exe` |
| Windows portable | x64 | `LanFlare-1.0.0-Windows-x64-Portable.exe` |
| macOS | arm64 (Apple Silicon) | `LanFlare-1.0.0-macOS-arm64.dmg` / `.zip` |
| macOS | x64 (Intel) | `LanFlare-1.0.0-macOS-x64.dmg` / `.zip` |
| Linux | x64 | `LanFlare-1.0.0-Linux-x64.AppImage` / `.deb` / `.rpm` |
| Linux | arm64 | `LanFlare-1.0.0-Linux-arm64.AppImage` / `.deb` / `.rpm` |

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

项目配置了 GitHub Actions 自动构建，位于 `.github/workflows/build.yml`。

### CI 构建矩阵

推送 tag（格式 `v*`）或手动触发时，5 个 job **并行**构建：

| Job | Runner | 产物 |
|-----|--------|------|
| `build-windows` | `windows-latest` (x64) | `*-Windows-x64-Setup.exe`, `*-Windows-x64-Portable.exe` |
| `build-macos-arm64` | `macos-14` (Apple Silicon) | `*-macOS-arm64.dmg`, `*-macOS-arm64.zip` |
| `build-macos-x64` | `macos-14` (交叉编译) | `*-macOS-x64.dmg`, `*-macOS-x64.zip` |
| `build-linux-x64` | `ubuntu-latest` | `*-Linux-x64.AppImage/.deb/.rpm` |
| `build-linux-arm64` | `ubuntu-24.04-arm` | `*-Linux-arm64.AppImage/.deb/.rpm` |

> **macOS x64 交叉编译**: electron-builder 支持在 Apple Silicon (`macos-14`) 上通过 `--x64` 标志交叉编译 Intel 版本，无需 Intel 机器。`macos-13` 已于 2025 年底被 GitHub 下线。

> **Linux arm64 fpm**: electron-builder 捆绑的 fpm 是 x86 二进制，在 ARM64 机器上无法运行。因此 `build-linux-arm64` job 通过 `gem install fpm` 安装原生 fpm，并设置 `USE_SYSTEM_FPM=true`。

### Release 流程

所有 5 个 job 完成后，`release` job 自动创建 **Draft Release**（草稿状态）：

1. 下载全部构建产物
2. 创建草稿 Release，附上所有安装包
3. **由维护者手动审核后点击 Publish 正式发布**

预发布版本自动检测：tag 中包含 `-`（如 `v1.0.0-beta.1`）时自动标记为 Pre-release。

### 手动触发

在 GitHub Actions 页面点击 `workflow_dispatch`，填写版本号（如 `v1.1.0`）可手动触发构建和发布，无需推送 tag。

### 本地构建（无 CI）

```bash
# 仅构建，不发布
npm run build:win -- -p never
npm run build:mac -- -p never
npm run build:linux -- -p never

# 指定架构
npm run build:mac -- --arm64 -p never
npm run build:mac -- --x64 -p never
npm run build:linux -- --arm64 -p never   # 需 Linux arm64 环境
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
      "category": "public.app-category.utilities",
      "artifactName": "${productName}-${version}-macOS-${arch}.${ext}"
    },
    "linux": {
      "target": ["AppImage", "deb", "rpm"],
      "icon": "build/icon.png",
      "category": "Utility",
      "artifactName": "${productName}-${version}-Linux-${arch}.${ext}"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "artifactName": "${productName}-${version}-Windows-${arch}-Setup.${ext}"
    },
    "portable": {
      "artifactName": "${productName}-${version}-Windows-${arch}-Portable.${ext}"
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

### Linux arm64 DEB/RPM 打包失败（fpm Exec format error）

**问题**: `fpm-linux-x86/lib/ruby/bin.real/ruby: cannot execute binary file: Exec format error`

**原因**: electron-builder 捆绑的 fpm 是 x86 二进制，无法在 ARM64 机器上运行。

**解决**: 安装原生 fpm 并设置 `USE_SYSTEM_FPM=true`：

```bash
sudo apt-get install -y ruby ruby-dev build-essential
sudo gem install fpm --no-document
export USE_SYSTEM_FPM=true
npm run build:linux -- --arm64 -p never
```

### macOS x64 Runner 不可用

**问题**: `The configuration 'macos-13-us-default' is not supported`

**原因**: GitHub 已于 2025 年底下线 `macos-13`（Intel）runner。

**解决**: 改用 `macos-14`（Apple Silicon）并通过 `--x64` 交叉编译 Intel 版本：

```bash
npm run build:mac -- --x64 -p never
```

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

> 下载文件时请根据自己的系统架构选择对应版本（Intel 芯片选 `x64`，Apple Silicon / 树莓派等选 `arm64`）。

### Windows

1. 下载 `LanFlare-1.0.0-Windows-x64-Setup.exe`
2. 运行安装程序，选择安装目录
3. 完成安装后桌面出现快捷方式

或使用便携版（无需安装）：
1. 下载 `LanFlare-1.0.0-Windows-x64-Portable.exe`
2. 直接运行

### macOS

1. 根据芯片下载对应 DMG：
   - Apple Silicon（M1/M2/M3）→ `LanFlare-1.0.0-macOS-arm64.dmg`
   - Intel → `LanFlare-1.0.0-macOS-x64.dmg`
2. 打开 DMG，将 `LanFlare.app` 拖拽到 Applications 文件夹

遇到"无法打开"提示（未签名）:
```bash
xattr -cr /Applications/LanFlare.app
```

### Linux (AppImage)

```bash
# x64
chmod +x LanFlare-1.0.0-Linux-x64.AppImage
./LanFlare-1.0.0-Linux-x64.AppImage

# arm64（树莓派、Raspberry Pi 400 等）
chmod +x LanFlare-1.0.0-Linux-arm64.AppImage
./LanFlare-1.0.0-Linux-arm64.AppImage
```

或集成到系统：
```bash
sudo apt install appimagelauncher
```

### Linux (DEB - Ubuntu/Debian)

```bash
# x64
sudo dpkg -i LanFlare-1.0.0-Linux-x64.deb

# arm64
sudo dpkg -i LanFlare-1.0.0-Linux-arm64.deb

# 运行
lanflare
```

### Linux (RPM - Fedora/CentOS)

```bash
# x64
sudo rpm -i LanFlare-1.0.0-Linux-x64.rpm

# arm64
sudo rpm -i LanFlare-1.0.0-Linux-arm64.rpm

# 运行
lanflare
```

# LanFlare 开发环境设置

本文档介绍如何设置 LanFlare 的开发环境，以及开发过程中的常用工具和技巧。

## 前置要求

### 必需软件

- **Node.js**: 16.x 或更高版本
  - 下载: https://nodejs.org/
  - 推荐使用 LTS 版本
  - 验证安装: `node --version`

- **npm**: 通常随 Node.js 一起安装
  - 验证安装: `npm --version`
  - 或使用 yarn: `yarn --version`

- **Git**: 版本控制系统
  - 下载: https://git-scm.com/
  - 验证安装: `git --version`

### 推荐软件

- **Visual Studio Code**: 推荐的代码编辑器
  - 下载: https://code.visualstudio.com/
  - 推荐插件:
    - ESLint
    - Prettier
    - TypeScript and JavaScript Language Features
    - Electron Debug

- **Postman** 或 **Thunder Client**: 测试 Web 接收端 API

## 克隆项目

```bash
# 使用 HTTPS
git clone https://github.com/yourusername/LanFlare.git

# 或使用 SSH
git clone git@github.com:yourusername/LanFlare.git

cd LanFlare
```

## 安装依赖

```bash
npm install
```

这将安装所有必需的依赖，包括：
- `electron`: Electron 框架
- `typescript`: TypeScript 编译器
- `ws`: WebSocket 库
- `electron-builder`: 打包工具
- 以及其他开发依赖

## 项目结构

```
LanFlare/
├── .github/              # GitHub Actions CI/CD 配置
├── build/                # 构建资源（图标等）
├── dist/                 # 编译输出目录
├── docs/                 # 文档
│   └── develop/          # 开发文档
├── node_modules/         # Node.js 依赖
├── src/                  # 源代码
│   ├── assets/           # 静态资源
│   ├── main/             # 主进程代码
│   ├── preload/          # Preload 脚本
│   └── renderer/         # 渲染进程代码
├── main.ts               # 主进程入口
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
└── README.md             # 项目说明
```

## 开发工作流

### 1. 启动开发模式

```bash
npm run dev
```

这个命令会：
1. 编译 TypeScript (`tsc`)
2. 复制静态资源 (`copyassets`)
3. 启动 Electron 应用

**快捷键**:
- `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Option+I` (macOS): 打开开发者工具
- `Ctrl+R` (Windows/Linux) 或 `Cmd+R` (macOS): 重新加载窗口

### 2. 监听文件变化

开发时推荐使用文件监听工具自动重新编译：

**方法 1: 使用 tsc watch**

在一个终端窗口运行：
```bash
npx tsc --watch
```

在另一个终端窗口运行：
```bash
npm run copyassets && electron .
```

每次保存 TypeScript 文件后，手动重启 Electron 或按 `Ctrl+R` 重新加载。

**方法 2: 使用 nodemon (推荐)**

安装 nodemon：
```bash
npm install --save-dev nodemon
```

添加到 `package.json` scripts:
```json
"watch": "tsc --watch",
"dev:watch": "nodemon --watch dist --exec 'npm run copyassets && electron .'"
```

使用：
```bash
# 终端 1
npm run watch

# 终端 2
npm run dev:watch
```

### 3. 编译 TypeScript

仅编译代码而不启动应用：

```bash
npm run tsc
```

编译错误会在终端显示。

### 4. 调试技巧

#### 主进程调试

在 VS Code 中创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": ["."],
      "outputCapture": "std",
      "preLaunchTask": "npm: tsc"
    }
  ]
}
```

在代码中设置断点，按 F5 启动调试。

#### 渲染进程调试

1. 启动应用 `npm run dev`
2. 打开开发者工具 `Ctrl+Shift+I`
3. 在 Sources 标签页中找到 `src/renderer/app.js`
4. 设置断点并触发相应操作

#### 查看日志

**主进程**:
- 输出到终端 `console.log()`

**渲染进程**:
- 输出到开发者工具 Console

**网络调试**:
```typescript
// 在 transfer.ts 中添加
socket.on('data', (chunk) => {
  console.log('Received chunk:', chunk.length, 'bytes');
});
```

### 5. 测试功能

#### 测试设备发现

需要至少两台设备或虚拟机：

```bash
# 设备 1
npm run dev

# 设备 2（同一局域网）
npm run dev
```

两个设备应该能互相发现。

**单机测试**（开发模式）:
- 在开发模式 (`!app.isPackaged`)，设备列表会包含自己
- 可以对自己发送文件进行测试

#### 测试文件传输

1. 启动两个实例（或在开发模式下选择自己）
2. 选择目标设备
3. 点击"发送文件"选择测试文件
4. 检查 `~/Downloads/LanFlare` 目录

**预期行为**:
- 发送端显示进度（如果文件较大）
- 接收端收到通知
- 接收记录中显示文件

#### 测试 Web 接收端

1. 启动应用 `npm run dev`
2. 设备列表顶部显示 Web URL（如 `http://192.168.1.100:53321`）
3. 在浏览器中打开该 URL
4. 上传文件测试

**使用 cURL 测试**:
```bash
# 上传文件
curl -X POST http://192.168.1.100:53321/upload \
  -H "Content-Type: application/octet-stream" \
  -H "X-Filename: test.txt" \
  -H "X-Filesize: 1024" \
  --data-binary "@test.txt"

# 上传文本
curl -X POST http://192.168.1.100:53321/text \
  -H "Content-Type: text/plain; charset=utf-8" \
  -d "Hello LanFlare"
```

#### 测试剪贴板同步

1. 启动两个实例
2. 在"剪贴板同步"标签页开启同步
3. 在一个实例中复制文本
4. 检查另一个实例是否收到

**测试内容**:
- 纯文本
- 图片（复制图片文件或截图）
- 文件路径（复制文件）

## 常见问题

### TypeScript 编译错误

**问题**: `error TS2307: Cannot find module 'xxx'`

**解决**:
```bash
npm install
npm install --save-dev @types/xxx
```

### Electron 启动失败

**问题**: `Error: Electron failed to install correctly`

**解决**:
```bash
cd node_modules/electron
node install.js
```

或重新安装：
```bash
npm uninstall electron
npm install --save-dev electron
```

### 端口已被占用

**问题**: `Error: listen EADDRINUSE: address already in use`

**解决**:

Windows:
```powershell
# 查找占用端口的进程
netstat -ano | findstr :53319
# 结束进程 (PID 为上一步输出的最后一列)
taskkill /PID <PID> /F
```

Linux/macOS:
```bash
# 查找占用端口的进程
lsof -i :53319
# 结束进程
kill -9 <PID>
```

或在代码中使用不同的端口（修改 `src/main/*.ts` 中的端口常量）。

### 无法发现设备

**检查清单**:
1. ✅ 设备在同一局域网
2. ✅ 防火墙允许 UDP 53318 端口
3. ✅ 两个设备都启动了 LanFlare
4. ✅ 网络不是"公共网络"（Windows）

**调试**:
```typescript
// 在 discovery.ts 的 start() 方法中添加
this.socket.on('listening', () => {
  const address = this.socket!.address();
  console.log(`Discovery service listening on ${address.address}:${address.port}`);
});
```

### 文件传输失败

**检查清单**:
1. ✅ 连接已授权（检查 connection-auth.ts）
2. ✅ 防火墙允许 TCP 53319 端口
3. ✅ 目标设备有足够磁盘空间
4. ✅ 文件路径存在且可读

**查看详细错误**:
```typescript
// 在 app.js 的 sendFilesAction() 中
if (!result.success) {
  console.error('Send failed:', result.error);
  showToast(`发送失败: ${result.error}`, 'error');
}
```

## 代码规范

### TypeScript 风格

- 使用 2 空格缩进
- 使用单引号字符串
- 接口名称使用 PascalCase
- 函数名称使用 camelCase
- 私有方法前缀 `_`

示例:
```typescript
interface DeviceInfo {
  id: string;
  name: string;
}

class Discovery {
  private devices: Map<string, DeviceInfo>;
  
  public start(): void {
    this._broadcast();
  }
  
  private _broadcast(): void {
    // ...
  }
}
```

### 提交消息规范

使用 Conventional Commits 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

类型 (type):
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具配置

示例:
```
feat(transfer): add folder aggregation

- Aggregate folder files using PendingFolder structure
- Emit single transfer-complete event for folders
- Add 60s timeout protection

Closes #123
```

## 开发工具

### VS Code 配置

推荐的 `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.exclude": {
    "**/.git": true,
    "**/node_modules": true,
    "**/dist": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true
  }
}
```

### 有用的 npm scripts

在 `package.json` 中添加：

```json
"scripts": {
  "tsc": "tsc",
  "tsc:watch": "tsc --watch",
  "clean": "rimraf dist",
  "lint": "eslint src --ext .ts",
  "format": "prettier --write \"src/**/*.{ts,js,html,css}\"",
  "test": "echo \"Error: no test specified\" && exit 1"
}
```

安装相应工具：
```bash
npm install --save-dev eslint prettier rimraf
```

## 性能分析

### Electron DevTools

1. 打开开发者工具 `Ctrl+Shift+I`
2. Performance 标签页录制性能
3. Memory 标签页检查内存泄漏

### 主进程性能

使用 Node.js 内置的 profiler:

```bash
electron . --inspect=5858
```

然后在 Chrome 中打开 `chrome://inspect`。

### 网络性能

监控传输速度：

```typescript
// 在 transfer.ts 中
let startTime = Date.now();
let totalBytes = 0;

socket.on('data', (chunk) => {
  totalBytes += chunk.length;
  const elapsed = (Date.now() - startTime) / 1000;
  const speed = totalBytes / elapsed / 1024 / 1024; // MB/s
  console.log(`Speed: ${speed.toFixed(2)} MB/s`);
});
```

## 下一步

- 阅读 [架构设计](architecture.md) 了解系统设计
- 阅读 [网络协议](protocols.md) 了解通信协议
- 阅读 [构建和发布](building.md) 了解打包流程
- 开始贡献代码！

## 获取帮助

- 查看 [GitHub Issues](https://github.com/yourusername/LanFlare/issues)
- 提交新 Issue 描述你的问题
- 加入讨论 [GitHub Discussions](https://github.com/yourusername/LanFlare/discussions)

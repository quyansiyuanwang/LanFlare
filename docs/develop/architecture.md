# LanFlare 架构设计

## 概述

LanFlare 是基于 Electron 构建的跨平台局域网文件传输应用。本文档描述了应用的整体架构、模块设计和数据流。

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Application                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────┐        ┌──────────────────────┐   │
│  │  Renderer Process│◄──IPC─►│   Main Process       │   │
│  │  (Browser)       │        │   (Node.js)          │   │
│  │                  │        │                       │   │
│  │  - UI Logic      │        │  - Discovery Server  │   │
│  │  - User Events   │        │  - Transfer Server   │   │
│  │  - Progress      │        │  - Clipboard Sync    │   │
│  │    Display       │        │  - Connection Auth   │   │
│  │                  │        │  - Web Receiver      │   │
│  └─────────────────┘        └──────────────────────┘   │
│                                        │                 │
└────────────────────────────────────────┼─────────────────┘
                                         │
                    ┌────────────────────┼────────────────┐
                    │                    │                 │
            ┌───────▼────────┐  ┌───────▼───────┐  ┌─────▼─────┐
            │ UDP Discovery  │  │ TCP Transfer  │  │ WebSocket │
            │   (Port 53318) │  │  (Port 53319) │  │ WS: 53320 │
            └────────────────┘  └───────────────┘  │ WS: 53322 │
                                                    │ HTTP:53321│
                                                    └───────────┘
```

## 模块设计

### 1. Main Process (主进程)

主进程运行在 Node.js 环境中，负责应用的核心业务逻辑。

#### 1.1 Discovery Module (`discovery.ts`)

**职责**: 局域网设备发现和管理

**核心功能**:
- UDP 广播自身设备信息（每 2 秒）
- 监听局域网内其他 LanFlare 设备的广播
- 维护在线设备列表（6 秒超时自动移除）
- 设备信息包含：ID、名称、IP、端口、平台

**关键实现**:
```typescript
interface DeviceInfo {
  id: string;           // 唯一设备 ID
  name: string;         // 设备名称（主机名）
  ip: string;           // IP 地址
  tcpPort: number;      // TCP 传输端口
  wsPort: number;       // WebSocket 端口
  platform: string;     // 操作系统平台
  lastSeen?: number;    // 最后可见时间
}
```

**事件**:
- `devices-changed`: 设备列表变更时触发

#### 1.2 Transfer Module (`transfer.ts`)

**职责**: 文件和文本传输

**核心功能**:
- TCP Server: 监听文件接收请求
- TCP Client: 发送文件到目标设备
- 支持文件、文件夹、文本、剪贴板内容
- 文件夹传输聚合（避免多次通知）
- 传输进度跟踪

**传输流程**:
```
发送端                                        接收端
  │                                            │
  ├─1. 建立 TCP 连接─────────────────────────►│
  │                                            │
  ├─2. 发送 JSON Header + \n\n ──────────────►│
  │    {type, fileName, fileSize, from, ...}  │
  │                                            │
  ├─3. 发送文件数据流 ────────────────────────►│
  │    (多次 socket.write)                    │
  │                                            ├─接收并写入文件
  │                                            │
  ├─4. 关闭连接 ──────────────────────────────►│
  │                                            │
  │                                            ├─触发 transfer-complete
```

**文件夹聚合机制**:
- 使用 `PendingFolder` 结构追踪文件夹传输
- 按 `${from}::${folderName}` 作为键聚合多个文件
- 收到所有文件后才触发单次 `transfer-complete` 事件
- 60 秒超时保护机制

#### 1.3 Clipboard Sync Module (`clipboard-sync.ts`)

**职责**: 设备间剪贴板实时同步

**核心功能**:
- WebSocket Server/Client 架构
- 轮询本地剪贴板变化（500ms 间隔）
- 支持文本、图片（PNG）、文件、文件夹
- 消息去重（使用 `messageId` + `receivedMessageIds` Set）

**剪贴板检测优先级**:
```
1. 文件夹 → contentType: 'folder'
2. 文件 → contentType: 'files'
3. 文本 → contentType: 'text'
4. 图片 → contentType: 'image'
```

**同步协议**:
```json
{
  "type": "clipboard",
  "contentType": "text|image|files|folder",
  "content": "内容或 base64",
  "from": "设备名称",
  "timestamp": 1234567890,
  "messageId": "唯一消息 ID",
  "folderInfo": {  // 仅 contentType='folder' 时
    "name": "文件夹名称",
    "fileCount": 10,
    "totalSize": 1024000
  }
}
```

#### 1.4 Connection Auth Module (`connection-auth.ts`)

**职责**: 设备连接授权管理

**核心功能**:
- WebSocket 授权服务器（端口 53322）
- 连接请求/响应机制
- 授权状态管理（1 小时有效期）
- 30 秒请求超时

**授权流程**:
```
设备 A                    设备 B
  │                         │
  ├─1. requestConnection()─►│
  │    (建立 WS 连接)        │
  │                         ├─触发 connection-request 事件
  │                         ├─显示授权弹窗
  │                         │
  │◄─2. connection-response─┤
  │    {approved: true}     │
  │                         │
  ├─3. 缓存授权状态 1 小时  │
  │                         │
  ├─后续操作自动通过────────►│
```

#### 1.5 Web Receiver Module (`web-receiver.ts`)

**职责**: HTTP 服务器，支持浏览器上传文件

**核心功能**:
- HTTP Server（端口 53321）
- 提供 Web 界面（`web-receiver.html`）
- 文件上传接口 `/upload`
- 文本上传接口 `/text`
- 可选密码保护

**上传协议**:
```
POST /upload
Headers:
  Content-Type: application/octet-stream
  X-Filename: file.txt (URL encoded)
  X-Filesize: 1024
  X-Relative-Path: folder/file.txt (可选，文件夹上传)
  X-Folder-Name: MyFolder (可选，文件夹上传)
Body: 文件二进制数据
```

### 2. Renderer Process (渲染进程)

渲染进程运行在 Chromium 浏览器环境中，负责用户界面。

#### 2.1 UI Components

**主要组件**:
- **Custom Titlebar**: 自定义标题栏（支持窗口控制）
- **Device List**: 左侧设备列表
- **Send Panel**: 发送操作面板
- **Receive History**: 接收记录列表
- **Clipboard Sync Panel**: 剪贴板同步管理

#### 2.2 State Management

**全局状态**:
```javascript
let selectedDevice = null;       // 当前选中的设备
let webTargetUrl = null;         // Web 接收端 URL（与 selectedDevice 互斥）
let devices = [];                // 可用设备列表
let receiveHistory = [];         // 接收记录（按时间倒序）
let syncingDevices = new Set();  // 正在同步剪贴板的设备 ID
```

#### 2.3 Event Flow

```
用户操作
  │
  ├─► IPC 调用 (window.api.*)
  │     │
  │     └─► Main Process 处理
  │           │
  │           └─► 网络操作/文件系统
  │                 │
  │                 └─► IPC 事件返回 (ipcRenderer.on)
  │                       │
  │                       └─► 更新 UI 状态
```

### 3. Preload Script (`preload.ts`)

**职责**: 安全的 IPC 桥接层

通过 `contextBridge` 暴露受限的 API 给渲染进程：

```typescript
window.api = {
  // 设备发现
  getDevices, onDevicesChanged,
  
  // 文件操作
  selectFiles, selectFolder,
  
  // 发送操作
  sendFiles, sendFolder, sendText, sendClipboard,
  
  // 传输事件
  onTransferStart, onTransferProgress, onTransferComplete,
  
  // 剪贴板同步
  toggleClipboardSync, onClipboardSynced,
  
  // 连接授权
  requestConnection, approveConnection, rejectConnection,
  
  // 工具方法
  openSaveDir, openPath, deleteFile, deleteFolder,
  
  // Web 接收端
  getWebSettings, setWebSettings, uploadFileToWeb, uploadFolderToWeb,
  
  // 窗口控制
  windowMinimize, windowMaximize, windowClose
}
```

## 数据流示例

### 文件发送流程

```
1. 用户点击"发送文件"按钮
   ↓
2. Renderer: 调用 window.api.selectFiles()
   ↓
3. Main: dialog.showOpenDialog() 选择文件
   ↓
4. Renderer: 调用 window.api.sendFiles({deviceIp, devicePort, filePaths})
   ↓
5. Main: 检查连接授权 → connectionAuth.isAuthorized()
   ↓
6. Main: 遍历文件，调用 sendFile()
   ↓
7. Main: 建立 TCP 连接，发送 Header + 文件数据
   ↓
8. 接收端 Main: transfer-complete 事件
   ↓
9. 接收端 Renderer: 更新接收记录 UI
   ↓
10. 接收端: 显示系统通知
```

### 剪贴板同步流程

```
1. 设备 A: 用户复制文本
   ↓
2. 设备 A Main: 轮询检测到剪贴板变化
   ↓
3. 设备 A Main: 通过 WebSocket 发送到设备 B
   ↓
4. 设备 B Main: 接收 WebSocket 消息
   ↓
5. 设备 B Main: 写入本地剪贴板 clipboard.writeText()
   ↓
6. 设备 B Renderer: 触发 onClipboardSynced 事件
   ↓
7. 设备 B Renderer: 显示同步记录
```

## 文件结构

```
LanFlare/
├── main.ts                    # 主进程入口
├── src/
│   ├── main/
│   │   ├── discovery.ts       # 设备发现
│   │   ├── transfer.ts        # 文件传输
│   │   ├── clipboard-sync.ts  # 剪贴板同步
│   │   ├── connection-auth.ts # 连接授权
│   │   ├── web-receiver.ts    # Web 接收端
│   │   └── utils.ts           # 工具函数
│   ├── preload/
│   │   └── preload.ts         # IPC 桥接
│   ├── renderer/
│   │   ├── index.html         # 主界面
│   │   ├── app.js             # UI 逻辑
│   │   └── styles.css         # 样式
│   └── assets/
│       └── web-receiver.html  # Web 接收页面
├── dist/                      # 编译输出
├── package.json
└── tsconfig.json
```

## 安全考虑

### 1. 连接授权
- 所有 LAN 设备连接需要用户手动授权
- 授权有效期 1 小时，过期需重新授权

### 2. Web 接收端
- 支持密码保护
- 仅监听局域网地址，不对外网开放

### 3. IPC 安全
- 使用 `contextBridge` 限制暴露的 API
- 禁用 Node.js 集成（`nodeIntegration: false`）
- 启用上下文隔离（`contextIsolation: true`）

### 4. 文件系统
- 接收文件自动保存到固定目录 `~/Downloads/LanFlare`
- 文件夹递归操作有深度限制

## 性能优化

### 1. 通知去重
- 文件夹传输聚合，避免单个文件单独通知
- 多文件传输 1.5 秒防抖，批量通知

### 2. 剪贴板轮询
- 500ms 轮询间隔平衡响应速度和 CPU 占用
- 消息 ID 去重避免死循环

### 3. 设备发现
- 2 秒广播间隔
- 6 秒超时自动清理离线设备

## 扩展性

### 添加新的传输类型

1. 在 `TransferHeader` 添加新的 `type`
2. 在 `TransferServer._handleConnection` 添加处理逻辑
3. 添加对应的 Client 函数（如 `sendXxx()`）
4. 在 Main Process 添加 IPC 处理器
5. 在 Preload 暴露 API
6. 在 Renderer 添加 UI 和调用逻辑

### 添加新的网络服务

1. 在 `src/main/` 创建新模块（继承 `EventEmitter`）
2. 在 `main.ts` 初始化服务并监听事件
3. 添加相应的 IPC 通信
4. 更新文档和端口列表

## 已知限制

1. **文件夹上传**: Web 端依赖浏览器 `webkitdirectory` API（部分浏览器不支持）
2. **剪贴板文件夹**: 仅同步文件夹路径，不自动传输文件夹内容
3. **网络环境**: 需要局域网环境，不支持跨网段
4. **防火墙**: 可能需要用户手动添加防火墙规则
5. **大文件传输**: 无断点续传，传输中断需重新发送

## 未来规划

- [ ] P2P 穿透支持（NAT 穿透）
- [ ] 断点续传
- [ ] 传输加密
- [ ] 传输速度限制
- [ ] 多语言支持
- [ ] 深色模式
- [ ] 插件系统

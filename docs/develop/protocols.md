# LanFlare 网络协议规范

本文档描述 LanFlare 应用中使用的所有网络协议和消息格式。

## 端口分配

| 端口 | 协议 | 模块 | 用途 |
|------|------|------|------|
| 53318 | UDP | Discovery | 设备发现广播 |
| 53319 | TCP | Transfer | 文件和文本传输 |
| 53320 | WebSocket | Clipboard Sync | 剪贴板同步 |
| 53321 | HTTP | Web Receiver | 浏览器文件上传 |
| 53322 | WebSocket | Connection Auth | 连接授权 |

## 1. 设备发现协议 (UDP 53318)

### 广播消息

设备每 2 秒向局域网广播自身信息。

**方向**: 单播/广播 → 所有 LanFlare 设备

**消息格式** (JSON, UTF-8):

```json
{
  "id": "device-uuid",
  "name": "MacBook-Pro",
  "tcpPort": 53319,
  "wsPort": 53320,
  "platform": "darwin"
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 设备唯一 ID（UUID v4，每次启动生成） |
| `name` | string | 是 | 设备名称（操作系统主机名） |
| `tcpPort` | number | 是 | TCP 传输端口 |
| `wsPort` | number | 是 | WebSocket 端口 |
| `platform` | string | 是 | 平台标识（`win32`, `darwin`, `linux`） |

**设备超时**: 6 秒未收到广播则认为设备离线。

**接收处理**:
- 忽略自身 ID 的消息（`data.id === this.deviceId`）
- 更新设备的 `lastSeen` 时间戳
- 触发 `devices-changed` 事件通知 UI 更新

---

## 2. 文件传输协议 (TCP 53319)

### 2.1 通用帧格式

每个 TCP 连接对应一个传输任务（文件、文本或剪贴板内容）。

**帧格式**:
```
[JSON Header]\n\n[Binary/Text Payload]
```

- Header 和 Payload 之间以 `\n\n`（两个换行符）分隔
- Header 为有效的 JSON 字符串
- Payload 为文件原始二进制数据或文本内容

### 2.2 Transfer Header 格式

```typescript
interface TransferHeader {
  type: 'file' | 'text' | 'clipboard-text' | 'clipboard-image';
  fileName?: string;       // 文件名（type=file 时必填）
  fileSize?: number;       // 文件大小（字节）
  from: string;            // 发送方设备名
  folderName?: string;     // 文件夹名（文件夹传输时）
  relativePath?: string;   // 文件夹内相对路径（文件夹传输时）
  totalFiles?: number;     // 文件夹内文件总数（文件夹传输时）
}
```

### 2.3 传输类型

#### 单文件传输

```json
{
  "type": "file",
  "fileName": "document.pdf",
  "fileSize": 1048576,
  "from": "Desktop-PC"
}
```

接收端保存路径: `~/Downloads/LanFlare/document.pdf`

#### 文件夹传输

文件夹中每个文件建立独立 TCP 连接，Header 携带文件夹信息：

```json
{
  "type": "file",
  "fileName": "readme.md",
  "fileSize": 2048,
  "from": "Desktop-PC",
  "folderName": "MyProject",
  "relativePath": "docs/readme.md",
  "totalFiles": 42
}
```

接收端保存路径: `~/Downloads/LanFlare/MyProject/docs/readme.md`

**文件夹聚合逻辑**:
- 每个文件到达后，以 `${from}::${folderName}` 为键追踪进度
- 收到所有 `totalFiles` 个文件后发出单次完成事件
- 60 秒超时保护（防止发送端中途失败导致等待）

#### 文本传输

```json
{
  "type": "text",
  "from": "Desktop-PC",
  "fileSize": 256
}
```

Payload: UTF-8 文本内容（无文件，直接读取 payload）

#### 剪贴板文本

```json
{
  "type": "clipboard-text",
  "from": "Desktop-PC",
  "fileSize": 128
}
```

Payload: UTF-8 文本内容

#### 剪贴板图片

```json
{
  "type": "clipboard-image",
  "fileName": "clipboard_1234567890.png",
  "fileSize": 204800,
  "from": "Desktop-PC"
}
```

Payload: PNG 格式二进制数据

接收端保存路径: `~/Downloads/LanFlare/clipboard_1234567890.png`

### 2.4 传输进度事件

接收端实时计算接收进度并触发事件（通过 IPC 发送到渲染进程）：

```typescript
interface TransferProgressInfo {
  id: string;        // 传输任务 ID
  received: number;  // 已接收字节数
  total: number;     // 总字节数
  percent: number;   // 完成百分比 (0-100)
}
```

### 2.5 传输完成事件

```typescript
interface TransferCompleteInfo {
  id: string;
  type: string;          // 传输类型
  from: string;          // 发送方名称
  content?: string;      // 文本内容（type=text/clipboard-text 时）
  fileName?: string;     // 文件名
  fileSize?: number;     // 文件大小
  savePath?: string;     // 保存路径
  timestamp: number;     // 完成时间戳
  folderName?: string;   // 文件夹名（type=folder 时）
  totalFiles?: number;   // 文件数量（type=folder 时）
  folderSavePath?: string; // 文件夹保存路径（type=folder 时）
}
```

### 2.6 错误处理

- 连接中断: `socket.on('error', handler)` 捕获错误
- 接收端关闭未完成的 WriteStream
- 发送端 Promise 以 reject 方式返回错误

---

## 3. 剪贴板同步协议 (WebSocket 53320)

### 3.1 连接建立

发起方连接到目标设备：
```
ws://192.168.1.100:53320
```

连接成功后双方可互相发送消息。

### 3.2 消息格式

```typescript
interface ClipboardMessage {
  type: 'clipboard';
  contentType: 'text' | 'image' | 'files' | 'folder';
  content: string;        // 文本内容或图片 base64
  from: string;           // 发送方设备名
  timestamp: number;      // 时间戳
  messageId: string;      // 消息唯一 ID（去重用）
  folderInfo?: {          // 仅 contentType='folder' 时
    name: string;
    fileCount: number;
    totalSize: number;
  };
}
```

**消息例子**:

文本同步:
```json
{
  "type": "clipboard",
  "contentType": "text",
  "content": "Hello, World!",
  "from": "MacBook-Pro",
  "timestamp": 1740825600000,
  "messageId": "msg_abc123def456"
}
```

图片同步:
```json
{
  "type": "clipboard",
  "contentType": "image",
  "content": "iVBORw0KGgoAAAANSUhEUgAA...",
  "from": "MacBook-Pro",
  "timestamp": 1740825600000,
  "messageId": "msg_xyz789"
}
```

文件同步:
```json
{
  "type": "clipboard",
  "contentType": "files",
  "content": "C:\\Users\\user\\Documents\\file.txt",
  "from": "Desktop-PC",
  "timestamp": 1740825600000,
  "messageId": "msg_files001"
}
```

文件夹同步:
```json
{
  "type": "clipboard",
  "contentType": "folder",
  "content": "C:\\Users\\user\\Documents\\MyProject",
  "from": "Desktop-PC",
  "timestamp": 1740825600000,
  "messageId": "msg_folder001",
  "folderInfo": {
    "name": "MyProject",
    "fileCount": 15,
    "totalSize": 2048000
  }
}
```

### 3.3 轮询机制

- **间隔**: 500ms
- **检测顺序**: 文件夹 → 文件 → 文本 → 图片
- **去重**: 记录最后发送的内容，内容未变则不发送
- **消息 ID**: `msg_${Date.now()}_${Math.random()}` 格式，接收端缓存已处理 ID

### 3.4 剪贴板内容检测

```
检测流程:
1. 读取文本剪贴板内容
2. 检查是否看起来像文件路径（正则匹配）
   ├─ 是: fs.statSync() 检查路径是否存在
   │     ├─ 是且为文件夹 → contentType='folder'
   │     └─ 是且为文件 → contentType='files'
   └─ 否: 内容为普通文本 → contentType='text'
3. 读取图片剪贴板内容
   └─ 有图片且文本未变 → contentType='image'
```

---

## 4. 连接授权协议 (WebSocket 53322)

### 4.1 连接建立

发起方连接到目标设备的授权服务：
```
ws://192.168.1.100:53322
```

### 4.2 消息类型

#### 连接请求

发起方发送：

```json
{
  "type": "connection-request",
  "requestId": "req_abc123",
  "fromDeviceId": "device-uuid",
  "fromDeviceName": "Desktop-PC",
  "timestamp": 1740825600000
}
```

#### 连接响应

被请求方回复：

```json
{
  "type": "connection-response",
  "requestId": "req_abc123",
  "approved": true,
  "timestamp": 1740825600001
}
```

或拒绝：

```json
{
  "type": "connection-response",
  "requestId": "req_abc123",
  "approved": false,
  "timestamp": 1740825600001
}
```

### 4.3 授权状态机

```
未连接
  │
  ├─ requestConnection() 调用
  │   │
  │   ├─ 已授权且未过期 → 直接返回 approved=true
  │   │
  │   └─ 未授权/已过期 → 发送 connection-request
  │         │
  │         ├─ 收到 approved=true → 缓存授权状态(1h) → 返回 approved=true
  │         │
  │         ├─ 收到 approved=false → 返回 approved=false
  │         │
  │         └─ 30秒超时 → 抛出 Error("连接请求超时")
```

### 4.4 授权缓存

```typescript
interface AuthRecord {
  deviceId: string;
  authorizedAt: number;  // 时间戳
}

// 授权有效期: 3600000ms (1 小时)
const AUTH_EXPIRY = 3600 * 1000;
```

检查授权：
```typescript
isAuthorized(deviceId: string): boolean {
  const record = this.authorized.get(deviceId);
  if (!record) return false;
  return Date.now() - record.authorizedAt < AUTH_EXPIRY;
}
```

---

## 5. Web 接收端 HTTP 协议 (HTTP 53321)

### 5.1 端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 返回 Web 前端页面 |
| POST | `/upload` | 上传文件（含文件夹） |
| POST | `/text` | 上传文本 |

### 5.2 身份验证

如果设置了密码，所有请求需包含 `X-Password` 头或 `password` 查询参数：

请求头：
```
X-Password: yourpassword
```

错误响应（密码错误）：
```
HTTP/1.1 401 Unauthorized
内容: Unauthorized
```

### 5.3 文件上传

**请求**:
```
POST /upload
Content-Type: application/octet-stream
X-Filename: document.pdf
X-Filesize: 1048576
[可选文件夹头]

[文件二进制数据]
```

**文件夹上传** (额外 Headers):
```
X-Relative-Path: subfolder%2Fdocument.pdf   (URL encoded)
X-Folder-Name: MyProject                     (URL encoded)
```

**成功响应**:
```
HTTP/1.1 200 OK
Content-Type: text/plain
OK
```

**错误响应**:
```
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain
Upload failed: [错误信息]
```

**文件保存路径**:
- 普通文件: `~/Downloads/LanFlare/[filename]`
- 文件夹文件: `~/Downloads/LanFlare/[folderName]/[relativePath]`

### 5.4 文本上传

**请求**:
```
POST /text
Content-Type: text/plain; charset=utf-8

[文本内容]
```

**成功响应**:
```
HTTP/1.1 200 OK
Content-Type: text/plain
OK
```

---

## 6. 安全考虑

### 6.1 网络范围
所有服务仅绑定到局域网接口（`0.0.0.0`），实际上通过路由器防火墙限制到局域网范围。

### 6.2 端口选择
使用高位端口（53318-53322），避免与常用系统服务冲突，减少权限问题。

### 6.3 身份验证
- 设备传输：连接授权机制（WS 53322）
- Web 接收：可选密码保护（HTTP Header）

### 6.4 已知风险
- 传输数据无加密（局域网内认为安全）
- 设备 ID 每次启动重新生成，理论上可伪造名称
- Web 接收端密码以明文传输

## 7. 向后兼容性

目前协议版本为 v1（隐式）。未来版本变更时：
- 增量添加字段，旧字段保持兼容
- 不支持的消息类型静默忽略
- 协议**主版本**变更时添加 `protocolVersion` 字段

---

## 附录

### 消息 ID 生成

```javascript
const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

### 设备 ID 生成

```javascript
const deviceId = crypto.randomBytes(8).toString('hex');
// 或
const deviceId = Math.random().toString(36).substr(2, 12);
```

### 文件大小格式化

```typescript
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
```

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LanFlare is an Electron-based cross-platform LAN file transfer and clipboard sync application. It enables fast, secure file transfers and real-time clipboard synchronization between devices on the same local network without requiring a server.

**Key Features:**

- High-speed LAN file transfers (files, folders, text, clipboard)
- Real-time clipboard synchronization (text, images, files)
- Web receiver for browser-based uploads
- Connection authorization system
- Zero-configuration device discovery

## Development Commands

### Setup

```bash
npm install
```

### Development

```bash
npm run dev          # Compile TypeScript and run Electron
npm start            # Same as dev
```

### Code Quality

```bash
npm run tsc          # Compile TypeScript
npm run tsc:check    # Type check without emitting files
npm run lint         # Lint and auto-fix TypeScript files
npm run lint:check   # Lint without fixing
npm run format       # Format code with Prettier
npm run format:check # Check formatting without fixing
npm run precommit    # Run all checks (tsc + lint + format)
```

### Building

```bash
npm run build        # Build for current platform
npm run build:win    # Build for Windows (NSIS installer + portable)
npm run build:mac    # Build for macOS (arm64 + x64)
npm run build:linux  # Build for Linux (AppImage, deb, rpm)
npm run build:all    # Build for all platforms
npm run clean        # Clean build artifacts
npm run analyze      # Analyze build size and dependencies
```

### Optimization

```bash
npm run optimize     # Optimize CSS and HTML (optional)
```

## Architecture

### Process Model

**Main Process** (`main.ts`): Node.js environment running core business logic

- Discovery: UDP broadcast for device discovery (port 53318)
- Transfer: TCP server/client for file transfers (port 53319)
- Clipboard Sync: WebSocket server/client for clipboard sync (port 53320)
- Connection Auth: WebSocket authorization server (port 53322)
- Web Receiver: HTTP server for browser uploads (port 53321)

**Renderer Process** (`src/renderer/`): Chromium browser environment for UI

- Plain HTML/CSS/JavaScript (no framework)
- Communicates with main process via IPC through preload bridge

**Preload Script** (`src/preload/preload.ts`): Secure IPC bridge

- Uses `contextBridge` to expose limited API to renderer
- Ensures `contextIsolation: true` and `nodeIntegration: false`

### Core Modules

**`src/main/discovery.ts`**: Device discovery via UDP broadcast

- Broadcasts device info every 2 seconds
- Maintains online device list (6 second timeout)
- Emits `devices-changed` event

**`src/main/transfer.ts`**: File and text transfer via TCP

- Protocol: `[JSON Header]\n\n[Binary Payload]`
- Supports file, folder, text, clipboard-text, clipboard-image
- Folder aggregation: groups files by `${from}::${folderName}` key
- Emits `transfer-start`, `transfer-progress`, `transfer-complete`

**`src/main/clipboard-sync.ts`**: Real-time clipboard sync via WebSocket

- Polls clipboard every 500ms
- Detection priority: folder → files → text → image
- Message deduplication using `messageId` and `receivedMessageIds` Set
- Emits `clipboard-received`, `peer-connected`, `peer-disconnected`

**`src/main/connection-auth.ts`**: Connection authorization via WebSocket

- Request/response protocol with 30 second timeout
- Authorization cached for 1 hour
- Supports auto-accept mode
- Emits `connection-request`, `connection-auto-accepted`

**`src/main/web-receiver.ts`**: HTTP server for browser uploads

- Serves `src/assets/web-receiver.html`
- Endpoints: `GET /`, `POST /upload`, `POST /text`
- Optional password protection via `X-Password` header
- Folder uploads use `X-Relative-Path` and `X-Folder-Name` headers

### Network Ports

| Port  | Protocol  | Module          | Purpose                  |
| ----- | --------- | --------------- | ------------------------ |
| 53318 | UDP       | Discovery       | Device discovery         |
| 53319 | TCP       | Transfer        | File/text transfer       |
| 53320 | WebSocket | Clipboard Sync  | Clipboard sync           |
| 53321 | HTTP      | Web Receiver    | Browser file upload      |
| 53322 | WebSocket | Connection Auth | Connection authorization |

## File Structure

```
LanFlare/
├── main.ts                      # Main process entry point
├── src/
│   ├── main/                    # Main process modules
│   │   ├── discovery.ts         # Device discovery
│   │   ├── transfer.ts          # File transfer
│   │   ├── clipboard-sync.ts    # Clipboard sync
│   │   ├── connection-auth.ts   # Connection authorization
│   │   ├── web-receiver.ts      # Web receiver
│   │   └── utils.ts             # Utility functions
│   ├── preload/
│   │   └── preload.ts           # IPC bridge (contextBridge)
│   ├── renderer/                # Renderer process (not TypeScript)
│   │   ├── index.html           # Main UI
│   │   ├── app.js               # UI logic (vanilla JS)
│   │   └── styles.css           # Styles
│   └── assets/
│       └── web-receiver.html    # Web receiver page
├── dist/                        # Build output (TypeScript → JavaScript)
├── build/                       # App resources
│   ├── icons/                   # App icons (all formats)
│   │   ├── icon.ico             # Windows icon
│   │   ├── icon.icns            # macOS icon
│   │   ├── icon.png             # Linux icon (512x512)
│   │   ├── icon-256.png         # Linux icon (256x256)
│   │   ├── 512x512.png          # Linux icon (512x512)
│   │   └── 256x256.png          # Linux icon (256x256)
│   └── lanflare.desktop         # Linux desktop entry
├── package.json
├── tsconfig.json
└── eslint.config.mjs
```

## Important Patterns

### IPC Communication

All renderer-to-main communication goes through `window.api.*` exposed by preload script. Main process handlers use `ipcMain.handle()` for async operations.

### Authorization Flow

Before any file transfer or clipboard sync, check authorization:

1. Call `connectionAuth.isAuthorized(deviceId)`
2. If not authorized, call `connectionAuth.requestConnection(deviceIp, deviceId)`
3. Target device shows authorization dialog
4. Authorization cached for 1 hour if approved

### Folder Transfer Aggregation

When sending folders, each file is sent individually with folder metadata (`folderName`, `relativePath`, `totalFiles`). The receiver aggregates files using `PendingFolder` structure and emits a single `transfer-complete` event when all files arrive (60 second timeout protection).

### Notification Debouncing

Individual file transfers are debounced (1.5 seconds) to avoid notification spam. Folder transfers trigger immediate notification after all files complete.

### Config Persistence

App settings stored in `config.json` at `app.getPath('userData')`:

- `saveDir`: Custom download directory
- `useNativeFrame`: Native vs custom window frame
- `autoAcceptConnections`: Auto-accept connection requests
- `minimizeToTray`: Minimize to system tray on close instead of quitting
- `theme`: Theme mode ("dark" or "light")

### Theme System

- Two themes: dark (default) and light
- Theme applied via `body.light-theme` class
- CSS variables automatically switch based on theme class
- Theme preference persisted in config
- Instant theme switching without restart

### System Tray

- Tray icon created on app startup
- Click tray icon to show/hide window
- Right-click for context menu (Show/Quit)
- When "minimize to tray" is enabled, closing window hides to tray instead of quitting
- Tray icon uses platform-specific format (16x16 resized from main icon)

## Code Style

- TypeScript for main process and preload
- Vanilla JavaScript for renderer (no framework)
- ESLint with TypeScript plugin (ignores `src/renderer/`)
- Prettier for formatting
- Unused parameters prefixed with `_` to avoid warnings

## Testing Notes

- Development mode (`npm run dev`) includes self in device list for testing
- Production builds exclude self from device list
- All network services bind to `0.0.0.0` (LAN-only via router firewall)

## Security Considerations

- Context isolation enabled, Node.js integration disabled
- All API exposed via `contextBridge` in preload
- Connection authorization required for device-to-device transfers
- Web receiver supports optional password protection
- Files auto-saved to `~/Downloads/LanFlare` (configurable)
- No encryption on transfers (assumes trusted LAN environment)

## Build System

- TypeScript compiled to `dist/` directory
- `copyassets` script copies `web-receiver.html` to dist
- electron-builder packages app with platform-specific installers
- All icons stored in `build/icons/` directory
- Main entry point: `dist/main.js`
- Preload compiled to: `dist/src/preload/preload.js`

## Build Optimization

### Size Optimization

- **Dependency pruning**: Only `ws` module included in production build
- **Maximum compression**: ASAR archive with maximum compression
- **No source maps**: Disabled in production builds
- **Comment removal**: All comments stripped from compiled code
- **Output separation**: Build artifacts in `release/` directory

### Performance Optimization

- **Lazy loading**: Non-critical resources loaded on demand
- **Event debouncing**: Notifications and folder transfers optimized
- **Memory management**: Proper cleanup of timers and listeners
- **CSS variables**: Reduced code duplication

### Build Analysis

Run `npm run analyze` to see:

- Compiled output size
- Dependency sizes
- Source file sizes
- Release package sizes

## Linux Icon Configuration

To ensure proper taskbar icon display on Linux:

- Icons stored in `build/icons/` directory with multiple sizes
- `StartupWMClass: "LanFlare"` matches the BrowserWindow class name
- Desktop entry includes proper Icon and Categories fields
- Icon path in package.json points to `build/icons` directory (not individual files)

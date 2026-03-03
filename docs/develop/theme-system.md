# 主题系统使用说明

## 功能概述

LanFlare 现在支持深色和浅色两种主题模式，用户可以在设置中自由切换。

## 实现细节

### 1. CSS 变量系统

- 使用 CSS 自定义属性（CSS Variables）实现主题切换
- 深色主题（默认）：`:root` 中定义
- 浅色主题：`body.light-theme` 中覆盖变量

### 2. 主题变量

所有颜色和样式通过以下变量定义：

- `--bg-primary`: 主背景色
- `--bg-secondary`: 次要背景色
- `--bg-card`: 卡片背景色
- `--text-primary`: 主文本颜色
- `--text-secondary`: 次要文本颜色
- `--accent-1/2/3`: 强调色
- `--border`: 边框颜色
- `--shadow-*`: 阴影效果

### 3. 切换机制

1. 用户在设置页面选择主题
2. 调用 `window.api.setThemeSetting(theme)`
3. 保存到配置文件
4. 立即添加/移除 `body.light-theme` 类
5. CSS 变量自动切换，无需刷新

### 4. 持久化

- 主题选择保存在 `config.json` 的 `theme` 字段
- 应用启动时自动加载并应用保存的主题
- 默认为深色主题

## 使用方法

### 用户操作

1. 打开应用
2. 点击"设置"标签
3. 在"外观"部分找到"主题模式"下拉框
4. 选择"深色"或"浅色"
5. 主题立即生效

### 开发者扩展

如果需要添加新的主题相关样式：

1. 在 `:root` 中定义深色主题变量
2. 在 `body.light-theme` 中定义浅色主题对应变量
3. 在组件样式中使用 `var(--variable-name)`

## 技术栈

- CSS Variables (CSS Custom Properties)
- JavaScript class toggle
- Electron IPC for settings persistence

# NovelCraft AI (本地桌面版)

这是一个基于 AI 的小说创作流水线工具。本版本已配置为支持本地运行和 Electron 桌面应用模式。

## 🚀 如何运行

### 1. 准备环境
确保你的电脑上安装了 **Node.js** (推荐 v18 或更高版本)。
下载地址：https://nodejs.org/

### 2. 安装依赖
在项目根目录（即包含 `package.json` 的文件夹）打开终端/命令行，运行：

```bash
npm install
```

### 3. 启动开发模式 (浏览器 + 桌面)
如果你想一边修改代码一边预览：

```bash
npm run app:dev
```
这将同时启动本地网页服务器和 Electron 窗口。

### 4. 打包与运行 (纯桌面模式)
如果你只想运行应用：

```bash
# 先构建前端资源
npm run build

# 启动桌面应用
npm run app
```

## 📦 如何打包成 .exe (进阶)

如果你想生成一个可以发送给别人的 `.exe` 安装包，你需要安装 `electron-builder`：

1. 运行 `npm install --save-dev electron-builder`
2. 在 `package.json` 的 `scripts` 中添加 `"dist": "electron-builder"`
3. 运行 `npm run dist`

生成的安装包将位于 `dist` 目录下。

## 💾 数据存储
您的所有创作数据（设定、大纲、正文）都会自动保存在本地电脑的 IndexedDB 数据库中，即使关闭软件也不会丢失。

const { app, BrowserWindow } = require('electron');
const path = require('path');

// 判断当前环境是开发模式(dev)还是生产模式(prod)
const isDev = !app.isPackaged;

function createWindow() {
  // 创建浏览器窗口
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1e1e1e', // 设置深色背景，防止加载时白屏
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // 允许渲染进程使用 Node.js 能力
      webSecurity: false // 开发环境下有时需要关闭安全策略以加载本地资源
    },
    autoHideMenuBar: true, // 隐藏原本丑陋的菜单栏
  });

  // 根据环境加载不同的地址
  if (isDev) {
    // 开发模式：加载 Vite 启动的本地服务（通常是 5173 端口）
    // 这里加个延时，确保 Vite 服务已经启动
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:5173');
    }, 1000);
    
    // 开发模式下自动打开调试控制台（可选，不需要可以注释掉）
    // mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：加载打包后的 html 文件
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// 当 Electron 准备好时，创建窗口
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

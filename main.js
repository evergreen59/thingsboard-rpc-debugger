const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

// 初始化配置存储
const store = new Store();

// 保持对window对象的全局引用，避免JavaScript对象被垃圾回收时窗口关闭
let mainWindow;
let currentPage = 'login'; // 当前页面：login, devices, rpc

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    webPreferences: {
      nodeIntegration: true, // 允许在渲染进程中使用Node.js API
      contextIsolation: false, // 禁用上下文隔离
      enableRemoteModule: true // 启用remote模块
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // 根据认证状态加载不同的页面
  const authConfig = store.get('authConfig', {});
  if (authConfig.token) {
    // 已登录，加载设备选择页面
    loadDevicesPage();
  } else {
    // 未登录，加载登录页面
    loadLoginPage();
  }

  // 设置应用菜单
  const template = [
    {
      label: '文件',
      submenu: [
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggledevtools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetzoom', label: '重置缩放' },
        { role: 'zoomin', label: '放大' },
        { role: 'zoomout', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: async () => {
            const { dialog } = require('electron');
            const response = dialog.showMessageBoxSync(mainWindow, {
              title: '关于',
              message: 'ThingsBoard RPC调试工具',
              detail: '版本 1.0.1\n作者 EverGreen\n一个用于调试ThingsBoard RPC接口的工具',
              icon: path.join(__dirname, 'assets/icon.png'),
              buttons: ['确定', '访问项目主页']
            });
            
            // 如果用户点击了"访问项目主页"按钮
            if (response === 1) {
              shell.openExternal('https://github.com/evergreen59/thingsboard-rpc-debugger');
            }
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // 当window被关闭时触发
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // 在macOS上，当dock图标被点击且没有其他窗口打开时，通常会在应用程序中重新创建一个窗口
    if (mainWindow === null) createWindow();
  });
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', function () {
  // 在macOS上，除非用户使用Cmd + Q确定地退出，否则应用及其菜单栏会保持活动状态
  if (process.platform !== 'darwin') app.quit();
});

// 页面加载函数
function loadLoginPage() {
  currentPage = 'login';
  mainWindow.loadFile('login.html');
  mainWindow.setTitle('ThingsBoard RPC调试工具 - 登录');
}

function loadDevicesPage() {
  currentPage = 'devices';
  mainWindow.loadFile('devices.html');
  mainWindow.setTitle('ThingsBoard RPC调试工具 - 设备选择');
}

function loadRpcPage() {
  currentPage = 'rpc';
  mainWindow.loadFile('index.html');
  mainWindow.setTitle('ThingsBoard RPC调试工具');
}

// 处理来自渲染进程的IPC消息

// 认证相关
ipcMain.on('save-auth-config', (event, config) => {
  store.set('authConfig', config);
  event.reply('auth-config-saved', true);
});

ipcMain.on('get-auth-config', (event) => {
  const config = store.get('authConfig', { serverUrl: '', username: '', rememberMe: true });
  event.reply('auth-config', config);
});

ipcMain.on('clear-auth-config', (event) => {
  store.delete('authConfig');
  event.reply('auth-config-cleared', true);
});

// 导航相关
ipcMain.on('navigate-to-login', () => {
  loadLoginPage();
});

ipcMain.on('navigate-to-main', () => {
  loadDevicesPage();
});

ipcMain.on('navigate-to-rpc', () => {
  loadRpcPage();
});

// 服务器配置相关
ipcMain.on('save-server-config', (event, config) => {
  store.set('serverConfig', config);
  event.reply('server-config-saved', true);
});

ipcMain.on('get-server-config', (event) => {
  const config = store.get('serverConfig', { url: '', accessToken: '' });
  event.reply('server-config', config);
});

// 不再需要RPC历史记录相关的IPC处理程序，因为我们已经改为使用日志文件记录

// 应用程序路径相关
ipcMain.on('get-app-path', (event) => {
  // 获取应用程序可执行文件所在目录
  const appPath = path.dirname(process.execPath);
  // 在开发环境中，使用当前目录
  const exePath = app.isPackaged ? appPath : __dirname;
  event.reply('app-path', exePath);
});
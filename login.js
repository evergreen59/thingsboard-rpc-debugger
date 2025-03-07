// 引入所需模块
const { ipcRenderer } = require('electron');
const axios = require('axios');

// DOM元素
const serverUrlInput = document.getElementById('server-url');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const rememberMeCheckbox = document.getElementById('remember-me');
const loginForm = document.getElementById('login-form');
const loginAlert = document.getElementById('login-alert');

// 全局变量
let authConfig = { serverUrl: '', username: '', rememberMe: true };

// 初始化应用
function initApp() {
  // 初始化主题
  const themeManager = require('./theme-manager');
  themeManager.initTheme();
  
  // 主题切换按钮点击事件
  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', themeManager.toggleTheme);
  }
  
  // 从主进程获取保存的认证配置
  ipcRenderer.send('get-auth-config');
  ipcRenderer.once('auth-config', (event, config) => {
    authConfig = config;
    
    // 填充表单
    if (config.serverUrl) {
      serverUrlInput.value = config.serverUrl;
    }
    
    if (config.username) {
      usernameInput.value = config.username;
    }
    
    if (config.rememberMe !== undefined) {
      rememberMeCheckbox.checked = config.rememberMe;
    }
    
    // 如果有refreshToken，尝试自动登录
    if (config.refreshToken) {
      tryAutoLogin(config);
    }
  });
}

// 尝试使用refreshToken自动登录
async function tryAutoLogin(config) {
  try {
    // 显示正在登录提示
    showAlert('正在自动登录...', 'info');
    
    // 使用refreshToken获取新的accessToken
    const response = await axios.post(`${config.serverUrl}/api/auth/token`, {
      refreshToken: config.refreshToken
    });
    
    if (response.data && response.data.token) {
      // 登录成功，保存token信息
      const authData = {
        serverUrl: config.serverUrl,
        username: config.username,
        rememberMe: config.rememberMe,
        token: response.data.token,
        refreshToken: response.data.refreshToken,
        userId: response.data.userId
      };
      
      // 保存认证信息
      ipcRenderer.send('save-auth-config', authData);
      
      // 跳转到主页面
      ipcRenderer.send('navigate-to-main');
    } else {
      // 自动登录失败，清除提示，等待用户手动登录
      hideAlert();
    }
  } catch (error) {
    console.error('自动登录失败:', error);
    // 自动登录失败，清除提示，等待用户手动登录
    hideAlert();
  }
}

// 登录到ThingsBoard服务器
async function login() {
  // 获取表单数据
  const serverUrl = serverUrlInput.value.trim();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const rememberMe = rememberMeCheckbox.checked;
  
  // 验证表单
  if (!serverUrl) {
    showAlert('请输入服务器URL', 'danger');
    return;
  }
  
  if (!username) {
    showAlert('请输入用户名', 'danger');
    return;
  }
  
  if (!password) {
    showAlert('请输入密码', 'danger');
    return;
  }
  
  try {
    // 显示正在登录提示
    showAlert('正在登录...', 'info');
    
    // 发送登录请求
    const response = await axios.post(`${serverUrl}/api/auth/login`, {
      username: username,
      password: password
    });
    
    if (response.data && response.data.token) {
      // 登录成功，保存token信息
      const authData = {
        serverUrl: serverUrl,
        username: username,
        rememberMe: rememberMe,
        token: response.data.token,
        refreshToken: response.data.refreshToken,
        userId: response.data.userId
      };
      
      // 保存认证信息
      ipcRenderer.send('save-auth-config', authData);
      
      // 跳转到主页面
      ipcRenderer.send('navigate-to-main');
    } else {
      showAlert('登录失败：无效的响应', 'danger');
    }
  } catch (error) {
    console.error('登录失败:', error);
    
    if (error.response) {
      // 服务器返回了错误响应
      if (error.response.status === 401) {
        showAlert('登录失败：用户名或密码错误', 'danger');
      } else {
        showAlert(`登录失败：${error.response.data.message || '未知错误'}`, 'danger');
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      showAlert('登录失败：无法连接到服务器', 'danger');
    } else {
      // 请求设置时发生错误
      showAlert(`登录失败：${error.message}`, 'danger');
    }
  }
}

// 显示提示信息
function showAlert(message, type = 'danger') {
  loginAlert.className = `alert alert-${type}`;
  loginAlert.textContent = message;
  loginAlert.style.display = 'block';
}

// 隐藏提示信息
function hideAlert() {
  loginAlert.style.display = 'none';
}

// 事件监听
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  login();
});

// 初始化应用
document.addEventListener('DOMContentLoaded', initApp);
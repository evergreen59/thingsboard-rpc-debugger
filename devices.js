// 引入所需模块
const { ipcRenderer } = require('electron');
const axios = require('axios');

// DOM元素
const usernameDisplay = document.getElementById('username-display');
const logoutBtn = document.getElementById('logout-btn');
const loadingMessage = document.getElementById('loading-message');
const errorMessage = document.getElementById('error-message');
const searchInput = document.getElementById('search-input');
const devicesContainer = document.getElementById('devices-container');
const favoriteDevicesContainer = document.getElementById('favorite-devices');
const refreshBtn = document.getElementById('refresh-btn');
const selectDeviceBtn = document.getElementById('select-device-btn');

// 全局变量
let authConfig = {};
let devices = [];
let selectedDeviceId = null;
let favoriteDevices = [];

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
    if (!config.token) {
      // 如果没有token，跳转到登录页面
      ipcRenderer.send('navigate-to-login');
      return;
    }
    
    authConfig = config;
    
    // 显示用户名
    usernameDisplay.textContent = `${config.username} @ ${new URL(config.serverUrl).hostname}`;
    
    // 加载收藏设备
    loadFavoriteDevices();
    
    // 加载设备列表
    loadDevices();
  });
}

// 加载收藏设备
function loadFavoriteDevices() {
  // 从localStorage获取收藏设备
  const savedFavorites = localStorage.getItem('favoriteDevices');
  if (savedFavorites) {
    try {
      favoriteDevices = JSON.parse(savedFavorites);
    } catch (e) {
      console.error('解析收藏设备失败:', e);
      favoriteDevices = [];
    }
  }
}

// 保存收藏设备
function saveFavoriteDevices() {
  localStorage.setItem('favoriteDevices', JSON.stringify(favoriteDevices));
}

// 添加或移除收藏设备
function toggleFavorite(device) {
  const deviceId = device.id.id;
  const index = favoriteDevices.findIndex(id => id === deviceId);
  
  if (index === -1) {
    // 添加到收藏
    favoriteDevices.push(deviceId);
  } else {
    // 从收藏中移除
    favoriteDevices.splice(index, 1);
  }
  
  // 保存收藏设备
  saveFavoriteDevices();
  
  // 重新渲染设备列表
  renderDevicesList(devices);
}

// 检查设备是否被收藏
function isFavorite(deviceId) {
  return favoriteDevices.includes(deviceId);
}

// 加载设备列表
async function loadDevices() {
  showLoading(true);
  hideError();
  
  try {
    // 构建API请求头部
    const headers = {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${authConfig.token}`
    };
    
    // 初始化设备数组和分页参数
    devices = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 100;
    
    // 循环获取所有页面的设备
    while (hasMore) {
      // 构建API请求URL（带分页参数）
      const url = `${authConfig.serverUrl}/api/tenant/devicesNew?pageSize=${pageSize}&page=${page}`;
      
      // 发送请求获取当前页设备列表
      const response = await axios.get(url, { headers });
      
      if (response.data && response.data.data) {
        // 将当前页设备添加到总设备列表
        const pageDevices = response.data.data;
        devices = devices.concat(pageDevices);
        
        // 如果获取的设备数量小于页面大小，说明已经没有更多设备
        if (pageDevices.length < pageSize) {
          hasMore = false;
        } else {
          // 继续获取下一页
          page++;
        }
      } else {
        showError('获取设备列表失败：无效的响应格式');
        hasMore = false;
      }
    }
    
    // 渲染所有获取到的设备
    renderDevicesList(devices);
    
  } catch (error) {
    console.error('获取设备列表失败:', error);
    
    if (error.response && error.response.status === 401) {
      // Token可能已过期，尝试刷新
      tryRefreshToken();
    } else {
      showError(`获取设备列表失败：${error.message}`);
    }
  } finally {
    showLoading(false);
  }
}

// 尝试刷新Token
async function tryRefreshToken() {
  try {
    // 使用refreshToken获取新的accessToken
    const response = await axios.post(`${authConfig.serverUrl}/api/auth/token`, {
      refreshToken: authConfig.refreshToken
    });
    
    if (response.data && response.data.token) {
      // 更新token
      authConfig.token = response.data.token;
      authConfig.refreshToken = response.data.refreshToken;
      
      // 保存到主进程
      ipcRenderer.send('save-auth-config', authConfig);
      
      // 重新加载设备列表
      loadDevices();
    } else {
      // 刷新token失败，需要重新登录
      showError('会话已过期，请重新登录');
      setTimeout(() => {
        ipcRenderer.send('navigate-to-login');
      }, 2000);
    }
  } catch (error) {
    console.error('刷新Token失败:', error);
    showError('会话已过期，请重新登录');
    setTimeout(() => {
      ipcRenderer.send('navigate-to-login');
    }, 2000);
  }
}

// 渲染设备列表
function renderDevicesList(devicesList) {
  // 清空设备容器
  devicesContainer.innerHTML = '';
  
  // 分离收藏和非收藏设备
  const favDevices = devicesList.filter(device => isFavorite(device.id.id));
  const normalDevices = devicesList.filter(device => !isFavorite(device.id.id));
  
  // 处理收藏设备区域
  if (favDevices.length > 0) {
    favoriteDevicesContainer.innerHTML = '';
    favoriteDevicesContainer.style.display = 'block';
    
    // 渲染收藏设备
    favDevices.forEach(device => {
      const deviceItem = createDeviceItem(device);
      favoriteDevicesContainer.appendChild(deviceItem);
    });
  } else {
    favoriteDevicesContainer.style.display = 'none';
  }
  
  // 处理普通设备
  if (normalDevices.length === 0 && favDevices.length === 0) {
    devicesContainer.innerHTML = '<div class="p-3 text-center text-muted">没有找到设备</div>';
    return;
  }
  
  // 渲染普通设备
  normalDevices.forEach(device => {
    const deviceItem = createDeviceItem(device);
    devicesContainer.appendChild(deviceItem);
  });
}

// 创建设备项
function createDeviceItem(device) {
  const deviceItem = document.createElement('div');
  deviceItem.className = `device-item ${device.id.id === selectedDeviceId ? 'active' : ''}`;
  deviceItem.dataset.id = device.id.id;
  
  // 设备状态
  const isActive = device.active;
  const isFav = isFavorite(device.id.id);
  
  deviceItem.innerHTML = `
    <div class="d-flex justify-content-between align-items-center">
      <div>
        <div class="device-name">${device.name}</div>
        <div class="device-type">${device.type || '未知类型'}</div>
      </div>
      <div class="d-flex align-items-center">
        <div class="device-status ${isActive ? 'status-active' : 'status-inactive'} me-3">
          ${isActive ? '在线' : '离线'}
        </div>
        <span class="favorite-btn ${isFav ? 'active' : ''}" data-id="${device.id.id}">
          ${isFav ? '★' : '☆'}
        </span>
      </div>
    </div>
  `;
  
  // 点击选择设备
  deviceItem.addEventListener('click', (e) => {
    // 如果点击的是收藏按钮，不触发设备选择
    if (e.target.classList.contains('favorite-btn')) {
      return;
    }
    selectDevice(device);
  });
  
  // 收藏按钮点击事件
  const favoriteBtn = deviceItem.querySelector('.favorite-btn');
  favoriteBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // 阻止事件冒泡
    toggleFavorite(device);
  });
  
  return deviceItem;
}

// 选择设备
function selectDevice(device) {
  // 更新选中状态
  selectedDeviceId = device.id.id;
  
  // 更新UI
  document.querySelectorAll('.device-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === selectedDeviceId);
  });
  
  // 启用选择按钮
  selectDeviceBtn.disabled = false;
}

// 确认选择设备
function confirmDeviceSelection() {
  if (!selectedDeviceId) return;
  
  // 查找选中的设备
  const selectedDevice = devices.find(d => d.id.id === selectedDeviceId);
  if (!selectedDevice) return;
  
  // 获取设备的访问令牌
  getDeviceCredentials(selectedDevice);
}

// 获取设备凭证
async function getDeviceCredentials(device) {
  showLoading(true);
  
  try {
    // 构建API请求URL和头部
    const url = `${authConfig.serverUrl}/api/device/${device.id.id}/credentials`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${authConfig.token}`
    };
    
    // 发送请求获取设备凭证
    const response = await axios.get(url, { headers });
    
    if (response.data && response.data.credentialsId) {
      // 保存设备信息和访问令牌
      const serverConfig = {
        url: authConfig.serverUrl,
        accessToken: response.data.credentialsId,
        deviceName: device.name,
        deviceId: device.id.id
      };
      
      // 保存到主进程
      ipcRenderer.send('save-server-config', serverConfig);
      ipcRenderer.once('server-config-saved', () => {
        // 跳转到主页面
        ipcRenderer.send('navigate-to-rpc');
      });
    } else {
      showError('获取设备凭证失败：无效的响应格式');
      showLoading(false);
    }
  } catch (error) {
    console.error('获取设备凭证失败:', error);
    
    if (error.response && error.response.status === 401) {
      // Token可能已过期，尝试刷新
      tryRefreshToken();
    } else {
      showError(`获取设备凭证失败：${error.message}`);
      showLoading(false);
    }
  }
}

// 搜索设备
function searchDevices(query) {
  query = query.toLowerCase();
  
  if (!query) {
    renderDevicesList(devices);
    return;
  }
  
  const filteredDevices = devices.filter(device => 
    device.name.toLowerCase().includes(query) || 
    (device.type && device.type.toLowerCase().includes(query))
  );
  
  renderDevicesList(filteredDevices);
}

// 显示加载中
function showLoading(show) {
  loadingMessage.style.display = show ? 'block' : 'none';
}

// 显示错误信息
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

// 隐藏错误信息
function hideError() {
  errorMessage.style.display = 'none';
}

// 退出登录
function logout() {
  if (confirm('确定要退出登录吗？')) {
    // 清除认证信息
    ipcRenderer.send('clear-auth-config');
    
    // 跳转到登录页面
    ipcRenderer.send('navigate-to-login');
  }
}

// 事件监听
refreshBtn.addEventListener('click', loadDevices);
selectDeviceBtn.addEventListener('click', confirmDeviceSelection);
logoutBtn.addEventListener('click', logout);

searchInput.addEventListener('input', (e) => {
  searchDevices(e.target.value.trim());
});

// 初始化应用
document.addEventListener('DOMContentLoaded', initApp);
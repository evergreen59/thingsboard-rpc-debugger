// 引入所需模块
const { ipcRenderer } = require('electron');
const axios = require('axios');
const CodeMirror = require('codemirror');
require('codemirror/mode/javascript/javascript');
require('codemirror/addon/edit/matchbrackets');
require('codemirror/addon/edit/closebrackets');

// 全局变量
let serverConfig = { url: '', accessToken: '' };
let rpcHistory = [];
let isConnected = false;
let isDarkMode = false;
let responseJsonEditor;

// DOM元素
const serverUrlInput = document.getElementById('server-url');
const accessTokenInput = document.getElementById('access-token');
const serverConfigForm = document.getElementById('server-config-form');
const connectionStatus = document.getElementById('connection-status');
const connectionText = document.getElementById('connection-text');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');
const methodNameInput = document.getElementById('method-name');
const paramsInput = document.getElementById('params');
const paramsEditor = document.getElementById('params-editor');
const formatJsonBtn = document.getElementById('format-json');
const timeoutInput = document.getElementById('timeout');
const testConnectionBtn = document.getElementById('test-connection');
const rpcForm = document.getElementById('rpc-form');
const responseStatus = document.getElementById('response-status');
const responseData = document.getElementById('response-data');
const responseTime = document.getElementById('response-time');
const responseEditor = document.getElementById('response-editor');
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.querySelector('.theme-icon');
const themeText = document.querySelector('.theme-text');
const htmlElement = document.documentElement;

// CodeMirror编辑器实例
let jsonEditor;

// 初始化应用
function initApp() {
  // 初始化CodeMirror编辑器
  initJsonEditor();
  
  // 初始化响应数据编辑器
  initResponseEditor();
  
  // 从主进程获取保存的服务器配置
  ipcRenderer.send('get-server-config');
  ipcRenderer.once('server-config', (event, config) => {
    serverConfig = config;
    serverUrlInput.value = config.url;
    accessTokenInput.value = config.accessToken;
    
    // 如果有配置，尝试测试连接
    if (config.url && config.accessToken) {
      testConnection();
    }
  });
  
  // 从主进程获取RPC历史记录
  ipcRenderer.send('get-rpc-history');
  ipcRenderer.once('rpc-history', (event, history) => {
    rpcHistory = history;
    renderHistoryList();
  });
  
  // 初始化主题
  initTheme();
}

// 初始化JSON编辑器
function initJsonEditor() {
  jsonEditor = CodeMirror(paramsEditor, {
    mode: {name: "javascript", json: true},
    theme: isDarkMode ? "darcula" : "idea",
    lineNumbers: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: true,
    value: paramsInput.value || '{\n  \n}'
  });
  
  // 编辑器内容变化时同步到隐藏的textarea
  jsonEditor.on('change', function() {
    paramsInput.value = jsonEditor.getValue();
  });
}

// 初始化响应数据编辑器
function initResponseEditor() {
  responseJsonEditor = CodeMirror(responseEditor, {
    mode: {name: "javascript", json: true},
    theme: isDarkMode ? "monokai" : "eclipse",
    lineNumbers: true,
    matchBrackets: true,
    readOnly: true,
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: true,
    value: "响应数据将显示在这里"
  });
}

// 初始化主题
function initTheme() {
  // 检查是否已经设置了暗色模式
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    enableDarkMode();
  } else {
    enableLightMode();
  }
}

// 切换主题
function toggleTheme() {
  if (isDarkMode) {
    enableLightMode();
  } else {
    enableDarkMode();
  }
}

// 启用暗色模式
function enableDarkMode() {
  isDarkMode = true;
  htmlElement.setAttribute('data-bs-theme', 'dark');
  themeIcon.textContent = '☀️';
  localStorage.setItem('theme', 'dark');
  
  // 更新编辑器主题
  if (jsonEditor) jsonEditor.setOption('theme', 'monokai');
  if (responseJsonEditor) responseJsonEditor.setOption('theme', 'monokai');
}

// 启用亮色模式
function enableLightMode() {
  isDarkMode = false;
  htmlElement.setAttribute('data-bs-theme', 'light');
  themeIcon.textContent = '🌙';
  localStorage.setItem('theme', 'light');
  
  // 更新编辑器主题
  if (jsonEditor) jsonEditor.setOption('theme', 'eclipse');
  if (responseJsonEditor) responseJsonEditor.setOption('theme', 'eclipse');
}

// 保存服务器配置
function saveServerConfig() {
  serverConfig = {
    url: serverUrlInput.value.trim(),
    accessToken: accessTokenInput.value.trim()
  };
  
  ipcRenderer.send('save-server-config', serverConfig);
  ipcRenderer.once('server-config-saved', () => {
    // 保存成功后测试连接
    testConnection();
  });
}

// 测试与ThingsBoard服务器的连接
async function testConnection() {
  // 显示测试中状态
  testConnectionBtn.disabled = true;
  testConnectionBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 测试中...';
  
  if (!serverConfig.url || !serverConfig.deviceId) {
    updateConnectionStatus(false, '未配置');
    showTestConnectionResult(false, '服务器URL或设备ID未配置');
    return;
  }
  
  try {
    // 获取JWT令牌
    const authConfig = await new Promise((resolve) => {
      ipcRenderer.send('get-auth-config');
      ipcRenderer.once('auth-config', (event, config) => {
        resolve(config);
      });
    });
    
    if (!authConfig.token) {
      updateConnectionStatus(false, '未登录');
      showTestConnectionResult(false, '未登录，请先登录ThingsBoard');
      return;
    }
    
    // 构建测试URL - 使用设备属性API进行测试
    const testUrl = `${serverConfig.url}/api/plugins/telemetry/DEVICE/${serverConfig.deviceId}/values/attributes`;
    
    // 设置请求头
    const headers = {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${authConfig.token}`
    };
    
    // 发送请求
    const response = await axios.get(testUrl, { 
      timeout: 5000,
      headers: headers
    });
    
    // 连接成功
    if (response.status === 200) {
      updateConnectionStatus(true, '已连接');
      showTestConnectionResult(true, '连接成功！服务器可访问。');
    } else {
      updateConnectionStatus(false, '连接失败');
      showTestConnectionResult(false, `连接失败：状态码 ${response.status}`);
    }
  } catch (error) {
    console.error('连接测试失败:', error);
    updateConnectionStatus(false, '连接失败');
    
    let errorMessage = '连接失败';
    if (error.response) {
      errorMessage = `连接失败：状态码 ${error.response.status}`;
    } else if (error.request) {
      errorMessage = '连接失败：服务器无响应';
    } else {
      errorMessage = `连接失败：${error.message}`;
    }
    
    showTestConnectionResult(false, errorMessage);
  }
}

// 更新连接状态显示
function updateConnectionStatus(connected, text) {
  isConnected = connected;
  connectionStatus.className = `status-indicator ${connected ? 'status-connected' : 'status-disconnected'}`;
  connectionText.textContent = text;
}

// 显示测试连接结果
function showTestConnectionResult(success, message) {
  // 恢复按钮状态
  testConnectionBtn.disabled = false;
  testConnectionBtn.textContent = '测试连接';
  
  // 显示结果提示
  const alertType = success ? 'success' : 'danger';
  responseStatus.className = `alert alert-${alertType}`;
  responseStatus.textContent = message;
}

// 发送RPC请求
async function sendRpcRequest() {
  if (!isConnected) {
    updateResponseStatus('error', '未连接到ThingsBoard服务器');
    return;
  }
  
  const methodName = methodNameInput.value.trim();
  if (!methodName) {
    updateResponseStatus('error', '请输入方法名称');
    return;
  }
  
  let params = {};
  try {
    const paramsText = paramsInput.value.trim();
    if (paramsText) {
      params = JSON.parse(paramsText);
    }
  } catch (error) {
    updateResponseStatus('error', 'JSON参数格式错误');
    return;
  }
  
  const timeout = parseInt(timeoutInput.value) || 5000;
  
  // 清空之前的响应
  responseData.textContent = '// 正在发送请求...';
  responseStatus.className = 'alert alert-info';
  responseStatus.textContent = '请求中...';
  responseTime.textContent = '';
  
  // 记录开始时间
  const startTime = new Date();
  
  try {
    // 构建双向RPC请求URL
    const rpcUrl = `${serverConfig.url}/api/plugins/rpc/twoway/${serverConfig.deviceId}`;
    
    // 获取JWT令牌
    const authConfig = await new Promise((resolve) => {
      ipcRenderer.send('get-auth-config');
      ipcRenderer.once('auth-config', (event, config) => {
        resolve(config);
      });
    });
    
    // 设置请求头和参数
    const headers = {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${authConfig.token}`
    };
    
    // 发送RPC请求
    const response = await axios.post(rpcUrl, {
      method: methodName,
      params: params
    }, { 
      timeout: timeout,
      headers: headers
    });
    
    // 计算响应时间
    const endTime = new Date();
    const duration = endTime - startTime;
    
    // 更新响应显示
    updateResponseStatus('success', `请求成功 (${duration}ms)`);
    const formattedResponse = JSON.stringify(response.data, null, 2);
    responseJsonEditor.setValue(formattedResponse);
    responseData.textContent = formattedResponse; // 保持隐藏的文本区域同步
    responseTime.textContent = `响应时间: ${duration}ms`;
    
    // 添加到历史记录
    addToHistory(methodName, params, response.data);
  } catch (error) {
    console.error('RPC请求失败:', error);
    
    // 计算响应时间
    const endTime = new Date();
    const duration = endTime - startTime;
    
    // 更新响应显示
    updateResponseStatus('error', `请求失败 (${duration}ms)`);
    
    if (error.response) {
      // 服务器返回了错误响应
      const errorData = JSON.stringify({
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      }, null, 2);
      responseJsonEditor.setValue(errorData);
      responseData.textContent = errorData;
    } else if (error.request) {
      // 请求已发送但没有收到响应
      const errorData = JSON.stringify({
        error: '没有收到响应',
        message: error.message
      }, null, 2);
      responseJsonEditor.setValue(errorData);
      responseData.textContent = errorData;
    } else {
      // 请求设置时发生错误
      const errorData = JSON.stringify({
        error: '请求错误',
        message: error.message
      }, null, 2);
      responseJsonEditor.setValue(errorData);
      responseData.textContent = errorData;
    }
    
    responseTime.textContent = `响应时间: ${duration}ms`;
    
    // 添加到历史记录（即使失败）
    addToHistory(methodName, params, { error: error.message });
  }
}

// 更新响应状态
function updateResponseStatus(type, message) {
  responseStatus.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
  responseStatus.textContent = message;
}

// 添加到历史记录
function addToHistory(method, params, response) {
  const historyItem = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    method: method,
    params: params,
    response: response
  };
  
  // 添加到历史记录数组的开头
  rpcHistory.unshift(historyItem);
  
  // 限制历史记录数量为20条
  if (rpcHistory.length > 20) {
    rpcHistory = rpcHistory.slice(0, 20);
  }
  
  // 保存到主进程
  ipcRenderer.send('save-rpc-history', rpcHistory);
  
  // 更新历史记录显示
  renderHistoryList();
}

// 渲染历史记录列表
function renderHistoryList() {
  historyList.innerHTML = '';
  
  if (rpcHistory.length === 0) {
    const emptyItem = document.createElement('div');
    emptyItem.className = 'history-item text-muted';
    emptyItem.textContent = '暂无历史记录';
    historyList.appendChild(emptyItem);
    return;
  }
  
  rpcHistory.forEach(item => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.dataset.id = item.id;
    
    // 格式化时间
    const date = new Date(item.timestamp);
    const formattedTime = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    
    historyItem.innerHTML = `
      <div><strong>${item.method}</strong></div>
      <div class="text-muted small">${formattedTime}</div>
    `;
    
    // 点击历史记录项加载到表单
    historyItem.addEventListener('click', () => loadHistoryItem(item));
    
    historyList.appendChild(historyItem);
  });
}

// 加载历史记录项到表单
function loadHistoryItem(item) {
  methodNameInput.value = item.method;
  const formattedParams = JSON.stringify(item.params, null, 2);
  paramsInput.value = formattedParams;
  jsonEditor.setValue(formattedParams);
  
  // 显示历史响应
  const formattedResponse = JSON.stringify(item.response, null, 2);
  responseJsonEditor.setValue(formattedResponse);
  responseData.textContent = formattedResponse;
  responseStatus.className = 'alert alert-secondary';
  responseStatus.textContent = '历史记录';
  responseTime.textContent = `时间: ${new Date(item.timestamp).toLocaleString()}`;
}

// 清除历史记录
function clearHistory() {
  if (confirm('确定要清除所有历史记录吗？')) {
    rpcHistory = [];
    ipcRenderer.send('save-rpc-history', rpcHistory);
    renderHistoryList();
    
    // 清空响应区域
    responseJsonEditor.setValue('// 响应数据将显示在这里');
    responseData.textContent = '// 响应数据将显示在这里';
    responseStatus.className = 'alert alert-secondary';
    responseStatus.textContent = '等待请求...';
    responseTime.textContent = '';
  }
}

// 格式化JSON
function formatJson() {
  try {
    const currentValue = jsonEditor.getValue().trim();
    if (currentValue) {
      // 解析并格式化JSON
      const parsedJson = JSON.parse(currentValue);
      const formattedJson = JSON.stringify(parsedJson, null, 2);
      jsonEditor.setValue(formattedJson);
    }
  } catch (error) {
    // 如果JSON解析失败，显示错误
    alert(`JSON格式错误: ${error.message}`);
  }
}

// 事件监听
serverConfigForm.addEventListener('submit', (e) => {
  e.preventDefault();
  saveServerConfig();
});

testConnectionBtn.addEventListener('click', testConnection);

rpcForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendRpcRequest();
});

clearHistoryBtn.addEventListener('click', clearHistory);

// 返回设备列表按钮点击事件
const backToDevicesBtn = document.getElementById('back-to-devices');
if (backToDevicesBtn) {
  backToDevicesBtn.addEventListener('click', () => {
    ipcRenderer.send('navigate-to-main');
  });
}

// 格式化JSON按钮点击事件
formatJsonBtn.addEventListener('click', formatJson);

// 主题切换按钮点击事件
themeToggleBtn.addEventListener('click', toggleTheme);

// 初始化应用
document.addEventListener('DOMContentLoaded', initApp);
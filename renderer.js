// 引入所需模块
const { ipcRenderer } = require('electron');
const axios = require('axios');
const CodeMirror = require('codemirror');
const fs = require('fs');
const path = require('path');
require('codemirror/mode/javascript/javascript');
require('codemirror/addon/edit/matchbrackets');
require('codemirror/addon/edit/closebrackets');

// 全局变量
let serverConfig = { url: '', accessToken: '' };
let isConnected = false;
let isDarkMode = false;
let responseJsonEditor;
let templates = []; // 存储模板数据

// 日志相关
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'rpc-debug.log');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// DOM元素
const serverUrlInput = document.getElementById('server-url');
const accessTokenInput = document.getElementById('access-token');
const serverConfigForm = document.getElementById('server-config-form');
const connectionStatus = document.getElementById('connection-status');
const connectionText = document.getElementById('connection-text');
const templateSelect = document.getElementById('template-select');
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
  
  // 初始化主题
  initTheme();
  
  // 加载模板数据
  loadTemplates();
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
    viewportMargin: Infinity,
    scrollbarStyle: "native",
    value: paramsInput.value || '{\n  \n}'
  });
  
  // 编辑器内容变化时同步到隐藏的textarea
  jsonEditor.on('change', function() {
    paramsInput.value = jsonEditor.getValue();
  });
  
  // 确保滚动条可以正常工作
  setTimeout(() => {
    jsonEditor.refresh();
  }, 100);
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
    viewportMargin: Infinity,
    scrollbarStyle: "native",
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
  const timestamp = startTime.toISOString();
  
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
    
    // 记录请求日志
    const requestLog = {
      timestamp: timestamp,
      type: 'REQUEST',
      method: methodName,
      params: params,
      url: rpcUrl
    };
    
    // 写入日志文件
    fs.appendFileSync(LOG_FILE, JSON.stringify(requestLog) + '\n');
    
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
    
    // 记录响应日志
    const responseLog = {
      timestamp: endTime.toISOString(),
      type: 'RESPONSE',
      method: methodName,
      duration: duration,
      status: 'success',
      data: response.data
    };
    
    // 写入日志文件
    fs.appendFileSync(LOG_FILE, JSON.stringify(responseLog) + '\n');
  } catch (error) {
    console.error('RPC请求失败:', error);
    
    // 计算响应时间
    const endTime = new Date();
    const duration = endTime - startTime;
    
    // 更新响应显示
    updateResponseStatus('error', `请求失败 (${duration}ms)`);
    
    let errorData;
    let errorDetails = {};
    
    if (error.response) {
      // 服务器返回了错误响应
      errorDetails = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };
      errorData = JSON.stringify(errorDetails, null, 2);
      responseJsonEditor.setValue(errorData);
      responseData.textContent = errorData;
    } else if (error.request) {
      // 请求已发送但没有收到响应
      errorDetails = {
        error: '没有收到响应',
        message: error.message
      };
      errorData = JSON.stringify(errorDetails, null, 2);
      responseJsonEditor.setValue(errorData);
      responseData.textContent = errorData;
    } else {
      // 请求设置时发生错误
      errorDetails = {
        error: '请求错误',
        message: error.message
      };
      errorData = JSON.stringify(errorDetails, null, 2);
      responseJsonEditor.setValue(errorData);
      responseData.textContent = errorData;
    }
    
    responseTime.textContent = `响应时间: ${duration}ms`;
    
    // 记录错误日志
    const errorLog = {
      timestamp: endTime.toISOString(),
      type: 'ERROR',
      method: methodName,
      duration: duration,
      error: errorDetails
    };
    
    // 写入日志文件
    fs.appendFileSync(LOG_FILE, JSON.stringify(errorLog) + '\n');
  }
}

// 更新响应状态
function updateResponseStatus(type, message) {
  responseStatus.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
  responseStatus.textContent = message;
}

// 记录日志函数
function logToFile(logData) {
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(logData) + '\n');
  } catch (error) {
    console.error('写入日志文件失败:', error);
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

// 加载模板数据
function loadTemplates() {
  try {
    // 读取模板文件
    const templatesPath = path.join(__dirname, 'templates.json');
    if (fs.existsSync(templatesPath)) {
      const templatesData = fs.readFileSync(templatesPath, 'utf8');
      templates = JSON.parse(templatesData);
      
      // 填充模板下拉列表
      populateTemplateSelect();
    } else {
      console.error('模板文件不存在:', templatesPath);
    }
  } catch (error) {
    console.error('加载模板失败:', error);
  }
}

// 填充模板下拉列表
function populateTemplateSelect() {
  // 清空现有选项（保留默认选项）
  while (templateSelect.options.length > 1) {
    templateSelect.remove(1);
  }
  
  // 添加模板选项
  templates.forEach((template, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = template.name;
    templateSelect.appendChild(option);
  });
}

// 应用选中的模板
function applyTemplate() {
  const selectedIndex = templateSelect.value;
  if (selectedIndex === '') {
    return; // 未选择模板
  }
  
  const template = templates[parseInt(selectedIndex)];
  if (template) {
    // 填充方法名称
    methodNameInput.value = template.method;
    
    // 填充参数
    const formattedParams = JSON.stringify(template.params, null, 2);
    jsonEditor.setValue(formattedParams);
    paramsInput.value = formattedParams; // 同步到隐藏的textarea
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

// 模板选择事件
templateSelect.addEventListener('change', applyTemplate);

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
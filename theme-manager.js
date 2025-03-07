// 主题管理模块

// 全局变量
let isDarkMode = false;
let htmlElement;

// 初始化主题
function initTheme() {
  // 获取HTML元素
  htmlElement = document.documentElement;
  
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
  
  // 更新主题图标（如果存在）
  const themeIcon = document.querySelector('.theme-icon');
  
  if (themeIcon) themeIcon.textContent = '☀️';
  
  localStorage.setItem('theme', 'dark');
  
  // 触发主题变更事件
  document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: 'dark' } }));
}

// 启用亮色模式
function enableLightMode() {
  isDarkMode = false;
  htmlElement.setAttribute('data-bs-theme', 'light');
  
  // 更新主题图标（如果存在）
  const themeIcon = document.querySelector('.theme-icon');
  
  if (themeIcon) themeIcon.textContent = '🌙';
  
  localStorage.setItem('theme', 'light');
  
  // 触发主题变更事件
  document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: 'light' } }));
}

// 导出函数
module.exports = {
  initTheme,
  toggleTheme,
  enableDarkMode,
  enableLightMode
};
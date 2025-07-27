/**
 * 背景图片管理器
 * 优先从Bing每日图片获取，无法联网时使用渐变动画背景
 */
class BackgroundManager {
  constructor() {
    this.bingImageUrl = null;
    this.isOnline = navigator.onLine;
    this.imageLoadRetryCount = 0;
    this.maxRetries = 3;
    this.imageCache = new Map();
    this.ipcRenderer = require('electron').ipcRenderer;
    this.init();
  }

  async init() {
    // 监听网络状态变化
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.loadBingImage();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.fallbackToGradient();
    });

    // 加载缓存
    this.loadFromCache();

    // 尝试加载Bing图片
    if (this.isOnline) {
      await this.loadBingImage();
    } else {
      this.fallbackToGradient();
    }
  }

  /**
   * 获取Bing每日图片URL
   */
  async getBingImageUrl() {
    try {
      const result = await this.ipcRenderer.invoke('get-bing-image');
      
      if (result.success) {
        // 缓存图片信息
        this.cacheImageInfo(result.imageUrl, result.imageInfo);
        return result.imageUrl;
      } else {
        console.warn('Failed to get Bing image:', result.error);
        return null;
      }
    } catch (error) {
      console.warn('Failed to fetch Bing daily image:', error);
      return null;
    }
  }

  /**
   * 缓存图片信息
   */
  cacheImageInfo(url, info) {
    const today = new Date().toDateString();
    this.imageCache.set(today, {
      url: url,
      info: info,
      timestamp: Date.now()
    });
    
    // 清理过期缓存 (保留最近7天)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    for (const [date, cache] of this.imageCache.entries()) {
      if (cache.timestamp < sevenDaysAgo) {
        this.imageCache.delete(date);
      }
    }
    
    // 保存到localStorage
    try {
      localStorage.setItem('bing-image-cache', JSON.stringify(Array.from(this.imageCache.entries())));
    } catch (e) {
      console.warn('Failed to save image cache to localStorage:', e);
    }
  }

  /**
   * 从缓存加载图片信息
   */
  loadFromCache() {
    try {
      const cached = localStorage.getItem('bing-image-cache');
      if (cached) {
        const cacheArray = JSON.parse(cached);
        this.imageCache = new Map(cacheArray);
        
        const today = new Date().toDateString();
        const todayCache = this.imageCache.get(today);
        
        if (todayCache) {
          // 如果有今天的缓存，先应用它
          this.preloadAndApplyImage(todayCache.url);
          return todayCache.url;
        }
      }
    } catch (e) {
      console.warn('Failed to load image cache from localStorage:', e);
    }
    return null;
  }

  /**
   * 加载并应用Bing图片
   */
  async loadBingImage() {
    try {
      // 首先尝试从缓存加载
      let imageUrl = this.loadFromCache();
      
      // 如果缓存中没有今天的图片，则重新获取
      if (!imageUrl) {
        imageUrl = await this.getBingImageUrl();
      }
      
      if (imageUrl) {
        await this.preloadAndApplyImage(imageUrl);
        this.imageLoadRetryCount = 0;
      } else {
        throw new Error('Failed to get Bing image URL');
      }
    } catch (error) {
      console.warn('Failed to load Bing image:', error);
      this.handleImageLoadFailure();
    }
  }

  /**
   * 预加载图片并应用背景
   */
  async preloadAndApplyImage(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        this.bingImageUrl = imageUrl;
        this.applyBingBackground(imageUrl);
        resolve();
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      // 设置超时
      setTimeout(() => {
        reject(new Error('Image load timeout'));
      }, 15000);
      
      img.src = imageUrl;
    });
  }

  /**
   * 应用Bing图片背景
   */
  applyBingBackground(imageUrl) {
    const body = document.body;
    
    // 创建新的背景样式
    const backgroundStyle = `
      background: linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.2)), url('${imageUrl}');
      background-size: cover;
      background-position: center;
      background-attachment: fixed;
      background-repeat: no-repeat;
    `;
    
    // 应用背景
    body.style.cssText += backgroundStyle;
    
    // 移除渐变动画类，添加Bing背景类
    body.classList.remove('gradient-background');
    body.classList.add('bing-background');
    
    console.log('Applied Bing daily image background');
  }

  /**
   * 处理图片加载失败
   */
  handleImageLoadFailure() {
    this.imageLoadRetryCount++;
    
    if (this.imageLoadRetryCount < this.maxRetries) {
      // 延迟重试
      setTimeout(() => {
        this.loadBingImage();
      }, 2000 * this.imageLoadRetryCount);
    } else {
      // 最大重试次数后回退到渐变背景
      this.fallbackToGradient();
    }
  }

  /**
   * 回退到渐变动画背景
   */
  fallbackToGradient() {
    const body = document.body;
    
    // 移除Bing背景相关样式
    body.classList.remove('bing-background');
    body.classList.add('gradient-background');
    
    // 清除inline style
    body.style.background = '';
    body.style.backgroundSize = '';
    body.style.backgroundPosition = '';
    body.style.backgroundAttachment = '';
    body.style.backgroundRepeat = '';
    
    console.log('Fallback to gradient background');
  }

  /**
   * 手动刷新背景图片
   */
  async refreshBackground() {
    if (this.isOnline) {
      // 清除今天的缓存
      const today = new Date().toDateString();
      this.imageCache.delete(today);
      
      // 重新加载
      await this.loadBingImage();
    } else {
      console.warn('Cannot refresh background: offline');
    }
  }

  /**
   * 获取当前背景信息
   */
  getCurrentBackgroundInfo() {
    const today = new Date().toDateString();
    const cached = this.imageCache.get(today);
    
    return {
      isOnline: this.isOnline,
      hasImage: !!this.bingImageUrl,
      imageUrl: this.bingImageUrl,
      imageInfo: cached ? cached.info : null,
      isUsingFallback: !this.bingImageUrl
    };
  }
}

// 导出背景管理器
window.BackgroundManager = BackgroundManager;
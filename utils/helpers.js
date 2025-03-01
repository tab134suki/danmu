// helpers.js - 通用工具函数库

/* ==================== 性能优化 ==================== */
// 防抖函数
export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};

// 节流函数（带尾调用）
export const throttle = (fn, threshold = 250) => {
  let lastCall = 0;
  let pending = false;
  
  return (...args) => {
    const now = Date.now();
    if (!pending && now - lastCall >= threshold) {
      fn.apply(this, args);
      lastCall = now;
      pending = false;
    } else {
      pending = true;
      requestAnimationFrame(() => this(...args));
    }
  };
};

/* ==================== 内容处理 ==================== */
// 高亮文本中的链接
export const highlightLinks = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" class="link">$1</a>');
};

// 检测图片URL
export const isImageUrl = (url) => {
  return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
};

// 安全HTML转义
export const escapeHTML = (str) => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

// 生成弹幕唯一ID
export const generateDanmuId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

/* ==================== 数据处理 ==================== */
// 深度克隆对象
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clone[key] = deepClone(obj[key]);
    }
  }
  return clone;
};

// 格式化运行时间
export const formatUptime = (millis) => {
  const totalSeconds = Math.floor(millis / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
};

/* ==================== DOM操作 ==================== */
// 动态加载图片
export const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
};

// 批量更新样式
export const batchStyle = (elements, styles) => {
  const updates = [];
  for (const el of elements) {
    updates.push(() => {
      Object.assign(el.style, styles);
    });
  }
  
  requestAnimationFrame(() => {
    for (const update of updates) update();
  });
};

/* ==================== 验证工具 ==================== */
// 邮箱格式验证
export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// 密码强度验证
export const checkPasswordStrength = (password) => {
  const strength = {
    length: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*]/.test(password)
  };
  
  return {
    ...strength,
    score: Object.values(strength).filter(Boolean).length
  };
};

/* ==================== 本地存储 ==================== */
// 安全读取存储
export const safeStorage = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  
  remove(key) {
    localStorage.removeItem(key);
  }
};

/* ==================== 随机生成 ==================== */
// 生成随机颜色
export const randomColor = (alpha = 1) => {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgba(${r},${g},${b},${alpha})`;
};

// 生成轨道位置
export const calculateTrack = (containerHeight, itemHeight) => {
  const trackCount = Math.floor(containerHeight / itemHeight);
  return Math.floor(Math.random() * trackCount) * itemHeight;
};

/* ==================== 错误处理 ==================== */
// 统一错误处理
export const handleError = (error) => {
  console.error('[系统错误]', error);
  return {
    code: error.code || 'UNKNOWN',
    message: error.message || '发生未知错误'
  };
};

// Supabase错误转译
export const translateSupabaseError = (error) => {
  const errorMessages = {
    '23505': '内容已存在',
    '42501': '操作未授权',
    'PGRST301': '请求过于频繁'
  };
  return errorMessages[error.code] || error.message;
};

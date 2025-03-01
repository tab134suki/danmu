// app.js - 弹幕系统核心逻辑
import { supabase } from './supabase-client.js';

// 全局状态管理
const state = {
  isAdmin: localStorage.getItem('isAdmin') === 'true',
  settings: JSON.parse(localStorage.getItem('settings')) || {
    opacity: 0.9,
    speed: 1.0,
    highlight: true,
    theme: 'light'
  },
  activeDanmus: new Map(),
  lastPosition: 0,
  systemStartTime: Date.now()
};

// DOM元素缓存
const elements = {
  container: document.getElementById('danmu-container'),
  settingsPanel: document.getElementById('settings-panel'),
  opacityRange: document.getElementById('opacity-range'),
  speedRange: document.getElementById('speed-range'),
  highlightCheck: document.getElementById('highlight-check'),
  loginBtn: document.getElementById('login-btn'),
  adminControls: document.getElementById('admin-controls'),
  logModal: document.getElementById('log-modal')
};

/* ------------------ 初始化系统 ------------------ */
function initializeSystem() {
  applyInitialSettings();
  setupEventListeners();
  setupRealtimeListener();
  startUptimeCounter();
  checkAdminStatus();
  loadInitialDanmus();
}

/* ------------------ 事件监听器 ------------------ */
function setupEventListeners() {
  // 虚拟输入框（支持移动端）
  const virtualInput = createVirtualInput();
  document.body.appendChild(virtualInput);

  // 设置控件
  elements.opacityRange.addEventListener('input', handleOpacityChange);
  elements.speedRange.addEventListener('input', handleSpeedChange);
  elements.highlightCheck.addEventListener('change', handleHighlightChange);
  
  // 全局点击
  document.addEventListener('click', handleGlobalClick);
  
  // 主题切换
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  
  // 管理员功能
  if(state.isAdmin) setupAdminFeatures();
}

/* ------------------ 弹幕核心逻辑 ------------------ */
async function loadInitialDanmus() {
  const { data, error } = await supabase
    .from('danmus')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!error) data.reverse().forEach(createDanmuElement);
}

function createDanmuElement(danmuData) {
  const danmu = document.createElement('div');
  danmu.className = `danmu-item ${danmuData.type}-type`;
  danmu.innerHTML = processContent(danmuData.content);
  
  // 定位逻辑
  const topPosition = calculatePosition();
  danmu.style.top = `${topPosition}%`;
  
  // 动画控制
  setupDanmuAnimation(danmu, danmuData.type);
  
  elements.container.appendChild(danmu);
  state.activeDanmus.set(danmuData.id, danmu);
}

function processContent(text) {
  let processed = text;
  // 链接高亮
  if (state.settings.highlight) {
    processed = processed.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<span class="highlight-link">$1</span>'
    );
  }
  // 图片检测
  if (/(https?:\/\/.*\.(?:png|jpg|gif))/i.test(processed)) {
    return `<img src="${RegExp.$1}" class="danmu-image"><p>${processed}</p>`;
  }
  return processed;
}

/* ------------------ 实时通信 ------------------ */
function setupRealtimeListener() {
  supabase.channel('danmu-channel')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'danmus'
    }, (payload) => {
      if (!state.activeDanmus.has(payload.new.id)) {
        createDanmuElement(payload.new);
        cleanupOldDanmus();
      }
    })
    .subscribe();
}

/* ------------------ 设置管理 ------------------ */
function applyInitialSettings() {
  // 应用保存的设置
  document.documentElement.style.setProperty('--danmu-opacity', state.settings.opacity);
  document.documentElement.style.setProperty('--danmu-speed', `${10 / state.settings.speed}s`);
  document.body.classList.toggle('night-mode', state.settings.theme === 'dark');
  
  // 更新控件状态
  elements.opacityRange.value = state.settings.opacity;
  elements.speedRange.value = state.settings.speed;
  elements.highlightCheck.checked = state.settings.highlight;
}

function handleOpacityChange(e) {
  const value = parseFloat(e.target.value);
  state.settings.opacity = value;
  document.documentElement.style.setProperty('--danmu-opacity', value);
  saveSettings();
}

function handleSpeedChange(e) {
  const value = parseFloat(e.target.value);
  state.settings.speed = value;
  document.documentElement.style.setProperty('--danmu-speed', `${10 / value}s`);
  adjustExistingAnimations(value);
  saveSettings();
}

/* ------------------ 管理员功能 ------------------ */
function setupAdminFeatures() {
  elements.adminControls.classList.remove('hidden');
  document.getElementById('auth-status').textContent = '管理员模式';
  
  // 添加管理事件监听
  document.getElementById('clear-danmus').addEventListener('click', clearAllDanmus);
  document.getElementById('export-logs').addEventListener('click', exportLogs);
}

async function submitUpdateLog() {
  const title = document.getElementById('log-title').value;
  const content = document.getElementById('log-content').value;
  
  if (!title || !content) return;

  const { error } = await supabase
    .from('update_logs')
    .insert([{
      title,
      content,
      version: 'v1.0.0',
      author: 'admin'
    }]);

  if (!error) {
    showNotification('更新日志已发布');
    document.getElementById('log-form').reset();
  }
}

/* ------------------ 工具函数 ------------------ */
function calculatePosition() {
  state.lastPosition = (state.lastPosition + 10) % 90;
  return state.lastPosition;
}

function cleanupOldDanmus() {
  if (state.activeDanmus.size > 100) {
    const oldest = Array.from(state.activeDanmus.keys()).slice(0, 20);
    oldest.forEach(id => {
      state.activeDanmus.get(id).remove();
      state.activeDanmus.delete(id);
    });
  }
}

function createVirtualInput() {
  const input = document.createElement('div');
  input.contentEditable = true;
  input.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    min-height: 40px;
    padding: 10px;
    background: rgba(255,255,255,0.9);
    border-radius: 20px;
    z-index: 1000;
    opacity: 0;
  `;
  input.addEventListener('input', handleDanmuInput);
  return input;
}

// 初始化系统
document.addEventListener('DOMContentLoaded', initializeSystem);

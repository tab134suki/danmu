// danmu.js - 弹幕核心引擎
import { supabase, handleSupabaseError } from './supabase.js';

export class DanmuEngine {
  constructor(container) {
    this.container = container;
    this.activeDanmus = new Map();
    this.animationQueue = [];
    this.positionCache = new Set();
    this.currentYPositions = {};
    this.init();
  }

  /* ------------------ 初始化 ------------------ */
  async init() {
    this.setupResizeObserver();
    await this.loadHistory();
    this.setupRealtime();
    this.startCleanupLoop();
  }

  /* ------------------ 弹幕生命周期管理 ------------------ */
  async createDanmu(content, type = 'text', options = {}) {
    try {
      const { data, error } = await supabase
        .from('danmus')
        .insert([{
          content,
          type,
          style: this.getStyleOptions(),
          ...options
        }])
        .select();

      if (error) throw error;
      return data[0].id;
    } catch (error) {
      console.error('弹幕发送失败:', handleSupabaseError(error));
      return null;
    }
  }

  /* ------------------ 弹幕渲染 ------------------ */
  async renderDanmu(payload) {
    const danmu = this.createDOM(payload);
    this.container.appendChild(danmu);
    this.manageAnimation(danmu);
    this.recordPosition(danmu);
  }

  createDOM({ id, content, type, style }) {
    const danmu = document.createElement('div');
    danmu.className = `danmu danmu-${type}`;
    danmu.dataset.id = id;
    danmu.innerHTML = this.processContent(content, type);
    
    Object.assign(danmu.style, {
      top: this.calculateYPosition(),
      '--speed': `${style?.speed || 1}`,
      opacity: style?.opacity || 1
    });

    return danmu;
  }

  /* ------------------ 动画控制 ------------------ */
  manageAnimation(danmu) {
    const animation = danmu.animate(
      [
        { transform: 'translateX(100vw)' },
        { transform: 'translateX(-100%)' }
      ],
      {
        duration: 10000 / parseFloat(danmu.style.getPropertyValue('--speed')),
        iterations: 1
      }
    );

    animation.onfinish = () => this.removeDanmu(danmu.dataset.id);
    this.animationQueue.push(animation);
  }

  /* ------------------ 布局算法 ------------------ */
  calculateYPosition() {
    const containerHeight = this.container.offsetHeight;
    const danmuHeight = 40; // 弹项固定高度
    
    // 轨道算法
    const trackCount = Math.floor(containerHeight / danmuHeight);
    let selectedTrack = 0;
    
    for (let track = 0; track < trackCount; track++) {
      if (!this.currentYPositions[track] || 
          Date.now() - this.currentYPositions[track] > 2000) {
        selectedTrack = track;
        break;
      }
    }

    this.currentYPositions[selectedTrack] = Date.now();
    return `${selectedTrack * danmuHeight}px`;
  }

  /* ------------------ 性能优化 ------------------ */
  setupResizeObserver() {
    const observer = new ResizeObserver(entries => {
      entries.forEach(entry => {
        this.adjustAllAnimations(entry.contentRect.width);
      });
    });
    observer.observe(this.container);
  }

  startCleanupLoop() {
    setInterval(() => {
      this.cleanupOldDanmus();
      this.optimizeAnimations();
    }, 5000);
  }

  /* ------------------ 工具方法 ------------------ */
  processContent(content, type) {
    switch(type) {
      case 'image':
        return `<img src="${content}" 
                loading="lazy" 
                onload="this.parentElement.style.opacity=1"
                style="opacity:0;transition:opacity 0.3s">`;
        
      case 'link':
        return `<a href="${content}" target="_blank">${content}</a>`;
        
      default:
        return this.highlightLinks(content);
    }
  }

  highlightLinks(text) {
    return text.replace(
      /(https?:\/\/[^\s]+)/g,
      '<span class="link">$1</span>'
    );
  }

  /* ------------------ 数据库交互 ------------------ */
  async loadHistory() {
    const { data } = await supabase
      .from('danmus')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    data.reverse().forEach(danmu => this.renderDanmu(danmu));
  }

  setupRealtime() {
    supabase.channel('danmu-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'danmus'
      }, payload => {
        if (!this.activeDanmus.has(payload.new.id)) {
          this.renderDanmu(payload.new);
        }
      })
      .subscribe();
  }

  /* ------------------ 公共接口 ------------------ */
  updateSpeed(speedFactor) {
    this.animationQueue.forEach(anim => {
      anim.effect.timing = {
        ...anim.effect.timing,
        duration: 10000 / speedFactor
      };
    });
  }

  removeDanmu(id) {
    const danmu = this.activeDanmus.get(id);
    if (danmu) {
      danmu.style.opacity = 0;
      setTimeout(() => danmu.remove(), 300);
      this.activeDanmus.delete(id);
    }
  }

  clearAll() {
    this.animationQueue.forEach(anim => anim.cancel());
    this.container.innerHTML = '';
    this.activeDanmus.clear();
  }
}

// 初始化示例
// const danmuEngine = new DanmuEngine(document.getElementById('danmu-container'));
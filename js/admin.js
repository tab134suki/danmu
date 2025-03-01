// admin.js - 管理员功能模块
import { supabase, handleSupabaseError } from './supabase.js';

export class AdminSystem {
  static ADMIN_ROLE = 'danmu_admin';
  static TOKEN_KEY = 'dm-admin-token';

  /* ==================== 认证系统 ==================== */
  static async login(credentials) {
    try {
      const { email, password } = credentials;
      
      // 执行认证
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // 验证管理员权限
      const isAdmin = await this.verifyAdminRole(data.user.id);
      if (!isAdmin) throw new Error('权限不足');

      // 生成访问令牌
      const token = this.generateToken(data.user);
      this.saveSession(token);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: handleSupabaseError(error) 
      };
    }
  }

  static async logout() {
    await supabase.auth.signOut();
    localStorage.removeItem(this.TOKEN_KEY);
    window.location.reload();
  }

  /* ==================== 权限验证 ==================== */
  static async verifyAdminRole(userId) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    return data?.role === this.ADMIN_ROLE;
  }

  static checkAuth() {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() < payload.exp * 1000;
    } catch {
      return false;
    }
  }

  /* ==================== 内容管理 ==================== */
  static async deleteDanmu(danmuId) {
    if (!this.checkAuth()) return false;

    const { error } = await supabase
      .from('danmus')
      .delete()
      .eq('id', danmuId);

    return !error;
  }

  static async clearAllDanmus() {
    if (!this.checkAuth()) return false;

    const { error } = await supabase
      .from('danmus')
      .delete()
      .gt('id', 0);

    return !error;
  }

  /* ==================== 日志管理 ==================== */
  static async postUpdateLog(logData) {
    if (!this.checkAuth()) return false;

    const { error } = await supabase
      .from('update_logs')
      .insert({
        ...logData,
        author: 'admin',
        version: process.env.APP_VERSION
      });

    return !error;
  }

  static async getLogs(options = {}) {
    const { limit = 50, page = 1 } = options;
    
    const { data, error } = await supabase
      .from('update_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range((page-1)*limit, page*limit-1);

    return error ? [] : data;
  }

  /* ==================== 系统工具 ==================== */
  static async exportData(format = 'csv') {
    if (!this.checkAuth()) return null;

    const { data } = await supabase
      .from('danmus')
      .select('*');

    switch(format) {
      case 'csv':
        return this.convertToCSV(data);
      case 'json':
        return JSON.stringify(data);
      default:
        return null;
    }
  }

  static async getStatistics() {
    const { count } = await supabase
      .from('danmus')
      .select('count', { count: 'exact' });

    return {
      totalDanmus: count,
      activeUsers: await this.getActiveUsers(),
      storageUsage: await this.calculateStorage()
    };
  }

  /* ==================== 私有方法 ==================== */
  static generateToken(user) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: user.id,
      role: this.ADMIN_ROLE,
      exp: Math.floor(Date.now()/1000) + 3600 // 1小时过期
    };
    
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    return `${encodedHeader}.${encodedPayload}.${this.signToken(payload)}`;
  }

  static signToken(payload) {
    // 生产环境应使用服务器端签名
    return btoa(payload.exp.toString());
  }

  static saveSession(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
    setTimeout(() => this.logout(), 3600 * 1000); // 1小时后自动登出
  }

  static convertToCSV(data) {
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => 
      Object.values(obj)
        .map(v => `"${v}"`.replace(/\n/g, ' '))
        .join(',')
    );
    return [headers, ...rows].join('\n');
  }

  static async getActiveUsers() {
    const { count } = await supabase
      .from('users')
      .select('count', { 
        count: 'exact', 
        filter: 'last_active.gt.2023-09-01' 
      });
      
    return count;
  }

  static async calculateStorage() {
    const { data } = await supabase.storage.getBucket('danmu_assets');
    return data?.spaceUsed || 0;
  }
}

/* ==================== UI 绑定 ==================== */
export function initAdminUI() {
  // 登录表单处理
  document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    
    const result = await AdminSystem.login({ email, password });
    if (result.success) {
      window.location.href = '/admin/dashboard';
    } else {
      showError(result.message);
    }
  });

  // 仪表盘初始化
  if (window.location.pathname.includes('/admin')) {
    if (!AdminSystem.checkAuth()) {
      window.location.href = '/admin/login';
      return;
    }
    
    loadDashboard();
    setupRealtimeUpdates();
  }
}

/* ==================== 实时更新 ==================== */
function setupRealtimeUpdates() {
  supabase.channel('admin-channel')
    .on('postgres_changes', {
      event: '*',
      schema: 'public'
    }, (payload) => {
      switch(payload.table) {
        case 'danmus':
          handleDanmuUpdate(payload);
          break;
        case 'update_logs':
          handleLogUpdate(payload);
          break;
      }
    })
    .subscribe();
}

// 初始化示例
// document.addEventListener('DOMContentLoaded', initAdminUI);
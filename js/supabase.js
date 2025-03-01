// src/js/supabase.js
import { createClient } from '@supabase/supabase-js'

// 从 GitHub Secrets 获取环境变量
const SUPABASE_URL = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY || import.meta.env.VITE_SUPABASE_KEY


// 初始化客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})

export default supabase

// 创建实时通信频道
export const realtimeChannel = supabase.channel(REALTIME_CHANNEL_NAME, {
  config: {
    broadcast: { 
      ack: true 
    },
    presence: {
      key: 'danmu-system'
    }
  }
})

/* ------------------ 数据库监听配置 ------------------ */
export function setupRealtimeListener(tableName, eventType, callback) {
  return realtimeChannel
    .on('postgres_changes', {
      event: eventType,
      schema: 'public',
      table: tableName,
      filter: '*' // 可替换为特定筛选条件
    }, (payload) => {
      try {
        callback(payload)
      } catch (error) {
        handleSupabaseError(error)
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('实时通道已连接')
      }
    })
}

/* ------------------ 管理员功能 ------------------ */
export async function verifyAdmin() {
  const adminToken = localStorage.getItem('sb-admin-token')
  
  // 双重验证机制
  const { data: { user }, error } = await supabase.auth.getUser()
  
  return new Promise((resolve) => {
    if (error || !user || user.role !== 'admin' || adminToken !== 'valid-token') {
      localStorage.removeItem('sb-admin-token')
      resolve(false)
    }
    resolve(true)
  })
}

/* ------------------ 错误处理 ------------------ */
export function handleSupabaseError(error) {
  const errorMap = {
    '23505': '内容重复提交',
    '42501': '权限不足',
    'PGRST301': '请求频率过高'
  }
  
  console.error(`[Supabase Error ${error.code}] ${error.message}`)
  return errorMap[error.code] || '系统繁忙，请稍后重试'
}

/* ------------------ 初始化函数 ------------------ */
export async function initializeDatabase() {
  // 启用实时功能
  await supabase.realtime.setChannel(realtimeChannel)
  
  // 初始化数据库监听
  setupRealtimeListener('danmus', 'INSERT', (payload) => {
    console.log('新弹幕:', payload.new)
  })
}

/* ------------------ 安全策略 ------------------ */
// 行级安全策略示例（需在SQL中执行）
export const RLS_POLICIES = `
-- 弹幕表策略
CREATE POLICY "允许所有人读取弹幕"
ON danmus FOR SELECT USING (true);

CREATE POLICY "允许认证用户插入"
ON danmus FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "仅管理员删除"
ON danmus FOR DELETE
USING (auth.jwt() ->> 'role' = 'admin');

-- 日志表策略
CREATE POLICY "允许所有人读取日志"
ON update_logs FOR SELECT USING (true);

CREATE POLICY "仅管理员管理日志"
ON update_logs FOR ALL
USING (auth.jwt() ->> 'role' = 'admin');
`

// 暴露必要接口
export default {
  supabase,
  realtimeChannel,
  initializeDatabase,
  verifyAdmin,
  handleSupabaseError
}
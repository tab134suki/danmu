// validator.js - 输入验证模块

export const Validator = {
  /* ==================== 基础验证规则 ==================== */
  required: (value, field = '字段') => ({
    isValid: !!value?.trim(),
    message: `${field}不能为空`
  }),

  minLength: (value, min, field = '字段') => ({
    isValid: value.length >= min,
    message: `${field}至少需要${min}个字符`
  }),

  maxLength: (value, max, field = '字段') => ({
    isValid: value.length <= max,
    message: `${field}不能超过${max}个字符`
  }),

  /* ==================== 弹幕内容验证 ==================== */
  danmuContent: (content, config = {}) => {
    const defaultConfig = {
      maxLength: 100,
      allowLinks: true,
      allowImages: true,
      sensitiveWords: []
    };
    const options = { ...defaultConfig, ...config };

    // 基础验证
    const baseCheck = this.chain(content, [
      this.required(content, '弹幕内容'),
      this.maxLength(content, options.maxLength, '弹幕内容')
    ]);

    if (!baseCheck.isValid) return baseCheck;

    // HTML标签检测
    const htmlRegex = /<[^>]*>/g;
    if (htmlRegex.test(content)) {
      return { isValid: false, message: '不能包含HTML标签' };
    }

    // 链接检测
    if (!options.allowLinks) {
      const urlRegex = /https?:\/\/\S+/g;
      if (urlRegex.test(content)) {
        return { isValid: false, message: '不能包含外部链接' };
      }
    }

    // 图片检测
    if (!options.allowImages) {
      const imageRegex = /\.(jpg|jpeg|png|gif)/i;
      if (imageRegex.test(content)) {
        return { isValid: false, message: '不能包含图片' };
      }
    }

    // 敏感词过滤
    if (options.sensitiveWords.length > 0) {
      const sensitiveRegex = new RegExp(
        options.sensitiveWords.join('|'),
        'gi'
      );
      if (sensitiveRegex.test(content)) {
        return { 
          isValid: false, 
          message: '包含不被允许的内容'
        };
      }
    }

    return { isValid: true, message: '' };
  },

  /* ==================== 用户认证验证 ==================== */
  email: (email) => {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return {
      isValid: regex.test(email),
      message: '请输入有效的邮箱地址'
    };
  },

  password: (password) => {
    const strength = {
      minLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*]/.test(password)
    };

    const passedChecks = Object.values(strength).filter(Boolean).length;
    let message = '';

    if (passedChecks < 3) {
      message = '密码强度不足（需包含大小写字母、数字和特殊字符）';
    }

    return {
      isValid: passedChecks >= 3,
      message
    };
  },

  /* ==================== 系统设置验证 ==================== */
  opacity: (value) => ({
    isValid: value >= 0 && value <= 1,
    message: '透明度必须在0到1之间'
  }),

  speed: (value) => ({
    isValid: value >= 0.5 && value <= 5,
    message: '速度必须在0.5到5倍之间'
  }),

  /* ==================== URL验证 ==================== */
  imageUrl: (url) => {
    const urlRegex = /^(https?:\/\/)[\w-]+(\.[\w-]+)+([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?$/;
    const extRegex = /\.(jpe?g|png|gif|webp)$/i;

    return {
      isValid: urlRegex.test(url) && extRegex.test(url),
      message: '请输入有效的图片链接（支持jpg/png/gif/webp）'
    };
  },

  /* ==================== 高级工具 ==================== */
  chain: (value, rules) => {
    for (const rule of rules) {
      const result = typeof rule === 'function' 
        ? rule(value) 
        : rule;
      if (!result.isValid) return result;
    }
    return { isValid: true, message: '' };
  },

  validateForm: (formData, schema) => {
    const errors = {};
    for (const [field, rules] of Object.entries(schema)) {
      const value = formData[field];
      const result = this.chain(value, rules);
      if (!result.isValid) {
        errors[field] = result.message;
      }
    }
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};

/* ==================== 使用示例 ==================== */
/*
// 单个字段验证
const emailResult = Validator.email('user@example.com');
if (!emailResult.isValid) {
  console.error(emailResult.message);
}

// 复杂弹幕验证
const danmuResult = Validator.danmuContent('Hello!', {
  maxLength: 50,
  sensitiveWords: ['暴力', '色情']
});

// 表单验证
const schema = {
  username: [
    value => Validator.required(value, '用户名'),
    value => Validator.minLength(value, 3, '用户名')
  ],
  password: [
    Validator.password
  ]
};

const formResult = Validator.validateForm(
  { username: 'abc', password: 'Test123!' },
  schema
);
*/
/**
 * Circuit Breaker Manager Service
 * 
 * این سرویس برای مدیریت الگوی Circuit Breaker استفاده می‌شود که از سیستم در برابر خطاهای مکرر محافظت می‌کند.
 * با تشخیص خطاهای مداوم، اتصال به سرویس‌های ناسالم را موقتاً قطع می‌کند تا از فشار بیشتر جلوگیری شود.
 */

const EventEmitter = require('events');

// وضعیت‌های مدار
const CIRCUIT_STATE = {
  CLOSED: 'CLOSED',     // مدار بسته (عملکرد عادی)
  OPEN: 'OPEN',         // مدار باز (رد درخواست‌ها)
  HALF_OPEN: 'HALF_OPEN' // مدار نیمه‌باز (اجازه عبور محدود درخواست‌ها)
};

/**
 * کلاس Circuit Breaker
 * پیاده‌سازی الگوی Circuit Breaker برای یک سرویس خاص
 */
class CircuitBreaker extends EventEmitter {
  /**
   * سازنده کلاس Circuit Breaker
   * @param {string} name - نام مدار
   * @param {Object} options - تنظیمات مدار
   */
  constructor(name, options = {}) {
    super();
    this.setMaxListeners(50); // افزایش حد مجاز listener ها
    
    this.name = name;
    
    // تنظیمات پیش‌فرض
    this.options = {
      failureThreshold: options.failureThreshold || 5, // آستانه خطا برای باز کردن مدار
      successThreshold: options.successThreshold || 2, // آستانه موفقیت برای بستن مدار
      resetTimeout: options.resetTimeout || 30000, // زمان انتظار قبل از نیمه‌باز شدن مدار (میلی‌ثانیه)
      timeout: options.timeout || 10000, // زمان انتظار برای اجرای عملیات (میلی‌ثانیه)
      volumeThreshold: options.volumeThreshold || 10, // حداقل تعداد درخواست قبل از بررسی نرخ خطا
      errorThresholdPercentage: options.errorThresholdPercentage || 50, // درصد خطا برای باز کردن مدار
      fallback: options.fallback || null, // تابع جایگزین در صورت باز بودن مدار
      isFailure: options.isFailure || this._defaultIsFailure, // تابع تشخیص خطا
      healthCheckInterval: options.healthCheckInterval || 60000, // فاصله زمانی بررسی سلامت (میلی‌ثانیه)
      healthCheck: options.healthCheck || null, // تابع بررسی سلامت
      enabled: options.enabled !== undefined ? options.enabled : true, // فعال بودن مدار
      group: options.group || null, // گروه مدار
      monitorIntervalMs: options.monitorIntervalMs || 10000, // فاصله زمانی جمع‌آوری آمار (میلی‌ثانیه)
    };
    
    // وضعیت فعلی مدار
    this.state = CIRCUIT_STATE.CLOSED;
    
    // آمار
    this.stats = {
      successes: 0,
      failures: 0,
      rejects: 0,
      timeouts: 0,
      fallbacks: 0,
      latencies: [],
      lastError: null,
      lastSuccess: null,
      lastFailure: null,
      lastRejection: null,
      lastTimeout: null,
      lastFallback: null,
    };
    
    // پنجره زمانی برای محاسبه نرخ خطا
    this.window = {
      startTime: Date.now(),
      successes: 0,
      failures: 0,
      total: 0
    };
    
    // شناسه تایمر برای بازنشانی مدار
    this.resetTimer = null;
    
    // شناسه تایمر برای بررسی سلامت
    if (this.options.healthCheck) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthCheck();
      }, this.options.healthCheckInterval);
    }
    
    // شناسه تایمر برای جمع‌آوری آمار
    this.monitorTimer = setInterval(() => {
      this.resetWindow();
    }, this.options.monitorIntervalMs);
  }
  
  /**
   * تابع پیش‌فرض تشخیص خطا
   * @param {Error} error - خطای رخ داده
   * @returns {boolean} - آیا خطا محسوب می‌شود
   */
  _defaultIsFailure(error) {
    return error !== null && error !== undefined;
  }
  
  /**
   * اجرای عملیات با محافظت مدار
   * @param {Function} fn - تابع مورد نظر
   * @param {Array} args - پارامترهای تابع
   * @returns {Promise<any>} - نتیجه اجرای تابع
   */
  async execute(fn, ...args) {
    // بررسی فعال بودن مدار
    if (!this.options.enabled) {
      return fn(...args);
    }
    
    // بررسی وضعیت مدار
    if (this.state === CIRCUIT_STATE.OPEN) {
      // مدار باز است، رد درخواست
      this.stats.rejects++;
      this.window.total++;
      this.stats.lastRejection = Date.now();
      
      this.emit('reject', this.name);
      
      // اجرای تابع جایگزین در صورت وجود
      if (this.options.fallback) {
        this.stats.fallbacks++;
        this.stats.lastFallback = Date.now();
        
        this.emit('fallback', this.name);
        
        return this.options.fallback(...args);
      }
      
      throw new Error(`مدار ${this.name} باز است و درخواست‌ها را رد می‌کند.`);
    }
    
    // اجرای عملیات با زمان‌سنجی
    const startTime = Date.now();
    let result;
    
    try {
      // اجرای عملیات با محدودیت زمانی
      result = await this._executeWithTimeout(fn, args, this.options.timeout);
      
      // محاسبه زمان پاسخ
      const latency = Date.now() - startTime;
      this.stats.latencies.push(latency);
      
      // حفظ حداکثر ۱۰۰ زمان پاسخ
      if (this.stats.latencies.length > 100) {
        this.stats.latencies.shift();
      }
      
      // ثبت موفقیت
      this.stats.successes++;
      this.window.successes++;
      this.window.total++;
      this.stats.lastSuccess = Date.now();
      
      this.emit('success', this.name, latency);
      
      // بررسی وضعیت نیمه‌باز
      if (this.state === CIRCUIT_STATE.HALF_OPEN) {
        this._handleHalfOpenSuccess();
      }
      
      return result;
    } catch (error) {
      // بررسی آیا خطا محسوب می‌شود
      if (this.options.isFailure(error)) {
        // ثبت خطا
        this.stats.failures++;
        this.window.failures++;
        this.window.total++;
        this.stats.lastError = error;
        this.stats.lastFailure = Date.now();
        
        // بررسی خطای زمان انتظار
        if (error.name === 'TimeoutError') {
          this.stats.timeouts++;
          this.stats.lastTimeout = Date.now();
          this.emit('timeout', this.name, error);
        } else {
          this.emit('failure', this.name, error);
        }
        
        // بررسی وضعیت مدار
        if (this.state === CIRCUIT_STATE.CLOSED) {
          this._handleClosedFailure();
        } else if (this.state === CIRCUIT_STATE.HALF_OPEN) {
          this._handleHalfOpenFailure();
        }
        
        // اجرای تابع جایگزین در صورت وجود
        if (this.options.fallback) {
          this.stats.fallbacks++;
          this.stats.lastFallback = Date.now();
          
          this.emit('fallback', this.name);
          
          return this.options.fallback(...args);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * اجرای عملیات با محدودیت زمانی
   * @param {Function} fn - تابع مورد نظر
   * @param {Array} args - پارامترهای تابع
   * @param {number} timeout - زمان انتظار (میلی‌ثانیه)
   * @returns {Promise<any>} - نتیجه اجرای تابع
   */
  async _executeWithTimeout(fn, args, timeout) {
    return new Promise((resolve, reject) => {
      // ایجاد تایمر برای زمان انتظار
      const timeoutId = setTimeout(() => {
        const error = new Error(`عملیات در مدار ${this.name} با زمان انتظار مواجه شد.`);
        error.name = 'TimeoutError';
        reject(error);
      }, timeout);
      
      // اجرای تابع
      Promise.resolve(fn(...args))
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  /**
   * مدیریت خطا در وضعیت بسته
   */
  _handleClosedFailure() {
    // بررسی آستانه حجم
    if (this.window.total < this.options.volumeThreshold) {
      return;
    }
    
    // محاسبه نرخ خطا
    const failureRate = (this.window.failures / this.window.total) * 100;
    
    // بررسی آستانه نرخ خطا
    if (failureRate >= this.options.errorThresholdPercentage) {
      this._openCircuit();
    }
  }
  
  /**
   * مدیریت موفقیت در وضعیت نیمه‌باز
   */
  _handleHalfOpenSuccess() {
    this.stats.successes++;
    
    // بررسی آستانه موفقیت
    if (this.stats.successes >= this.options.successThreshold) {
      this._closeCircuit();
    }
  }
  
  /**
   * مدیریت خطا در وضعیت نیمه‌باز
   */
  _handleHalfOpenFailure() {
    // بازگشت به وضعیت باز
    this._openCircuit();
  }
  
  /**
   * باز کردن مدار
   */
  _openCircuit() {
    if (this.state !== CIRCUIT_STATE.OPEN) {
      this.state = CIRCUIT_STATE.OPEN;
      this.emit('open', this.name);
      
      // تنظیم تایمر برای بازنشانی مدار
      this.resetTimer = setTimeout(() => {
        this._halfOpenCircuit();
      }, this.options.resetTimeout);
    }
  }
  
  /**
   * نیمه‌باز کردن مدار
   */
  _halfOpenCircuit() {
    if (this.state === CIRCUIT_STATE.OPEN) {
      this.state = CIRCUIT_STATE.HALF_OPEN;
      this.stats.successes = 0; // بازنشانی شمارنده موفقیت
      this.emit('half-open', this.name);
    }
  }
  
  /**
   * بستن مدار
   */
  _closeCircuit() {
    if (this.state !== CIRCUIT_STATE.CLOSED) {
      this.state = CIRCUIT_STATE.CLOSED;
      this.resetWindow(); // بازنشانی پنجره زمانی
      this.emit('close', this.name);
      
      // لغو تایمر بازنشانی
      if (this.resetTimer) {
        clearTimeout(this.resetTimer);
        this.resetTimer = null;
      }
    }
  }
  
  /**
   * بازنشانی پنجره زمانی
   */
  resetWindow() {
    this.window = {
      startTime: Date.now(),
      successes: 0,
      failures: 0,
      total: 0
    };
  }
  
  /**
   * انجام بررسی سلامت
   */
  async performHealthCheck() {
    if (!this.options.healthCheck || this.state !== CIRCUIT_STATE.OPEN) {
      return;
    }
    
    try {
      const isHealthy = await this.options.healthCheck();
      
      if (isHealthy) {
        // سرویس سالم است، نیمه‌باز کردن مدار
        this._halfOpenCircuit();
      }
    } catch (error) {
      // خطا در بررسی سلامت، مدار همچنان باز می‌ماند
      this.emit('health-check-failed', this.name, error);
    }
  }
  
  /**
   * دریافت وضعیت فعلی مدار
   * @returns {Object} - وضعیت مدار
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      stats: { ...this.stats },
      window: { ...this.window },
      options: { ...this.options }
    };
  }
  
  /**
   * تنظیم وضعیت مدار
   * @param {string} state - وضعیت جدید
   */
  setState(state) {
    if (!Object.values(CIRCUIT_STATE).includes(state)) {
      throw new Error(`وضعیت نامعتبر: ${state}`);
    }
    
    if (state === CIRCUIT_STATE.OPEN) {
      this._openCircuit();
    } else if (state === CIRCUIT_STATE.HALF_OPEN) {
      this._halfOpenCircuit();
    } else if (state === CIRCUIT_STATE.CLOSED) {
      this._closeCircuit();
    }
  }
  
  /**
   * بازنشانی آمار مدار
   */
  resetStats() {
    this.stats = {
      successes: 0,
      failures: 0,
      rejects: 0,
      timeouts: 0,
      fallbacks: 0,
      latencies: [],
      lastError: null,
      lastSuccess: null,
      lastFailure: null,
      lastRejection: null,
      lastTimeout: null,
      lastFallback: null,
    };
    
    this.resetWindow();
  }
  
  /**
   * فعال یا غیرفعال کردن مدار
   * @param {boolean} enabled - وضعیت فعال بودن
   */
  setEnabled(enabled) {
    this.options.enabled = enabled;
    
    if (enabled && this.state === CIRCUIT_STATE.OPEN) {
      // بررسی زمان باز بودن مدار
      const openTime = Date.now() - this.stats.lastFailure;
      
      if (openTime >= this.options.resetTimeout) {
        this._halfOpenCircuit();
      }
    }
  }
  
  /**
   * تنظیم گزینه‌های مدار
   * @param {Object} options - گزینه‌های جدید
   */
  setOptions(options) {
    this.options = {
      ...this.options,
      ...options
    };
    
    // به‌روزرسانی تایمر بررسی سلامت
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.options.healthCheck) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthCheck();
      }, this.options.healthCheckInterval);
    }
    
    // به‌روزرسانی تایمر جمع‌آوری آمار
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
    }
    
    this.monitorTimer = setInterval(() => {
      this.resetWindow();
    }, this.options.monitorIntervalMs);
  }
  
  /**
   * پاکسازی منابع هنگام خروج
   */
  close() {
    // لغو تایمر بازنشانی
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    
    // لغو تایمر بررسی سلامت
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // لغو تایمر جمع‌آوری آمار
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }
}

/**
 * کلاس Circuit Breaker Manager
 * مدیریت چندین مدار برای سرویس‌های مختلف
 */
class CircuitBreakerManager extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // افزایش حد مجاز listener ها
    
    // مجموعه مدارها
    this.breakers = new Map();
    
    // گروه‌بندی مدارها
    this.groups = new Map();
    
    // تنظیمات پیش‌فرض
    this.defaultOptions = {
      failureThreshold: 5,
      successThreshold: 2,
      resetTimeout: 30000,
      timeout: 10000,
      volumeThreshold: 10,
      errorThresholdPercentage: 50,
      healthCheckInterval: 60000,
      monitorIntervalMs: 10000,
    };
  }
  
  /**
   * ایجاد یا دریافت یک مدار
   * @param {string} name - نام مدار
   * @param {Object} options - تنظیمات مدار
   * @returns {CircuitBreaker} - مدار ایجاد شده یا موجود
   */
  getBreaker(name, options = {}) {
    if (this.breakers.has(name)) {
      return this.breakers.get(name);
    }
    
    // ترکیب تنظیمات پیش‌فرض و سفارشی
    const breakerOptions = {
      ...this.defaultOptions,
      ...options
    };
    
    // ایجاد مدار جدید
    const breaker = new CircuitBreaker(name, breakerOptions);
    
    // افزودن به مجموعه مدارها
    this.breakers.set(name, breaker);
    
    // افزودن به گروه در صورت وجود
    if (breakerOptions.group) {
      this.addToGroup(breakerOptions.group, breaker);
    }
    
    // انتقال رویدادهای مدار
    this._relayEvents(breaker);
    
    return breaker;
  }
  
  /**
   * انتقال رویدادهای مدار به مدیر
   * @param {CircuitBreaker} breaker - مدار مورد نظر
   */
  _relayEvents(breaker) {
    const events = [
      'open', 'close', 'half-open', 'success', 'failure',
      'timeout', 'reject', 'fallback', 'health-check-failed'
    ];
    
    events.forEach(event => {
      breaker.on(event, (...args) => {
        // انتشار رویداد با نام مدار
        this.emit(`${event}:${breaker.name}`, ...args);
        
        // انتشار رویداد کلی
        this.emit(event, breaker.name, ...args);
      });
    });
  }
  
  /**
   * افزودن مدار به گروه
   * @param {string} groupName - نام گروه
   * @param {CircuitBreaker} breaker - مدار مورد نظر
   */
  addToGroup(groupName, breaker) {
    if (!this.groups.has(groupName)) {
      this.groups.set(groupName, new Set());
    }
    
    this.groups.get(groupName).add(breaker.name);
  }
  
  /**
   * حذف مدار از گروه
   * @param {string} groupName - نام گروه
   * @param {string} breakerName - نام مدار
   */
  removeFromGroup(groupName, breakerName) {
    if (this.groups.has(groupName)) {
      this.groups.get(groupName).delete(breakerName);
      
      // حذف گروه در صورت خالی بودن
      if (this.groups.get(groupName).size === 0) {
        this.groups.delete(groupName);
      }
    }
  }
  
  /**
   * دریافت همه مدارهای یک گروه
   * @param {string} groupName - نام گروه
   * @returns {Array<CircuitBreaker>} - مدارهای گروه
   */
  getGroupBreakers(groupName) {
    if (!this.groups.has(groupName)) {
      return [];
    }
    
    return Array.from(this.groups.get(groupName))
      .map(name => this.breakers.get(name))
      .filter(breaker => breaker !== undefined);
  }
  
  /**
   * تنظیم وضعیت همه مدارهای یک گروه
   * @param {string} groupName - نام گروه
   * @param {string} state - وضعیت جدید
   */
  setGroupState(groupName, state) {
    const breakers = this.getGroupBreakers(groupName);
    
    breakers.forEach(breaker => {
      breaker.setState(state);
    });
  }
  
  /**
   * تنظیم گزینه‌های همه مدارهای یک گروه
   * @param {string} groupName - نام گروه
   * @param {Object} options - گزینه‌های جدید
   */
  setGroupOptions(groupName, options) {
    const breakers = this.getGroupBreakers(groupName);
    
    breakers.forEach(breaker => {
      breaker.setOptions(options);
    });
  }
  
  /**
   * فعال یا غیرفعال کردن همه مدارهای یک گروه
   * @param {string} groupName - نام گروه
   * @param {boolean} enabled - وضعیت فعال بودن
   */
  setGroupEnabled(groupName, enabled) {
    const breakers = this.getGroupBreakers(groupName);
    
    breakers.forEach(breaker => {
      breaker.setEnabled(enabled);
    });
  }
  
  /**
   * حذف یک مدار
   * @param {string} name - نام مدار
   */
  removeBreaker(name) {
    if (this.breakers.has(name)) {
      const breaker = this.breakers.get(name);
      
      // حذف از همه گروه‌ها
      for (const [groupName, breakerNames] of this.groups.entries()) {
        if (breakerNames.has(name)) {
          this.removeFromGroup(groupName, name);
        }
      }
      
      // پاکسازی منابع
      breaker.close();
      
      // حذف از مجموعه مدارها
      this.breakers.delete(name);
    }
  }
  
  /**
   * دریافت وضعیت همه مدارها
   * @returns {Object} - وضعیت مدارها
   */
  getStats() {
    const stats = {
      breakers: {},
      groups: {},
      summary: {
        total: this.breakers.size,
        open: 0,
        closed: 0,
        halfOpen: 0,
        disabled: 0
      }
    };
    
    // جمع‌آوری آمار مدارها
    for (const [name, breaker] of this.breakers.entries()) {
      stats.breakers[name] = breaker.getState();
      
      // به‌روزرسانی خلاصه
      if (!breaker.options.enabled) {
        stats.summary.disabled++;
      } else if (breaker.state === CIRCUIT_STATE.OPEN) {
        stats.summary.open++;
      } else if (breaker.state === CIRCUIT_STATE.CLOSED) {
        stats.summary.closed++;
      } else if (breaker.state === CIRCUIT_STATE.HALF_OPEN) {
        stats.summary.halfOpen++;
      }
    }
    
    // جمع‌آوری آمار گروه‌ها
    for (const [groupName, breakerNames] of this.groups.entries()) {
      stats.groups[groupName] = {
        breakers: Array.from(breakerNames),
        count: breakerNames.size,
        states: {
          open: 0,
          closed: 0,
          halfOpen: 0,
          disabled: 0
        }
      };
      
      // محاسبه وضعیت‌ها در گروه
      for (const breakerName of breakerNames) {
        const breaker = this.breakers.get(breakerName);
        
        if (breaker) {
          if (!breaker.options.enabled) {
            stats.groups[groupName].states.disabled++;
          } else if (breaker.state === CIRCUIT_STATE.OPEN) {
            stats.groups[groupName].states.open++;
          } else if (breaker.state === CIRCUIT_STATE.CLOSED) {
            stats.groups[groupName].states.closed++;
          } else if (breaker.state === CIRCUIT_STATE.HALF_OPEN) {
            stats.groups[groupName].states.halfOpen++;
          }
        }
      }
    }
    
    return stats;
  }
  
  /**
   * تنظیم گزینه‌های پیش‌فرض
   * @param {Object} options - گزینه‌های پیش‌فرض جدید
   */
  setDefaultOptions(options) {
    this.defaultOptions = {
      ...this.defaultOptions,
      ...options
    };
  }
  
  /**
   * بازنشانی همه مدارها
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.setState(CIRCUIT_STATE.CLOSED);
      breaker.resetStats();
    }
  }
  
  /**
   * پاکسازی منابع هنگام خروج
   */
  close() {
    for (const breaker of this.breakers.values()) {
      breaker.close();
    }
    
    this.breakers.clear();
    this.groups.clear();
  }
}

module.exports = new CircuitBreakerManager();
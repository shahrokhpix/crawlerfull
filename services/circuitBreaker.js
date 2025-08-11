const EventEmitter = require('events');
const logger = require('../utils/logger');

class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.setMaxListeners(50); // افزایش حد مجاز listener ها
    
    // تنظیمات پیش‌فرض
    this.options = {
      failureThreshold: 5, // تعداد خطاهای متوالی برای باز کردن مدار
      successThreshold: 3, // تعداد موفقیت‌های متوالی برای بستن مدار
      timeout: 60000, // زمان انتظار در حالت نیمه‌باز (1 دقیقه)
      resetTimeout: 300000, // زمان ریست خودکار (5 دقیقه)
      monitoringPeriod: 60000, // دوره مانیتورینگ (1 دقیقه)
      errorThresholdPercentage: 50, // درصد خطا برای باز کردن مدار
      minimumRequests: 10, // حداقل درخواست برای فعال‌سازی circuit breaker
      ...options
    };
    
    // وضعیت‌های مدار
    this.states = {
      CLOSED: 'CLOSED', // مدار بسته - درخواست‌ها عادی پردازش می‌شوند
      OPEN: 'OPEN', // مدار باز - همه درخواست‌ها رد می‌شوند
      HALF_OPEN: 'HALF_OPEN' // مدار نیمه‌باز - تست محدود درخواست‌ها
    };
    
    // وضعیت فعلی
    this.state = this.states.CLOSED;
    
    // آمارها
    this.stats = {
      requests: 0,
      failures: 0,
      successes: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      lastStateChange: Date.now()
    };
    
    // تایمرها
    this.resetTimer = null;
    this.monitoringTimer = null;
    
    // شروع مانیتورینگ
    this.startMonitoring();
  }

  // شروع مانیتورینگ دوره‌ای
  startMonitoring() {
    this.monitoringTimer = setInterval(() => {
      this.checkCircuitHealth();
    }, this.options.monitoringPeriod);
    
    logger.info('Circuit breaker monitoring شروع شد');
  }

  // بررسی سلامت مدار
  checkCircuitHealth() {
    const now = Date.now();
    const timeSinceLastStateChange = now - this.stats.lastStateChange;
    
    // بررسی نیاز به ریست خودکار
    if (this.state === this.states.OPEN && timeSinceLastStateChange >= this.options.resetTimeout) {
      this.halfOpen();
    }
    
    // بررسی درصد خطا
    if (this.state === this.states.CLOSED && this.stats.requests >= this.options.minimumRequests) {
      const errorRate = (this.stats.failures / this.stats.requests) * 100;
      
      if (errorRate >= this.options.errorThresholdPercentage) {
        logger.warn(`نرخ خطا بالا: ${errorRate.toFixed(2)}% - باز کردن مدار`);
        this.open();
      }
    }
    
    // لاگ آمار
    this.logStats();
  }

  // اجرای درخواست با circuit breaker
  async execute(operation, fallback = null) {
    // بررسی وضعیت مدار
    if (this.state === this.states.OPEN) {
      const error = new Error('Circuit breaker is OPEN');
      error.code = 'CIRCUIT_OPEN';
      
      if (fallback) {
        logger.info('اجرای fallback به دلیل مدار باز');
        return await this.executeFallback(fallback);
      }
      
      throw error;
    }
    
    if (this.state === this.states.HALF_OPEN) {
      // در حالت نیمه‌باز، فقط یک درخواست در هر زمان مجاز است
      if (this.stats.consecutiveSuccesses >= this.options.successThreshold) {
        this.close();
      }
    }
    
    const startTime = Date.now();
    
    try {
      // اجرای عملیات
      const result = await operation();
      
      // ثبت موفقیت
      this.onSuccess(Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      // ثبت شکست
      this.onFailure(error, Date.now() - startTime);
      
      // اجرای fallback در صورت وجود
      if (fallback) {
        logger.info('اجرای fallback به دلیل خطا در عملیات اصلی');
        return await this.executeFallback(fallback);
      }
      
      throw error;
    }
  }

  // اجرای fallback
  async executeFallback(fallback) {
    try {
      if (typeof fallback === 'function') {
        return await fallback();
      } else {
        return fallback;
      }
    } catch (fallbackError) {
      logger.error('خطا در اجرای fallback:', fallbackError);
      throw fallbackError;
    }
  }

  // ثبت موفقیت
  onSuccess(duration) {
    this.stats.requests++;
    this.stats.successes++;
    this.stats.consecutiveSuccesses++;
    this.stats.consecutiveFailures = 0;
    this.stats.lastSuccessTime = Date.now();
    
    this.emit('success', {
      duration,
      state: this.state,
      stats: { ...this.stats }
    });
    
    // بررسی امکان بستن مدار در حالت نیمه‌باز
    if (this.state === this.states.HALF_OPEN && 
        this.stats.consecutiveSuccesses >= this.options.successThreshold) {
      this.close();
    }
    
    logger.debug(`Circuit breaker success - State: ${this.state}, Consecutive: ${this.stats.consecutiveSuccesses}`);
  }

  // ثبت شکست
  onFailure(error, duration) {
    this.stats.requests++;
    this.stats.failures++;
    this.stats.consecutiveFailures++;
    this.stats.consecutiveSuccesses = 0;
    this.stats.lastFailureTime = Date.now();
    
    this.emit('failure', {
      error,
      duration,
      state: this.state,
      stats: { ...this.stats }
    });
    
    // بررسی نیاز به باز کردن مدار
    if (this.state === this.states.CLOSED && 
        this.stats.consecutiveFailures >= this.options.failureThreshold) {
      this.open();
    } else if (this.state === this.states.HALF_OPEN) {
      // در حالت نیمه‌باز، هر خطا باعث باز شدن مدار می‌شود
      this.open();
    }
    
    logger.debug(`Circuit breaker failure - State: ${this.state}, Consecutive: ${this.stats.consecutiveFailures}`);
  }

  // باز کردن مدار
  open() {
    if (this.state !== this.states.OPEN) {
      this.state = this.states.OPEN;
      this.stats.lastStateChange = Date.now();
      
      // تنظیم تایمر برای حالت نیمه‌باز
      this.scheduleHalfOpen();
      
      this.emit('stateChange', {
        from: this.state,
        to: this.states.OPEN,
        reason: 'failure_threshold_exceeded',
        stats: { ...this.stats }
      });
      
      logger.warn(`Circuit breaker OPENED - Consecutive failures: ${this.stats.consecutiveFailures}`);
    }
  }

  // نیمه‌باز کردن مدار
  halfOpen() {
    if (this.state !== this.states.HALF_OPEN) {
      const previousState = this.state;
      this.state = this.states.HALF_OPEN;
      this.stats.lastStateChange = Date.now();
      this.stats.consecutiveSuccesses = 0;
      this.stats.consecutiveFailures = 0;
      
      // پاک کردن تایمر قبلی
      if (this.resetTimer) {
        clearTimeout(this.resetTimer);
        this.resetTimer = null;
      }
      
      this.emit('stateChange', {
        from: previousState,
        to: this.states.HALF_OPEN,
        reason: 'timeout_reached',
        stats: { ...this.stats }
      });
      
      logger.info('Circuit breaker HALF-OPEN - Testing requests');
    }
  }

  // بستن مدار
  close() {
    if (this.state !== this.states.CLOSED) {
      const previousState = this.state;
      this.state = this.states.CLOSED;
      this.stats.lastStateChange = Date.now();
      
      // ریست آمار
      this.resetStats();
      
      this.emit('stateChange', {
        from: previousState,
        to: this.states.CLOSED,
        reason: 'success_threshold_reached',
        stats: { ...this.stats }
      });
      
      logger.info('Circuit breaker CLOSED - Normal operation resumed');
    }
  }

  // برنامه‌ریزی حالت نیمه‌باز
  scheduleHalfOpen() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    
    this.resetTimer = setTimeout(() => {
      this.halfOpen();
    }, this.options.timeout);
  }

  // ریست آمار
  resetStats() {
    this.stats.requests = 0;
    this.stats.failures = 0;
    this.stats.successes = 0;
    this.stats.consecutiveFailures = 0;
    this.stats.consecutiveSuccesses = 0;
  }

  // دریافت وضعیت فعلی
  getState() {
    return {
      state: this.state,
      stats: { ...this.stats },
      options: { ...this.options },
      isOpen: this.state === this.states.OPEN,
      isClosed: this.state === this.states.CLOSED,
      isHalfOpen: this.state === this.states.HALF_OPEN
    };
  }

  // دریافت آمار
  getStats() {
    const now = Date.now();
    const uptime = now - this.stats.lastStateChange;
    const errorRate = this.stats.requests > 0 ? (this.stats.failures / this.stats.requests) * 100 : 0;
    const successRate = this.stats.requests > 0 ? (this.stats.successes / this.stats.requests) * 100 : 0;
    
    return {
      state: this.state,
      uptime,
      requests: this.stats.requests,
      failures: this.stats.failures,
      successes: this.stats.successes,
      errorRate: parseFloat(errorRate.toFixed(2)),
      successRate: parseFloat(successRate.toFixed(2)),
      consecutiveFailures: this.stats.consecutiveFailures,
      consecutiveSuccesses: this.stats.consecutiveSuccesses,
      lastFailureTime: this.stats.lastFailureTime,
      lastSuccessTime: this.stats.lastSuccessTime,
      lastStateChange: this.stats.lastStateChange
    };
  }

  // لاگ آمار
  logStats() {
    const stats = this.getStats();
    
    logger.info('Circuit Breaker Stats:', {
      state: stats.state,
      requests: stats.requests,
      errorRate: `${stats.errorRate}%`,
      successRate: `${stats.successRate}%`,
      consecutiveFailures: stats.consecutiveFailures,
      uptime: `${Math.round(stats.uptime / 1000)}s`
    });
  }

  // اجبار باز کردن مدار
  forceOpen() {
    this.open();
    logger.warn('Circuit breaker اجباری باز شد');
  }

  // اجبار بستن مدار
  forceClose() {
    this.close();
    logger.info('Circuit breaker اجباری بسته شد');
  }

  // ریست کامل
  reset() {
    this.state = this.states.CLOSED;
    this.resetStats();
    this.stats.lastStateChange = Date.now();
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    
    this.emit('reset');
    logger.info('Circuit breaker ریست شد');
  }

  // تخریب کننده
  destroy() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    this.removeAllListeners();
    logger.info('Circuit breaker تخریب شد');
  }
}

// کلاس مدیریت چندین circuit breaker
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
    this.defaultOptions = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000,
      resetTimeout: 300000,
      errorThresholdPercentage: 50,
      minimumRequests: 10
    };
  }

  // ایجاد یا دریافت circuit breaker
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      const breakerOptions = { ...this.defaultOptions, ...options };
      const breaker = new CircuitBreaker(breakerOptions);
      
      // Event listeners
      breaker.on('stateChange', (data) => {
        logger.info(`Circuit breaker '${name}' state changed: ${data.from} -> ${data.to}`);
      });
      
      this.breakers.set(name, breaker);
      logger.info(`Circuit breaker '${name}' ایجاد شد`);
    }
    
    return this.breakers.get(name);
  }

  // حذف circuit breaker
  removeBreaker(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.destroy();
      this.breakers.delete(name);
      logger.info(`Circuit breaker '${name}' حذف شد`);
      return true;
    }
    return false;
  }

  // دریافت آمار همه circuit breakerها
  getAllStats() {
    const stats = {};
    
    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = breaker.getStats();
    }
    
    return stats;
  }

  // ریست همه circuit breakerها
  resetAll() {
    for (const [name, breaker] of this.breakers.entries()) {
      breaker.reset();
    }
    
    logger.info('همه circuit breakerها ریست شدند');
  }

  // تخریب همه circuit breakerها
  destroyAll() {
    for (const [name, breaker] of this.breakers.entries()) {
      breaker.destroy();
    }
    
    this.breakers.clear();
    logger.info('همه circuit breakerها تخریب شدند');
  }
}

// Singleton instance
const circuitBreakerManager = new CircuitBreakerManager();

module.exports = {
  CircuitBreaker,
  CircuitBreakerManager,
  circuitBreakerManager
};
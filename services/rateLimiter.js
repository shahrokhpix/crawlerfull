const EventEmitter = require('events');
const logger = require('../utils/logger');

class RateLimiter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // افزایش حد مجاز listener ها
    this.limits = new Map(); // domain -> limit config
    this.requests = new Map(); // domain -> request history
    this.delays = new Map(); // domain -> current delay
    this.blocked = new Set(); // blocked domains
    
    // تنظیمات پیش‌فرض
    this.defaultConfig = {
      maxRequests: 10, // حداکثر درخواست
      windowMs: 60000, // در 1 دقیقه
      minDelay: 1000, // حداقل تاخیر بین درخواست‌ها (1 ثانیه)
      maxDelay: 30000, // حداکثر تاخیر (30 ثانیه)
      backoffMultiplier: 1.5, // ضریب افزایش تاخیر
      resetOnSuccess: true, // ریست تاخیر در صورت موفقیت
      blockDuration: 5 * 60 * 1000 // مدت زمان مسدودی (5 دقیقه)
    };
    
    // پاکسازی دوره‌ای
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // هر دقیقه
  }

  // تنظیم محدودیت برای دامنه
  setLimit(domain, config = {}) {
    const limitConfig = { ...this.defaultConfig, ...config };
    this.limits.set(domain, limitConfig);
    
    logger.info(`محدودیت نرخ تنظیم شد برای ${domain}:`, limitConfig);
    this.emit('limitSet', { domain, config: limitConfig });
  }

  // دریافت تنظیمات محدودیت
  getLimit(domain) {
    return this.limits.get(domain) || this.defaultConfig;
  }

  // بررسی امکان درخواست
  async canMakeRequest(domain) {
    // بررسی مسدودی
    if (this.blocked.has(domain)) {
      const blockInfo = this.blocked.get(domain);
      if (Date.now() < blockInfo.until) {
        return {
          allowed: false,
          reason: 'blocked',
          waitTime: blockInfo.until - Date.now()
        };
      } else {
        this.unblock(domain);
      }
    }
    
    const config = this.getLimit(domain);
    const now = Date.now();
    
    // دریافت تاریخچه درخواست‌ها
    if (!this.requests.has(domain)) {
      this.requests.set(domain, []);
    }
    
    const requests = this.requests.get(domain);
    
    // پاک کردن درخواست‌های قدیمی
    const windowStart = now - config.windowMs;
    const recentRequests = requests.filter(time => time > windowStart);
    this.requests.set(domain, recentRequests);
    
    // بررسی تعداد درخواست‌ها
    if (recentRequests.length >= config.maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const waitTime = (oldestRequest + config.windowMs) - now;
      
      return {
        allowed: false,
        reason: 'rate_limit',
        waitTime: Math.max(0, waitTime)
      };
    }
    
    // بررسی تاخیر مورد نیاز
    const currentDelay = this.delays.get(domain) || config.minDelay;
    const lastRequest = recentRequests.length > 0 ? Math.max(...recentRequests) : 0;
    const timeSinceLastRequest = now - lastRequest;
    
    if (timeSinceLastRequest < currentDelay) {
      return {
        allowed: false,
        reason: 'delay',
        waitTime: currentDelay - timeSinceLastRequest
      };
    }
    
    return { allowed: true };
  }

  // ثبت درخواست موفق
  async recordRequest(domain) {
    const now = Date.now();
    
    if (!this.requests.has(domain)) {
      this.requests.set(domain, []);
    }
    
    const requests = this.requests.get(domain);
    requests.push(now);
    
    const config = this.getLimit(domain);
    
    // ریست تاخیر در صورت موفقیت
    if (config.resetOnSuccess) {
      this.delays.set(domain, config.minDelay);
    }
    
    this.emit('requestRecorded', { domain, timestamp: now });
    
    logger.info(`درخواست ثبت شد برای ${domain}`);
  }

  // ثبت درخواست ناموفق
  async recordFailure(domain, errorType = 'unknown') {
    const config = this.getLimit(domain);
    const currentDelay = this.delays.get(domain) || config.minDelay;
    
    // افزایش تاخیر
    const newDelay = Math.min(
      currentDelay * config.backoffMultiplier,
      config.maxDelay
    );
    
    this.delays.set(domain, newDelay);
    
    this.emit('requestFailed', { 
      domain, 
      errorType, 
      oldDelay: currentDelay, 
      newDelay 
    });
    
    logger.warn(`درخواست ناموفق برای ${domain}. تاخیر افزایش یافت به ${newDelay}ms`);
    
    // مسدود کردن در صورت خطاهای خاص
    if (this.shouldBlock(errorType)) {
      this.block(domain, config.blockDuration);
    }
  }

  // بررسی نیاز به مسدودی
  shouldBlock(errorType) {
    const blockableErrors = [
      'too_many_requests',
      'server_error',
      'forbidden',
      'timeout'
    ];
    
    return blockableErrors.includes(errorType);
  }

  // مسدود کردن دامنه
  block(domain, duration = null) {
    const config = this.getLimit(domain);
    const blockDuration = duration || config.blockDuration;
    const until = Date.now() + blockDuration;
    
    this.blocked.set(domain, { until, duration: blockDuration });
    
    this.emit('domainBlocked', { domain, until, duration: blockDuration });
    
    logger.warn(`دامنه ${domain} مسدود شد تا ${new Date(until).toISOString()}`);
  }

  // رفع مسدودی
  unblock(domain) {
    const wasBlocked = this.blocked.delete(domain);
    
    if (wasBlocked) {
      this.emit('domainUnblocked', { domain });
      logger.info(`مسدودی دامنه ${domain} رفع شد`);
    }
    
    return wasBlocked;
  }

  // انتظار تا امکان درخواست
  async waitForRequest(domain) {
    const check = await this.canMakeRequest(domain);
    
    if (check.allowed) {
      return true;
    }
    
    logger.info(`انتظار ${check.waitTime}ms برای ${domain} (دلیل: ${check.reason})`);
    
    await this.sleep(check.waitTime);
    
    // بررسی مجدد
    return this.waitForRequest(domain);
  }

  // تابع کمکی برای sleep
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // اجرای درخواست با rate limiting
  async executeRequest(domain, requestFn, maxRetries = 3) {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        // انتظار تا امکان درخواست
        await this.waitForRequest(domain);
        
        // اجرای درخواست
        const result = await requestFn();
        
        // ثبت موفقیت
        await this.recordRequest(domain);
        
        return result;
        
      } catch (error) {
        retries++;
        
        // تشخیص نوع خطا
        const errorType = this.classifyError(error);
        
        // ثبت شکست
        await this.recordFailure(domain, errorType);
        
        if (retries >= maxRetries) {
          throw error;
        }
        
        logger.warn(`تلاش مجدد ${retries}/${maxRetries} برای ${domain}`);
      }
    }
  }

  // طبقه‌بندی خطا
  classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('429') || message.includes('too many requests')) {
      return 'too_many_requests';
    }
    
    if (message.includes('403') || message.includes('forbidden')) {
      return 'forbidden';
    }
    
    if (message.includes('timeout')) {
      return 'timeout';
    }
    
    if (message.includes('5') && message.includes('server')) {
      return 'server_error';
    }
    
    return 'unknown';
  }

  // پاکسازی داده‌های قدیمی
  cleanup() {
    const now = Date.now();
    let cleanedDomains = 0;
    
    // پاک کردن درخواست‌های قدیمی
    for (const [domain, requests] of this.requests.entries()) {
      const config = this.getLimit(domain);
      const windowStart = now - config.windowMs;
      const recentRequests = requests.filter(time => time > windowStart);
      
      if (recentRequests.length !== requests.length) {
        this.requests.set(domain, recentRequests);
        cleanedDomains++;
      }
      
      // حذف دامنه‌های بدون درخواست اخیر
      if (recentRequests.length === 0) {
        this.requests.delete(domain);
        this.delays.delete(domain);
      }
    }
    
    // رفع مسدودی‌های منقضی
    for (const [domain, blockInfo] of this.blocked.entries()) {
      if (now >= blockInfo.until) {
        this.unblock(domain);
      }
    }
    
    if (cleanedDomains > 0) {
      logger.info(`پاکسازی rate limiter: ${cleanedDomains} دامنه`);
    }
  }

  // دریافت آمار
  getStats() {
    const stats = {
      totalDomains: this.limits.size,
      activeDomains: this.requests.size,
      blockedDomains: this.blocked.size,
      domains: {}
    };
    
    for (const [domain, requests] of this.requests.entries()) {
      const config = this.getLimit(domain);
      const now = Date.now();
      const windowStart = now - config.windowMs;
      const recentRequests = requests.filter(time => time > windowStart);
      
      stats.domains[domain] = {
        recentRequests: recentRequests.length,
        maxRequests: config.maxRequests,
        currentDelay: this.delays.get(domain) || config.minDelay,
        isBlocked: this.blocked.has(domain)
      };
    }
    
    return stats;
  }

  // ریست همه محدودیت‌ها
  reset() {
    this.requests.clear();
    this.delays.clear();
    this.blocked.clear();
    
    logger.info('همه محدودیت‌های نرخ ریست شدند');
    this.emit('reset');
  }

  // تخریب کننده
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.reset();
    this.removeAllListeners();
    
    logger.info('Rate limiter تخریب شد');
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

module.exports = rateLimiter;
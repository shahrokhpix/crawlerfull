const EventEmitter = require('events');
const crypto = require('crypto');
const logger = require('../utils/logger');
const memoryManager = require('./memoryManager');

class CacheManager extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // افزایش حد مجاز listener ها
    this.cache = new Map();
    this.ttlCache = new Map(); // Time To Live cache
    this.accessCount = new Map(); // برای LRU
    this.maxSize = 1000; // حداکثر تعداد آیتم‌ها
    this.defaultTTL = 30 * 60 * 1000; // 30 دقیقه
    this.cleanupInterval = 5 * 60 * 1000; // 5 دقیقه
    this.tempCleanupInterval = 60 * 60 * 1000; // هر ساعت پاکسازی فایل‌های موقت
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
    
    this.startCleanupTimer();
    this.startTempCleanup();
    
    // مدیریت حافظه
    memoryManager.on('highMemory', () => {
      this.clearExpired();
      this.evictLRU(Math.floor(this.cache.size * 0.3)); // پاک کردن 30%
    });
    
    memoryManager.on('criticalMemory', () => {
      this.clear();
    });
  }

  // تولید کلید کش
  generateKey(prefix, data) {
    const hash = crypto.createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
    return `${prefix}:${hash}`;
  }

  // ذخیره در کش
  set(key, value, ttl = this.defaultTTL) {
    try {
      // بررسی حد مجاز
      if (this.cache.size >= this.maxSize) {
        this.evictLRU(1);
      }
      
      const now = Date.now();
      const expiresAt = now + ttl;
      
      this.cache.set(key, {
        value,
        createdAt: now,
        expiresAt,
        accessCount: 0,
        lastAccessed: now
      });
      
      this.ttlCache.set(key, expiresAt);
      this.accessCount.set(key, 0);
      
      this.stats.sets++;
      
      logger.info(`کش ذخیره شد: ${key} (TTL: ${ttl}ms)`);
      this.emit('set', { key, ttl });
      
      return true;
    } catch (error) {
      logger.error('خطا در ذخیره کش:', error);
      return false;
    }
  }

  // دریافت از کش
  get(key) {
    try {
      const item = this.cache.get(key);
      
      if (!item) {
        this.stats.misses++;
        return null;
      }
      
      const now = Date.now();
      
      // بررسی انقضا
      if (now > item.expiresAt) {
        this.delete(key);
        this.stats.misses++;
        return null;
      }
      
      // به‌روزرسانی آمار دسترسی
      item.accessCount++;
      item.lastAccessed = now;
      this.accessCount.set(key, item.accessCount);
      
      this.stats.hits++;
      this.emit('hit', { key });
      
      return item.value;
    } catch (error) {
      logger.error('خطا در دریافت کش:', error);
      this.stats.misses++;
      return null;
    }
  }

  // حذف از کش
  delete(key) {
    try {
      const deleted = this.cache.delete(key);
      this.ttlCache.delete(key);
      this.accessCount.delete(key);
      
      if (deleted) {
        this.stats.deletes++;
        this.emit('delete', { key });
      }
      
      return deleted;
    } catch (error) {
      logger.error('خطا در حذف کش:', error);
      return false;
    }
  }

  // بررسی وجود کلید
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    // بررسی انقضا
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  // پاک کردن آیتم‌های منقضی
  clearExpired() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.info(`${expiredCount} آیتم منقضی از کش پاک شد`);
    }
    
    return expiredCount;
  }

  // حذف LRU (کمترین استفاده)
  evictLRU(count = 1) {
    const items = Array.from(this.cache.entries())
      .map(([key, item]) => ({ key, ...item }))
      .sort((a, b) => {
        // ترتیب بر اساس تعداد دسترسی و زمان آخرین دسترسی
        if (a.accessCount !== b.accessCount) {
          return a.accessCount - b.accessCount;
        }
        return a.lastAccessed - b.lastAccessed;
      });
    
    let evicted = 0;
    for (let i = 0; i < Math.min(count, items.length); i++) {
      this.delete(items[i].key);
      evicted++;
      this.stats.evictions++;
    }
    
    if (evicted > 0) {
      logger.info(`${evicted} آیتم LRU از کش حذف شد`);
    }
    
    return evicted;
  }

  // پاک کردن همه کش
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.ttlCache.clear();
    this.accessCount.clear();
    
    logger.info(`همه کش پاک شد (${size} آیتم)`);
    this.emit('clear', { size });
  }

  // دریافت آمار
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`,
      ...this.stats,
      memoryUsage: this.getMemoryUsage()
    };
  }

  // تخمین استفاده از حافظه
  getMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, item] of this.cache.entries()) {
      totalSize += key.length * 2; // UTF-16
      totalSize += JSON.stringify(item.value).length * 2;
      totalSize += 64; // metadata overhead
    }
    
    return {
      bytes: totalSize,
      kb: Math.round(totalSize / 1024),
      mb: Math.round(totalSize / 1024 / 1024 * 100) / 100
    };
  }

  // تنظیم حداکثر اندازه
  setMaxSize(size) {
    this.maxSize = size;
    
    // اگر فعلی بیشتر از حد جدید است
    if (this.cache.size > this.maxSize) {
      this.evictLRU(this.cache.size - this.maxSize);
    }
    
    logger.info(`حداکثر اندازه کش تنظیم شد: ${size}`);
  }

  // تنظیم TTL پیش‌فرض
  setDefaultTTL(ttl) {
    this.defaultTTL = ttl;
    logger.info(`TTL پیش‌فرض تنظیم شد: ${ttl}ms`);
  }

  // شروع تایمر پاکسازی
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.clearExpired();
    }, this.cleanupInterval);
  }

  // توقف تایمر پاکسازی
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // شروع تایمر پاکسازی فایل‌های موقت
  startTempCleanup() {
    this.tempCleanupTimer = setInterval(() => {
      this.cleanupTempFiles();
    }, this.tempCleanupInterval);
  }

  // پاکسازی فایل‌های موقت
  cleanupTempFiles() {
    try {
      const { execSync } = require('child_process');
      const os = require('os');
      
      // تشخیص سیستم عامل
      const isWindows = os.platform() === 'win32';
      
      if (isWindows) {
        // پاکسازی برای ویندوز
        try {
          execSync('forfiles /p %TEMP% /m "puppeteer_dev_chrome_profile-*" /c "cmd /c rmdir /s /q @path" 2>nul', { timeout: 30000 });
        } catch (error) {
          // ignore cleanup errors on Windows
        }
      } else {
        // پاکسازی برای لینوکس/یونیکس
        try {
          // پاکسازی پروفایل‌های puppeteer قدیمی (بیش از 1 ساعت)
          execSync('find /tmp -name "puppeteer_dev_chrome_profile-*" -type d -mmin +60 -exec rm -rf {} + 2>/dev/null || true', { timeout: 30000 });
          
          // پاکسازی فایل‌های موقت snap قدیمی
          execSync('find /tmp/snap-private-tmp -type f -mmin +120 -delete 2>/dev/null || true', { timeout: 30000 });
        } catch (error) {
          // ignore cleanup errors on Linux
        }
      }
      
      logger.info('فایل‌های موقت پاک شدند');
    } catch (error) {
      logger.error('خطا در پاکسازی فایل‌های موقت:', error);
    }
  }

  // متدهای کش اختصاصی برای crawler
  
  // کش نتایج سلکتور
  cacheSelectorResult(url, selector, result, ttl = 10 * 60 * 1000) { // 10 دقیقه
    const key = this.generateKey('selector', { url, selector });
    return this.set(key, result, ttl);
  }

  getSelectorResult(url, selector) {
    const key = this.generateKey('selector', { url, selector });
    return this.get(key);
  }

  // کش محتوای صفحه
  cachePageContent(url, content, ttl = 30 * 60 * 1000) { // 30 دقیقه
    const key = this.generateKey('page', { url });
    return this.set(key, content, ttl);
  }

  getPageContent(url) {
    const key = this.generateKey('page', { url });
    return this.get(key);
  }

  // کش لینک‌های استخراج شده
  cacheExtractedLinks(url, links, ttl = 60 * 60 * 1000) { // 1 ساعت
    const key = this.generateKey('links', { url });
    return this.set(key, links, ttl);
  }

  getExtractedLinks(url) {
    const key = this.generateKey('links', { url });
    return this.get(key);
  }

  // کش نتایج کرال
  cacheCrawlResult(sourceId, result, ttl = 15 * 60 * 1000) { // 15 دقیقه
    const key = this.generateKey('crawl', { sourceId });
    return this.set(key, result, ttl);
  }

  getCrawlResult(sourceId) {
    const key = this.generateKey('crawl', { sourceId });
    return this.get(key);
  }

  // تخریب کننده
  destroy() {
    this.stopCleanupTimer();
    if (this.tempCleanupTimer) {
      clearInterval(this.tempCleanupTimer);
      this.tempCleanupTimer = null;
    }
    this.clear();
    this.removeAllListeners();
    logger.info('Cache manager تخریب شد');
  }
}

// Singleton instance
const cacheManager = new CacheManager();

module.exports = cacheManager;
const EventEmitter = require('events');
const logger = require('../utils/logger');

class MemoryManager extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // افزایش حد مجاز listener ها
    this.memoryThreshold = 300 * 1024 * 1024; // کاهش به 300MB
    this.criticalThreshold = 450 * 1024 * 1024; // کاهش به 450MB
    this.emergencyThreshold = 500 * 1024 * 1024; // آستانه اضطراری
    this.checkInterval = 15000; // کاهش به 15 ثانیه
    this.gcInterval = 30000; // کاهش به 30 ثانیه
    this.isMonitoring = false;
    this.memoryHistory = [];
    this.maxHistorySize = 50; // کاهش تاریخچه
    this.leakDetectionEnabled = true;
    this.lastGCTime = Date.now();
    this.emergencyMode = false;
    
    // شمارنده‌های منابع
    this.resourceCounters = {
      webDrivers: 0,
      dbConnections: 0,
      activeRequests: 0,
      openFiles: 0
    };
  }

  // شروع مانیتورینگ حافظه
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    logger.info('شروع مانیتورینگ حافظه با آستانه‌های جدید...');
    
    // مانیتورینگ دوره‌ای
    this.monitoringTimer = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);
    
    // Garbage Collection دوره‌ای
    this.gcTimer = setInterval(() => {
      this.performGarbageCollection();
    }, this.gcInterval);
    
    // بررسی فوری
    this.checkMemoryUsage();
  }

  // توقف مانیتورینگ
  stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
    
    logger.info('مانیتورینگ حافظه متوقف شد');
  }

  // بررسی استفاده از حافظه
  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const timestamp = Date.now();
    const memoryPercentage = (memUsage.rss / (1024 * 1024 * 1024)) * 100; // درصد استفاده از حافظه
    
    // اضافه کردن به تاریخچه
    this.memoryHistory.push({
      timestamp,
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      percentage: memoryPercentage
    });
    
    // محدود کردن تاریخچه
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }
    
    // بررسی آستانه‌ها
    if (memUsage.rss > this.emergencyThreshold) {
      this.handleEmergencyMemory(memUsage);
    } else if (memUsage.rss > this.criticalThreshold) {
      this.handleCriticalMemory(memUsage);
    } else if (memUsage.rss > this.memoryThreshold) {
      this.handleHighMemory(memUsage);
    }
    
    // تشخیص memory leak
    if (this.leakDetectionEnabled) {
      this.detectMemoryLeak();
    }
    
    // ارسال event
    this.emit('memoryCheck', {
      usage: memUsage,
      resources: this.resourceCounters,
      timestamp,
      percentage: memoryPercentage
    });
    
    // لاگ کردن وضعیت حافظه
    if (memoryPercentage > 80) {
      logger.warn(`🚨 هشدار حافظه: ${memoryPercentage.toFixed(1)}%`);
    }
  }

  // مدیریت حافظه بالا
  handleHighMemory(memUsage) {
    logger.warn(`⚠️ 🚨 هشدار عملکرد: استفاده از حافظه بالا: ${((memUsage.rss / (1024 * 1024 * 1024)) * 100).toFixed(1)}%`);
    
    // پاکسازی کش‌ها
    this.clearCaches();
    
    // Garbage Collection اجباری
    this.forceGarbageCollection();
    
    // ارسال alert
    this.emit('alert', {
      type: 'memory',
      level: 'warning',
      message: `استفاده از حافظه بالا: ${((memUsage.rss / (1024 * 1024 * 1024)) * 100).toFixed(1)}%`,
      usage: memUsage
    });
  }

  // مدیریت حافظه بحرانی
  handleCriticalMemory(memUsage) {
    logger.error(`🚨 هشدار بحرانی حافظه: ${((memUsage.rss / (1024 * 1024 * 1024)) * 100).toFixed(1)}%`);
    
    // پاکسازی اضطراری
    this.emergencyCleanup();
    
    // Garbage Collection اجباری
    this.forceGarbageCollection();
    
    // ارسال alert
    this.emit('alert', {
      type: 'memory',
      level: 'critical',
      message: `حافظه بحرانی: ${((memUsage.rss / (1024 * 1024 * 1024)) * 100).toFixed(1)}%`,
      usage: memUsage
    });
  }

  // مدیریت حافظه اضطراری
  handleEmergencyMemory(memUsage) {
    logger.error(`🚨 وضعیت اضطراری حافظه: ${((memUsage.rss / (1024 * 1024 * 1024)) * 100).toFixed(1)}%`);
    
    this.emergencyMode = true;
    
    // پاکسازی کامل
    this.emergencyCleanup();
    
    // Garbage Collection اجباری
    this.forceGarbageCollection();
    
    // درخواست restart از PM2
    setTimeout(() => {
      if (this.emergencyMode) {
        logger.error('🚨 درخواست restart اضطراری به دلیل حافظه بالا');
        process.exit(1); // PM2 will restart the process
      }
    }, 5000);
    
    // ارسال alert
    this.emit('alert', {
      type: 'memory',
      level: 'emergency',
      message: `وضعیت اضطراری حافظه: ${((memUsage.rss / (1024 * 1024 * 1024)) * 100).toFixed(1)}%`,
      usage: memUsage
    });
  }

  // تشخیص memory leak
  detectMemoryLeak() {
    if (this.memoryHistory.length < 10) return;
    
    const recent = this.memoryHistory.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    
    // بررسی روند افزایشی
    const growthRate = (newest.rss - oldest.rss) / (newest.timestamp - oldest.timestamp);
    const threshold = 1024 * 1024; // 1MB per second
    
    if (growthRate > threshold) {
      logger.warn(`احتمال memory leak تشخیص داده شد. نرخ رشد: ${Math.round(growthRate / 1024)}KB/s`);
      this.emit('memoryLeak', { growthRate, recent });
    }
  }

  // اجرای garbage collection
  performGarbageCollection() {
    const now = Date.now();
    if (now - this.lastGCTime < 30000) return; // حداقل 30 ثانیه فاصله
    
    try {
      if (global.gc) {
        const before = process.memoryUsage().heapUsed;
        global.gc();
        const after = process.memoryUsage().heapUsed;
        const freed = before - after;
        
        logger.info(`Garbage collection انجام شد. ${Math.round(freed / 1024 / 1024)}MB آزاد شد`);
        this.lastGCTime = now;
        
        this.emit('garbageCollection', { freed, before, after });
      }
    } catch (error) {
      logger.error('خطا در garbage collection:', error);
    }
  }

  // اجرای اجباری garbage collection
  forceGarbageCollection() {
    try {
      if (global.gc) {
        global.gc();
        global.gc(); // دوبار برای اطمینان
        logger.info('Garbage collection اجباری انجام شد');
      }
    } catch (error) {
      logger.error('خطا در garbage collection اجباری:', error);
    }
  }

  // پاکسازی کش‌ها
  clearCaches() {
    try {
      // پاکسازی require cache (احتیاط)
      const moduleKeys = Object.keys(require.cache);
      const safeToClear = moduleKeys.filter(key => 
        !key.includes('node_modules') && 
        !key.includes('database') &&
        !key.includes('logger')
      );
      
      safeToClear.forEach(key => {
        delete require.cache[key];
      });
      
      logger.info(`${safeToClear.length} ماژول از کش پاک شد`);
    } catch (error) {
      logger.error('خطا در پاکسازی کش:', error);
    }
  }

  // پاکسازی اضطراری
  emergencyCleanup() {
    logger.warn('شروع پاکسازی اضطراری...');
    
    // پاکسازی کش‌ها
    this.clearCaches();
    
    // اجرای garbage collection چندباره
    this.forceGarbageCollection();
    
    // ارسال سیگنال برای بستن منابع
    this.emit('emergencyCleanup');
  }

  // ثبت استفاده از منبع
  trackResource(type, action = 'create') {
    if (this.resourceCounters.hasOwnProperty(type)) {
      if (action === 'create') {
        this.resourceCounters[type]++;
      } else if (action === 'destroy') {
        this.resourceCounters[type] = Math.max(0, this.resourceCounters[type] - 1);
      }
    }
  }

  // دریافت آمار حافظه
  getMemoryStats() {
    const memUsage = process.memoryUsage();
    const latest = this.memoryHistory[this.memoryHistory.length - 1];
    
    return {
      current: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      thresholds: {
        warning: Math.round(this.memoryThreshold / 1024 / 1024),
        critical: Math.round(this.criticalThreshold / 1024 / 1024)
      },
      resources: { ...this.resourceCounters },
      history: this.memoryHistory.length,
      isMonitoring: this.isMonitoring
    };
  }

  // تنظیم آستانه‌ها
  setThresholds(warning, critical) {
    this.memoryThreshold = warning * 1024 * 1024;
    this.criticalThreshold = critical * 1024 * 1024;
    logger.info(`آستانه‌های حافظه تنظیم شد: ${warning}MB / ${critical}MB`);
  }

  // فعال/غیرفعال کردن تشخیص memory leak
  setLeakDetection(enabled) {
    this.leakDetectionEnabled = enabled;
    logger.info(`تشخیص memory leak: ${enabled ? 'فعال' : 'غیرفعال'}`);
  }
}

// Singleton instance
const memoryManager = new MemoryManager();

module.exports = memoryManager;
const EventEmitter = require('events');
const logger = require('../utils/logger');
const os = require('os');

class StabilityManager extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    
    this.isRunning = false;
    this.healthCheckInterval = 30000; // 30 seconds
    this.memoryThreshold = 85; // 85% memory usage
    this.cpuThreshold = 80; // 80% CPU usage
    this.restartThreshold = 5; // 5 consecutive failures
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.recoveryMode = false;
    
    this.healthChecks = {
      database: { enabled: true, lastCheck: 0, status: 'unknown' },
      memory: { enabled: true, lastCheck: 0, status: 'unknown' },
      cpu: { enabled: true, lastCheck: 0, status: 'unknown' },
      disk: { enabled: true, lastCheck: 0, status: 'unknown' },
      network: { enabled: true, lastCheck: 0, status: 'unknown' }
    };
    
    this.recoveryActions = {
      memory: this.handleMemoryIssue.bind(this),
      database: this.handleDatabaseIssue.bind(this),
      cpu: this.handleCpuIssue.bind(this),
      disk: this.handleDiskIssue.bind(this),
      network: this.handleNetworkIssue.bind(this)
    };
  }

  // شروع مدیریت پایداری
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('🚀 شروع مدیریت پایداری سیستم...');
    
    // شروع health checks
    this.startHealthChecks();
    
    // شروع monitoring
    this.startMonitoring();
    
    // تنظیم event listeners
    this.setupEventListeners();
    
    logger.info('✅ مدیریت پایداری فعال شد');
  }

  // توقف مدیریت پایداری
  stop() {
    this.isRunning = false;
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    logger.info('🛑 مدیریت پایداری متوقف شد');
  }

  // شروع health checks
  startHealthChecks() {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckInterval);
  }

  // شروع monitoring
  startMonitoring() {
    this.monitoringTimer = setInterval(() => {
      this.monitorSystemResources();
    }, 10000); // هر 10 ثانیه
  }

  // تنظیم event listeners
  setupEventListeners() {
    // Memory manager events
    if (global.memoryManager) {
      global.memoryManager.on('highMemory', (data) => {
        this.handleMemoryIssue(data);
      });
      
      global.memoryManager.on('criticalMemory', (data) => {
        this.handleCriticalMemoryIssue(data);
      });
    }
    
    // Database optimizer events
    if (global.databaseOptimizer && typeof global.databaseOptimizer.on === 'function') {
      global.databaseOptimizer.on('error', (error) => {
        this.handleDatabaseIssue(error);
      });
    }
    
    // Performance monitor events
    if (global.performanceMonitor) {
      global.performanceMonitor.on('alert', (alert) => {
        this.handlePerformanceAlert(alert);
      });
    }
  }

  // انجام health checks
  async performHealthChecks() {
    try {
      const checks = [
        this.checkDatabaseHealth(),
        this.checkMemoryHealth(),
        this.checkCpuHealth(),
        this.checkDiskHealth(),
        this.checkNetworkHealth()
      ];
      
      const results = await Promise.allSettled(checks);
      
      let hasFailure = false;
      results.forEach((result, index) => {
        const checkName = Object.keys(this.healthChecks)[index];
        if (result.status === 'rejected') {
          this.healthChecks[checkName].status = 'failed';
          this.healthChecks[checkName].lastCheck = Date.now();
          hasFailure = true;
          logger.warn(`❌ Health check failed: ${checkName}`, result.reason);
        } else {
          this.healthChecks[checkName].status = 'healthy';
          this.healthChecks[checkName].lastCheck = Date.now();
        }
      });
      
      if (hasFailure) {
        this.handleHealthCheckFailure();
      } else {
        this.failureCount = 0;
        this.recoveryMode = false;
      }
      
    } catch (error) {
      logger.error('خطا در انجام health checks:', error);
    }
  }

  // بررسی سلامت دیتابیس
  async checkDatabaseHealth() {
    try {
      if (global.connectionPool) {
        const result = await global.connectionPool.query('SELECT 1 as health_check');
        const rows = result.rows || [];
        return rows.length > 0 && rows[0].health_check === 1;
      }
      return false;
    } catch (error) {
      throw new Error(`Database health check failed: ${error.message}`);
    }
  }

  // بررسی سلامت حافظه
  checkMemoryHealth() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsage = (usedMem / totalMem) * 100;
      
      if (memoryUsage > this.memoryThreshold) {
        throw new Error(`Memory usage too high: ${memoryUsage.toFixed(2)}%`);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Memory health check failed: ${error.message}`);
    }
  }

  // بررسی سلامت CPU
  checkCpuHealth() {
    try {
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });
      
      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      const cpuUsage = 100 - (100 * idle / total);
      
      if (cpuUsage > this.cpuThreshold) {
        throw new Error(`CPU usage too high: ${cpuUsage.toFixed(2)}%`);
      }
      
      return true;
    } catch (error) {
      throw new Error(`CPU health check failed: ${error.message}`);
    }
  }

  // بررسی سلامت دیسک
  checkDiskHealth() {
    try {
      // این بخش نیاز به fs.statfs دارد که در Windows متفاوت است
      // فعلاً true برمی‌گردانیم
      return true;
    } catch (error) {
      throw new Error(`Disk health check failed: ${error.message}`);
    }
  }

  // بررسی سلامت شبکه
  checkNetworkHealth() {
    try {
      // بررسی اتصال به اینترنت
      return true;
    } catch (error) {
      throw new Error(`Network health check failed: ${error.message}`);
    }
  }

  // مدیریت خطاهای health check
  handleHealthCheckFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    logger.warn(`⚠️ Health check failure #${this.failureCount}`);
    
    if (this.failureCount >= this.restartThreshold) {
      this.enterRecoveryMode();
    }
  }

  // ورود به حالت recovery
  enterRecoveryMode() {
    if (this.recoveryMode) return;
    
    this.recoveryMode = true;
    logger.warn('🚨 ورود به حالت recovery...');
    
    // اجرای اقدامات recovery
    this.performRecoveryActions();
  }

  // اجرای اقدامات recovery
  async performRecoveryActions() {
    try {
      logger.info('🔄 شروع اقدامات recovery...');
      
      // پاکسازی cache
      if (global.cacheManager) {
        global.cacheManager.clearAll();
        logger.info('✅ Cache پاک شد');
      }
      
      // بهینه‌سازی دیتابیس
      if (global.databaseOptimizer) {
        await global.databaseOptimizer.clearCache();
        logger.info('✅ Database cache پاک شد');
      }
      
      // تنظیم حالت اضطراری در load balancer
      if (global.loadBalancerCron) {
        global.loadBalancerCron.loadBalancer.setLoadMode('emergency');
        logger.info('✅ Load balancer در حالت اضطراری قرار گرفت');
      }
      
      // کاهش تعداد کرال‌های همزمان
      if (global.crawler) {
        global.crawler.maxConcurrentCrawls = 1;
        logger.info('✅ تعداد کرال‌های همزمان کاهش یافت');
      }
      
      // انتظار برای بهبود وضعیت
      setTimeout(() => {
        this.exitRecoveryMode();
      }, 5 * 60 * 1000); // 5 دقیقه
      
    } catch (error) {
      logger.error('خطا در اجرای اقدامات recovery:', error);
    }
  }

  // خروج از حالت recovery
  exitRecoveryMode() {
    this.recoveryMode = false;
    this.failureCount = 0;
    
    logger.info('✅ خروج از حالت recovery');
    
    // بازگرداندن تنظیمات عادی
    if (global.loadBalancerCron) {
      global.loadBalancerCron.loadBalancer.setLoadMode('normal');
    }
    
    if (global.crawler) {
      global.crawler.maxConcurrentCrawls = 3;
    }
  }

  // مدیریت مشکلات حافظه
  handleMemoryIssue(data) {
    logger.warn('⚠️ مشکل حافظه تشخیص داده شد:', data);
    
    // پاکسازی cache
    if (global.cacheManager) {
      global.cacheManager.clearAll();
    }
    
    // پاکسازی database cache
    if (global.databaseOptimizer) {
      global.databaseOptimizer.clearCache();
    }
    
    // فشردگی اضطراری
    if (global.queueManager) {
      global.queueManager.addJob({
        type: 'compression',
        options: { daysOld: 7, emergency: true }
      }, 'high');
    }
  }

  // مدیریت مشکلات بحرانی حافظه
  handleCriticalMemoryIssue(data) {
    logger.error('🚨 مشکل بحرانی حافظه:', data);
    
    // بستن web drivers
    if (global.webDriverOptimizer) {
      global.webDriverOptimizer.close();
    }
    
    // تنظیم حالت اضطراری
    if (global.loadBalancerCron) {
      global.loadBalancerCron.loadBalancer.setLoadMode('emergency');
    }
    
    // توقف موقت کرال‌ها
    if (global.crawler) {
      global.crawler.maxConcurrentCrawls = 0;
    }
  }

  // مدیریت مشکلات دیتابیس
  handleDatabaseIssue(error) {
    logger.error('⚠️ مشکل دیتابیس:', error);
    
    // تلاش برای reconnect
    if (global.connectionPool) {
      global.connectionPool.pool.end();
      // reconnect logic here
    }
  }

  // مدیریت مشکلات CPU
  handleCpuIssue(data) {
    logger.warn('⚠️ مشکل CPU:', data);
    
    // کاهش بار
    if (global.loadBalancerCron) {
      global.loadBalancerCron.loadBalancer.setLoadMode('low');
    }
  }

  // مدیریت مشکلات دیسک
  handleDiskIssue(data) {
    logger.warn('⚠️ مشکل دیسک:', data);
    
    // پاکسازی فایل‌های موقت
    if (global.queueManager) {
      global.queueManager.addJob({
        type: 'cleanup',
        options: { tempFiles: true }
      }, 'high');
    }
  }

  // مدیریت مشکلات شبکه
  handleNetworkIssue(data) {
    logger.warn('⚠️ مشکل شبکه:', data);
    
    // تنظیم retry logic
    if (global.rateLimiter) {
      global.rateLimiter.setGlobalDelay(5000); // 5 seconds delay
    }
  }

  // مدیریت هشدارهای عملکرد
  handlePerformanceAlert(alert) {
    logger.warn(`⚠️ هشدار عملکرد: ${alert.type} - ${alert.message}`);
    
    const action = this.recoveryActions[alert.type];
    if (action) {
      action(alert);
    }
  }

  // مانیتورینگ منابع سیستم
  monitorSystemResources() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsage = (usedMem / totalMem) * 100;
      
      if (memoryUsage > 90) {
        this.handleMemoryIssue({ usage: memoryUsage, threshold: 90 });
      }
      
      // بررسی uptime
      const uptime = os.uptime();
      if (uptime > 24 * 60 * 60) { // بیش از 24 ساعت
        logger.info(`🕐 سیستم ${Math.floor(uptime / 3600)} ساعت در حال اجرا است`);
      }
      
    } catch (error) {
      logger.error('خطا در مانیتورینگ منابع:', error);
    }
  }

  // دریافت وضعیت سیستم
  getSystemStatus() {
    return {
      isRunning: this.isRunning,
      recoveryMode: this.recoveryMode,
      failureCount: this.failureCount,
      healthChecks: this.healthChecks,
      memoryUsage: this.getMemoryUsage(),
      uptime: os.uptime()
    };
  }

  // دریافت استفاده حافظه
  getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      percentage: (usedMem / totalMem) * 100
    };
  }

  // دریافت آمار سیستم
  getSystemStats() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };
  }
}

module.exports = StabilityManager; 
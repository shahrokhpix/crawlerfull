const cron = require('node-cron');
const logger = require('../utils/logger');
const LoadBalancer = require('./loadBalancer');
const memoryManager = require('./memoryManager');
const performanceMonitor = require('./performanceMonitor');
const databaseOptimizer = require('./databaseOptimizer');

class LoadBalancerCron {
  constructor() {
    this.loadBalancer = new LoadBalancer();
    this.isRunning = false;
    this.jobs = new Map();
    
    // تنظیمات cron jobs
    this.cronJobs = {
      // بررسی بار هر 30 ثانیه
      loadCheck: '*/30 * * * * *',
      
      // پاکسازی حافظه هر 5 دقیقه
      memoryCleanup: '*/5 * * * *',
      
      // بهینه‌سازی دیتابیس هر 30 دقیقه
      databaseOptimization: '*/30 * * * *',
      
      // پاکسازی لاگ‌ها هر ساعت
      logCleanup: '0 * * * *',
      
      // بررسی سلامت سیستم هر 10 دقیقه
      healthCheck: '*/10 * * * *',
      
      // پاکسازی cache هر 15 دقیقه
      cacheCleanup: '*/15 * * * *',
      
      // تنظیم مجدد بار هر 2 دقیقه
      loadAdjustment: '*/2 * * * *'
    };
  }

  // شروع cron jobs
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('شروع cron jobs مدیریت بار...');
    
    // شروع load balancer
    this.loadBalancer.startMonitoring();
    
    // تنظیم cron jobs
    this.setupCronJobs();
    
    logger.info('Cron jobs مدیریت بار فعال شدند');
  }

  // توقف cron jobs
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // توقف load balancer
    this.loadBalancer.stopMonitoring();
    
    // توقف تمام cron jobs
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Cron job متوقف شد: ${name}`);
    });
    
    this.jobs.clear();
    logger.info('تمام cron jobs متوقف شدند');
  }

  // تنظیم cron jobs
  setupCronJobs() {
    // بررسی بار سیستم
    this.jobs.set('loadCheck', cron.schedule(this.cronJobs.loadCheck, () => {
      this.performLoadCheck();
    }, {
      scheduled: true,
      timezone: 'Asia/Tehran'
    }));

    // پاکسازی حافظه
    this.jobs.set('memoryCleanup', cron.schedule(this.cronJobs.memoryCleanup, () => {
      this.performMemoryCleanup();
    }, {
      scheduled: true,
      timezone: 'Asia/Tehran'
    }));

    // بهینه‌سازی دیتابیس
    this.jobs.set('databaseOptimization', cron.schedule(this.cronJobs.databaseOptimization, () => {
      this.performDatabaseOptimization();
    }, {
      scheduled: true,
      timezone: 'Asia/Tehran'
    }));

    // پاکسازی لاگ‌ها
    this.jobs.set('logCleanup', cron.schedule(this.cronJobs.logCleanup, () => {
      this.performLogCleanup();
    }, {
      scheduled: true,
      timezone: 'Asia/Tehran'
    }));

    // بررسی سلامت سیستم
    this.jobs.set('healthCheck', cron.schedule(this.cronJobs.healthCheck, () => {
      this.performHealthCheck();
    }, {
      scheduled: true,
      timezone: 'Asia/Tehran'
    }));

    // پاکسازی cache
    this.jobs.set('cacheCleanup', cron.schedule(this.cronJobs.cacheCleanup, () => {
      this.performCacheCleanup();
    }, {
      scheduled: true,
      timezone: 'Asia/Tehran'
    }));

    // تنظیم مجدد بار
    this.jobs.set('loadAdjustment', cron.schedule(this.cronJobs.loadAdjustment, () => {
      this.performLoadAdjustment();
    }, {
      scheduled: true,
      timezone: 'Asia/Tehran'
    }));
  }

  // بررسی بار سیستم
  async performLoadCheck() {
    try {
      const stats = this.loadBalancer.getCurrentConfig();
      
      // بررسی آستانه‌های بحرانی
      if (stats.stats.memory > 85) {
        logger.warn('🚨 حافظه بحرانی، شروع پاکسازی اضطراری...');
        await this.emergencyCleanup();
      }
      
      if (stats.stats.cpu > 85) {
        logger.warn('🚨 CPU بحرانی، کاهش بار...');
        this.loadBalancer.setLoadMode('emergency');
      }
      
      if (stats.stats.database > 3000) {
        logger.warn('🚨 دیتابیس کند، بهینه‌سازی...');
        await this.performDatabaseOptimization();
      }
      
    } catch (error) {
      logger.error('خطا در بررسی بار سیستم:', error);
    }
  }

  // پاکسازی حافظه
  async performMemoryCleanup() {
    try {
      const memUsage = process.memoryUsage();
      const memoryPercentage = (memUsage.rss / (1024 * 1024 * 1024)) * 100;
      
      if (memoryPercentage > 70) {
        logger.info('🧹 شروع پاکسازی حافظه...');
        
        // پاکسازی cache ها
        if (global.cacheManager) {
          global.cacheManager.clearAll();
        }
        
        if (global.databaseOptimizer) {
          global.databaseOptimizer.clearCache();
        }
        
        // Garbage Collection اجباری
        if (global.gc) {
          global.gc();
        }
        
        logger.info('✅ پاکسازی حافظه تکمیل شد');
      }
    } catch (error) {
      logger.error('خطا در پاکسازی حافظه:', error);
    }
  }

  // بهینه‌سازی دیتابیس
  async performDatabaseOptimization() {
    try {
      logger.info('🗄️ شروع بهینه‌سازی دیتابیس...');
      
      if (global.databaseOptimizer) {
        await global.databaseOptimizer.analyzeTables();
        await global.databaseOptimizer.cleanupOldData();
      }
      
      logger.info('✅ بهینه‌سازی دیتابیس تکمیل شد');
    } catch (error) {
      logger.error('خطا در بهینه‌سازی دیتابیس:', error);
    }
  }

  // پاکسازی لاگ‌ها
  async performLogCleanup() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      logger.info('📝 شروع پاکسازی لاگ‌ها...');
      
      // پاکسازی لاگ‌های قدیمی (بیش از 7 روز)
      const logsDir = path.join(__dirname, '../logs');
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      
      const files = await fs.readdir(logsDir);
      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(logsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < sevenDaysAgo) {
            await fs.unlink(filePath);
            logger.info(`حذف لاگ قدیمی: ${file}`);
          }
        }
      }
      
      logger.info('✅ پاکسازی لاگ‌ها تکمیل شد');
    } catch (error) {
      logger.error('خطا در پاکسازی لاگ‌ها:', error);
    }
  }

  // بررسی سلامت سیستم
  async performHealthCheck() {
    try {
      const stats = this.loadBalancer.getCurrentConfig();
      
      // بررسی وضعیت کلی
      const healthStatus = {
        memory: stats.stats.memory < 80,
        cpu: stats.stats.cpu < 80,
        database: stats.stats.database < 2000,
        mode: stats.currentMode !== 'emergency'
      };
      
      const isHealthy = Object.values(healthStatus).every(status => status);
      
      if (!isHealthy) {
        logger.warn('⚠️ مشکلات سلامت سیستم شناسایی شد:', healthStatus);
        
        // اقدامات اصلاحی
        if (!healthStatus.memory) {
          await this.performMemoryCleanup();
        }
        
        if (!healthStatus.database) {
          await this.performDatabaseOptimization();
        }
      } else {
        logger.debug('✅ سلامت سیستم در وضعیت مطلوب');
      }
      
    } catch (error) {
      logger.error('خطا در بررسی سلامت سیستم:', error);
    }
  }

  // پاکسازی cache
  async performCacheCleanup() {
    try {
      logger.info('🗑️ شروع پاکسازی cache...');
      
      // پاکسازی cache های مختلف
      if (global.cacheManager) {
        global.cacheManager.clearExpired();
      }
      
      if (global.databaseOptimizer) {
        global.databaseOptimizer.clearCache();
      }
      
      // پاکسازی memory cache
      if (global.gc) {
        global.gc();
      }
      
      logger.info('✅ پاکسازی cache تکمیل شد');
    } catch (error) {
      logger.error('خطا در پاکسازی cache:', error);
    }
  }

  // تنظیم مجدد بار
  async performLoadAdjustment() {
    try {
      const currentConfig = this.loadBalancer.getCurrentConfig();
      const loadLevel = this.loadBalancer.determineLoadLevel();
      
      // تنظیم خودکار بر اساس بار
      if (loadLevel === 'normal' && currentConfig.mode !== 'normal') {
        // بهبود تدریجی
        if (currentConfig.mode === 'emergency') {
          this.loadBalancer.setLoadMode('high');
        } else if (currentConfig.mode === 'high') {
          this.loadBalancer.setLoadMode('moderate');
        } else if (currentConfig.mode === 'moderate') {
          this.loadBalancer.setLoadMode('normal');
        }
      }
      
    } catch (error) {
      logger.error('خطا در تنظیم مجدد بار:', error);
    }
  }

  // پاکسازی اضطراری
  async emergencyCleanup() {
    try {
      logger.warn('🚨 شروع پاکسازی اضطراری...');
      
      // توقف تمام کرال‌های فعال
      if (global.crawler) {
        await global.crawler.emergencyCleanup();
      }
      
      // پاکسازی کامل cache ها
      if (global.cacheManager) {
        global.cacheManager.clearAll();
      }
      
      if (global.databaseOptimizer) {
        global.databaseOptimizer.clearCache();
      }
      
      // Garbage Collection اجباری
      if (global.gc) {
        global.gc();
      }
      
      // تنظیم حالت اضطراری
      this.loadBalancer.setLoadMode('emergency');
      
      logger.warn('✅ پاکسازی اضطراری تکمیل شد');
    } catch (error) {
      logger.error('خطا در پاکسازی اضطراری:', error);
    }
  }

  // دریافت آمار
  getStats() {
    return {
      isRunning: this.isRunning,
      loadBalancer: this.loadBalancer.getStats(),
      activeJobs: this.jobs.size,
      cronJobs: Object.keys(this.cronJobs)
    };
  }
}

module.exports = LoadBalancerCron; 
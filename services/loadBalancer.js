const EventEmitter = require('events');
const os = require('os');
const logger = require('../utils/logger');

class LoadBalancer extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    
    // تنظیمات بار
    this.maxConcurrentCrawls = 3;
    this.minConcurrentCrawls = 1;
    this.currentConcurrentCrawls = 3;
    
    // آستانه‌های سیستم
    this.cpuThreshold = 70; // درصد
    this.memoryThreshold = 75; // درصد
    this.diskThreshold = 85; // درصد
    this.databaseThreshold = 2000; // میلی‌ثانیه
    
    // تنظیمات تنظیم خودکار
    this.adjustmentInterval = 30000; // 30 ثانیه
    this.recoveryTime = 5 * 60 * 1000; // 5 دقیقه
    this.isMonitoring = false;
    this.lastAdjustment = Date.now();
    this.systemStats = {
      cpu: 0,
      memory: 0,
      disk: 0,
      database: 0
    };
    
    // تاریخچه تنظیمات
    this.adjustmentHistory = [];
    this.maxHistorySize = 50;
    
    // حالت‌های مختلف بار
    this.loadModes = {
      normal: {
        concurrentCrawls: 3,
        delayBetweenCrawls: 2000,
        timeoutMultiplier: 1
      },
      moderate: {
        concurrentCrawls: 2,
        delayBetweenCrawls: 5000,
        timeoutMultiplier: 1.5
      },
      high: {
        concurrentCrawls: 1,
        delayBetweenCrawls: 10000,
        timeoutMultiplier: 2
      },
      emergency: {
        concurrentCrawls: 0,
        delayBetweenCrawls: 30000,
        timeoutMultiplier: 3
      }
    };
    
    this.currentMode = 'normal';
  }

  // شروع مانیتورینگ بار
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    logger.info('شروع مانیتورینگ بار سیستم...');
    
    // مانیتورینگ دوره‌ای
    this.monitoringTimer = setInterval(() => {
      this.checkSystemLoad();
    }, this.adjustmentInterval);
    
    // تنظیم خودکار
    this.adjustmentTimer = setInterval(() => {
      this.adjustLoad();
    }, this.adjustmentInterval);
    
    // شروع فوری
    this.checkSystemLoad();
  }

  // توقف مانیتورینگ
  stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    if (this.adjustmentTimer) {
      clearInterval(this.adjustmentTimer);
      this.adjustmentTimer = null;
    }
    
    logger.info('مانیتورینگ بار سیستم متوقف شد');
  }

  // بررسی بار سیستم
  async checkSystemLoad() {
    try {
      // جمع‌آوری آمار سیستم
      const cpuUsage = await this.getCPUUsage();
      const memoryUsage = await this.getMemoryUsage();
      const diskUsage = await this.getDiskUsage();
      const databasePerformance = await this.getDatabasePerformance();
      
      this.systemStats = {
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
        database: databasePerformance
      };
      
      // تشخیص وضعیت بار
      const loadLevel = this.determineLoadLevel();
      
      // ارسال event
      this.emit('loadCheck', {
        stats: this.systemStats,
        level: loadLevel,
        timestamp: Date.now()
      });
      
      // لاگ کردن وضعیت
      if (loadLevel !== 'normal') {
        logger.warn(`⚠️ بار سیستم: ${loadLevel} - CPU: ${cpuUsage}%, Memory: ${memoryUsage}%, DB: ${databasePerformance}ms`);
      }
      
    } catch (error) {
      logger.error('خطا در بررسی بار سیستم:', error);
    }
  }

  // دریافت استفاده از CPU
  async getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - (100 * idle / total);
    
    return Math.round(usage);
  }

  // دریافت استفاده از حافظه
  async getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usage = ((totalMem - freeMem) / totalMem) * 100;
    
    return Math.round(usage);
  }

  // دریافت استفاده از دیسک
  async getDiskUsage() {
    try {
      const fs = require('fs');
      const path = require('path');
      const diskPath = path.join(__dirname, '..');
      const stats = fs.statSync(diskPath);
      
      // این یک تخمین ساده است
      return 60; // فرض می‌کنیم 60% استفاده شده
    } catch (error) {
      return 50;
    }
  }

  // دریافت عملکرد دیتابیس
  async getDatabasePerformance() {
    try {
      const Database = require('../config/database');
      const db = Database.getDb();
      const startTime = Date.now();
      
      await db.query('SELECT 1 as health_check');
      
      return Date.now() - startTime;
    } catch (error) {
      return 5000; // در صورت خطا، مقدار بالا برگردان
    }
  }

  // تشخیص سطح بار
  determineLoadLevel() {
    const { cpu, memory, disk, database } = this.systemStats;
    
    // وضعیت اضطراری
    if (cpu > 90 || memory > 90 || disk > 95 || database > 5000) {
      return 'emergency';
    }
    
    // بار بالا
    if (cpu > 80 || memory > 80 || disk > 85 || database > 3000) {
      return 'high';
    }
    
    // بار متوسط
    if (cpu > 70 || memory > 70 || disk > 75 || database > 2000) {
      return 'moderate';
    }
    
    // بار عادی
    return 'normal';
  }

  // تنظیم خودکار بار
  adjustLoad() {
    const loadLevel = this.determineLoadLevel();
    const previousMode = this.currentMode;
    
    // تصمیم‌گیری برای تغییر حالت
    if (loadLevel === 'emergency' && this.currentMode !== 'emergency') {
      this.setLoadMode('emergency');
    } else if (loadLevel === 'high' && this.currentMode !== 'high') {
      this.setLoadMode('high');
    } else if (loadLevel === 'moderate' && this.currentMode !== 'moderate') {
      this.setLoadMode('moderate');
    } else if (loadLevel === 'normal' && this.currentMode !== 'normal') {
      this.setLoadMode('normal');
    }
    
    // ثبت تغییرات
    if (previousMode !== this.currentMode) {
      this.logAdjustment(previousMode, this.currentMode, loadLevel);
    }
  }

  // تنظیم حالت بار
  setLoadMode(mode) {
    if (!this.loadModes[mode]) {
      logger.error(`حالت بار نامعتبر: ${mode}`);
      return;
    }
    
    const previousMode = this.currentMode;
    this.currentMode = mode;
    const config = this.loadModes[mode];
    
    // اعمال تنظیمات
    this.currentConcurrentCrawls = config.concurrentCrawls;
    
    // ارسال event
    this.emit('loadModeChange', {
      previousMode,
      newMode: mode,
      config,
      timestamp: Date.now()
    });
    
    logger.info(`🔄 تغییر حالت بار: ${previousMode} → ${mode} (کرال‌های همزمان: ${config.concurrentCrawls})`);
  }

  // ثبت تنظیمات
  logAdjustment(previousMode, newMode, loadLevel) {
    const adjustment = {
      timestamp: Date.now(),
      previousMode,
      newMode,
      loadLevel,
      stats: { ...this.systemStats }
    };
    
    this.adjustmentHistory.push(adjustment);
    
    // محدود کردن تاریخچه
    if (this.adjustmentHistory.length > this.maxHistorySize) {
      this.adjustmentHistory.shift();
    }
  }

  // دریافت تنظیمات فعلی
  getCurrentConfig() {
    return {
      mode: this.currentMode,
      config: this.loadModes[this.currentMode],
      stats: this.systemStats,
      concurrentCrawls: this.currentConcurrentCrawls
    };
  }

  // بررسی امکان شروع کرال جدید
  canStartNewCrawl() {
    if (this.currentMode === 'emergency') {
      return false;
    }
    
    // بررسی تعداد کرال‌های فعال
    const activeCrawls = this.getActiveCrawlsCount();
    return activeCrawls < this.currentConcurrentCrawls;
  }

  // دریافت تعداد کرال‌های فعال
  getActiveCrawlsCount() {
    // این تابع باید با سیستم کرالر هماهنگ شود
    return 0; // فعلاً 0 برمی‌گردانیم
  }

  // دریافت delay بین کرال‌ها
  getDelayBetweenCrawls() {
    return this.loadModes[this.currentMode].delayBetweenCrawls;
  }

  // دریافت ضریب timeout
  getTimeoutMultiplier() {
    return this.loadModes[this.currentMode].timeoutMultiplier;
  }

  // دریافت آمار
  getStats() {
    return {
      currentMode: this.currentMode,
      concurrentCrawls: this.currentConcurrentCrawls,
      systemStats: this.systemStats,
      adjustmentHistory: this.adjustmentHistory.length,
      isMonitoring: this.isMonitoring
    };
  }

  // تنظیم آستانه‌ها
  setThresholds(cpu, memory, disk, database) {
    this.cpuThreshold = cpu;
    this.memoryThreshold = memory;
    this.diskThreshold = disk;
    this.databaseThreshold = database;
    
    logger.info(`آستانه‌های جدید تنظیم شدند: CPU=${cpu}%, Memory=${memory}%, Disk=${disk}%, DB=${database}ms`);
  }

  // تنظیم حالت‌های بار
  setLoadModes(modes) {
    this.loadModes = { ...this.loadModes, ...modes };
    logger.info('حالت‌های بار به‌روزرسانی شدند');
  }
}

module.exports = LoadBalancer; 
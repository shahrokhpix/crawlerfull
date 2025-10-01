const EventEmitter = require('events');
const logger = require('../utils/logger');
const Database = require('../config/database');

class QueueManager extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // افزایش حد مجاز listener ها
    this.db = Database.getDb();
    this.queues = {
      high: [],     // اولویت بالا
      normal: [],   // اولویت عادی
      low: []       // اولویت پایین
    };
    this.processing = new Set();
    this.maxConcurrent = 3; // حداکثر کرال همزمان
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 ثانیه
    this.stats = {
      processed: 0,
      failed: 0,
      queued: 0,
      processing: 0
    };
    this.isProcessing = false;
    this.memoryThreshold = 400 * 1024 * 1024; // 400MB
    this.lastCleanup = Date.now();
    this.cleanupInterval = 10 * 60 * 1000; // 10 دقیقه
    
    // شروع پردازش خودکار
    this.startProcessing();
    
    // مانیتورینگ حافظه
    this.startMemoryMonitoring();
  }

  // اضافه کردن کار به صف
  async addJob(job, priority = 'normal') {
    const jobId = this.generateJobId();
    const jobData = {
      id: jobId,
      ...job,
      priority,
      attempts: 0,
      createdAt: Date.now(),
      status: 'queued'
    };

    this.queues[priority].push(jobData);
    this.stats.queued++;
    
    logger.info(`کار جدید اضافه شد: ${jobId} با اولویت ${priority}`);
    this.emit('jobAdded', jobData);
    
    // ذخیره در دیتابیس
    await this.saveJobToDb(jobData);
    
    return jobId;
  }

  // دریافت کار بعدی از صف
  getNextJob() {
    // اولویت‌بندی: high > normal > low
    for (const priority of ['high', 'normal', 'low']) {
      if (this.queues[priority].length > 0) {
        const job = this.queues[priority].shift();
        this.stats.queued--;
        return job;
      }
    }
    return null;
  }

  // شروع پردازش صف
  async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    logger.info('شروع پردازش صف...');
    
    while (this.isProcessing) {
      try {
        // بررسی حافظه
        await this.checkMemoryUsage();
        
        // پردازش کارهای موجود
        while (this.processing.size < this.maxConcurrent) {
          const job = this.getNextJob();
          if (!job) break;
          
          this.processJob(job);
        }
        
        // صبر کوتاه قبل از چک بعدی
        await this.sleep(1000);
        
      } catch (error) {
        logger.error('خطا در پردازش صف:', error);
        await this.sleep(5000);
      }
    }
  }

  // پردازش یک کار
  async processJob(job) {
    this.processing.add(job.id);
    this.stats.processing++;
    job.status = 'processing';
    job.startedAt = Date.now();
    
    logger.info(`شروع پردازش کار: ${job.id}`);
    this.emit('jobStarted', job);
    
    try {
      // اجرای کار
      const result = await this.executeJob(job);
      
      // به‌روزرسانی زمان آخرین اجرا اگر scheduleId موجود باشد
      if (job.scheduleId && global.scheduler) {
        await global.scheduler.updateLastRun(job.scheduleId);
      }
      
      // موفقیت
      job.status = 'completed';
      job.completedAt = Date.now();
      job.result = result;
      
      this.stats.processed++;
      logger.info(`کار تکمیل شد: ${job.id}`);
      this.emit('jobCompleted', job);
      
    } catch (error) {
      // خطا
      job.attempts++;
      job.lastError = error.message;
      
      if (job.attempts < this.retryAttempts) {
        // تلاش مجدد
        job.status = 'retrying';
        logger.warn(`تلاش مجدد برای کار ${job.id}: ${job.attempts}/${this.retryAttempts}`);
        
        setTimeout(() => {
          job.status = 'queued';
          this.queues[job.priority].push(job);
          this.stats.queued++;
        }, this.retryDelay * job.attempts);
        
      } else {
        // شکست نهایی
        job.status = 'failed';
        job.failedAt = Date.now();
        this.stats.failed++;
        
        logger.error(`کار شکست خورد: ${job.id} - ${error.message}`);
        this.emit('jobFailed', job);
      }
    } finally {
      this.processing.delete(job.id);
      this.stats.processing--;
      
      // به‌روزرسانی در دیتابیس
      this.updateJobInDb(job);
    }
  }

  // اجرای کار
  async executeJob(job) {
    switch (job.type) {
      case 'crawl':
        return await this.executeCrawlJob(job);
      case 'compress':
        return await this.executeCompressJob(job);
      case 'cleanup':
        return await this.executeCleanupJob(job);
      default:
        throw new Error(`نوع کار ناشناخته: ${job.type}`);
    }
  }

  // اجرای کار کرال
  async executeCrawlJob(job) {
    const UniversalCrawler = require('./crawler');
    const crawler = new UniversalCrawler(job.driverType || 'cheerio');
    
    return await crawler.crawlSource(job.sourceId, job.options || {});
  }

  // اجرای کار فشرده‌سازی
  async executeCompressJob(job) {
    const CompressionService = require('./compressionService');
    const compressor = new CompressionService();
    
    return await compressor.compressOldData(job.options || {});
  }

  // اجرای کار پاکسازی
  async executeCleanupJob(job) {
    // اجرای پاکسازی
    if (global.cleanup && job.keepCount) {
      const result = await global.cleanup.performCleanup(job.keepCount);
      console.log(`✅ پاک‌سازی انجام شد: ${result.deletedCount} مقاله پاک شد`);
      
      // ثبت لاگ عملیات
      if (job.scheduleId) {
        await global.cleanup.logCleanupOperation(job.scheduleId, 'success', 
          `پاک‌سازی موفق: ${result.deletedCount} مقاله پاک شد`);
      }
      return result;
    } else if (global.compressionService) {
      await global.compressionService.cleanupTempData();
    } else {
      const cleanup = require('./cleanup');
      return await cleanup.performCleanup(job.options || {});
    }
  }

  // مانیتورینگ حافظه
  async startMemoryMonitoring() {
    setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // هر 30 ثانیه
  }

  // بررسی استفاده از حافظه
  async checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    
    if (heapUsed > this.memoryThreshold) {
      logger.warn(`استفاده از حافظه بالا: ${Math.round(heapUsed / 1024 / 1024)}MB`);
      
      // کاهش کرال همزمان
      if (this.maxConcurrent > 1) {
        this.maxConcurrent = Math.max(1, this.maxConcurrent - 1);
        logger.info(`کاهش کرال همزمان به: ${this.maxConcurrent}`);
      }
      
      // اجرای garbage collection
      if (global.gc) {
        global.gc();
        logger.info('Garbage collection اجرا شد');
      }
      
      // پاکسازی اضطراری
      await this.emergencyCleanup();
    } else if (heapUsed < this.memoryThreshold * 0.7 && this.maxConcurrent < 5) {
      // افزایش کرال همزمان اگر حافظه کافی است
      this.maxConcurrent++;
      logger.info(`افزایش کرال همزمان به: ${this.maxConcurrent}`);
    }
  }

  // پاکسازی اضطراری
  async emergencyCleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupInterval) return;
    
    this.lastCleanup = now;
    logger.info('شروع پاکسازی اضطراری...');
    
    // پاکسازی کارهای قدیمی تکمیل شده
    const cutoff = now - (24 * 60 * 60 * 1000); // 24 ساعت قبل
    
    await this.db.query(`
      DELETE FROM queue_jobs 
      WHERE status IN ('completed', 'failed') 
      AND created_at < $1
    `, [cutoff]);
    
    logger.info('پاکسازی اضطراری تکمیل شد');
  }

  // تولید شناسه کار
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ذخیره کار در دیتابیس
  async saveJobToDb(job) {
    try {
      await this.db.query(`
        INSERT INTO queue_jobs (
          id, type, priority, status, data, attempts, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          type = EXCLUDED.type,
          priority = EXCLUDED.priority,
          status = EXCLUDED.status,
          data = EXCLUDED.data,
          attempts = EXCLUDED.attempts,
          updated_at = CURRENT_TIMESTAMP
      `, [
        job.id,
        job.type,
        job.priority,
        job.status,
        JSON.stringify(job),
        job.attempts,
        job.createdAt
      ]);
    } catch (error) {
      logger.warn('خطا در ذخیره کار در دیتابیس:', error.message);
    }
  }

  // به‌روزرسانی کار در دیتابیس
  async updateJobInDb(job) {
    try {
      await this.db.query(`
        UPDATE queue_jobs 
        SET status = $1, data = $2, attempts = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [
        job.status,
        JSON.stringify(job),
        job.attempts,
        job.id
      ]);
    } catch (error) {
      logger.warn('خطا در به‌روزرسانی کار در دیتابیس:', error.message);
    }
  }

  // دریافت آمار صف
  getStats() {
    return {
      ...this.stats,
      queueSizes: {
        high: this.queues.high.length,
        normal: this.queues.normal.length,
        low: this.queues.low.length
      },
      maxConcurrent: this.maxConcurrent,
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    };
  }

  // توقف پردازش
  stop() {
    this.isProcessing = false;
    logger.info('پردازش صف متوقف شد');
  }

  // تابع کمکی برای sleep
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = QueueManager;
const Database = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class DatabaseOptimizer {
  constructor() {
    this.db = Database.db;
    this.queryCache = new Map();
    this.maxCacheSize = 100;
    this.slowQueryThreshold = 2000; // 2 ثانیه
    this.busyTimeout = 30000; // 30 ثانیه
    this.maxRetries = 3;
    this.isOptimized = false;
    this.walCheckInterval = 5 * 60 * 1000; // 5 دقیقه
    this.lastWalCheck = Date.now();
  }

  // بهینه‌سازی دیتابیس
  async optimize() {
    if (this.isOptimized) return;

    try {
      logger.info('شروع بهینه‌سازی دیتابیس...');

      // تنظیم DELETE mode به جای WAL برای جلوگیری از I/O bottleneck
      await this.setDeleteMode();
      
      // ایجاد index های ضروری
      await this.createIndexes();
      
      // تنظیم timeout ها
      await this.setTimeouts();
      
      // پاکسازی داده‌های قدیمی
      await this.cleanupOldData();
      
      // تحلیل جداول
      await this.analyzeTables();
      
      // شروع مانیتورینگ WAL
      this.startWalMonitoring();
      
      this.isOptimized = true;
      logger.info('بهینه‌سازی دیتابیس تکمیل شد');
    } catch (error) {
      logger.error('خطا در بهینه‌سازی دیتابیس:', error);
      throw error;
    }
  }

  // تنظیم DELETE mode به جای WAL
  async setDeleteMode() {
    try {
      // PostgreSQL doesn't use PRAGMA statements like SQLite
      // Instead, we can optimize PostgreSQL settings
      await this.db.query('SET synchronous_commit = off');
      // Note: shared_preload_libraries requires server restart, so we skip it
      await this.db.query('SET track_activities = on');
      logger.info('PostgreSQL optimization settings applied');
    } catch (error) {
      logger.warn('خطا در تنظیم PostgreSQL optimization:', error);
    }
  }

  // مانیتورینگ WAL files - PostgreSQL uses WAL by default
  startWalMonitoring() {
    setInterval(() => {
      this.checkPostgreSQLStatus();
    }, this.walCheckInterval);
  }

  // بررسی وضعیت دیتابیس PostgreSQL
  async checkPostgreSQLStatus() {
    try {
      // بررسی اتصال به دیتابیس
      const result = await this.db.query('SELECT 1 as status');
      if (result && (result.rows || []).length > 0) {
        logger.info('✅ اتصال به PostgreSQL برقرار است');
      }
    } catch (error) {
      logger.error('❌ خطا در اتصال به PostgreSQL:', error);
    }
  }

  // ایجاد index های ضروری
  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id)',
      'CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(hash)',
      'CREATE INDEX IF NOT EXISTS idx_sources_active ON news_sources(active)',
      'CREATE INDEX IF NOT EXISTS idx_crawl_history_timestamp ON crawl_history(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp)'
    ];

    for (const index of indexes) {
      try {
        await this.db.query(index);
      } catch (error) {
        logger.warn('خطا در ایجاد index:', error);
      }
    }

    logger.info('Index های ضروری ایجاد شدند');
  }

  // تنظیم timeout ها - PostgreSQL uses different timeout settings
  async setTimeouts() {
    try {
      // PostgreSQL uses statement_timeout (query_timeout doesn't exist)
      await this.db.query(`SET statement_timeout = '${this.busyTimeout}ms'`);
      logger.info(`PostgreSQL statement_timeout به ${this.busyTimeout}ms تنظیم شد`);
    } catch (error) {
      logger.warn('خطا در تنظیم PostgreSQL timeouts:', error);
    }
  }

  // پاکسازی داده‌های قدیمی
  async cleanupOldData() {
    try {
      // حذف مقالات قدیمی (بیش از 30 روز)
      await this.db.query(
        'DELETE FROM articles WHERE created_at < NOW() - INTERVAL \'30 days\''
      );

      // حذف متریک‌های قدیمی (بیش از 7 روز)
      await this.db.query(
        'DELETE FROM performance_metrics WHERE timestamp < EXTRACT(EPOCH FROM NOW() - INTERVAL \'7 days\') * 1000'
      );

      // حذف تاریخچه کرال قدیمی (بیش از 14 روز)
      await this.db.query(
        'DELETE FROM crawl_history WHERE created_at < NOW() - INTERVAL \'14 days\''
      );

      logger.info('داده‌های قدیمی پاکسازی شدند');
    } catch (error) {
      logger.warn('خطا در پاکسازی داده‌های قدیمی:', error);
    }
  }

  // تحلیل جداول
  async analyzeTables() {
    try {
      await this.db.query('ANALYZE');
      logger.info('تحلیل جداول تکمیل شد');
    } catch (error) {
      logger.warn('خطا در تحلیل جداول:', error);
    }
  }

  // اجرای query با retry logic
  async executeQuery(query, params = [], options = {}) {
    const startTime = Date.now();
    const maxRetries = options.maxRetries || this.maxRetries;
    const timeout = options.timeout || this.slowQueryThreshold;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.db.query(query, params);
        const duration = Date.now() - startTime;

        // لاگ کردن query های کند
        if (duration > timeout) {
          logger.warn(`🚨 هشدار عملکرد: کندی دیتابیس: ${duration}ms`);
          logger.warn(`🚨 هشدار دیتابیس: ${duration}ms`);
        }

        return result;
      } catch (error) {
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          if (attempt === maxRetries) {
            logger.error('خطا در جمع‌آوری متریک‌های کرالر: PostgreSQL connection error');
            throw error;
          }
          
          logger.warn(`تلاش ${attempt} برای query ناموفق (connection error)، انتظار...`);
          await this.delay(1000 * attempt);
        } else {
          throw error;
        }
      }
    }
  }

  // اجرای query با cache
  async executeCachedQuery(query, params = [], cacheKey = null) {
    if (!cacheKey) {
      cacheKey = this.generateCacheKey(query, params);
    }

    // بررسی cache
    if (this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 دقیقه
        logger.debug('Cache hit برای query');
        return cached.result;
      }
    }

    // اجرای query
    const result = await this.executeQuery(query, params);
    
    // ذخیره در cache
    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // محدود کردن اندازه cache
    if (this.queryCache.size > this.maxCacheSize) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }

    return result;
  }

  // تولید cache key
  generateCacheKey(query, params) {
    return crypto.createHash('md5')
      .update(query + JSON.stringify(params))
      .digest('hex');
  }

  // دریافت آمار دیتابیس
  async getDatabaseStats() {
    try {
      const stats = {};

      // تعداد رکوردها
      const tables = ['articles', 'news_sources', 'crawl_history', 'performance_metrics'];
      for (const table of tables) {
        const result = await this.db.query(`SELECT COUNT(*) as count FROM ${table}`);
        const rows = result.rows || [];
        stats[table] = parseInt(rows[0]?.count || 0);
      }

      // اندازه فایل دیتابیس
      const dbSize = await this.getDatabaseSize();
      stats.databaseSize = dbSize;

      // آمار cache
      stats.cacheSize = this.queryCache.size;
      stats.maxCacheSize = this.maxCacheSize;

      return stats;
    } catch (error) {
      logger.error('خطا در دریافت آمار دیتابیس:', error);
      return {};
    }
  }

  // دریافت اندازه دیتابیس
  async getDatabaseSize() {
    try {
      const result = await this.db.query(`
        SELECT 
                pg_size_pretty(pg_database_size('crawler_db')) as size,
      pg_database_size('crawler_db') as size_bytes
      `);
      
      if (result && (result.rows || []).length > 0) {
        const rows = result.rows || [];
    return Math.round((rows[0]?.size_bytes || 0) / 1024 / 1024); // MB
      }
      return 0;
    } catch (error) {
      logger.error('خطا در دریافت اندازه دیتابیس:', error);
      return 0;
    }
  }

  // پاکسازی cache
  clearCache() {
    this.queryCache.clear();
    logger.info('Cache دیتابیس پاکسازی شد');
  }

  // تابع کمکی برای delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // بستن اتصال
  async close() {
    try {
      this.clearCache();
      logger.info('اتصال دیتابیس بسته شد');
    } catch (error) {
      logger.error('خطا در بستن اتصال دیتابیس:', error);
    }
  }
}

module.exports = DatabaseOptimizer; 
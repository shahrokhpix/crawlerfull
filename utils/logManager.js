const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('./logger');

class LogManager {
  constructor() {
    this.logBuffer = [];
    this.bufferSize = config.logging.database.batchSize || 100;
    this.flushInterval = 30000; // 30 ثانیه
    this.isShuttingDown = false;
    
    // شروع flush دوره‌ای
    this.startPeriodicFlush();
    
    // مدیریت shutdown
    this.setupGracefulShutdown();
  }

  // اضافه کردن لاگ به buffer
  addToBuffer(logEntry) {
    if (this.isShuttingDown) return;
    
    this.logBuffer.push(logEntry);
    
    // flush کردن اگر buffer پر شد
    if (this.logBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }
  }

  // flush کردن buffer به دیتابیس
  async flushBuffer() {
    if (this.logBuffer.length === 0) return;
    
    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];
    
    try {
      const connectionPool = require('../services/connectionPool');
      
      // ثبت دسته‌ای لاگ‌ها
      for (const logEntry of logsToFlush) {
        await connectionPool.query(
          `INSERT INTO crawl_logs 
           (source_id, action, status, message, articles_found, articles_processed, duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            logEntry.sourceId,
            logEntry.action,
            logEntry.status,
            logEntry.message,
            logEntry.stats.articlesFound || 0,
            logEntry.stats.articlesProcessed || 0,
            logEntry.stats.duration || 0
          ]
        );
      }
      
      logger.debug(`${logsToFlush.length} لاگ با موفقیت در دیتابیس ثبت شد`);
    } catch (error) {
      logger.error('خطا در flush کردن لاگ‌ها:', error);
      // بازگرداندن لاگ‌ها به buffer در صورت خطا
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  // شروع flush دوره‌ای
  startPeriodicFlush() {
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.flushInterval);
  }

  // پاکسازی لاگ‌های قدیمی
  async cleanupOldLogs() {
    try {
      const connectionPool = require('../services/connectionPool');
      const cleanupDays = config.logging.database.cleanupDays || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);
      
      const result = await connectionPool.query(
        'DELETE FROM crawl_logs WHERE created_at < $1',
        [cutoffDate.toISOString()]
      );
      
      if (result.rowCount > 0) {
        logger.info(`${result.rowCount} لاگ قدیمی پاک شد`);
      }
      
      return result.rowCount;
    } catch (error) {
      logger.error('خطا در پاکسازی لاگ‌های قدیمی:', error);
      throw error;
    }
  }

  // پاکسازی فایل‌های لاگ قدیمی
  async cleanupOldLogFiles() {
    try {
      const logDir = path.join(__dirname, '..', 'logs');
      const files = fs.readdirSync(logDir);
      const maxFiles = config.logging.file.maxFiles || 3;
      
      // مرتب‌سازی فایل‌ها بر اساس تاریخ تغییر
      const logFiles = files
        .filter(file => file.startsWith('crawler-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          mtime: fs.statSync(path.join(logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
      
      // حذف فایل‌های اضافی
      if (logFiles.length > maxFiles) {
        const filesToDelete = logFiles.slice(maxFiles);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          logger.info(`فایل لاگ قدیمی حذف شد: ${file.name}`);
        }
      }
    } catch (error) {
      logger.error('خطا در پاکسازی فایل‌های لاگ:', error);
    }
  }

  // مدیریت shutdown
  setupGracefulShutdown() {
    const shutdown = async () => {
      this.isShuttingDown = true;
      logger.info('در حال بستن LogManager...');
      
      // متوقف کردن timer
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
      
      // flush کردن لاگ‌های باقی‌مانده
      await this.flushBuffer();
      
      logger.info('LogManager با موفقیت بسته شد');
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('beforeExit', shutdown);
  }

  // دریافت آمار لاگ‌ها
  async getLogStats() {
    try {
      const connectionPool = require('../services/connectionPool');
      
      const stats = await connectionPool.query(`
        SELECT 
          COUNT(*) as total_logs,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as success_logs,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as error_logs,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as logs_24h
        FROM crawl_logs
      `);
      
      return stats;
    } catch (error) {
      logger.error('خطا در دریافت آمار لاگ‌ها:', error);
      throw error;
    }
  }
}

module.exports = new LogManager();
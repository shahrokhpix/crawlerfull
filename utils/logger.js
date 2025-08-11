const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const config = require('../config/config');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.logLevel = config.logging.level || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      success: 2,
      debug: 3
    };
    this.ensureLogDir();
  }

  shouldLog(level) {
    const currentLevel = this.levels[this.logLevel] || 2;
    const messageLevel = this.levels[level] || 2;
    return messageLevel <= currentLevel;
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFileName() {
    const date = moment().tz('Asia/Tehran').format('YYYY-MM-DD');
    return path.join(this.logDir, `crawler-${date}.log`);
  }

  formatMessage(level, message, data = null) {
    const timestamp = moment().tz('Asia/Tehran').format();
    const logData = data ? ` | Data: ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${logData}\n`;
  }

  writeToFile(level, message, data = null) {
    const logMessage = this.formatMessage(level, message, data);
    const logFile = this.getLogFileName();
    
    fs.appendFile(logFile, logMessage, (err) => {
      if (err) {
        console.error('خطا در نوشتن لاگ:', err);
      }
    });
  }

  info(message, data = null) {
    if (this.shouldLog('info')) {
      console.log(`ℹ️ ${message}`, data || '');
      this.writeToFile('info', message, data);
    }
  }

  error(message, error = null) {
    if (this.shouldLog('error')) {
      const errorData = error ? {
        message: error.message,
        stack: error.stack
      } : null;
      
      console.error(`❌ ${message}`, errorData || '');
      this.writeToFile('error', message, errorData);
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️ ${message}`, data || '');
      this.writeToFile('warn', message, data);
    }
  }

  success(message, data = null) {
    if (this.shouldLog('success')) {
      console.log(`✅ ${message}`, data || '');
      this.writeToFile('success', message, data);
    }
  }

  debug(message, data = null) {
    if (this.shouldLog('debug')) {
      console.log(`🐛 ${message}`, data || '');
      this.writeToFile('debug', message, data);
    }
  }

  // لاگ کرال در دیتابیس (بهینه‌سازی شده)
  logCrawlOperation(sourceId, action, status, message, stats = {}) {
    try {
      // استفاده از LogManager برای مدیریت بهینه
      const logManager = require('./logManager');
      
      const logEntry = {
        sourceId,
        action,
        status,
        message,
        stats: stats || {},
        timestamp: new Date().toISOString()
      };
      
      // اضافه کردن به buffer به جای ثبت فوری
      logManager.addToBuffer(logEntry);
      
      // لاگ فقط برای خطاها یا در سطح debug
      if (status === 'error') {
        this.error(`کرال ${action}: ${message}`, stats);
      } else if (this.shouldLog('debug')) {
        this.debug(`کرال ${action}: ${message}`, stats);
      }
      
    } catch (err) {
      this.error('خطا در ثبت لاگ کرال:', err);
    }
  }

  // دریافت لاگ‌های اخیر
  async getRecentLogs(limit = 50) {
    try {
      const connectionPool = require('../services/connectionPool');
      const query = `
        SELECT cl.*, ns.name as source_name
        FROM crawl_logs cl
        LEFT JOIN news_sources ns ON cl.source_id = ns.id
        ORDER BY cl.created_at DESC
        LIMIT $1
      `;
      
      const result = await connectionPool.query(query, [limit]);
      const rows = result.rows;
      return rows;
    } catch (err) {
      this.error('خطا در دریافت لاگ‌های اخیر:', err);
      throw err;
    }
  }

  // پاک کردن لاگ‌های قدیمی
  async cleanOldLogs(daysToKeep = 30) {
    try {
      const connectionPool = require('../services/connectionPool');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const query = `DELETE FROM crawl_logs WHERE created_at < $1`;
      const result = await connectionPool.query(query, [cutoffDate.toISOString()]);
      
              return result.rowCount;
    } catch (err) {
      this.error('خطا در پاک کردن لاگ‌های قدیمی:', err);
      throw err;
    }
  }
}

module.exports = new Logger();
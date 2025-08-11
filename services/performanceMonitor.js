const EventEmitter = require('events');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const Database = require('../config/database');

class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // افزایش حد مجاز listener ها
    this.db = Database.db;
    this.metrics = {
      cpu: [],
      memory: [],
      disk: [],
      network: [],
      database: [],
      crawlers: []
    };
    this.alerts = {
      cpu: { threshold: 70, active: false }, // کاهش آستانه
      memory: { threshold: 75, active: false }, // کاهش آستانه
      disk: { threshold: 85, active: false }, // کاهش آستانه
      database: { threshold: 2000, active: false } // افزایش آستانه دیتابیس
    };
    this.isMonitoring = false;
    this.monitoringInterval = 15000; // کاهش به 15 ثانیه
    this.retentionPeriod = 12 * 60 * 60 * 1000; // کاهش به 12 ساعت
    this.lastCleanup = Date.now();
    this.databaseQueryTimes = [];
    this.maxQueryTimeHistory = 50;
    
    // ایجاد جدول متریک‌ها
    this.createMetricsTable();
  }

  // ایجاد جدول متریک‌ها
  async createMetricsTable() {
    try {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id SERIAL PRIMARY KEY,
          timestamp BIGINT NOT NULL,
          metric_type TEXT NOT NULL,
          metric_name TEXT NOT NULL,
          value REAL NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_metrics_timestamp 
        ON performance_metrics(timestamp)
      `);

      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_metrics_type 
        ON performance_metrics(metric_type, metric_name)
      `);
    } catch (error) {
      logger.error('خطا در ایجاد جدول متریک‌ها:', error);
    }
  }

  // شروع مانیتورینگ
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    logger.info('شروع مانیتورینگ عملکرد با آستانه‌های جدید...');
    
    // مانیتورینگ دوره‌ای
    this.monitoringTimer = setInterval(() => {
      this.collectMetrics();
    }, this.monitoringInterval);
    
    // پاکسازی دوره‌ای
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
    }, 30 * 60 * 1000); // هر 30 دقیقه
    
    // شروع جمع‌آوری فوری
    this.collectMetrics();
  }

  // توقف مانیتورینگ
  stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    logger.info('مانیتورینگ عملکرد متوقف شد');
  }

  // جمع‌آوری متریک‌ها
  async collectMetrics() {
    try {
      const timestamp = Date.now();
      
      // جمع‌آوری متریک‌های مختلف
      await Promise.all([
        this.collectCPUMetrics(timestamp),
        this.collectMemoryMetrics(timestamp),
        this.collectDiskMetrics(timestamp),
        this.collectDatabaseMetrics(timestamp),
        this.collectCrawlerMetrics(timestamp)
      ]);
      
      // بررسی هشدارها
      await this.checkAlerts();
      
    } catch (error) {
      logger.error('خطا در جمع‌آوری متریک‌های کرالر:', error);
    }
  }

  // جمع‌آوری متریک‌های CPU
  async collectCPUMetrics(timestamp) {
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
    const usage = 100 - (100 * idle / total);
    
    await this.saveMetric(timestamp, 'cpu', 'usage_percent', usage);
    await this.saveMetric(timestamp, 'cpu', 'load_average', os.loadavg()[0]);
  }

  // جمع‌آوری متریک‌های حافظه
  async collectMemoryMetrics(timestamp) {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = (usedMem / totalMem) * 100;
    
    await this.saveMetric(timestamp, 'system', 'memory_usage', memUsage, {
      total: totalMem,
      used: usedMem,
      free: freeMem
    });
    
    // متریک‌های Node.js
    const nodeMemory = process.memoryUsage();
    await this.saveMetric(timestamp, 'nodejs', 'heap_used', nodeMemory.heapUsed);
    await this.saveMetric(timestamp, 'nodejs', 'heap_total', nodeMemory.heapTotal);
    await this.saveMetric(timestamp, 'nodejs', 'rss', nodeMemory.rss);
    await this.saveMetric(timestamp, 'nodejs', 'external', nodeMemory.external);
  }

  // جمع‌آوری متریک‌های دیسک
  async collectDiskMetrics(timestamp) {
    try {
      const stats = await fs.stat(process.cwd());
      
      // دریافت اندازه دیتابیس PostgreSQL
      const dbSizeResult = await this.db.query(`
        SELECT pg_database_size('crawler_db') as size
      `);
      
      if (dbSizeResult && dbSizeResult.length > 0) {
        const rows = dbSizeResult.rows || [];
        await this.saveMetric(timestamp, 'storage', 'database_size', rows[0]?.size || 0);
      }
      
      // بررسی فضای آزاد (تقریبی)
      const diskUsage = await this.getDiskUsage();
      if (diskUsage) {
        await this.saveMetric(timestamp, 'storage', 'disk_usage', diskUsage.usage, {
          total: diskUsage.total,
          used: diskUsage.used,
          free: diskUsage.free
        });
      }
      
    } catch (error) {
      logger.warn('خطا در جمع‌آوری متریک‌های دیسک:', error.message);
    }
  }

  // جمع‌آوری متریک‌های دیتابیس
  async collectDatabaseMetrics(timestamp) {
    try {
      // تعداد مقالات
      const articleCount = await this.getTableCount('articles');
      await this.saveMetric(timestamp, 'database', 'article_count', articleCount);
      
      // تعداد منابع
      const sourceCount = await this.getTableCount('news_sources');
      await this.saveMetric(timestamp, 'database', 'source_count', sourceCount);
      
      // سرعت کوئری
      const queryTime = await this.measureQueryTime();
      await this.saveMetric(timestamp, 'database', 'query_time', queryTime);
      
      // اندازه دیتابیس
      const dbSize = await this.getDatabaseSize();
      await this.saveMetric(timestamp, 'database', 'size', dbSize);
      
    } catch (error) {
      logger.warn('خطا در جمع‌آوری متریک‌های دیتابیس:', error.message);
    }
  }

  // جمع‌آوری متریک‌های کرالر
  async collectCrawlerMetrics(timestamp) {
    try {
      // آمار کرال‌های اخیر
      const recentCrawls = await this.getRecentCrawlStats();
      
      if (recentCrawls) {
        await this.saveMetric(timestamp, 'crawler', 'success_rate', recentCrawls.successRate);
        await this.saveMetric(timestamp, 'crawler', 'avg_duration', recentCrawls.avgDuration);
        await this.saveMetric(timestamp, 'crawler', 'total_crawls', recentCrawls.totalCrawls);
      }
      
      // وضعیت صف
      const QueueManager = require('./queueManager');
      if (global.queueManager instanceof QueueManager) {
        const queueStats = global.queueManager.getStats();
        await this.saveMetric(timestamp, 'queue', 'pending_jobs', queueStats.queueSizes.high + queueStats.queueSizes.normal + queueStats.queueSizes.low);
        await this.saveMetric(timestamp, 'queue', 'processing_jobs', queueStats.processing);
        await this.saveMetric(timestamp, 'queue', 'completed_jobs', queueStats.processed);
        await this.saveMetric(timestamp, 'queue', 'failed_jobs', queueStats.failed);
      }
      
    } catch (error) {
      logger.warn('خطا در جمع‌آوری متریک‌های کرالر:', error.message);
    }
  }

  // ذخیره متریک
  async saveMetric(timestamp, type, name, value, metadata = null) {
    try {
      await this.db.query(`
        INSERT INTO performance_metrics (timestamp, metric_type, metric_name, value, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [timestamp, type, name, value, metadata ? JSON.stringify(metadata) : null]);
    } catch (error) {
      logger.error('خطا در ذخیره متریک:', error);
    }
  }

  // بررسی هشدارها
  async checkAlerts() {
    const latest = await this.getLatestMetrics();
    
    // هشدار CPU
    if (latest.cpu_usage > this.alerts.cpu.threshold) {
      if (!this.alerts.cpu.active) {
        this.alerts.cpu.active = true;
        this.emit('alert', {
          type: 'cpu',
          level: 'warning',
          message: `استفاده از CPU بالا: ${latest.cpu_usage.toFixed(1)}%`,
          value: latest.cpu_usage,
          threshold: this.alerts.cpu.threshold
        });
        logger.warn(`🚨 هشدار CPU: ${latest.cpu_usage.toFixed(1)}%`);
      }
    } else {
      this.alerts.cpu.active = false;
    }
    
    // هشدار حافظه
    if (latest.memory_usage > this.alerts.memory.threshold) {
      if (!this.alerts.memory.active) {
        this.alerts.memory.active = true;
        this.emit('alert', {
          type: 'memory',
          level: 'warning',
          message: `استفاده از حافظه بالا: ${latest.memory_usage.toFixed(1)}%`,
          value: latest.memory_usage,
          threshold: this.alerts.memory.threshold
        });
        logger.warn(`🚨 هشدار حافظه: ${latest.memory_usage.toFixed(1)}%`);
      }
    } else {
      this.alerts.memory.active = false;
    }
    
    // هشدار دیسک
    if (latest.disk_usage && latest.disk_usage > this.alerts.disk.threshold) {
      if (!this.alerts.disk.active) {
        this.alerts.disk.active = true;
        this.emit('alert', {
          type: 'disk',
          level: 'critical',
          message: `فضای دیسک کم: ${latest.disk_usage.toFixed(1)}%`,
          value: latest.disk_usage,
          threshold: this.alerts.disk.threshold
        });
        logger.error(`🚨 هشدار دیسک: ${latest.disk_usage.toFixed(1)}%`);
      }
    } else {
      this.alerts.disk.active = false;
    }
    
    // هشدار دیتابیس
    if (latest.query_time > this.alerts.database.threshold) {
      if (!this.alerts.database.active) {
        this.alerts.database.active = true;
        this.emit('alert', {
          type: 'database',
          level: 'warning',
          message: `کندی دیتابیس: ${latest.query_time}ms`,
          value: latest.query_time,
          threshold: this.alerts.database.threshold
        });
        logger.warn(`🚨 هشدار دیتابیس: ${latest.query_time}ms`);
      }
    } else {
      this.alerts.database.active = false;
    }
  }

  // دریافت آخرین متریک‌ها
  async getLatestMetrics() {
    try {
      const result = await this.db.query(`
        SELECT metric_name, value
        FROM performance_metrics
        WHERE timestamp > $1
        ORDER BY timestamp DESC
        LIMIT 100
      `, [Date.now() - this.monitoringInterval * 2]);
      
      const rows = result.rows || [];
      const metrics = {};
      rows.forEach(row => {
        if (!metrics[row.metric_name]) {
          metrics[row.metric_name] = row.value;
        }
      });
      return metrics;
    } catch (error) {
      logger.warn('خطا در دریافت آخرین متریک‌ها:', error.message);
      return {};
    }
  }

  // دریافت آمار عملکرد
  async getPerformanceStats(hours = 1) {
    try {
      const since = Date.now() - (hours * 60 * 60 * 1000);
      
      const result = await this.db.query(`
        SELECT 
          metric_type,
          metric_name,
          AVG(value) as avg_value,
          MIN(value) as min_value,
          MAX(value) as max_value,
          COUNT(*) as sample_count
        FROM performance_metrics
        WHERE timestamp > $1
        GROUP BY metric_type, metric_name
        ORDER BY metric_type, metric_name
      `, [since]);
      
      const rows = result.rows || [];
      const stats = {};
      rows.forEach(row => {
        if (!stats[row.metric_type]) {
          stats[row.metric_type] = {};
        }
        stats[row.metric_type][row.metric_name] = {
          avg: Math.round(row.avg_value * 100) / 100,
          min: Math.round(row.min_value * 100) / 100,
          max: Math.round(row.max_value * 100) / 100,
          samples: row.sample_count
        };
      });
      return stats;
    } catch (error) {
      logger.warn('خطا در دریافت آمار عملکرد:', error.message);
      return {};
    }
  }

  // تابع‌های کمکی
  async getTableCount(tableName) {
    try {
      const result = await this.db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      const rows = result.rows || [];
      return rows.length > 0 ? rows[0].count : 0;
    } catch (error) {
      logger.warn('خطا در دریافت تعداد رکوردها:', error.message);
      return 0;
    }
  }

  async measureQueryTime() {
    try {
      const start = Date.now();
      await this.db.query('SELECT COUNT(*) FROM articles WHERE created_at > NOW() - INTERVAL \'1 hour\'');
      return Date.now() - start;
    } catch (error) {
      logger.warn('خطا در اندازه‌گیری زمان کوئری:', error.message);
      return 0;
    }
  }

  async getDatabaseSize() {
    try {
      const result = await this.db.query(`
        SELECT pg_database_size('crawler_db') as size
      `);
      
      const rows = result.rows || [];
      if (rows.length > 0) {
        return rows[0].size;
      }
      return 0;
    } catch (error) {
      logger.warn('خطا در دریافت اندازه دیتابیس:', error.message);
      return 0;
    }
  }

  async getDiskUsage() {
    // پیاده‌سازی ساده برای Windows
    if (os.platform() === 'win32') {
      return null; // نیاز به ابزار خارجی
    }
    
    // برای سیستم‌های Unix-like
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec('df -h .', (error, stdout) => {
          if (error) {
            resolve(null);
            return;
          }
          
          const lines = stdout.split('\n');
          if (lines.length > 1) {
            const parts = lines[1].split(/\s+/);
            const usage = parseInt(parts[4]);
            resolve({ usage });
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      return null;
    }
  }

  async getRecentCrawlStats() {
    // این تابع باید با سیستم لاگ کرالر یکپارچه شود
    return {
      successRate: 85,
      avgDuration: 5000,
      totalCrawls: 10
    };
  }

  // پاکسازی متریک‌های قدیمی
  async cleanupOldMetrics() {
    try {
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 روز پیش
      await this.db.query(`
        DELETE FROM performance_metrics 
        WHERE timestamp < $1
      `, [cutoffTime]);
    } catch (error) {
      logger.error('خطا در پاکسازی متریک‌های قدیمی:', error);
    }
  }

  // تنظیم آستانه هشدار
  setAlertThreshold(type, threshold) {
    if (this.alerts[type]) {
      this.alerts[type].threshold = threshold;
      logger.info(`آستانه هشدار ${type} به ${threshold} تغییر یافت`);
    }
  }

  // دریافت وضعیت سیستم
  getSystemStatus() {
    return {
      monitoring: this.isMonitoring,
      alerts: Object.keys(this.alerts).reduce((acc, key) => {
        acc[key] = {
          active: this.alerts[key].active,
          threshold: this.alerts[key].threshold
        };
        return acc;
      }, {}),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch()
    };
  }
}

module.exports = PerformanceMonitor;
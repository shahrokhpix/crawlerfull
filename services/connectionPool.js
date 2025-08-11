const { Pool } = require('pg');
const logger = require('../utils/logger');

class ConnectionPool {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'farsnews_user',
      host: process.env.DB_HOST || 'postgres',
      database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
      password: process.env.DB_PASSWORD || 'farsnews123',
      port: parseInt(process.env.DB_PORT) || 5432,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('connect', () => {
      logger.info('✅ Connected to PostgreSQL database');
    });

    this.pool.on('error', (err) => {
      logger.error('❌ PostgreSQL connection error:', err);
    });
  }

  // دریافت اتصال از pool
  async getConnection() {
    return this.pool.connect();
  }

  // اجرای query با مدیریت اتصال
  async query(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      return result;
    } catch (error) {
      logger.error('خطا در اجرای query:', error);
      throw error;
    }
  }

  // اجرای query بدون بازگرداندن نتیجه
  async run(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      return result;
    } catch (error) {
      logger.error('خطا در اجرای run:', error);
      throw error;
    }
  }

  // دریافت یک رکورد
  async get(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      const rows = result.rows || [];
    return rows[0] || null;
    } catch (error) {
      logger.error('خطا در اجرای get:', error);
      throw error;
    }
  }

  // بستن pool
  async shutdown() {
    try {
      await this.pool.end();
      logger.info('✅ Connection pool closed successfully');
    } catch (error) {
      logger.error('❌ خطا در بستن connection pool:', error);
      throw error;
    }
  }

  // دریافت آمار pool
  getStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  // بررسی وضعیت اتصال
  async healthCheck() {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('❌ Health check failed:', error);
      return false;
    }
  }
}

module.exports = new ConnectionPool();
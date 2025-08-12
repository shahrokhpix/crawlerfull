const { Pool } = require('pg');
const logger = require('../utils/logger');

class PostgreSQLDatabase {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'crawler_user',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'crawler_db',
      password: process.env.DB_PASSWORD || 'farsnews123',
      port: process.env.DB_PORT || 5432,
      max: 20, // connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      statement_timeout: 30000, // 30 seconds
      query_timeout: 30000,
    });

    // Event listeners
    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    this.pool.on('connect', () => {
      logger.debug('New client connected to PostgreSQL');
    });

    this.isInitialized = false;
  }

  // راه‌اندازی دیتابیس
  async init() {
    if (this.isInitialized) return;

    try {
      // تست اتصال
      await this.pool.query('SELECT 1');
      
      // ایجاد جداول اگر وجود ندارند
      await this.createTables();
      
      this.isInitialized = true;
      logger.info('PostgreSQL database initialized successfully');
    } catch (error) {
      logger.error('Error initializing PostgreSQL database:', error);
      throw error;
    }
  }

  // ایجاد جداول
  async createTables() {
    try {
      // جدول منابع خبری
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS news_sources (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          base_url TEXT NOT NULL,
          list_selector TEXT NOT NULL,
          title_selector TEXT,
          content_selector TEXT,
          link_selector TEXT,
          driver_type TEXT DEFAULT 'puppeteer',
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // جدول مقالات
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS articles (
          id SERIAL PRIMARY KEY,
          source_id INTEGER REFERENCES news_sources(id),
          title TEXT NOT NULL,
          link TEXT UNIQUE NOT NULL,
          content TEXT,
          hash TEXT UNIQUE,
          depth INTEGER DEFAULT 0,
          is_read BOOLEAN DEFAULT FALSE,
          compressed INTEGER DEFAULT 0,
          compressed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // جدول تاریخچه کرال
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS crawl_history (
          id SERIAL PRIMARY KEY,
          source_id INTEGER REFERENCES news_sources(id),
          start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          end_time TIMESTAMP,
          articles_found INTEGER DEFAULT 0,
          articles_saved INTEGER DEFAULT 0,
          errors TEXT,
          status TEXT DEFAULT 'running'
        )
      `);

      // جدول متریک‌های عملکرد
      await this.pool.query(`
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

      // ایجاد index ها
      await this.createIndexes();

      logger.info('PostgreSQL tables created successfully');
    } catch (error) {
      logger.error('Error creating tables:', error);
      throw error;
    }
  }

  // ایجاد index ها
  async createIndexes() {
    try {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id)',
        'CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(hash)',
        'CREATE INDEX IF NOT EXISTS idx_articles_title_gin ON articles USING gin(to_tsvector(\'persian\', title))',
        'CREATE INDEX IF NOT EXISTS idx_sources_active ON news_sources(active)',
        'CREATE INDEX IF NOT EXISTS idx_crawl_history_timestamp ON crawl_history(start_time)',
        'CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp)'
      ];

      for (const index of indexes) {
        await this.pool.query(index);
      }

      logger.info('PostgreSQL indexes created successfully');
    } catch (error) {
      logger.error('Error creating indexes:', error);
    }
  }

  // اجرای query
  async query(sql, params = []) {
    const startTime = Date.now();
    
    try {
      const result = await this.pool.query(sql, params);
      const duration = Date.now() - startTime;
      
      // لاگ کردن query های کند
      if (duration > 2000) {
        logger.warn(`Slow query detected: ${duration}ms - ${sql.substring(0, 100)}...`);
      }
      
      return result.rows;
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  // اجرای query با یک رکورد
  async get(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows[0] || null;
  }

  // اجرای query بدون نتیجه
  async run(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return {
      changes: result.rowCount,
      lastID: result.rows[0]?.id
    };
  }

  // اجرای query با transaction
  async transaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // جستجوی متن کامل
  async fullTextSearch(query, limit = 50) {
    const sql = `
      SELECT id, title, link, content, created_at,
             ts_rank(to_tsvector('persian', title || ' ' || COALESCE(content, '')), plainto_tsquery('persian', $1)) as rank
      FROM articles 
      WHERE to_tsvector('persian', title || ' ' || COALESCE(content, '')) @@ plainto_tsquery('persian', $1)
      ORDER BY rank DESC, created_at DESC
      LIMIT $2
    `;
    
    return await this.query(sql, [query, limit]);
  }

  // آمار دیتابیس
  async getStats() {
    try {
      const stats = {};
      
      // تعداد رکوردها
      const tables = ['articles', 'news_sources', 'crawl_history', 'performance_metrics'];
      for (const table of tables) {
        const result = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = parseInt(result.count);
      }
      
      // اندازه دیتابیس
      const sizeResult = await this.get(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      stats.databaseSize = sizeResult.size;
      
      // آمار connection pool
      stats.poolSize = this.pool.totalCount;
      stats.poolIdle = this.pool.idleCount;
      
      return stats;
    } catch (error) {
      logger.error('Error getting database stats:', error);
      return {};
    }
  }

  // پاکسازی داده‌های قدیمی
  async cleanupOldData() {
    try {
      // حذف مقالات قدیمی (بیش از 30 روز)
      const articlesResult = await this.run(`
        DELETE FROM articles 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      
      // حذف متریک‌های قدیمی (بیش از 7 روز)
      const metricsResult = await this.run(`
        DELETE FROM performance_metrics 
        WHERE timestamp < EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
      `);
      
      // حذف تاریخچه کرال قدیمی (بیش از 14 روز)
      const historyResult = await this.run(`
        DELETE FROM crawl_history 
        WHERE start_time < NOW() - INTERVAL '14 days'
      `);
      
      logger.info(`Cleanup completed: ${articlesResult.changes} articles, ${metricsResult.changes} metrics, ${historyResult.changes} history records`);
      
      // VACUUM برای آزادسازی فضای دیسک
      await this.pool.query('VACUUM ANALYZE');
      
    } catch (error) {
      logger.error('Error cleaning up old data:', error);
    }
  }

  // بستن اتصال
  async close() {
    try {
      await this.pool.end();
      logger.info('PostgreSQL connection pool closed');
    } catch (error) {
      logger.error('Error closing PostgreSQL connection:', error);
    }
  }

  // دریافت connection pool برای سازگاری
  get db() {
    return {
      query: (sql, params) => this.query(sql, params),
      get: (sql, params) => this.get(sql, params),
      run: (sql, params) => this.run(sql, params),
      transaction: (callback) => this.transaction(callback)
    };
  }
}

module.exports = PostgreSQLDatabase; 
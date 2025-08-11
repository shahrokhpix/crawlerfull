const { Pool } = require('pg');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'crawler_user',
      host: process.env.DB_HOST || 'postgres',
      database: process.env.DB_NAME || 'crawler_db',
      password: process.env.DB_PASSWORD || 'your_secure_password',
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

    this.isInitialized = false;
    this.init();
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      await this.createTables();
      this.isInitialized = true;
      logger.info('Database با PostgreSQL راه‌اندازی شد');
    } catch (error) {
      logger.error('خطا در راه‌اندازی database:', error);
      throw error;
    }
  }

  // برای سازگاری با کد قدیمی
  get db() {
    return {
      query: async (sql, params = []) => {
        try {
          const result = await this.pool.query(sql, params);
          return result;
        } catch (err) {
          throw err;
        }
      },
      all: (sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        this.pool.query(sql, params)
          .then(result => {
            if (callback) {
              callback(null, result.rows);
            }
          })
          .catch(err => {
            if (callback) {
              callback(err);
            }
          });
      },
      get: (sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        this.pool.query(sql, params)
          .then(result => {
            if (callback) {
              callback(null, result.rows[0]);
            }
          })
          .catch(err => {
            if (callback) {
              callback(err);
            }
          });
      },
      run: (sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        this.pool.query(sql, params)
          .then(result => {
            if (callback) {
              callback(null, result);
            }
          })
          .catch(err => {
            if (callback) {
              callback(err);
            }
          });
      },
      prepare: (sql) => {
        const pool = this.pool;
        return {
          run: (...args) => {
            let params = [];
            let callback = null;
            
            if (args.length > 0) {
              const lastArg = args[args.length - 1];
              if (typeof lastArg === 'function') {
                callback = lastArg;
                params = args.slice(0, -1);
              } else {
                params = args;
              }
            }
            
            pool.query(sql, params)
              .then(result => {
                if (callback) {
                  callback(null, result);
                }
              })
              .catch(err => {
                if (callback) {
                  callback(err);
                }
              });
          },
          finalize: () => {
            // No-op for PostgreSQL
          }
        };
      },
      serialize: (callback) => {
        if (typeof callback === 'function') {
          callback();
        }
      }
    };
  }

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

      // جدول اخبار
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS articles (
          id SERIAL PRIMARY KEY,
          source_id INTEGER REFERENCES news_sources(id),
          title TEXT NOT NULL,
          link TEXT NOT NULL UNIQUE,
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

      // جدول صف کارها
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS queue_jobs (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          priority TEXT DEFAULT 'normal',
          status TEXT DEFAULT 'queued',
          data TEXT NOT NULL,
          attempts INTEGER DEFAULT 0,
          created_at BIGINT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          started_at BIGINT,
          completed_at BIGINT,
          failed_at BIGINT
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

      // جدول پیکربندی‌های selector builder
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS selector_configs (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          selectors TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // جدول کاربران ادمین
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          email TEXT,
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // جدول لاگ‌ها
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS crawl_logs (
          id SERIAL PRIMARY KEY,
          source_id INTEGER REFERENCES news_sources(id),
          action TEXT NOT NULL,
          status TEXT NOT NULL,
          message TEXT,
          articles_found INTEGER DEFAULT 0,
          articles_processed INTEGER DEFAULT 0,
          duration_ms INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // جدول لاگ‌های عملیات
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS operation_logs (
          id SERIAL PRIMARY KEY,
          source_id INTEGER REFERENCES news_sources(id),
          action TEXT NOT NULL,
          status TEXT NOT NULL,
          message TEXT,
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // جدول تاریخچه کرال
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS crawl_history (
          id SERIAL PRIMARY KEY,
          source_id INTEGER REFERENCES news_sources(id),
          total_found INTEGER DEFAULT 0,
          total_processed INTEGER DEFAULT 0,
          new_articles INTEGER DEFAULT 0,
          crawl_depth INTEGER DEFAULT 0,
          duration_ms INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // جدول زمان‌بندی کرال
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS schedules (
          id SERIAL PRIMARY KEY,
          source_id INTEGER REFERENCES news_sources(id),
          cron_expression TEXT NOT NULL,
          active BOOLEAN DEFAULT TRUE,
          last_run TIMESTAMP,
          next_run TIMESTAMP,
          crawl_depth INTEGER DEFAULT 1,
          full_content BOOLEAN DEFAULT FALSE,
          article_limit INTEGER DEFAULT 10,
          timeout_ms INTEGER DEFAULT 30000,
          follow_links BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // ایندکس‌های بهینه
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at)
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id)
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(hash)
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_sources_active ON news_sources(active)
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_crawl_history_timestamp ON crawl_history(created_at)
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp)
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_queue_status_priority ON queue_jobs(status, priority, created_at)
      `);

      logger.info('✅ جداول PostgreSQL با موفقیت ایجاد شدند');

      // اضافه کردن منبع پیش‌فرض فارس‌نیوز
      await this.pool.query(`
        INSERT INTO news_sources (name, base_url, list_selector, title_selector, content_selector, link_selector)
        VALUES ('فارس‌نیوز', 'https://www.farsnews.ir/showcase', 'a[href*="/news/"]', 'h1, .title', '.story, .content, .news-content, p', 'a')
        ON CONFLICT (name) DO NOTHING
      `);

      // اضافه کردن کاربر ادمین پیش‌فرض
      const bcrypt = require('bcryptjs');
      const defaultPassword = bcrypt.hashSync('admin123', 10);
      
      await this.pool.query(`
        INSERT INTO admin_users (username, password_hash, email)
        VALUES ('admin', $1, 'admin@crawler.local')
        ON CONFLICT (username) DO UPDATE SET password_hash = $1
      `, [defaultPassword]);

      logger.info('✅ کاربر admin پیش‌فرض ایجاد شد');

    } catch (error) {
      logger.error('❌ خطا در ایجاد جداول:', error);
      throw error;
    }
  }

  getDb() {
    return this.db;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

module.exports = new Database();
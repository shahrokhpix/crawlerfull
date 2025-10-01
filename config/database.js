require('dotenv').config();
const { Pool } = require('pg');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

class Database {
  constructor() {
    if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_HOST) {
      throw new Error('❌ Missing required database environment variables');
    }

    this.pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased from 2000 to 10000
      acquireTimeoutMillis: 60000,    // Added acquire timeout
      createTimeoutMillis: 30000,     // Added create timeout
    });

    this.pool.on('connect', () => {
      logger.info('✅ Connected to PostgreSQL database');
    });

    this.pool.on('error', (err) => {
      logger.error('❌ PostgreSQL connection error:', err);
    });

    this.isInitialized = false;
    this.initPromise = this.init();
  }

  async init() {
    if (this.isInitialized) return;

    try {
      logger.info('🔄 Initializing database and creating tables...');
      await this.createTables();
      this.isInitialized = true;
      logger.info('✅ Database initialized successfully');
    } catch (error) {
      logger.error('❌ Error initializing database:', error);
      throw error;
    }
  }

  get db() {
    return {
      query: async (sql, params = []) => this.pool.query(sql, params),
      all: (sql, params, callback) => {
        if (typeof params === 'function') { callback = params; params = []; }
        this.pool.query(sql, params)
          .then(res => callback?.(null, res.rows))
          .catch(err => callback?.(err));
      },
      get: (sql, params, callback) => {
        if (typeof params === 'function') { callback = params; params = []; }
        this.pool.query(sql, params)
          .then(res => callback?.(null, res.rows[0]))
          .catch(err => callback?.(err));
      },
      run: (sql, params, callback) => {
        if (typeof params === 'function') { callback = params; params = []; }
        this.pool.query(sql, params)
          .then(res => callback?.(null, res))
          .catch(err => callback?.(err));
      },
      prepare: (sql) => {
        const pool = this.pool;
        return {
          run: (...args) => {
            let params = [], callback;
            const lastArg = args[args.length - 1];
            if (typeof lastArg === 'function') {
              callback = lastArg;
              params = args.slice(0, -1);
            } else {
              params = args;
            }
            pool.query(sql, params)
              .then(res => callback?.(null, res))
              .catch(err => callback?.(err));
          },
          finalize: () => {}
        };
      },
      serialize: (callback) => callback?.()
    };
  }

  async createTables() {
    try {
      logger.info('🔧 Creating database tables...');
      
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS news_sources (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          base_url TEXT NOT NULL,
          list_selector TEXT NOT NULL,
          title_selector TEXT,
          content_selector TEXT,
          link_selector TEXT,
          lead_selector TEXT,
          router_selector TEXT,
          title_selectors TEXT DEFAULT '[]',
          content_selectors TEXT DEFAULT '[]',
          lead_selectors TEXT DEFAULT '[]',
          router_selectors TEXT DEFAULT '[]',
          driver_type TEXT DEFAULT 'puppeteer',
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      logger.info('✅ news_sources table created');

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS articles (
          id SERIAL PRIMARY KEY,
          source_id INTEGER REFERENCES news_sources(id),
          title TEXT NOT NULL,
          link TEXT NOT NULL UNIQUE,
          content TEXT,
          lead TEXT,
          router TEXT,
          hash TEXT UNIQUE,
          depth INTEGER DEFAULT 0,
          is_read BOOLEAN DEFAULT FALSE,
          compressed INTEGER DEFAULT 0,
          compressed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      logger.info('✅ articles table created');

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
        )`);
      logger.info('✅ queue_jobs table created');

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id SERIAL PRIMARY KEY,
          timestamp BIGINT NOT NULL,
          metric_type TEXT NOT NULL,
          metric_name TEXT NOT NULL,
          value REAL NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      logger.info('✅ performance_metrics table created');

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS selector_configs (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          selectors TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      logger.info('✅ selector_configs table created');

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          email TEXT,
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      logger.info('✅ admin_users table created');

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
        )`);
      logger.info('✅ crawl_logs table created');

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS operation_logs (
          id SERIAL PRIMARY KEY,
          source_id INTEGER REFERENCES news_sources(id),
          action TEXT NOT NULL,
          status TEXT NOT NULL,
          message TEXT,
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      logger.info('✅ operation_logs table created');

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
        )`);
      logger.info('✅ crawl_history table created');

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
        )`);
      logger.info('✅ schedules table created');

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS cleanup_schedules (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          cron_expression TEXT NOT NULL,
          keep_articles_count INTEGER DEFAULT 1000,
          is_active BOOLEAN DEFAULT TRUE,
          last_run TIMESTAMP,
          next_run TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      logger.info('✅ cleanup_schedules table created');

      // ایندکس‌ها
      logger.info('🔧 Creating database indexes...');
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(hash)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_sources_active ON news_sources(active)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_crawl_history_timestamp ON crawl_history(created_at)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_queue_status_priority ON queue_jobs(status, priority, created_at)`);

      logger.info('✅ PostgreSQL tables and indexes created');

      // داده پیش‌فرض
      logger.info('🔧 Inserting default data...');
      
      // بررسی وجود ستون‌ها قبل از INSERT
      const columnCheck = await this.pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'news_sources' AND column_name = 'lead_selector'
      `);
      
      if (columnCheck.rows.length > 0) {
        await this.pool.query(`
          INSERT INTO news_sources (name, base_url, list_selector, title_selector, content_selector, link_selector, 
                                   lead_selector, router_selector, title_selectors, content_selectors, 
                                   lead_selectors, router_selectors)
          VALUES ('فارس‌نیوز', 'https://www.farsnews.ir/showcase', 'a[href*="/news/"]', 'h1, .title', 
                  '.story, .content, .news-content, p', 'a', '', '', '[]', '[]', '[]', '[]')
          ON CONFLICT (name) DO NOTHING
        `);
      } else {
        // اگر ستون‌های جدید وجود ندارند، از INSERT ساده استفاده کن
        await this.pool.query(`
          INSERT INTO news_sources (name, base_url, list_selector, title_selector, content_selector, link_selector)
          VALUES ('فارس‌نیوز', 'https://www.farsnews.ir/showcase', 'a[href*="/news/"]', 'h1, .title', 
                  '.story, .content, .news-content, p', 'a')
          ON CONFLICT (name) DO NOTHING
        `);
      }

      const defaultPassword = bcrypt.hashSync('admin123', 10);
      await this.pool.query(`
        INSERT INTO admin_users (username, password_hash, email)
        VALUES ('admin', $1, 'admin@crawler.local')
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
      `, [defaultPassword]);

      logger.info('✅ Default admin user ensured');
    } catch (error) {
      logger.error('❌ Error creating tables:', error);
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

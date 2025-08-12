#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { execSync } = require('child_process');

class PostgreSQLOnlySetup {
  constructor() {
    this.postgresConfig = {
      user: process.env.DB_USER || 'crawler_user',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
      password: process.env.DB_PASSWORD || 'farsnews123',
      port: process.env.DB_PORT || 5432,
    };
    
    this.postgresPool = new Pool(this.postgresConfig);
  }

  async setup() {
    console.log('🚀 راه‌اندازی PostgreSQL-Only Environment...');
    console.log('=====================================');
    
    try {
      // مرحله 1: بررسی PostgreSQL
      await this.checkPostgreSQL();
      
      // مرحله 2: ایجاد دیتابیس و کاربر
      await this.setupDatabase();
      
      // مرحله 3: ایجاد جداول
      await this.createTables();
      
      // مرحله 4: اضافه کردن داده‌های اولیه
      await this.insertInitialData();
      
      // مرحله 5: حذف وابستگی‌های SQLite
      await this.removeSQLiteDependencies();
      
      // مرحله 6: بهینه‌سازی
      await this.optimizeDatabase();
      
      console.log('\n✅ راه‌اندازی PostgreSQL-Only با موفقیت تکمیل شد!');
      
    } catch (error) {
      console.error('❌ خطا در راه‌اندازی:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async checkPostgreSQL() {
    console.log('🔍 بررسی PostgreSQL...');
    
    try {
      await this.postgresPool.query('SELECT version()');
      console.log('✅ PostgreSQL در دسترس است');
    } catch (error) {
      throw new Error(`PostgreSQL در دسترس نیست: ${error.message}`);
    }
  }

  async setupDatabase() {
    console.log('🗄️ راه‌اندازی دیتابیس...');
    
    try {
      // بررسی وجود دیتابیس
      const result = await this.postgresPool.query(`
        SELECT 1 FROM pg_database WHERE datname = $1
      `, [this.postgresConfig.database]);
      
      if (result.rows.length === 0) {
        console.log('📝 ایجاد دیتابیس جدید...');
        await this.postgresPool.query(`
          CREATE DATABASE ${this.postgresConfig.database}
        `);
        console.log('✅ دیتابیس ایجاد شد');
      } else {
        console.log('✅ دیتابیس از قبل وجود دارد');
      }
      
    } catch (error) {
      console.warn('⚠️ خطا در بررسی دیتابیس:', error.message);
    }
  }

  async createTables() {
    console.log('📋 ایجاد جداول...');
    
    const tables = [
      // جدول منابع خبری
      `CREATE TABLE IF NOT EXISTS news_sources (
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
      )`,

      // جدول اخبار
      `CREATE TABLE IF NOT EXISTS articles (
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
      )`,

      // جدول صف کارها
      `CREATE TABLE IF NOT EXISTS queue_jobs (
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
      )`,

      // جدول متریک‌های عملکرد
      `CREATE TABLE IF NOT EXISTS performance_metrics (
        id SERIAL PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        metric_type TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // جدول پیکربندی‌های selector builder
      `CREATE TABLE IF NOT EXISTS selector_configs (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        selectors TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // جدول کاربران ادمین
      `CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // جدول لاگ‌ها
      `CREATE TABLE IF NOT EXISTS crawl_logs (
        id SERIAL PRIMARY KEY,
        source_id INTEGER REFERENCES news_sources(id),
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        articles_found INTEGER DEFAULT 0,
        articles_processed INTEGER DEFAULT 0,
        duration_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // جدول لاگ‌های عملیات
      `CREATE TABLE IF NOT EXISTS operation_logs (
        id SERIAL PRIMARY KEY,
        source_id INTEGER REFERENCES news_sources(id),
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // جدول تاریخچه کرال
      `CREATE TABLE IF NOT EXISTS crawl_history (
        id SERIAL PRIMARY KEY,
        source_id INTEGER REFERENCES news_sources(id),
        total_found INTEGER DEFAULT 0,
        total_processed INTEGER DEFAULT 0,
        new_articles INTEGER DEFAULT 0,
        crawl_depth INTEGER DEFAULT 0,
        duration_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // جدول زمان‌بندی کرال
      `CREATE TABLE IF NOT EXISTS schedules (
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
      )`
    ];

    for (let i = 0; i < tables.length; i++) {
      try {
        await this.postgresPool.query(tables[i]);
        console.log(`✅ جدول ${i + 1} ایجاد شد`);
      } catch (error) {
        console.warn(`⚠️ خطا در ایجاد جدول ${i + 1}:`, error.message);
      }
    }

    // ایجاد ایندکس‌ها
    await this.createIndexes();
  }

  async createIndexes() {
    console.log('🔍 ایجاد ایندکس‌ها...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id)',
      'CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(hash)',
      'CREATE INDEX IF NOT EXISTS idx_sources_active ON news_sources(active)',
      'CREATE INDEX IF NOT EXISTS idx_crawl_history_timestamp ON crawl_history(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_queue_status_priority ON queue_jobs(status, priority, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_articles_link ON articles(link)',
      'CREATE INDEX IF NOT EXISTS idx_crawl_logs_source_id ON crawl_logs(source_id)',
      'CREATE INDEX IF NOT EXISTS idx_operation_logs_source_id ON operation_logs(source_id)'
    ];

    for (const index of indexes) {
      try {
        await this.postgresPool.query(index);
      } catch (error) {
        console.warn('⚠️ خطا در ایجاد ایندکس:', error.message);
      }
    }

    console.log('✅ ایندکس‌ها ایجاد شدند');
  }

  async insertInitialData() {
    console.log('📝 اضافه کردن داده‌های اولیه...');
    
    try {
      // اضافه کردن منبع پیش‌فرض فارس‌نیوز
      await this.postgresPool.query(`
        INSERT INTO news_sources (name, base_url, list_selector, title_selector, content_selector, link_selector)
        VALUES ('فارس‌نیوز', 'https://www.farsnews.ir/showcase', 'a[href*="/news/"]', 'h1, .title', '.story, .content, .news-content, p', 'a')
        ON CONFLICT (name) DO NOTHING
      `);
      console.log('✅ منبع فارس‌نیوز اضافه شد');

      // اضافه کردن منابع دیگر
      const sources = [
        {
          name: 'مهر-آخرین اخبار',
          base_url: 'https://www.mehrnews.com/news',
          list_selector: 'a[href*="/news/"]',
          title_selector: 'h1, .title',
          content_selector: '.content, .news-content, p',
          link_selector: 'a'
        },
        {
          name: 'آریا',
          base_url: 'https://www.aryanews.com/news',
          list_selector: 'a[href*="/news/"]',
          title_selector: 'h1, .title',
          content_selector: '.content, .news-content, p',
          link_selector: 'a'
        },
        {
          name: 'ایرنا',
          base_url: 'https://www.irna.ir/news',
          list_selector: 'a[href*="/news/"]',
          title_selector: 'h1, .title',
          content_selector: '.content, .news-content, p',
          link_selector: 'a'
        }
      ];

      for (const source of sources) {
        await this.postgresPool.query(`
          INSERT INTO news_sources (name, base_url, list_selector, title_selector, content_selector, link_selector)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (name) DO NOTHING
        `, [source.name, source.base_url, source.list_selector, source.title_selector, source.content_selector, source.link_selector]);
      }
      console.log('✅ منابع اضافی اضافه شدند');

      // اضافه کردن کاربر ادمین پیش‌فرض
      const bcrypt = require('bcryptjs');
      const defaultPassword = bcrypt.hashSync('admin123', 10);
      
      await this.postgresPool.query(`
        INSERT INTO admin_users (username, password_hash, email)
        VALUES ('admin', $1, 'admin@crawler.local')
        ON CONFLICT (username) DO UPDATE SET password_hash = $1
      `, [defaultPassword]);
      console.log('✅ کاربر admin ایجاد شد');

    } catch (error) {
      console.warn('⚠️ خطا در اضافه کردن داده‌های اولیه:', error.message);
    }
  }

  async removeSQLiteDependencies() {
    console.log('🗑️ حذف وابستگی‌های SQLite...');
    
    try {
      // حذف فایل‌های SQLite
      const sqliteFiles = [
        path.join(__dirname, '../data/database.sqlite'),
        path.join(__dirname, '../data/database.sqlite.backup'),
        path.join(__dirname, '../data/database.sqlite.backup.*')
      ];

      for (const file of sqliteFiles) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`🗑️ فایل حذف شد: ${file}`);
        }
      }

      // حذف پوشه data اگر خالی است
      const dataDir = path.join(__dirname, '../data');
      if (fs.existsSync(dataDir) && fs.readdirSync(dataDir).length === 0) {
        fs.rmdirSync(dataDir);
        console.log('🗑️ پوشه data خالی حذف شد');
      }

      // حذف sqlite3 از package.json
      await this.updatePackageJson();

      console.log('✅ وابستگی‌های SQLite حذف شدند');

    } catch (error) {
      console.warn('⚠️ خطا در حذف وابستگی‌های SQLite:', error.message);
    }
  }

  async updatePackageJson() {
    try {
      const packagePath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // حذف sqlite3 از devDependencies
      if (packageJson.devDependencies && packageJson.devDependencies.sqlite3) {
        delete packageJson.devDependencies.sqlite3;
        console.log('🗑️ sqlite3 از devDependencies حذف شد');
      }
      
      // حذف sqlite3 از dependencies
      if (packageJson.dependencies && packageJson.dependencies.sqlite3) {
        delete packageJson.dependencies.sqlite3;
        console.log('🗑️ sqlite3 از dependencies حذف شد');
      }
      
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
      console.log('✅ package.json به‌روزرسانی شد');

    } catch (error) {
      console.warn('⚠️ خطا در به‌روزرسانی package.json:', error.message);
    }
  }

  async optimizeDatabase() {
    console.log('⚡ بهینه‌سازی دیتابیس...');
    
    try {
      // تحلیل جداول
      await this.postgresPool.query('ANALYZE');
      console.log('✅ تحلیل جداول انجام شد');
      
      // بهینه‌سازی حافظه
      await this.postgresPool.query(`
        ALTER SYSTEM SET shared_buffers = '256MB';
        ALTER SYSTEM SET effective_cache_size = '1GB';
        ALTER SYSTEM SET maintenance_work_mem = '64MB';
        ALTER SYSTEM SET checkpoint_completion_target = 0.9;
        ALTER SYSTEM SET wal_buffers = '16MB';
        ALTER SYSTEM SET default_statistics_target = 100;
      `);
      console.log('✅ تنظیمات بهینه‌سازی اعمال شد');

    } catch (error) {
      console.warn('⚠️ خطا در بهینه‌سازی دیتابیس:', error.message);
    }
  }

  async cleanup() {
    try {
      await this.postgresPool.end();
      console.log('🔌 اتصالات PostgreSQL بسته شدند');
    } catch (error) {
      console.error('خطا در بستن اتصالات:', error);
    }
  }

  async verifySetup() {
    console.log('🔍 بررسی راه‌اندازی...');
    
    try {
      // بررسی جداول
      const tables = await this.postgresPool.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      console.log(`✅ ${tables.rows.length} جدول موجود است`);
      
      // بررسی منابع
      const sources = await this.postgresPool.query('SELECT COUNT(*) FROM news_sources');
      console.log(`✅ ${sources.rows[0].count} منبع خبری موجود است`);
      
      // بررسی کاربران
      const users = await this.postgresPool.query('SELECT COUNT(*) FROM admin_users');
      console.log(`✅ ${users.rows[0].count} کاربر ادمین موجود است`);
      
      console.log('✅ راه‌اندازی تایید شد');
      
    } catch (error) {
      console.error('❌ خطا در بررسی راه‌اندازی:', error);
    }
  }
}

// اجرای راه‌اندازی
async function main() {
  const setup = new PostgreSQLOnlySetup();
  
  try {
    await setup.setup();
    await setup.verifySetup();
    
    console.log('\n🎉 راه‌اندازی PostgreSQL-Only با موفقیت تکمیل شد!');
    console.log('\n📝 نکات مهم:');
    console.log('1. تمام جداول PostgreSQL ایجاد شدند');
    console.log('2. داده‌های اولیه اضافه شدند');
    console.log('3. وابستگی‌های SQLite حذف شدند');
    console.log('4. دیتابیس بهینه‌سازی شد');
    console.log('5. سیستم آماده استفاده است');
    console.log('\n🚀 برای شروع سرور: npm start');
    
  } catch (error) {
    console.error('\n❌ راه‌اندازی ناموفق بود:', error.message);
    process.exit(1);
  }
}

// اجرا اگر مستقیماً فراخوانی شود
if (require.main === module) {
  main();
}

module.exports = PostgreSQLOnlySetup; 
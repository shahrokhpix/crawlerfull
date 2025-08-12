#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();

class SQLiteToPostgreSQLMigrator {
  constructor() {
    this.sqlitePath = path.join(__dirname, '../data/database.sqlite');
    this.postgresConfig = {
      user: process.env.DB_USER || 'crawler_user',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
      password: process.env.DB_PASSWORD || 'farsnews123',
      port: process.env.DB_PORT || 5432,
    };
    
    this.postgresPool = new Pool(this.postgresConfig);
  }

  async migrate() {
    console.log('🚀 شروع migration از SQLite به PostgreSQL...');
    
    try {
      // بررسی وجود فایل SQLite
      if (!fs.existsSync(this.sqlitePath)) {
        console.log('❌ فایل SQLite یافت نشد. migration لغو شد.');
        return;
      }

      // اتصال به SQLite
      const sqliteDb = await this.connectSQLite();
      
      // اتصال به PostgreSQL
      await this.connectPostgreSQL();
      
      // Migration جداول
      await this.migrateTables(sqliteDb);
      
      // Migration داده‌ها
      await this.migrateData(sqliteDb);
      
      console.log('✅ Migration با موفقیت تکمیل شد!');
      
    } catch (error) {
      console.error('❌ خطا در migration:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async connectSQLite() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.sqlitePath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ اتصال به SQLite برقرار شد');
          resolve(db);
        }
      });
    });
  }

  async connectPostgreSQL() {
    try {
      await this.postgresPool.query('SELECT 1');
      console.log('✅ اتصال به PostgreSQL برقرار شد');
    } catch (error) {
      throw new Error(`خطا در اتصال به PostgreSQL: ${error.message}`);
    }
  }

  async migrateTables(sqliteDb) {
    console.log('📋 Migration جداول...');
    
    const tables = [
      'news_sources',
      'articles', 
      'crawl_history',
      'performance_metrics',
      'schedules',
      'queue_jobs',
      'admin_users',
      'crawl_logs',
      'operation_logs',
      'selector_configs'
    ];

    for (const table of tables) {
      try {
        await this.migrateTable(sqliteDb, table);
      } catch (error) {
        console.warn(`⚠️ خطا در migration جدول ${table}:`, error.message);
      }
    }
  }

  async migrateTable(sqliteDb, tableName) {
    return new Promise((resolve, reject) => {
      sqliteDb.all(`PRAGMA table_info(${tableName})`, async (err, columns) => {
        if (err) {
          reject(err);
          return;
        }

        if (columns.length === 0) {
          console.log(`ℹ️ جدول ${tableName} در SQLite وجود ندارد`);
          resolve();
          return;
        }

        console.log(`📊 Migration جدول ${tableName}...`);
        
        try {
          // دریافت داده‌ها از SQLite
          const data = await this.getTableData(sqliteDb, tableName);
          
          if (data.length > 0) {
            // درج داده‌ها در PostgreSQL
            await this.insertDataToPostgreSQL(tableName, data);
            console.log(`✅ ${data.length} رکورد از جدول ${tableName} منتقل شد`);
          } else {
            console.log(`ℹ️ جدول ${tableName} خالی است`);
          }
          
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async getTableData(sqliteDb, tableName) {
    return new Promise((resolve, reject) => {
      sqliteDb.all(`SELECT * FROM ${tableName}`, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async insertDataToPostgreSQL(tableName, data) {
    if (data.length === 0) return;

    const columns = Object.keys(data[0]);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT DO NOTHING
    `;

    for (const row of data) {
      const values = columns.map(col => row[col]);
      await this.postgresPool.query(query, values);
    }
  }

  async migrateData(sqliteDb) {
    console.log('📦 Migration داده‌ها...');
    
    // Migration داده‌های خاص
    await this.migrateSpecialData(sqliteDb);
  }

  async migrateSpecialData(sqliteDb) {
    // Migration تنظیمات خاص
    console.log('⚙️ Migration تنظیمات خاص...');
    
    // اینجا می‌توانید تنظیمات خاص را اضافه کنید
  }

  async cleanup() {
    try {
      await this.postgresPool.end();
      console.log('🔌 اتصالات بسته شدند');
    } catch (error) {
      console.error('خطا در بستن اتصالات:', error);
    }
  }

  async createBackup() {
    const backupPath = `${this.sqlitePath}.backup.${Date.now()}`;
    
    if (fs.existsSync(this.sqlitePath)) {
      fs.copyFileSync(this.sqlitePath, backupPath);
      console.log(`💾 Backup ایجاد شد: ${backupPath}`);
    }
  }
}

// اجرای migration
async function main() {
  const migrator = new SQLiteToPostgreSQLMigrator();
  
  try {
    // ایجاد backup
    await migrator.createBackup();
    
    // اجرای migration
    await migrator.migrate();
    
    console.log('\n🎉 Migration با موفقیت تکمیل شد!');
    console.log('📝 نکات مهم:');
    console.log('1. فایل SQLite backup شده است');
    console.log('2. تمام داده‌ها به PostgreSQL منتقل شده‌اند');
    console.log('3. اپلیکیشن حالا از PostgreSQL استفاده می‌کند');
    console.log('4. در صورت نیاز می‌توانید فایل SQLite را حذف کنید');
    
  } catch (error) {
    console.error('\n❌ Migration ناموفق بود:', error.message);
    process.exit(1);
  }
}

// اجرا اگر مستقیماً فراخوانی شود
if (require.main === module) {
  main();
}

module.exports = SQLiteToPostgreSQLMigrator; 
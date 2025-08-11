#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class SQLiteRemover {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
  }

  async removeSQLiteCompletely() {
    console.log('🗑️ حذف کامل SQLite از پروژه...');
    console.log('=====================================');
    
    try {
      // مرحله 1: حذف فایل‌های SQLite
      await this.removeSQLiteFiles();
      
      // مرحله 2: حذف وابستگی‌های SQLite از package.json
      await this.removeSQLiteDependencies();
      
      // مرحله 3: حذف import های SQLite از کد
      await this.removeSQLiteImports();
      
      // مرحله 4: پاک‌سازی پوشه‌های خالی
      await this.cleanupEmptyDirectories();
      
      console.log('\n✅ حذف کامل SQLite با موفقیت تکمیل شد!');
      console.log('\n📝 نکات مهم:');
      console.log('1. تمام فایل‌های SQLite حذف شدند');
      console.log('2. وابستگی‌های SQLite از package.json حذف شدند');
      console.log('3. import های SQLite از کد حذف شدند');
      console.log('4. پروژه حالا کاملاً PostgreSQL-Only است');
      console.log('\n🚀 سیستم آماده استفاده است!');
      
    } catch (error) {
      console.error('❌ خطا در حذف SQLite:', error);
      throw error;
    }
  }

  async removeSQLiteFiles() {
    console.log('📁 حذف فایل‌های SQLite...');
    
    const sqliteFiles = [
      path.join(this.projectRoot, 'data', 'database.sqlite'),
      path.join(this.projectRoot, 'data', 'database.sqlite.backup'),
      path.join(this.projectRoot, 'data', '*.sqlite'),
      path.join(this.projectRoot, 'data', '*.sqlite.backup'),
      path.join(this.projectRoot, '*.sqlite'),
      path.join(this.projectRoot, '*.sqlite.backup')
    ];

    for (const filePattern of sqliteFiles) {
      try {
        if (fs.existsSync(filePattern)) {
          fs.unlinkSync(filePattern);
          console.log(`🗑️ فایل حذف شد: ${filePattern}`);
        }
      } catch (error) {
        // نادیده گرفتن خطاهای فایل‌های غیرموجود
      }
    }

    // حذف پوشه data اگر خالی است
    const dataDir = path.join(this.projectRoot, 'data');
    if (fs.existsSync(dataDir) && fs.readdirSync(dataDir).length === 0) {
      fs.rmdirSync(dataDir);
      console.log('🗑️ پوشه data خالی حذف شد');
    }
  }

  async removeSQLiteDependencies() {
    console.log('📦 حذف وابستگی‌های SQLite از package.json...');
    
    try {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      let changed = false;
      
      // حذف sqlite3 از devDependencies
      if (packageJson.devDependencies && packageJson.devDependencies.sqlite3) {
        delete packageJson.devDependencies.sqlite3;
        console.log('🗑️ sqlite3 از devDependencies حذف شد');
        changed = true;
      }
      
      // حذف sqlite3 از dependencies
      if (packageJson.dependencies && packageJson.dependencies.sqlite3) {
        delete packageJson.dependencies.sqlite3;
        console.log('🗑️ sqlite3 از dependencies حذف شد');
        changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
        console.log('✅ package.json به‌روزرسانی شد');
      } else {
        console.log('ℹ️ sqlite3 در package.json یافت نشد');
      }

    } catch (error) {
      console.warn('⚠️ خطا در به‌روزرسانی package.json:', error.message);
    }
  }

  async removeSQLiteImports() {
    console.log('🔍 حذف import های SQLite از کد...');
    
    const filesToCheck = [
      'index.js',
      'config/database.js',
      'config/database-postgresql.js',
      'services/crawler.js',
      'routes/api.js'
    ];

    for (const file of filesToCheck) {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        await this.removeSQLiteFromFile(filePath);
      }
    }
  }

  async removeSQLiteFromFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let changed = false;
      
      // حذف import های sqlite3
      const sqliteImportRegex = /(const|let|var)\s+\w*\s*=\s*require\(['"]sqlite3['"]\)[^;]*;?\s*/g;
      if (sqliteImportRegex.test(content)) {
        content = content.replace(sqliteImportRegex, '');
        changed = true;
        console.log(`🗑️ import sqlite3 از ${path.basename(filePath)} حذف شد`);
      }
      
      // حذف کدهای مربوط به SQLite
      const sqliteCodeRegex = /\/\*\s*SQLite.*?\*\//gs;
      if (sqliteCodeRegex.test(content)) {
        content = content.replace(sqliteCodeRegex, '');
        changed = true;
        console.log(`🗑️ کدهای SQLite از ${path.basename(filePath)} حذف شد`);
      }
      
      if (changed) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ ${path.basename(filePath)} به‌روزرسانی شد`);
      }

    } catch (error) {
      console.warn(`⚠️ خطا در پردازش ${path.basename(filePath)}:`, error.message);
    }
  }

  async cleanupEmptyDirectories() {
    console.log('🧹 پاک‌سازی پوشه‌های خالی...');
    
    const directoriesToCheck = [
      path.join(this.projectRoot, 'data'),
      path.join(this.projectRoot, 'temp'),
      path.join(this.projectRoot, 'logs')
    ];

    for (const dir of directoriesToCheck) {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
        console.log(`🗑️ پوشه خالی حذف شد: ${path.basename(dir)}`);
      }
    }
  }

  async verifyRemoval() {
    console.log('🔍 بررسی حذف SQLite...');
    
    const checks = [
      {
        name: 'فایل‌های SQLite',
        check: () => {
          const sqliteFiles = [
            path.join(this.projectRoot, 'data', 'database.sqlite'),
            path.join(this.projectRoot, '*.sqlite')
          ];
          return !sqliteFiles.some(file => fs.existsSync(file));
        }
      },
      {
        name: 'وابستگی‌های SQLite در package.json',
        check: () => {
          const packagePath = path.join(this.projectRoot, 'package.json');
          const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          return !packageJson.dependencies?.sqlite3 && !packageJson.devDependencies?.sqlite3;
        }
      }
    ];

    for (const check of checks) {
      try {
        if (check.check()) {
          console.log(`✅ ${check.name}: حذف شده`);
        } else {
          console.log(`❌ ${check.name}: هنوز موجود است`);
        }
      } catch (error) {
        console.log(`⚠️ ${check.name}: بررسی ناموفق`);
      }
    }
  }
}

// اجرای حذف
async function main() {
  const remover = new SQLiteRemover();
  
  try {
    await remover.removeSQLiteCompletely();
    await remover.verifyRemoval();
    
  } catch (error) {
    console.error('\n❌ حذف SQLite ناموفق بود:', error.message);
    process.exit(1);
  }
}

// اجرا اگر مستقیماً فراخوانی شود
if (require.main === module) {
  main();
}

module.exports = SQLiteRemover; 
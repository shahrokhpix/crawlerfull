const cron = require('node-cron');
const Database = require('../config/database');
const logger = require('../utils/logger');

class CleanupService {
  constructor() {
    this.jobs = {};
    this.db = Database.db;
  }

  // شروع همه زمانبندی‌های فعال
  async startAllJobs() {
    try {
      const schedules = await this.getAllActiveSchedules();
      console.log(`📋 ${schedules.length} زمانبندی پاک‌سازی یافت شد`);
      
      for (const schedule of schedules) {
        await this.startJob(schedule);
      }
    } catch (error) {
      console.error('خطا در شروع زمانبندی‌های پاک‌سازی:', error);
    }
  }

  // شروع یک زمانبندی پاک‌سازی
  async startJob(schedule) {
    // بررسی معتبر بودن schedule
    if (!schedule || !schedule.id) {
      console.error('❌ زمانبندی نامعتبر یا فاقد شناسه');
      return;
    }

    // متوقف کردن job قبلی اگر وجود دارد
    if (this.jobs[schedule.id]) {
      this.jobs[schedule.id].stop();
      delete this.jobs[schedule.id];
    }

    console.log(`▶️ شروع زمانبندی پاک‌سازی ID=${schedule.id}, Cron="${schedule.cron_expression}"`);

    const job = cron.schedule(schedule.cron_expression, async () => {
      console.log(`🧹 اجرای زمانبندی پاک‌سازی: ${schedule.name}`);
      
      try {
        // استفاده از سیستم صف برای پاک‌سازی
        if (global.queueManager) {
          const jobId = global.queueManager.addJob({
            type: 'cleanup',
            scheduleId: schedule.id,
            keepCount: schedule.keep_articles_count,
            scheduleName: schedule.name
          }, 'low'); // اولویت پایین برای پاک‌سازی
          
          console.log(`✅ پاک‌سازی زمان‌بندی شده به صف اضافه شد: ${jobId}`);
        } else {
          // اجرای مستقیم اگر صف در دسترس نباشد
          const result = await this.performCleanup(schedule.keep_articles_count);
          console.log(`✅ پاک‌سازی با موفقیت انجام شد: ${result.deletedCount} مقاله پاک شد، ${result.remainingCount} مقاله باقی ماند`);
        }
        
        await this.logCleanupOperation(schedule.id, 'success', 
          `پاک‌سازی موفق به صف اضافه شد`);
          
      } catch (error) {
        console.error(`❌ خطا در پاک‌سازی:`, error.message);
        
        await this.logCleanupOperation(schedule.id, 'error', 
          `خطا در پاک‌سازی: ${error.message}`);
      }
    }, {
      scheduled: false
    });

    job.start();
    console.log(`✅ زمانبندی پاک‌سازی ID=${schedule.id} با موفقیت شروع شد`);
    
    this.jobs[schedule.id] = job;
  }

  // اجرای پاک‌سازی
  async performCleanup(keepCount = 1000) {
    try {
      // ابتدا تعداد کل مقالات را بشماریم
      const countResult = await this.db.query('SELECT COUNT(*) as total FROM articles');
      const rows = countResult.rows || [];
      const totalArticles = rows[0]?.total || 0;
      
      if (totalArticles <= keepCount) {
        return {
          deletedCount: 0,
          remainingCount: totalArticles,
          message: `تعداد مقالات (${totalArticles}) کمتر از حد نگهداری (${keepCount}) است`
        };
      }

      const deleteCount = totalArticles - keepCount;

      // پاک کردن قدیمی‌ترین مقالات
      const deleteQuery = `
        DELETE FROM articles 
        WHERE id IN (
          SELECT id FROM articles 
          ORDER BY created_at ASC 
          LIMIT $1
        )
      `;

      const result = await this.db.query(deleteQuery, [deleteCount]);
      
      return {
        deletedCount: result.rowCount,
        remainingCount: keepCount,
        totalBefore: totalArticles
      };
    } catch (error) {
      console.error('خطا در اجرای پاک‌سازی:', error);
      throw error;
    }
  }

  // دریافت همه زمانبندی‌های فعال
  async getAllActiveSchedules() {
    try {
      const query = 'SELECT * FROM cleanup_schedules WHERE is_active = true ORDER BY id';
      const result = await this.db.query(query);
      const rows = result.rows || [];
      return rows;
    } catch (error) {
      console.error('خطا در دریافت زمانبندی‌های پاک‌سازی:', error);
      return [];
    }
  }

  // ایجاد زمانبندی جدید
  async createSchedule(name, cronExpression, keepArticlesCount, isActive = true) {
    try {
      const query = `
        INSERT INTO cleanup_schedules (name, cron_expression, keep_articles_count, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;
      
      const result = await this.db.query(query, [name, cronExpression, keepArticlesCount, isActive]);
      const rows = result.rows || [];
      return { id: rows[0]?.id };
    } catch (error) {
      console.error('خطا در ایجاد زمانبندی پاک‌سازی:', error);
      throw error;
    }
  }

  // به‌روزرسانی زمانبندی
  async updateSchedule(id, name, cronExpression, keepArticlesCount, isActive) {
    try {
      const query = `
        UPDATE cleanup_schedules 
        SET name = $1, cron_expression = $2, keep_articles_count = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `;
      
      const result = await this.db.query(query, [name, cronExpression, keepArticlesCount, isActive, id]);
      return { changes: result.rowCount };
    } catch (error) {
      console.error('خطا در به‌روزرسانی زمانبندی پاک‌سازی:', error);
      throw error;
    }
  }

  // حذف زمانبندی
  async deleteSchedule(id) {
    // متوقف کردن job
    if (this.jobs[id]) {
      this.jobs[id].stop();
      delete this.jobs[id];
    }

    try {
      const query = 'DELETE FROM cleanup_schedules WHERE id = $1';
      const result = await this.db.query(query, [id]);
      return { success: result.rowCount > 0 };
    } catch (error) {
      console.error('خطا در حذف زمانبندی پاک‌سازی:', error);
      throw error;
    }
  }

  // متوقف کردن زمانبندی
  stopJob(id) {
    if (this.jobs[id]) {
      this.jobs[id].stop();
      delete this.jobs[id];
      console.log(`⏹️ زمانبندی پاک‌سازی ID=${id} متوقف شد`);
    }
  }

  // دریافت یک زمانبندی
  async getScheduleById(id) {
    try {
      const query = 'SELECT * FROM cleanup_schedules WHERE id = $1';
      const result = await this.db.query(query, [id]);
      const rows = result.rows || [];
      return rows[0] || null;
    } catch (error) {
      console.error('خطا در دریافت زمانبندی پاک‌سازی:', error);
      return null;
    }
  }

  // اجرای دستی پاک‌سازی
  async runManualCleanup(keepCount) {
    console.log(`🧹 شروع پاک‌سازی دستی (نگهداری ${keepCount} مقاله)...`);
    
    try {
      const result = await this.performCleanup(keepCount);
      console.log(`✅ پاک‌سازی دستی تکمیل شد: ${result.deletedCount} مقاله پاک شد`);
      return result;
    } catch (error) {
      console.error(`❌ خطا در پاک‌سازی دستی:`, error);
      throw error;
    }
  }

  // ثبت لاگ عملیات پاک‌سازی
  async logCleanupOperation(scheduleId, status, message) {
    try {
      const query = `
        INSERT INTO operation_logs (source_id, action, status, message, details)
        VALUES ($1, 'cleanup', $2, $3, $4)
      `;
      
      const details = JSON.stringify({ scheduleId, timestamp: new Date().toISOString() });
      
      const result = await this.db.query(query, [null, status, message, details]);
      const rows = result.rows || [];
      return rows[0]?.id;
    } catch (error) {
      console.warn('خطا در ثبت لاگ پاک‌سازی:', error.message);
      return null; // ادامه عملیات حتی در صورت خطا در لاگ
    }
  }
}

module.exports = new CleanupService();
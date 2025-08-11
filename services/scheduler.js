const cron = require('node-cron');
const moment = require('moment-timezone');
const Database = require('../config/database');
const UniversalCrawler = require('./crawler');

class Scheduler {
  constructor() {
    this.db = Database.db;
    this.crawler = new UniversalCrawler();
    this.jobs = {};
  }

  async loadSchedules() {
    console.log('🔄 بارگذاری زمان‌بندی‌ها...');
    const schedules = await this.getAllSchedules();
    console.log(`📋 ${schedules.length} زمان‌بندی یافت شد`);
    
    schedules.forEach(schedule => {
      if (schedule.is_active) {
        console.log(`▶️ شروع زمان‌بندی ID=${schedule.id}, Cron="${schedule.cron_expression}"`);
        this.startJob(schedule);
      } else {
        console.log(`⏸️ زمان‌بندی ID=${schedule.id} غیرفعال است`);
      }
    });
  }

  startJob(schedule) {
    if (!schedule || !schedule.id) {
      console.error('❌ زمان‌بندی نامعتبر یا فاقد شناسه');
      return;
    }
    
    if (this.jobs[schedule.id]) {
      this.jobs[schedule.id].stop();
    }

    const job = cron.schedule(schedule.cron_expression, async () => {
      // خواندن تنظیمات جدید از دیتابیس در هر اجرا
      const freshSchedule = await this.getScheduleById(schedule.id);
      if (!freshSchedule) {
        console.error(`❌ زمان‌بندی با شناسه ${schedule.id} یافت نشد.`);
        return;
      }
      
      const crawlOptions = {
        limit: freshSchedule.article_limit || 10,
        crawlDepth: freshSchedule.crawl_depth !== undefined ? freshSchedule.crawl_depth : 0,
        fullContent: freshSchedule.full_content || false,
        timeout: freshSchedule.timeout_ms || 300000,
        followLinks: freshSchedule.follow_links !== false
      };
      
      console.log(`🚀 اجرای زمان‌بندی شده برای منبع ${freshSchedule.source_id} با تنظیمات جدید:`, {
        depth: crawlOptions.crawlDepth,
        fullContent: crawlOptions.fullContent ? 1 : 0,
        limit: crawlOptions.limit,
        timeout: crawlOptions.timeout,
        followLinks: crawlOptions.followLinks ? 1 : 0
      });
      
      try {
        // استفاده از سیستم صف برای کرال‌های زمان‌بندی شده
        if (global.queueManager) {
          const jobId = global.queueManager.addJob({
            type: 'crawl',
            sourceId: freshSchedule.source_id,
            options: crawlOptions,
            scheduleId: freshSchedule.id
          }, 'normal');
          
          console.log(`✅ کرال زمان‌بندی شده به صف اضافه شد: ${jobId}`);
        } else {
          // اجرای مستقیم اگر صف در دسترس نباشد
          await this.crawler.crawlSource(freshSchedule.source_id, crawlOptions);
          console.log(`✅ کرال زمان‌بندی شده برای منبع ${freshSchedule.source_id} با موفقیت انجام شد`);
        }
        
        await this.updateLastRun(freshSchedule.id);
      } catch (error) {
        console.error(`❌ خطا در کرال زمان‌بندی شده برای منبع ${freshSchedule.source_id}:`, error.message);
      }
    }, {
      scheduled: false // شروع دستی
    });

    // شروع job
    job.start();
    console.log(`✅ زمان‌بندی ID=${schedule.id} با موفقیت شروع شد`);
    
    this.jobs[schedule.id] = job;
  }

  async runJob(scheduleId) {
    const schedule = await this.getScheduleById(scheduleId);
    if (!schedule) {
      console.error(`❌ زمان‌بندی با شناسه ${scheduleId} یافت نشد.`);
      return;
    }

    console.log(`🚀 اجرای دستی برای منبع ${schedule.source_id}`);

    const crawlOptions = {
      limit: schedule.article_limit || 10,
      crawlDepth: schedule.crawl_depth !== undefined ? schedule.crawl_depth : 0,
      fullContent: schedule.full_content || false,
      timeout: schedule.timeout_ms || 300000,
      followLinks: schedule.follow_links !== false
    };

    console.log(`🚀 اجرای دستی برای منبع ${schedule.source_id} با تنظیمات:`, {
      depth: crawlOptions.crawlDepth,
      fullContent: crawlOptions.fullContent ? 1 : 0,
      limit: crawlOptions.limit,
      timeout: crawlOptions.timeout,
      followLinks: crawlOptions.followLinks ? 1 : 0
    });

    // اضافه کردن به صف با اولویت بالا
    if (global.queueManager) {
      const jobId = global.queueManager.addJob({
        type: 'crawl',
        sourceId: schedule.source_id,
        options: crawlOptions
      }, 'high');
      
      console.log(`✅ کرال دستی به صف اضافه شد: ${jobId}`);
      return jobId;
    }

    // اجرای مستقیم اگر صف در دسترس نباشد
    (async () => {
      try {
        await this.crawler.crawlSource(schedule.source_id, crawlOptions);
        await this.updateLastRun(schedule.id);
        console.log(`✅ کرال دستی برای منبع ${schedule.source_id} با موفقیت انجام شد`);
      } catch (error) {
        console.error(`❌ خطا در کرال دستی برای منبع ${schedule.source_id}:`, error.message);
      }
    })();
  }

  stopJob(scheduleId) {
    if (this.jobs[scheduleId]) {
      this.jobs[scheduleId].stop();
      delete this.jobs[scheduleId];
    }
  }

  async getAllSchedules() {
    try {
      const query = `
        SELECT s.*, ns.name as source_name,
               s.active as is_active
        FROM schedules s 
        LEFT JOIN news_sources ns ON s.source_id = ns.id 
        ORDER BY s.created_at DESC
      `;
      const result = await this.db.query(query);
      const rows = result.rows || [];
      
      if (!rows || rows.length === 0) {
        console.log('هیچ زمان‌بندی‌ای یافت نشد');
        return [];
      }
      
      // محاسبه next_run برای هر زمان‌بندی
      const schedulesWithNextRun = rows.map(schedule => {
        let next_run = null;
        
        if (schedule.is_active && cron.validate(schedule.cron_expression)) {
          try {
            // محاسبه تقریبی زمان بعدی اجرا
             next_run = this.calculateNextRun(schedule.cron_expression);
            
          } catch (error) {
            console.error(`خطا در محاسبه next_run برای زمان‌بندی ${schedule.id}:`, error.message);
          }
        }
        
        return {
          ...schedule,
          next_run
        };
      });
      
      return schedulesWithNextRun;
    } catch (err) {
      console.error('خطا در بارگذاری زمان‌بندی‌ها:', err);
      throw err;
    }
  }

  async getScheduleById(id) {
    try {
      const query = `
        SELECT s.*, ns.name as source_name,
               s.active as is_active
        FROM schedules s 
        LEFT JOIN news_sources ns ON s.source_id = ns.id 
        WHERE s.id = $1
      `;
      const result = await this.db.query(query, [id]);
      const rows = result.rows || [];
      return rows[0] || null;
    } catch (err) {
      throw err;
    }
  }

  async createSchedule(sourceId, cronExpression, isActive = true, crawlSettings = {}) {
    const {
      crawl_depth = 0,
      full_content = false,
      article_limit = 10,
      timeout_ms = 300000,
      follow_links = true
    } = crawlSettings;

    try {
          const query = `
      INSERT INTO schedules 
      (source_id, cron_expression, active, crawl_depth, full_content, article_limit, timeout_ms, follow_links)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
      const result = await this.db.query(query, [
        sourceId, cronExpression, isActive, crawl_depth, full_content, article_limit, timeout_ms, follow_links
      ]);
      const rows = result.rows || [];
      return { id: rows[0]?.id };
    } catch (err) {
      throw err;
    }
  }

  async updateSchedule(id, sourceId, cronExpression, isActive, crawlSettings = {}) {
    const {
      crawl_depth = 0,
      full_content = false,
      article_limit = 10,
      timeout_ms = 300000,
      follow_links = true
    } = crawlSettings;

    try {
      const query = `
        UPDATE schedules SET 
        source_id = $1, cron_expression = $2, active = $3, 
        crawl_depth = $4, full_content = $5, article_limit = $6, 
        timeout_ms = $7, follow_links = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
      `;
      await this.db.query(query, [
        sourceId, cronExpression, isActive, crawl_depth, full_content, 
        article_limit, timeout_ms, follow_links, id
      ]);
      
      // بازگرداندن زمان‌بندی به‌روزرسانی شده
      const updatedSchedule = await this.getScheduleById(id);
      return updatedSchedule;
    } catch (err) {
      throw err;
    }
  }

  async deleteSchedule(id) {
    try {
      await this.db.query('DELETE FROM schedules WHERE id = $1', [id]);
      return { success: true };
    } catch (err) {
      throw err;
    }
  }

  async updateLastRun(scheduleId) {
    try {
      await this.db.query(
        'UPDATE schedules SET last_run = CURRENT_TIMESTAMP WHERE id = $1', 
        [scheduleId]
      );
    } catch (err) {
      console.error('خطا در بروزرسانی last_run:', err);
    }
  }

  calculateNextRun(cronExpression) {
    try {
      const now = moment().tz('Asia/Tehran');
      const parts = cronExpression.split(' ');

      if (parts.length !== 5) {
        return null;
      }

      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

      if (cronExpression === '*/10 * * * *') {
        const currentMinute = now.minutes();
        const nextMinute = Math.ceil(currentMinute / 10) * 10;
        const nextRun = now.clone().seconds(0).milliseconds(0);

        if (nextMinute >= 60) {
          nextRun.add(1, 'hour').minutes(0);
        } else {
          nextRun.minutes(nextMinute);
        }
        return nextRun.toISOString();
      }

      if (minute.startsWith('*/')) {
        const interval = parseInt(minute.substring(2));
        const currentMinute = now.minutes();
        const nextMinute = Math.ceil(currentMinute / interval) * interval;
        const nextRun = now.clone().seconds(0).milliseconds(0);

        if (nextMinute >= 60) {
          nextRun.add(1, 'hour').minutes(nextMinute - 60);
        } else {
          nextRun.minutes(nextMinute);
        }
        return nextRun.toISOString();
      }

      return now.clone().add(10, 'minutes').toISOString();

    } catch (error) {
      console.error('خطا در محاسبه next_run:', error.message);
      return null;
    }
  }
}

module.exports = new Scheduler();
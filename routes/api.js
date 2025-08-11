const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const config = require('../config/config');
const UniversalCrawler = require('../services/crawler');
const database = require('../config/database');
const connectionPool = require('../services/connectionPool');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');
const { validateSelectors } = require('../middleware/selectorProtection');
const scheduler = require('../services/scheduler');
const cleanup = require('../services/cleanup');
const loadBalancerRoutes = require('./loadBalancer');

// middleware محافظت از سلکتورها فقط برای مسیرهای منابع خبری اعمال می‌شود

const crawler = new UniversalCrawler(config.webDriver.defaultType);

// اضافه کردن load balancer routes
router.use('/load-balancer', loadBalancerRoutes);

// ==================== AUTH ROUTES ====================

// ورود
router.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'نام کاربری و رمز عبور الزامی است'
      });
    }
    
    const result = await auth.login(username, password);
    
    if (result.success) {
      // تنظیم کوکی
      res.cookie('auth_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 ساعت
      });
    }
    
    res.json(result);
    
  } catch (error) {
    next(error);
  }
});

// خروج
router.post('/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({
    success: true,
    message: 'خروج موفقیت‌آمیز'
  });
});

// اطلاعات کاربر
router.get('/auth/me', auth.verifyToken, async (req, res, next) => {
  try {
    const user = await auth.getUserInfo(req.user.id);
    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
});

// ==================== DATABASE MANAGEMENT ROUTES ====================

// تخلیه کامل مقالات و اخبار دیتابیس
router.delete('/database/clear', auth.verifyToken, async (req, res, next) => {
  try {
    let articlesDeleted = 0;
    let historyDeleted = 0;
    let logsDeleted = 0;
    
    // حذف تمام مقالات
    try {
      const articlesResult = await database.db.query('DELETE FROM articles');
      articlesDeleted = articlesResult.rowCount || 0;
      logger.info(`تعداد ${articlesDeleted} مقاله حذف شد`);
    } catch (err) {
      logger.error('خطا در حذف مقالات:', err);
      return res.status(500).json({
        success: false,
        message: 'خطا در حذف مقالات: ' + err.message
      });
    }
    
    // حذف تمام تاریخچه کرال
    try {
      const historyResult = await database.db.query('DELETE FROM crawl_history');
      historyDeleted = historyResult.rowCount || 0;
      logger.info(`تعداد ${historyDeleted} رکورد تاریخچه کرال حذف شد`);
    } catch (err) {
      logger.error('خطا در حذف تاریخچه کرال:', err);
      return res.status(500).json({
        success: false,
        message: 'خطا در حذف تاریخچه کرال: ' + err.message
      });
    }
    
    // حذف تمام لاگ‌های عملیات (اگر جدول وجود داشته باشد)
    try {
      const logsResult = await database.db.query('DELETE FROM operation_logs');
      logsDeleted = logsResult.rowCount || 0;
      if (logsDeleted > 0) {
        logger.info(`تعداد ${logsDeleted} لاگ عملیات حذف شد`);
      }
    } catch (err) {
      logger.warn('خطا در حذف لاگ‌های عملیات:', err.message);
      logsDeleted = 0;
    }
    
    logger.success('تخلیه کامل دیتابیس با موفقیت انجام شد');
    
    res.json({
      success: true,
      message: 'تخلیه کامل دیتابیس با موفقیت انجام شد',
      details: {
        articlesDeleted,
        historyDeleted,
        logsDeleted,
        totalDeleted: articlesDeleted + historyDeleted + logsDeleted
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// تخلیه کامل تمام داده‌های دیتابیس (clear-all)
router.delete('/database/clear-all', auth.verifyToken, async (req, res, next) => {
  try {
    let articlesDeleted = 0;
    let historyDeleted = 0;
    let logsDeleted = 0;
    let crawlLogsDeleted = 0;
    let schedulesDeleted = 0;
    let sourcesDeleted = 0;
    
    // حذف تمام مقالات
    try {
      const articlesResult = await database.db.query('DELETE FROM articles');
      articlesDeleted = articlesResult.rowCount || 0;
      logger.info(`تعداد ${articlesDeleted} مقاله حذف شد`);
    } catch (err) {
      logger.error('خطا در حذف مقالات:', err);
      return res.status(500).json({
        success: false,
        message: 'خطا در حذف مقالات: ' + err.message
      });
    }
    
    // حذف تمام تاریخچه کرال
    try {
      const historyResult = await database.db.query('DELETE FROM crawl_history');
      historyDeleted = historyResult.rowCount || 0;
      logger.info(`تعداد ${historyDeleted} رکورد تاریخچه کرال حذف شد`);
    } catch (err) {
      logger.error('خطا در حذف تاریخچه کرال:', err);
      return res.status(500).json({
        success: false,
        message: 'خطا در حذف تاریخچه کرال: ' + err.message
      });
    }
    
    // حذف تمام لاگ‌های کرال
    try {
      const crawlLogsResult = await database.db.query('DELETE FROM crawl_logs');
      crawlLogsDeleted = crawlLogsResult.rowCount || 0;
      logger.info(`تعداد ${crawlLogsDeleted} لاگ کرال حذف شد`);
    } catch (err) {
      logger.warn('خطا در حذف لاگ‌های کرال:', err.message);
      crawlLogsDeleted = 0;
    }
    
    // حذف تمام لاگ‌های عملیات
    try {
      const logsResult = await database.db.query('DELETE FROM operation_logs');
      logsDeleted = logsResult.rowCount || 0;
      if (logsDeleted > 0) {
        logger.info(`تعداد ${logsDeleted} لاگ عملیات حذف شد`);
      }
    } catch (err) {
      logger.warn('خطا در حذف لاگ‌های عملیات:', err.message);
      logsDeleted = 0;
    }
    
    // حذف تمام زمان‌بندی‌ها
    try {
      const schedulesResult = await database.db.query('DELETE FROM schedules');
      schedulesDeleted = schedulesResult.rowCount || 0;
      logger.info(`تعداد ${schedulesDeleted} زمان‌بندی حذف شد`);
    } catch (err) {
      logger.warn('خطا در حذف زمان‌بندی‌ها:', err.message);
      schedulesDeleted = 0;
    }
    
    // حذف تمام منابع خبری
    try {
      const sourcesResult = await database.db.query('DELETE FROM news_sources');
      sourcesDeleted = sourcesResult.rowCount || 0;
      logger.info(`تعداد ${sourcesDeleted} منبع خبری حذف شد`);
    } catch (err) {
      logger.warn('خطا در حذف منابع خبری:', err.message);
      sourcesDeleted = 0;
    }
    
    logger.success('تخلیه کامل تمام داده‌های دیتابیس با موفقیت انجام شد');
    
    res.json({
      success: true,
      message: 'تخلیه کامل تمام داده‌های دیتابیس با موفقیت انجام شد',
      details: {
        articlesDeleted,
        historyDeleted,
        crawlLogsDeleted,
        logsDeleted,
        schedulesDeleted,
        sourcesDeleted,
        totalDeleted: articlesDeleted + historyDeleted + crawlLogsDeleted + logsDeleted + schedulesDeleted + sourcesDeleted
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// دریافت آمار دیتابیس
router.get('/database/stats', auth.verifyToken, async (req, res, next) => {
  try {
    const db = database.db;
    
    // بررسی وجود جداول و دریافت آمار
    const articlesResult = await db.query('SELECT COUNT(*) as articlesCount FROM articles');
    const historyResult = await db.query('SELECT COUNT(*) as historyCount FROM crawl_history');
    
    // بررسی وجود جدول operation_logs
    let logsCount = 0;
    try {
      const logsResult = await db.query('SELECT COUNT(*) as logsCount FROM operation_logs');
      const logsRows = logsResult.rows || [];
      logsCount = parseInt(logsRows[0]?.logsCount || 0);
    } catch (err) {
      // جدول وجود ندارد
      logsCount = 0;
    }
    
    const stats = {
              articlesCount: parseInt((articlesResult.rows || [])[0]?.articlesCount || 0),
        historyCount: parseInt((historyResult.rows || [])[0]?.historyCount || 0),
      logsCount: logsCount
    };
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    next(error);
  }
});

// ==================== SCHEDULES ROUTES ====================

// دریافت لیست زمان‌بندی‌ها
router.get('/schedules', auth.verifyToken, async (req, res, next) => {
  try {
    const schedules = await scheduler.getAllSchedules();
    const formattedSchedules = schedules.map(s => ({
      ...s,
      is_active: s.is_active || s.active, // پشتیبانی از هر دو فیلد
      last_run: s.last_run && s.last_run !== 'null' && s.last_run !== 'undefined' ? moment(s.last_run).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : null,
      next_run: s.next_run && s.next_run !== 'null' && s.next_run !== 'undefined' ? moment(s.next_run).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : null,
      created_at: s.created_at ? moment(s.created_at).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : null,
      updated_at: s.updated_at && s.updated_at !== 'null' && s.updated_at !== 'undefined' ? moment(s.updated_at).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : null
    }));
    res.json(formattedSchedules);
  } catch (error) {
    next(error);
  }
});

// دریافت یک زمان‌بندی خاص
router.get('/schedules/:id', auth.verifyToken, async (req, res, next) => {
  try {
    const schedule = await scheduler.getScheduleById(req.params.id);
    if (schedule) {
      // اطمینان از وجود فیلد is_active
      const formattedSchedule = {
        ...schedule,
        is_active: schedule.is_active || schedule.active
      };
      res.json(formattedSchedule);
    } else {
      res.status(404).json({ message: 'زمان‌بندی یافت نشد' });
    }
  } catch (error) {
    next(error);
  }
});

// ایجاد یک زمان‌بندی جدید
router.post('/schedules', auth.verifyToken, async (req, res, next) => {
  try {
    const { source_id, cron_expression, is_active, crawl_settings } = req.body;
    
    // اعتبارسنجی عبارت cron
    const cron = require('node-cron');
    if (!cron.validate(cron_expression)) {
      return res.status(400).json({ 
        success: false, 
        message: 'عبارت cron نامعتبر است. لطفاً فرمت صحیح را استفاده کنید (مثال: */10 * * * * برای هر 10 دقیقه)' 
      });
    }
    
    const crawlSettings = crawl_settings || {
      crawl_depth: 0,
      full_content: false,
      article_limit: 10,
      timeout_ms: 300000,
      follow_links: true
    };
    
    const newSchedule = await scheduler.createSchedule(source_id, cron_expression, is_active, crawlSettings);
    
    // شروع job اگر فعال است
    if (is_active && newSchedule.id) {
      const schedule = await scheduler.getScheduleById(newSchedule.id);
      if (schedule) {
        scheduler.startJob(schedule);
      }
    }
    
    res.status(201).json({ success: true, schedule: newSchedule });
  } catch (error) {
    next(error);
  }
});

// به‌روزرسانی یک زمان‌بندی
router.put('/schedules/:id', auth.verifyToken, async (req, res, next) => {
  try {
    const { source_id, cron_expression, is_active, crawl_settings } = req.body;
    
    // اعتبارسنجی عبارت cron
    const cron = require('node-cron');
    if (!cron.validate(cron_expression)) {
      return res.status(400).json({ 
        success: false, 
        message: 'عبارت cron نامعتبر است. لطفاً فرمت صحیح را استفاده کنید (مثال: */10 * * * * برای هر 10 دقیقه)' 
      });
    }
    
    const crawlSettings = crawl_settings || {
      crawl_depth: 0,
      full_content: false,
      article_limit: 10,
      timeout_ms: 300000,
      follow_links: true
    };
    
    const updatedSchedule = await scheduler.updateSchedule(req.params.id, source_id, cron_expression, is_active, crawlSettings);
    
    // مدیریت job بر اساس وضعیت فعال/غیرفعال
    if (is_active) {
      const schedule = await scheduler.getScheduleById(req.params.id);
      if (schedule) {
        scheduler.startJob(schedule);
      }
    } else {
      scheduler.stopJob(req.params.id);
    }
    
    if (updatedSchedule) {
      res.json({ success: true, schedule: updatedSchedule });
    } else {
      res.status(404).json({ success: false, message: 'زمان‌بندی یافت نشد' });
    }
  } catch (error) {
    next(error);
  }
});

// اجرای دستی یک زمان‌بندی
router.post('/schedules/:id/run', auth.verifyToken, async (req, res, next) => {
  try {
    const schedule = await scheduler.getScheduleById(req.params.id);
    if (schedule) {
      // اجرای وظیفه به صورت غیرهمزمان
      scheduler.runJob(schedule.id);
      res.json({ success: true, message: `زمان‌بندی ${schedule.id} به صورت دستی اجرا شد.` });
    } else {
      res.status(404).json({ success: false, message: 'زمان‌بندی یافت نشد' });
    }
  } catch (error) {
    next(error);
  }
});

// حذف یک زمان‌بندی
router.delete('/schedules/:id', auth.verifyToken, async (req, res, next) => {
  try {
    // متوقف کردن job قبل از حذف
    scheduler.stopJob(req.params.id);
    
    const success = await scheduler.deleteSchedule(req.params.id);
    if (success) {
      res.json({ success: true, message: 'زمان‌بندی با موفقیت حذف شد' });
    } else {
      res.status(404).json({ success: false, message: 'زمان‌بندی یافت نشد' });
    }
  } catch (error) {
    next(error);
  }
});

// ==================== NEWS SOURCES ROUTES ====================

// Helper function to create source feed
function createSourceFeed(articles, source, req, feedType = 'rss') {
  const { Feed } = require('feed');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const originalUrl = req.originalUrl;
  
  const feed = new Feed({
    title: `آخرین اخبار ${source.name}`,
    description: `آخرین اخبار و مطالب از منبع ${source.name}`,
    id: `${baseUrl}${originalUrl}`,
    link: source.base_url || baseUrl,
    language: 'fa-IR',
    image: `${baseUrl}/favicon.ico`,
    favicon: `${baseUrl}/favicon.ico`,
    copyright: `© ${new Date().getFullYear()} ${source.name}`,
    updated: new Date(),
    generator: 'FarsNews Crawler RSS Generator',
    feedLinks: {
      rss2: `${baseUrl}/api/sources/${source.id}/rss`,
      atom: `${baseUrl}/api/sources/${source.id}/atom`,
      json: `${baseUrl}/api/sources/${source.id}/feed.json`
    },
    author: {
      name: source.name,
      link: source.base_url || baseUrl
    },
    ttl: 60
  });

  articles.forEach(article => {
    feed.addItem({
      title: article.title || 'بدون عنوان',
      id: article.link || `${baseUrl}/article/${article.id}`,
      link: article.link || `${baseUrl}/article/${article.id}`,
      description: article.content || article.title || 'محتوای خلاصه در دسترس نیست',
      content: article.content || article.title || 'محتوای کامل در دسترس نیست',
      author: [{
        name: source.name,
        link: source.base_url || baseUrl
      }],
      date: article.created_at ? moment(article.created_at).tz('Asia/Tehran').toDate() : new Date(),
      image: article.image_url || null
    });
  });

  return feed;
}

// دریافت فید RSS برای یک منبع خاص
router.get('/sources/:id/rss', async (req, res, next) => {
  const { id } = req.params;
  const db = database.db;

  try {
    const articles = await db.query(
      'SELECT * FROM articles WHERE source_id = $1 ORDER BY created_at DESC LIMIT 20', 
      [id]
    );

    const sourceResult = await db.query(
      'SELECT * FROM news_sources WHERE id = $1', 
      [id]
    );
    const source = sourceResult.rows?.[0];

    if (!source) {
      return res.status(404).json({ success: false, message: 'منبع یافت نشد' });
    }

    const feed = createSourceFeed(articles, source, req, 'rss');
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(feed.rss2());

  } catch (error) {
    next(error);
  }
});

// دریافت فید Atom برای یک منبع خاص
router.get('/sources/:id/atom', async (req, res, next) => {
  const { id } = req.params;
  const db = database.db;

  try {
    const articles = await db.query(
      'SELECT * FROM articles WHERE source_id = $1 ORDER BY created_at DESC LIMIT 20', 
      [id]
    );

    const sourceResult = await db.query(
      'SELECT * FROM news_sources WHERE id = $1', 
      [id]
    );
    const source = sourceResult.rows?.[0];

    if (!source) {
      return res.status(404).json({ success: false, message: 'منبع یافت نشد' });
    }

    const feed = createSourceFeed(articles, source, req, 'atom');
    res.set('Content-Type', 'application/atom+xml; charset=utf-8');
    res.send(feed.atom1());

  } catch (error) {
    next(error);
  }
});

// دریافت فید JSON برای یک منبع خاص
router.get('/sources/:id/feed.json', async (req, res, next) => {
  const { id } = req.params;
  const db = database.db;

  try {
    const articles = await db.query(
      'SELECT * FROM articles WHERE source_id = $1 ORDER BY created_at DESC LIMIT 20', 
      [id]
    );

    const sourceResult = await db.query(
      'SELECT * FROM news_sources WHERE id = $1', 
      [id]
    );
    const source = sourceResult.rows?.[0];

    if (!source) {
      return res.status(404).json({ success: false, message: 'منبع یافت نشد' });
    }

    const feed = createSourceFeed(articles, source, req, 'json');
    res.set('Content-Type', 'application/feed+json; charset=utf-8');
    res.send(feed.json1());

  } catch (error) {
    next(error);
  }
});

// دریافت لیست منابع خبری
router.get('/sources', auth.verifyToken, async (req, res, next) => {
  const db = database.db;
  
  try {
    const result = await db.query('SELECT * FROM news_sources ORDER BY created_at DESC');
    const rows = result.rows || [];
    
    // تبدیل تاریخ‌ها به فرمت فارسی
    const formattedRows = rows.map(row => ({
      ...row,
      created_at: row.created_at ? moment(row.created_at).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : row.created_at,
      updated_at: row.updated_at ? moment(row.updated_at).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : row.updated_at
    }));
    
    res.json({
      success: true,
      sources: formattedRows
    });
  } catch (error) {
    next(error);
  }
});

// دریافت منبع خاص
router.get('/sources/:id', auth.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const db = database.db;
  
  try {
    const result = await db.query('SELECT * FROM news_sources WHERE id = $1', [id]);
    const row = result.rows?.[0];

    if (!row) {
      return res.status(404).json({ success: false, message: 'منبع یافت نشد' });
    }

    res.json({
      success: true,
      source: row
    });
  } catch (error) {
    next(error);
  }
});

// اضافه کردن منبع جدید
router.post('/sources', auth.verifyToken, validateSelectors, async (req, res, next) => {
  const { 
    name, base_url, list_selector, title_selector, content_selector, link_selector, 
    lead_selector, router_selector, title_selectors, content_selectors, 
    lead_selectors, router_selectors, driver_type 
  } = req.body;
  
  if (!name || !base_url) {
    return res.status(400).json({
      success: false,
      message: 'نام و URL پایه الزامی است'
    });
  }
  
  try {
    const db = database.db;
    const query = `
      INSERT INTO news_sources 
      (name, base_url, list_selector, title_selector, content_selector, link_selector, 
       lead_selector, router_selector, title_selectors, content_selectors, 
       lead_selectors, router_selectors, driver_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;

    // لاگ شروع عملیات افزودن منبع
    logger.info('شروع افزودن منبع جدید:', {
      name,
      base_url,
      list_selector,
      title_selector: title_selector || 'خالی',
      content_selector: content_selector || 'خالی',
      driver_type: driver_type || 'puppeteer',
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });

    const result = await db.query(query, [
      name, base_url, list_selector, 
      title_selector || '', content_selector || '', link_selector || '',
      lead_selector || '', router_selector || '',
      title_selectors || '[]', content_selectors || '[]',
      lead_selectors || '[]', router_selectors || '[]',
      driver_type || 'puppeteer'
    ]);

    const rows = result.rows || [];
    const newId = rows[0]?.id;
    
    logger.info('منبع جدید با موفقیت در دیتابیس ذخیره شد:', {
      id: newId,
      name,
      base_url,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });

    res.json({
      success: true,
      message: 'منبع جدید با موفقیت اضافه شد',
      id: newId
    });

  } catch (error) {
    logger.error('خطا در ذخیره منبع جدید در دیتابیس:', {
      error: error.message,
      name,
      base_url,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    next(error);
  }
});

// به‌روزرسانی منبع
router.put('/sources/:id', auth.verifyToken, validateSelectors, async (req, res, next) => {
  const { id } = req.params;
  const { 
    name, base_url, list_selector, title_selector, content_selector, link_selector, 
    lead_selector, router_selector, title_selectors, content_selectors, 
    lead_selectors, router_selectors, active, driver_type 
  } = req.body;
  
  try {
    const db = database.db;
    
    // لاگ شروع عملیات به‌روزرسانی
    logger.info('شروع به‌روزرسانی منبع:', {
      id,
      name,
      base_url,
      title_selector: title_selector || 'خالی',
      content_selector: content_selector || 'خالی',
      active,
      driver_type: driver_type || 'puppeteer',
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    
    const query = `
      UPDATE news_sources 
      SET name = $1, base_url = $2, list_selector = $3, title_selector = $4, 
          content_selector = $5, link_selector = $6, lead_selector = $7, router_selector = $8,
          title_selectors = $9, content_selectors = $10, lead_selectors = $11, router_selectors = $12,
          active = $13, driver_type = $14, updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
    `;

    const result = await db.query(query, [
      name, base_url, list_selector, 
      title_selector || '', content_selector || '', link_selector || '',
      lead_selector || '', router_selector || '',
      title_selectors || '[]', content_selectors || '[]',
      lead_selectors || '[]', router_selectors || '[]',
      active, driver_type || 'puppeteer', id
    ]);

    if (!result.rowCount || result.rowCount === 0) {
      logger.warn('تلاش برای به‌روزرسانی منبع ناموجود:', {
        id,
        rowCount: result.rowCount,
        timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
      });
      return res.status(404).json({ success: false, message: 'منبع یافت نشد' });
    }

    logger.info('منبع با موفقیت در دیتابیس به‌روزرسانی شد:', {
      id,
      name,
      rowCount: result.rowCount,
      command: result.command,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });

    logger.info('منبع به‌روزرسانی شد:', { id, name });

    res.json({
      success: true,
      message: 'منبع با موفقیت به‌روزرسانی شد'
    });

  } catch (error) {
    logger.error('خطا در به‌روزرسانی منبع در دیتابیس:', {
      error: error.message,
      id,
      name,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    next(error);
  }
});

// به‌روزرسانی: حذف منبع به همراه زمان‌بندی‌های مرتبط
router.delete('/sources/:id', auth.verifyToken, async (req, res, next) => {
  const { id } = req.params;

  // Ensure we use a single connection for the entire transaction
  const client = await database.pool.connect();

  try {
    logger.info('شروع حذف منبع و داده‌های مرتبط:', {
      source_id: id,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });

    await client.query('BEGIN');

    // دریافت زمان‌بندی‌های مرتبط و توقف job ها
    const schedulesResult = await client.query('SELECT id FROM schedules WHERE source_id = $1', [id]);
    const scheduleRows = schedulesResult.rows || [];

    logger.info('زمان‌بندی‌های مرتبط با منبع پیدا شد:', {
      source_id: id,
      schedules_count: scheduleRows.length,
      schedule_ids: Array.isArray(scheduleRows) ? scheduleRows.map(r => r.id) : [],
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });

    scheduleRows.forEach(row => scheduler.stopJob(row.id));

    // حذف وابستگی‌ها به ترتیب امن
    const schedulesDeleteResult = await client.query('DELETE FROM schedules WHERE source_id = $1', [id]);
    logger.info(`${schedulesDeleteResult.rowCount} زمان‌بندی مرتبط با منبع ${id} حذف شد`, {
      source_id: id,
      deleted_schedules: schedulesDeleteResult.rowCount,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });

    const crawlHistoryDeleteResult = await client.query('DELETE FROM crawl_history WHERE source_id = $1', [id]);
    logger.info(`${crawlHistoryDeleteResult.rowCount} رکورد تاریخچه کرال مرتبط با منبع ${id} حذف شد`, {
      source_id: id,
      deleted_crawl_history: crawlHistoryDeleteResult.rowCount,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });

    const crawlLogsDeleteResult = await client.query('DELETE FROM crawl_logs WHERE source_id = $1', [id]);
    logger.info(`${crawlLogsDeleteResult.rowCount} رکورد لاگ کرال مرتبط با منبع ${id} حذف شد`, {
      source_id: id,
      deleted_crawl_logs: crawlLogsDeleteResult.rowCount,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });

    const operationLogsDeleteResult = await client.query('DELETE FROM operation_logs WHERE source_id = $1', [id]);
    logger.info(`${operationLogsDeleteResult.rowCount} رکورد لاگ عملیات مرتبط با منبع ${id} حذف شد`, {
      source_id: id,
      deleted_operation_logs: operationLogsDeleteResult.rowCount,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });

    const articlesDeleteResult = await client.query('DELETE FROM articles WHERE source_id = $1', [id]);
    logger.info(`${articlesDeleteResult.rowCount} مقاله مرتبط با منبع ${id} حذف شد`, {
      source_id: id,
      deleted_articles: articlesDeleteResult.rowCount,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });

    // حذف منبع
    const sourceDeleteResult = await client.query('DELETE FROM news_sources WHERE id = $1', [id]);
    if (!sourceDeleteResult.rowCount) {
      logger.warn('تلاش برای حذف منبع ناموجود:', {
        source_id: id,
        timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
      });
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'منبع یافت نشد' });
    }

    logger.info('منبع با موفقیت از دیتابیس حذف شد:', {
      source_id: id,
      rowCount: sourceDeleteResult.rowCount,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });

    await client.query('COMMIT');

    logger.info('تراکنش حذف منبع با موفقیت تأیید شد:', {
      source_id: id,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });

    return res.json({
      success: true,
      message: 'منبع و تمام داده‌های مرتبط با موفقیت حذف شدند',
      deletedSchedules: schedulesDeleteResult.rowCount,
      deletedCrawlHistory: crawlHistoryDeleteResult.rowCount,
      deletedCrawlLogs: crawlLogsDeleteResult.rowCount,
      deletedOperationLogs: operationLogsDeleteResult.rowCount,
      deletedArticles: articlesDeleteResult.rowCount
    });
  } catch (error) {
    logger.error('خطا در حذف منبع:', {
      error: error.message,
      source_id: id,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('خطا در rollback تراکنش:', rollbackError);
    }
    next(error);
  } finally {
    client.release();
  }
});

// ==================== CRAWLER ROUTES ====================

// کرال جامع (Universal Crawler)
router.post('/crawler/crawl', auth.verifyToken, async (req, res) => {
  try {
    const { source_id, limit = 10, depth = 0, full_content = true } = req.body;
    
    if (!source_id) {
      return res.status(400).json({
        success: false,
        message: 'شناسه منبع الزامی است'
      });
    }
    
    const result = await crawler.crawlSource(parseInt(source_id), {
      limit: parseInt(limit),
      crawlDepth: parseInt(depth),
      fullContent: full_content
    });
    
    res.json({
      success: true,
      processed: result.processed || 0,
      new_articles: result.newArticles || 0,
      duplicates: result.duplicates || 0,
      errors: result.errors || 0,
      message: 'کرال با موفقیت انجام شد'
    });
    
  } catch (error) {
    logger.error('خطا در کرال جامع:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در کرال',
      error: error.message
    });
  }
});

// کرال منبع خاص
router.get('/crawl/:sourceId', auth.verifyToken, async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { limit = 10, depth = 0, full = true } = req.query;
    
    const result = await crawler.crawlSource(parseInt(sourceId), {
      limit: parseInt(limit),
      crawlDepth: parseInt(depth),
      fullContent: full === 'true'
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('خطا در کرال:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در کرال',
      error: error.message
    });
  }
});

// کرال فارس‌نیوز (برای سازگاری)
router.get('/farsnews', async (req, res) => {
  try {
    const { limit = 10, depth = 0, full = true } = req.query;
    
    // فارس‌نیوز همیشه sourceId = 1
    const result = await crawler.crawlSource(1, {
      limit: parseInt(limit),
      crawlDepth: parseInt(depth),
      fullContent: full === 'true'
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('خطا در کرال فارس‌نیوز:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در کرال',
      error: error.message
    });
  }
});

// تست سلکتور (بدون احراز هویت - برای استفاده عمومی)
router.post('/test-selector', async (req, res) => {
  try {
    const { url, selector, type = 'list', driverType = 'cheerio' } = req.body;
    
    // اعتبارسنجی ورودی
    if (!url || !selector) {
      return res.status(400).json({
        success: false,
        message: 'URL و سلکتور الزامی است',
        code: 'MISSING_PARAMETERS'
      });
    }
    
    // بررسی فرمت URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'فرمت URL نامعتبر است',
        code: 'INVALID_URL'
      });
    }
    
    // اجرای تست سلکتور با درایور انتخابی
    const result = await crawler.testSelector(url, selector, type, driverType);
    
    if (result.success) {
      // فرمت کردن نتیجه برای frontend
      const response = {
        success: true,
        message: `✅ ${result.result.count} عنصر یافت شد`,
        data: {
          count: result.result.count,
          samples: result.result.samples,
          performance: result.performance,
          metadata: {
            url: result.url,
            selector: result.selector,
            type: result.type,
            duration: result.duration,
            timestamp: result.timestamp
          }
        }
      };
      
      // فرمت خاص برای نوع list
      if (type === 'list') {
        response.data.formattedSamples = result.result.samples.map(sample => ({
          index: sample.index,
          url: sample.href || url,
          text: sample.text,
          element: {
            tag: sample.tagName,
            class: sample.className,
            id: sample.id
          }
        }));
      }
      
      res.json(response);
      
    } else {
      // مدیریت خطاهای مختلف
      const errorResponse = {
        success: false,
        message: `❌ ${result.error}`,
        error: {
          type: result.errorType || 'unknown',
          suggestion: result.suggestion || 'لطفاً سلکتور یا URL را بررسی کنید',
          details: result.error
        },
        metadata: {
          url: result.url,
          selector: result.selector,
          type: result.type,
          duration: result.duration,
          timestamp: result.timestamp
        }
      };
      
      // اضافه کردن پیشنهادات و اطلاعات صفحه در صورت وجود
      if (result.suggestions && result.suggestions.length > 0) {
        errorResponse.suggestions = result.suggestions;
      }
      
      if (result.pageInfo) {
        errorResponse.pageInfo = result.pageInfo;
      }
      
      // تعیین کد وضعیت HTTP بر اساس نوع خطا
      let statusCode = 400;
      if (result.errorType === 'timeout' || result.errorType === 'network') {
        statusCode = 408; // Request Timeout
      } else if (result.errorType === 'browser') {
        statusCode = 503; // Service Unavailable
      }
      
      res.status(statusCode).json(errorResponse);
    }
    
  } catch (error) {
    logger.error('خطای غیرمنتظره در تست سلکتور:', error);
    
    res.status(500).json({
      success: false,
      message: '❌ خطای داخلی سرور در تست سلکتور',
      error: {
        type: 'internal_server_error',
        suggestion: 'لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید',
        details: error.message
      },
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// تست سلکتور (با احراز هویت)
router.post('/crawler/test-selector', auth.verifyToken, async (req, res) => {
  try {
    const { url, selector, type = 'list' } = req.body;
    
    // اعتبارسنجی ورودی
    if (!url || !selector) {
      return res.status(400).json({
        success: false,
        message: 'URL و سلکتور الزامی است',
        code: 'MISSING_PARAMETERS'
      });
    }
    
    // بررسی فرمت URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'فرمت URL نامعتبر است',
        code: 'INVALID_URL'
      });
    }
    
    // اجرای تست سلکتور
    const result = await crawler.testSelector(url, selector, type);
    
    if (result.success) {
      // فرمت کردن نتیجه برای frontend
      const response = {
        success: true,
        message: `✅ ${result.result.count} عنصر یافت شد`,
        data: {
          count: result.result.count,
          samples: result.result.samples,
          performance: result.performance,
          metadata: {
            url: result.url,
            selector: result.selector,
            type: result.type,
            duration: result.duration,
            timestamp: result.timestamp
          }
        }
      };
      
      // فرمت خاص برای نوع list
      if (type === 'list') {
        response.data.formattedSamples = result.result.samples.map(sample => ({
          index: sample.index,
          url: sample.href || url,
          text: sample.text,
          element: {
            tag: sample.tagName,
            class: sample.className,
            id: sample.id
          }
        }));
      }
      
      res.json(response);
      
    } else {
      // مدیریت خطاهای مختلف
      const errorResponse = {
        success: false,
        message: `❌ ${result.error}`,
        error: {
          type: result.errorType || 'unknown',
          suggestion: result.suggestion || 'لطفاً سلکتور یا URL را بررسی کنید',
          details: result.error
        },
        metadata: {
          url: result.url,
          selector: result.selector,
          type: result.type,
          duration: result.duration,
          timestamp: result.timestamp
        }
      };
      
      // اضافه کردن پیشنهادات و اطلاعات صفحه در صورت وجود
      if (result.suggestions && result.suggestions.length > 0) {
        errorResponse.suggestions = result.suggestions;
      }
      
      if (result.pageInfo) {
        errorResponse.pageInfo = result.pageInfo;
      }
      
      // تعیین کد وضعیت HTTP بر اساس نوع خطا
      let statusCode = 400;
      if (result.errorType === 'timeout' || result.errorType === 'network') {
        statusCode = 408; // Request Timeout
      } else if (result.errorType === 'browser') {
        statusCode = 503; // Service Unavailable
      }
      
      res.status(statusCode).json(errorResponse);
    }
    
  } catch (error) {
    logger.error('خطای غیرمنتظره در تست سلکتور:', error);
    
    res.status(500).json({
      success: false,
      message: '❌ خطای داخلی سرور در تست سلکتور',
      error: {
        type: 'internal_server_error',
        suggestion: 'لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید',
        details: error.message
      },
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// ==================== ARTICLES ROUTES ====================

// دریافت مقالات با فیلترهای پیشرفته
router.get('/articles', async (req, res, next) => {
  const { 
    source_id, 
    full, 
    limit = 25, 
    offset = 0, 
    newOnly,
    title,
    status,
    date_from,
    date_to,
    depth,
    sort = 'created_at_desc'
  } = req.query;

  let query = `
    SELECT 
      a.*,
      ns.name as source_name
    FROM articles a
    LEFT JOIN news_sources ns ON a.source_id = ns.id
  `;
  const params = [];
  const conditions = [];

  if (source_id) {
    conditions.push('a.source_id = $' + (params.length + 1));
    params.push(source_id);
  }

  if (newOnly === 'true') {
    conditions.push('a.is_read = false');
  }

  // فیلتر عنوان
  if (title) {
    conditions.push('a.title ILIKE $' + (params.length + 1));
    params.push(`%${title}%`);
  }

  // فیلتر وضعیت
  if (status === 'new') {
    conditions.push('a.is_read = false');
  } else if (status === 'read') {
    conditions.push('a.is_read = true');
  }

  // فیلتر تاریخ
  if (date_from) {
    conditions.push('a.created_at >= $' + (params.length + 1));
    params.push(date_from + ' 00:00:00');
  }
  if (date_to) {
    conditions.push('a.created_at <= $' + (params.length + 1));
    params.push(date_to + ' 23:59:59');
  }

  // فیلتر عمق
  if (depth !== undefined && depth !== '') {
    conditions.push('a.depth = $' + (params.length + 1));
    params.push(parseInt(depth));
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  // مرتب‌سازی
  let orderBy = 'a.created_at DESC';
  switch (sort) {
    case 'created_at_asc':
      orderBy = 'a.created_at ASC';
      break;
    case 'title_asc':
      orderBy = 'a.title ASC';
      break;
    case 'title_desc':
      orderBy = 'a.title DESC';
      break;
    default:
      orderBy = 'a.created_at DESC';
  }

  query += ` ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(parseInt(limit, 10));
  params.push(parseInt(offset, 10));

  try {
    const db = database.db;
    
    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM articles a`;
    const countParams = [];
    
    if (source_id) {
      countQuery += ' WHERE a.source_id = $1';
      countParams.push(source_id);
    }
    
    if (newOnly === 'true') {
      countQuery += source_id ? ' AND a.is_read = false' : ' WHERE a.is_read = false';
    }
    
    const totalCountResult = await database.pool.query(countQuery, countParams);
    const totalCount = totalCountResult.rows[0].total;
    
    const rowsResult = await database.pool.query(query, params);
    const rows = rowsResult.rows.map(row => ({
      ...row,
      created_at: row.created_at ? moment(row.created_at).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : row.created_at
    }));

    if (full !== 'true') {
      rows.forEach(row => {
        delete row.content;
      });
    }

    const currentPage = Math.floor(parseInt(offset, 10) / parseInt(limit, 10)) + 1;
    const totalPages = Math.ceil(totalCount / parseInt(limit, 10));

    res.json({
      success: true,
      articles: rows,
      pagination: {
        currentPage,
        totalPages,
        totalCount,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      }
    });

    if (newOnly === 'true' && rows.length > 0) {
      const ids = rows.map(row => row.id);
      const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
      const updateQuery = `UPDATE articles SET is_new = false WHERE id IN (${placeholders})`;
      await database.pool.query(updateQuery, ids);
    }
  } catch (error) {
    next(error);
  }
});

// دریافت یک مقاله خاص
router.get('/articles/:id', async (req, res, next) => {
  const { id } = req.params;
  const db = database.db;

  try {
    const query = `
      SELECT 
        a.*,
        ns.name as source_name
      FROM articles a
      LEFT JOIN news_sources ns ON a.source_id = ns.id
      WHERE a.id = $1
    `;
    
    const result = await db.query(query, [id]);
    const article = result.rows?.[0];

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'مقاله یافت نشد'
      });
    }

    const processedArticle = {
      ...article,
      created_at: article.created_at ? moment(article.created_at).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : article.created_at
    };

    res.json({
      success: true,
      article: processedArticle
    });

  } catch (error) {
    next(error);
  }
});

// علامت‌گذاری مقاله به عنوان خوانده‌شده
router.put('/articles/:id/read', async (req, res) => {
  const { id } = req.params;
  const db = database.db;
  
  try {
    await db.query('UPDATE articles SET is_read = true WHERE id = $1', [id]);
    
    res.json({
      success: true,
      message: 'مقاله به عنوان خوانده‌شده علامت‌گذاری شد'
    });
  } catch (error) {
    logger.error('خطا در به‌روزرسانی مقاله:', error);
    res.status(500).json({ success: false, message: 'خطای دیتابیس' });
  }
});

// حذف مقاله
router.delete('/articles/:id', auth.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const db = database.db;
  
  try {
    // ابتدا بررسی کنیم که مقاله وجود دارد
    const checkResult = await db.query('SELECT id, title FROM articles WHERE id = $1', [id]);
    
    if (!checkResult.rows || checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'مقاله یافت نشد'
      });
    }
    
    const article = checkResult.rows[0];
    
    // حذف مقاله
    const deleteResult = await db.query('DELETE FROM articles WHERE id = $1', [id]);
    
    if (deleteResult.rowCount === 0) {
      return res.status(500).json({
        success: false,
        message: 'خطا در حذف مقاله'
      });
    }
    
    logger.info(`مقاله حذف شد: ID=${id}, Title="${article.title}"`);
    
    res.json({
      success: true,
      message: 'مقاله با موفقیت حذف شد',
      deletedArticle: {
        id: parseInt(id),
        title: article.title
      }
    });
    
  } catch (error) {
    logger.error('خطا در حذف مقاله:', error);
    next(error);
  }
});

// ==================== STATS & LOGS ROUTES ====================

// آمار کلی
router.get('/stats', async (req, res) => {
  const db = database.db;
  
  try {
    const queries = {
      totalArticles: 'SELECT COUNT(*) as count FROM articles',
      newArticles: 'SELECT COUNT(*) as count FROM articles WHERE is_read = false',
      totalSources: 'SELECT COUNT(*) as count FROM news_sources WHERE active = true',
      recentCrawls: 'SELECT COUNT(*) as count FROM crawl_history WHERE created_at > NOW() - INTERVAL \'24 hours\'',
      topSources: `
        SELECT ns.name, COUNT(a.id) as article_count
        FROM news_sources ns
        LEFT JOIN articles a ON ns.id = a.source_id
        WHERE ns.active = true
        GROUP BY ns.id, ns.name
        ORDER BY article_count DESC
        LIMIT 5
      `
    };
    
    // اجرای کوئری‌ها به صورت موازی
    const [totalArticlesResult, newArticlesResult, totalSourcesResult, recentCrawlsResult, topSourcesResult] = await Promise.all([
      db.query(queries.totalArticles),
      db.query(queries.newArticles),
      db.query(queries.totalSources),
      db.query(queries.recentCrawls),
      db.query(queries.topSources)
    ]);
    
    const stats = {
      totalArticles: parseInt(totalArticlesResult.rows?.[0]?.count || 0),
      newArticles: parseInt(newArticlesResult.rows?.[0]?.count || 0),
      totalSources: parseInt(totalSourcesResult.rows?.[0]?.count || 0),
      recentCrawls: parseInt(recentCrawlsResult.rows?.[0]?.count || 0),
      topSources: topSourcesResult
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('خطا در دریافت آمار:', error);
    res.status(500).json({ success: false, message: 'خطای دیتابیس' });
  }
});

// دریافت لاگ‌ها
router.get('/logs', auth.verifyToken, async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0, 
      source_id, 
      status, 
      action, 
      date_from, 
      date_to, 
      message, 
      sort = 'created_at',
      order = 'desc'
    } = req.query;
    
    let query = `
      SELECT cl.*, ns.name as source_name
      FROM crawl_logs cl
      LEFT JOIN news_sources ns ON cl.source_id = ns.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    // فیلتر بر اساس منبع
    if (source_id) {
      query += ` AND cl.source_id = $${paramIndex}`;
      params.push(source_id);
      paramIndex++;
    }
    
    // فیلتر بر اساس وضعیت
    if (status) {
      query += ` AND cl.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    // فیلتر بر اساس عملیات
    if (action) {
      query += ` AND cl.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }
    
    // فیلتر بر اساس تاریخ از
    if (date_from) {
      query += ` AND cl.created_at >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }
    
    // فیلتر بر اساس تاریخ تا
    if (date_to) {
      query += ` AND cl.created_at <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }
    
    // جستجو در پیام
    if (message) {
      query += ` AND cl.message ILIKE $${paramIndex}`;
      params.push(`%${message}%`);
      paramIndex++;
    }
    
    // مرتب‌سازی
    const validSortFields = ['created_at', 'source_name', 'action', 'status', 'articles_found', 'articles_processed', 'duration_ms'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY cl.${sortField} ${sortOrder}`;
    
    // شمارش کل رکوردها
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await connectionPool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total);
    
    // اضافه کردن limit و offset
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await connectionPool.query(query, params);
    const logs = result.rows;
    
    // تبدیل زمان‌ها به تهران
    const formattedLogs = logs.map(log => ({
      ...log,
      timestamp: log.timestamp ? moment(log.timestamp).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : log.timestamp,
      created_at: log.created_at ? moment(log.created_at).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : log.created_at
    }));
    
    // محاسبه اطلاعات صفحه‌بندی
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      success: true,
      logs: formattedLogs,
      pagination: {
        currentPage,
        totalPages,
        totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('خطا در دریافت لاگ‌ها:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لاگ‌ها'
    });
  }
});

// دریافت آمار لاگ‌ها
router.get('/logs/stats', auth.verifyToken, async (req, res) => {
  try {
    const { source_id, date_from, date_to } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (source_id) {
      whereClause += ` AND source_id = $${paramIndex}`;
      params.push(source_id);
      paramIndex++;
    }
    
    if (date_from) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }
    
    if (date_to) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }
    
    // آمار کلی
    const totalQuery = `SELECT COUNT(*) as total FROM crawl_logs ${whereClause}`;
    const totalResult = await connectionPool.query(totalQuery, params);
    const totalLogs = parseInt(totalResult.rows[0].total);
    
    // آمار بر اساس وضعیت
    const statusQuery = `
      SELECT status, COUNT(*) as count 
      FROM crawl_logs ${whereClause}
      GROUP BY status
    `;
    const statusResult = await connectionPool.query(statusQuery, params);
    const statusStats = statusResult.rows;
    
    // آمار بر اساس عملیات
    const actionQuery = `
      SELECT action, COUNT(*) as count 
      FROM crawl_logs ${whereClause}
      GROUP BY action
    `;
    const actionResult = await connectionPool.query(actionQuery, params);
    const actionStats = actionResult.rows;
    
    // آمار امروز
    const todayQuery = `
      SELECT COUNT(*) as count 
      FROM crawl_logs 
      WHERE DATE(created_at) = CURRENT_DATE
    `;
    const todayResult = await connectionPool.query(todayQuery);
    const todayLogs = parseInt(todayResult.rows[0].count);
    
    // آمار موفقیت‌ها
    const successQuery = `
      SELECT COUNT(*) as count 
      FROM crawl_logs ${whereClause} AND status = 'success'
    `;
    const successResult = await connectionPool.query(successQuery, params);
    const successLogs = parseInt(successResult.rows[0].count);
    
    // آمار خطاها
    const errorQuery = `
      SELECT COUNT(*) as count 
      FROM crawl_logs ${whereClause} AND status = 'error'
    `;
    const errorResult = await connectionPool.query(errorQuery, params);
    const errorLogs = parseInt(errorResult.rows[0].count);
    
    res.json({
      success: true,
      stats: {
        total: totalLogs,
        today: todayLogs,
        success: successLogs,
        error: errorLogs,
        statusBreakdown: statusStats,
        actionBreakdown: actionStats
      }
    });
  } catch (error) {
    logger.error('خطا در دریافت آمار لاگ‌ها:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت آمار لاگ‌ها'
    });
  }
});

// حذف لاگ
router.delete('/logs/:id', auth.verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await connectionPool.query(
      'DELETE FROM crawl_logs WHERE id = $1',
      [id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'لاگ یافت نشد'
      });
    }
    
    res.json({
      success: true,
      message: 'لاگ با موفقیت حذف شد'
    });
  } catch (error) {
    logger.error('خطا در حذف لاگ:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در حذف لاگ'
    });
  }
});

// تلاش مجدد برای لاگ
router.post('/logs/:id/retry', auth.verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // دریافت اطلاعات لاگ
    const logResult = await connectionPool.query(
      'SELECT * FROM crawl_logs WHERE id = $1',
      [id]
    );
    
    if (logResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لاگ یافت نشد'
      });
    }
    
    const log = logResult.rows[0];
    
    // بررسی اینکه لاگ خطا داشته باشد
    if (log.status !== 'error') {
      return res.status(400).json({
        success: false,
        message: 'فقط لاگ‌های خطا قابل تلاش مجدد هستند'
      });
    }
    
    // اجرای مجدد عملیات کرال
    const crawler = new UniversalCrawler(config.webDriver.defaultType);
    
    // یافتن منبع
    const sourceResult = await connectionPool.query(
      'SELECT * FROM news_sources WHERE id = $1',
      [log.source_id]
    );
    
    if (sourceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'منبع یافت نشد'
      });
    }
    
    const source = sourceResult.rows[0];
    
    // اجرای کرال مجدد
    const crawlResult = await crawler.crawl(source);
    
    res.json({
      success: true,
      message: 'عملیات کرال مجدد شروع شد',
      result: crawlResult
    });
  } catch (error) {
    logger.error('خطا در تلاش مجدد لاگ:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در تلاش مجدد لاگ'
    });
  }
});

// پاک کردن همه لاگ‌ها
router.delete('/logs', auth.verifyToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const result = await connectionPool.query(
      'DELETE FROM crawl_logs WHERE created_at < $1',
      [cutoffDate.toISOString()]
    );
    
    res.json({
      success: true,
      message: `${result.rowCount} لاگ قدیمی پاک شد`,
      deletedCount: result.rowCount
    });
  } catch (error) {
    logger.error('خطا در پاک کردن لاگ‌ها:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در پاک کردن لاگ‌ها'
    });
  }
});

// ==================== CLEANUP SCHEDULES ROUTES ====================

// دریافت همه زمانبندی‌های پاک‌سازی
router.get('/cleanup-schedules', auth.verifyToken, async (req, res, next) => {
  try {
    const schedules = await cleanup.getAllActiveSchedules();
    
    const formattedSchedules = schedules.map(schedule => ({
      ...schedule,
      created_at: schedule.created_at ? moment(schedule.created_at).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : schedule.created_at,
      updated_at: schedule.updated_at ? moment(schedule.updated_at).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : schedule.updated_at
    }));
    
    res.json({ success: true, schedules: formattedSchedules });
  } catch (error) {
    next(error);
  }
});

// دریافت یک زمانبندی پاک‌سازی
router.get('/cleanup-schedules/:id', auth.verifyToken, async (req, res, next) => {
  try {
    const schedule = await cleanup.getScheduleById(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'زمانبندی پاک‌سازی یافت نشد' });
    }
    
    const formattedSchedule = {
      ...schedule,
      created_at: schedule.created_at ? moment(schedule.created_at).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : schedule.created_at,
      updated_at: schedule.updated_at ? moment(schedule.updated_at).tz('Asia/Tehran').format('YYYY/MM/DD HH:mm:ss') : schedule.updated_at
    };
    
    res.json({ success: true, schedule: formattedSchedule });
  } catch (error) {
    next(error);
  }
});

// ایجاد زمانبندی پاک‌سازی جدید
router.post('/cleanup-schedules', auth.verifyToken, async (req, res, next) => {
  try {
    const { name, cron_expression, keep_articles_count, is_active } = req.body;
    
    // لاگ شروع ایجاد زمان‌بندی
    logger.info('شروع ایجاد زمان‌بندی پاک‌سازی جدید:', {
      name,
      cron_expression,
      keep_articles_count,
      is_active,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    
    // اعتبارسنجی عبارت cron
    const cron = require('node-cron');
    if (!cron.validate(cron_expression)) {
      logger.warn('تلاش برای ایجاد زمان‌بندی با عبارت cron نامعتبر:', {
        name,
        cron_expression,
        timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
      });
      return res.status(400).json({ 
        success: false, 
        message: 'عبارت cron نامعتبر است. لطفاً فرمت صحیح را استفاده کنید (مثال: 0 2 * * * برای ساعت 2 شب هر روز)' 
      });
    }
    
    const newSchedule = await cleanup.createSchedule(name, cron_expression, keep_articles_count, is_active);
    
    logger.info('زمان‌بندی پاک‌سازی جدید با موفقیت ایجاد شد:', {
      schedule_id: newSchedule.id,
      name,
      is_active,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    
    // شروع job اگر فعال است
    if (is_active && newSchedule.id) {
      const schedule = await cleanup.getScheduleById(newSchedule.id);
      if (schedule) {
        await cleanup.startJob(schedule);
        logger.info('زمان‌بندی پاک‌سازی فعال شد:', {
          schedule_id: newSchedule.id,
          name,
          timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
        });
      } else {
        logger.warn('زمان‌بندی پاک‌سازی یافت نشد برای شروع job:', {
          schedule_id: newSchedule.id,
          name,
          timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
        });
      }
    }
    
    res.status(201).json({ success: true, schedule: newSchedule });
  } catch (error) {
    logger.error('خطا در ایجاد زمان‌بندی پاک‌سازی:', {
      error: error.message,
      name: req.body.name,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    next(error);
  }
});

// به‌روزرسانی زمانبندی پاک‌سازی
router.put('/cleanup-schedules/:id', auth.verifyToken, async (req, res, next) => {
  try {
    const { name, cron_expression, keep_articles_count, is_active } = req.body;
    const scheduleId = req.params.id;
    
    // لاگ شروع به‌روزرسانی زمان‌بندی
    logger.info('شروع به‌روزرسانی زمان‌بندی پاک‌سازی:', {
      schedule_id: scheduleId,
      name,
      cron_expression,
      keep_articles_count,
      is_active,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    
    // اعتبارسنجی عبارت cron
    const cron = require('node-cron');
    if (!cron.validate(cron_expression)) {
      logger.warn('تلاش برای به‌روزرسانی زمان‌بندی با عبارت cron نامعتبر:', {
        schedule_id: scheduleId,
        name,
        cron_expression,
        timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
      });
      return res.status(400).json({ 
        success: false, 
        message: 'عبارت cron نامعتبر است. لطفاً فرمت صحیح را استفاده کنید (مثال: 0 2 * * * برای ساعت 2 شب هر روز)' 
      });
    }
    
    const updatedSchedule = await cleanup.updateSchedule(scheduleId, name, cron_expression, keep_articles_count, is_active);
    
    // مدیریت job بر اساس وضعیت فعال/غیرفعال
    if (is_active) {
      const schedule = await cleanup.getScheduleById(scheduleId);
      if (schedule) {
        await cleanup.startJob(schedule);
        logger.info('زمان‌بندی پاک‌سازی فعال شد:', {
          schedule_id: scheduleId,
          name,
          timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
        });
      } else {
        logger.warn('زمان‌بندی پاک‌سازی یافت نشد برای فعال کردن:', {
          schedule_id: scheduleId,
          name,
          timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
        });
      }
    } else {
      cleanup.stopJob(scheduleId);
      logger.info('زمان‌بندی پاک‌سازی غیرفعال شد:', {
        schedule_id: scheduleId,
        name,
        timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
      });
    }
    
    if (updatedSchedule.changes > 0) {
      logger.info('زمان‌بندی پاک‌سازی با موفقیت به‌روزرسانی شد:', {
        schedule_id: scheduleId,
        name,
        changes: updatedSchedule.changes,
        timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
      });
      res.json({ success: true, schedule: updatedSchedule });
    } else {
      logger.warn('تلاش برای به‌روزرسانی زمان‌بندی ناموجود:', {
        schedule_id: scheduleId,
        timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
      });
      res.status(404).json({ success: false, message: 'زمانبندی پاک‌سازی یافت نشد' });
    }
  } catch (error) {
    logger.error('خطا در به‌روزرسانی زمان‌بندی پاک‌سازی:', {
      error: error.message,
      schedule_id: req.params.id,
      name: req.body.name,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    next(error);
  }
});

// حذف زمانبندی پاک‌سازی
router.delete('/cleanup-schedules/:id', auth.verifyToken, async (req, res, next) => {
  try {
    const scheduleId = req.params.id;
    
    // لاگ شروع حذف زمان‌بندی
    logger.info('شروع حذف زمان‌بندی پاک‌سازی:', {
      schedule_id: scheduleId,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    
    const result = await cleanup.deleteSchedule(scheduleId);
    
    if (result.success) {
      logger.info('زمان‌بندی پاک‌سازی با موفقیت حذف شد:', {
        schedule_id: scheduleId,
        timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
      });
      res.json({ success: true, message: 'زمانبندی پاک‌سازی با موفقیت حذف شد' });
    } else {
      logger.warn('تلاش برای حذف زمان‌بندی ناموجود:', {
        schedule_id: scheduleId,
        timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
      });
      res.status(404).json({ success: false, message: 'زمانبندی پاک‌سازی یافت نشد' });
    }
  } catch (error) {
    logger.error('خطا در حذف زمان‌بندی پاک‌سازی:', {
      error: error.message,
      schedule_id: req.params.id,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    next(error);
  }
});

// اجرای دستی پاک‌سازی
router.post('/cleanup-schedules/:id/run', auth.verifyToken, async (req, res, next) => {
  try {
    const scheduleId = req.params.id;
    
    // لاگ شروع اجرای دستی پاک‌سازی
    logger.info('شروع اجرای دستی پاک‌سازی بر اساس زمان‌بندی:', {
      schedule_id: scheduleId,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    
    const schedule = await cleanup.getScheduleById(scheduleId);
    if (!schedule) {
      logger.warn('تلاش برای اجرای پاک‌سازی با زمان‌بندی ناموجود:', {
        schedule_id: scheduleId,
        timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
      });
      return res.status(404).json({ success: false, message: 'زمانبندی پاک‌سازی یافت نشد' });
    }
    
    const result = await cleanup.runManualCleanup(schedule.keep_articles_count);
    
    logger.info('پاک‌سازی دستی با موفقیت انجام شد:', {
      schedule_id: scheduleId,
      keep_articles_count: schedule.keep_articles_count,
      deleted_count: result.deletedCount,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    
    res.json({ 
      success: true, 
      message: `پاک‌سازی با موفقیت انجام شد: ${result.deletedCount} مقاله پاک شد`,
      result 
    });
  } catch (error) {
    logger.error('خطا در اجرای دستی پاک‌سازی:', {
      error: error.message,
      schedule_id: req.params.id,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    next(error);
  }
});

// پاک‌سازی دستی با تعداد دلخواه
router.post('/cleanup/manual', auth.verifyToken, async (req, res, next) => {
  try {
    const { keep_articles_count } = req.body;
    
    // لاگ شروع پاک‌سازی دستی
    logger.info('شروع پاک‌سازی دستی با تعداد دلخواه:', {
      keep_articles_count: keep_articles_count,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    
    if (!keep_articles_count || keep_articles_count < 1) {
      logger.warn('تلاش برای پاک‌سازی دستی با تعداد نامعتبر:', {
        keep_articles_count: keep_articles_count,
        timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
      });
      return res.status(400).json({ 
        success: false, 
        message: 'تعداد مقالات نگهداری شده باید حداقل 1 باشد' 
      });
    }
    
    const result = await cleanup.runManualCleanup(keep_articles_count);
    
    logger.info('پاک‌سازی دستی با موفقیت انجام شد:', {
      keep_articles_count: keep_articles_count,
      deleted_count: result.deletedCount,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    
    res.json({ 
      success: true, 
      message: `پاک‌سازی دستی با موفقیت انجام شد: ${result.deletedCount} مقاله پاک شد`,
      result 
    });
  } catch (error) {
    logger.error('خطا در پاک‌سازی دستی:', {
      error: error.message,
      keep_articles_count: req.body.keep_articles_count,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    next(error);
  }
});

// ==================== WEBDRIVER ROUTES ====================

// دریافت نوع فعلی webDriver
router.get('/webdriver/current', auth.requireAuth, async (req, res, next) => {
  try {
    const currentType = crawler.webDriverManager.getCurrentType();
    const availableDrivers = crawler.getAvailableDrivers();
    
    res.json({
      success: true,
      data: {
        currentType,
        availableDrivers,
        isConnected: crawler.webDriverManager.isConnected()
      }
    });
  } catch (error) {
    next(error);
  }
});

// تغییر نوع webDriver
router.post('/webdriver/switch', auth.requireAuth, async (req, res, next) => {
  try {
    const { driverType } = req.body;
    
    if (!driverType) {
      return res.status(400).json({
        success: false,
        message: 'نوع درایور الزامی است'
      });
    }
    
    const availableDrivers = crawler.getAvailableDrivers();
    if (!availableDrivers.includes(driverType)) {
      return res.status(400).json({
        success: false,
        message: `نوع درایور ${driverType} در دسترس نیست. درایورهای موجود: ${availableDrivers.join(', ')}`
      });
    }
    
    // بستن درایور فعلی
    await crawler.forceCloseWebDriver();
    
    // تغییر نوع درایور
    crawler.setDriverType(driverType);
    
    // راه‌اندازی درایور جدید
    await crawler.initWebDriver();
    
    logger.info(`نوع webDriver به ${driverType} تغییر یافت`);
    
    res.json({
      success: true,
      message: `نوع درایور با موفقیت به ${driverType} تغییر یافت`,
      data: {
        currentType: driverType,
        isConnected: crawler.webDriverManager.isConnected()
      }
    });
  } catch (error) {
    next(error);
  }
});

// دریافت وضعیت عملکرد webDriver
router.get('/webdriver/status', auth.requireAuth, async (req, res, next) => {
  try {
    const stats = crawler.getStats();
    const memoryUsage = process.memoryUsage();
    
    res.json({
      success: true,
      data: {
        crawlStats: stats,
        memoryUsage: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
          external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
        },
        uptime: process.uptime(),
        isConnected: crawler.webDriverManager.isConnected(),
        currentType: crawler.webDriverManager.getCurrentType()
      }
    });
  } catch (error) {
    next(error);
  }
});

// اجرای پاکسازی دستی منابع
router.post('/webdriver/cleanup', auth.requireAuth, async (req, res, next) => {
  try {
    await crawler.performPeriodicCleanup();
    
    // اجرای garbage collection
    if (global.gc) {
      global.gc();
    }
    
    const memoryAfter = process.memoryUsage();
    
    res.json({
      success: true,
      message: 'پاکسازی منابع با موفقیت انجام شد',
      data: {
        memoryUsage: {
          rss: Math.round(memoryAfter.rss / 1024 / 1024) + ' MB',
          heapTotal: Math.round(memoryAfter.heapTotal / 1024 / 1024) + ' MB',
          heapUsed: Math.round(memoryAfter.heapUsed / 1024 / 1024) + ' MB',
          external: Math.round(memoryAfter.external / 1024 / 1024) + ' MB'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// ==================== PERFORMANCE & QUEUE ROUTES ====================

// دریافت آمار عملکرد
router.get('/performance/stats', auth.requireAuth, async (req, res, next) => {
  try {
    const hours = parseInt(req.query.hours) || 1;
    const stats = await global.performanceMonitor.getPerformanceStats(hours);
    const systemStatus = global.performanceMonitor.getSystemStatus();
    
    res.json({
      success: true,
      data: {
        stats,
        systemStatus,
        period: `${hours} ساعت گذشته`
      }
    });
  } catch (error) {
    next(error);
  }
});

// دریافت وضعیت صف
router.get('/queue/status', auth.requireAuth, async (req, res, next) => {
  try {
    const queueStats = global.queueManager.getStats();
    
    res.json({
      success: true,
      data: queueStats
    });
  } catch (error) {
    next(error);
  }
});

// اضافه کردن کار به صف
router.post('/queue/add', auth.requireAuth, async (req, res, next) => {
  try {
    const { type, priority = 'normal', options = {} } = req.body;
    
    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'نوع کار الزامی است'
      });
    }
    
    const validTypes = ['crawl', 'compress', 'cleanup'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `نوع کار باید یکی از موارد زیر باشد: ${validTypes.join(', ')}`
      });
    }
    
    const jobId = global.queueManager.addJob({ type, options }, priority);
    
    res.json({
      success: true,
      message: 'کار با موفقیت به صف اضافه شد',
      data: { jobId }
    });
  } catch (error) {
    next(error);
  }
});

// اجرای فشردگی دستی
router.post('/compression/run', auth.requireAuth, async (req, res, next) => {
  try {
    const { daysOld = 30, dryRun = false } = req.body;
    
    // اضافه کردن به صف با اولویت بالا
    const jobId = global.queueManager.addJob({
      type: 'compress',
      options: { daysOld, dryRun }
    }, 'high');
    
    res.json({
      success: true,
      message: 'فشردگی به صف اضافه شد',
      data: { jobId }
    });
  } catch (error) {
    next(error);
  }
});

// دریافت آمار فشردگی
router.get('/compression/stats', auth.requireAuth, async (req, res, next) => {
  try {
    const stats = await global.compressionService.getCompressionStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// تنظیم آستانه هشدارها
router.post('/performance/alerts/threshold', auth.requireAuth, async (req, res, next) => {
  try {
    const { type, threshold } = req.body;
    
    if (!type || threshold === undefined) {
      return res.status(400).json({
        success: false,
        message: 'نوع و آستانه هشدار الزامی است'
      });
    }
    
    const validTypes = ['cpu', 'memory', 'disk', 'database'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `نوع هشدار باید یکی از موارد زیر باشد: ${validTypes.join(', ')}`
      });
    }
    
    global.performanceMonitor.setAlertThreshold(type, threshold);
    
    res.json({
      success: true,
      message: `آستانه هشدار ${type} به ${threshold} تغییر یافت`
    });
  } catch (error) {
    next(error);
  }
});

// دریافت محتوای فشرده شده
router.get('/articles/:id/content', auth.requireAuth, async (req, res, next) => {
  try {
    const articleId = req.params.id;
    const content = await global.compressionService.getCompressedContent(articleId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'مقاله یافت نشد'
      });
    }
    
    res.json({
      success: true,
      data: { content }
    });
  } catch (error) {
    next(error);
  }
});

// اجرای پاکسازی اضطراری
router.post('/system/emergency-cleanup', auth.requireAuth, async (req, res, next) => {
  try {
    // اضافه کردن کارهای پاکسازی با اولویت بالا
    const cleanupJobId = global.queueManager.addJob({
      type: 'cleanup',
      options: { aggressive: true }
    }, 'high');
    
    const compressJobId = global.queueManager.addJob({
      type: 'compress',
      options: { daysOld: 7, emergency: true }
    }, 'high');
    
    // اجرای garbage collection فوری
    if (global.gc) {
      global.gc();
    }
    
    res.json({
      success: true,
      message: 'پاکسازی اضطراری شروع شد',
      data: {
        cleanupJobId,
        compressJobId
      }
    });
  } catch (error) {
    next(error);
  }
});

// دریافت متریک‌های لحظه‌ای
router.get('/performance/realtime', auth.requireAuth, async (req, res, next) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      success: true,
      data: {
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024)
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime(),
        timestamp: Date.now()
      }
    });
  } catch (error) {
    next(error);
  }
});

// ==================== SELECTOR BUILDER ROUTES ====================

// دریافت محتوای صفحه برای selector builder
router.post('/selector-builder/fetch-page', auth.requireAuth, async (req, res, next) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL الزامی است'
      });
    }
    
    // بررسی معتبر بودن URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'URL نامعتبر است'
      });
    }
    
    res.json({
      success: true,
      message: 'URL معتبر است',
      url
    });
    
  } catch (error) {
    next(error);
  }
});

// پروکسی برای بارگذاری صفحات خارجی
router.get('/selector-builder/proxy', auth.requireAuth, async (req, res, next) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL الزامی است'
      });
    }
    
    // بررسی معتبر بودن URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'URL نامعتبر است'
      });
    }
    
    const axios = require('axios');
    
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      // تنظیم header های مناسب
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'SAMEORIGIN'
      });
      
      // اضافه کردن script برای ارتباط با parent window
      let html = response.data;
      const scriptTag = `
        <script>
          // اضافه کردن event listener برای ارتباط با parent
          document.addEventListener('DOMContentLoaded', function() {
            // اطلاع رسانی به parent که صفحه بارگذاری شده
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({type: 'pageLoaded'}, '*');
            }
          });
        </script>
      `;
      
      // اضافه کردن script به انتهای body
      if (html.includes('</body>')) {
        html = html.replace('</body>', scriptTag + '</body>');
      } else {
        html += scriptTag;
      }
      
      res.send(html);
      
    } catch (error) {
      logger.error('خطا در دریافت صفحه:', error.message);
      res.status(500).json({
        success: false,
        message: 'خطا در دریافت صفحه: ' + error.message
      });
    }
    
  } catch (error) {
    next(error);
  }
});

// تولید CSS selector هوشمند
router.post('/selector-builder/generate-selector', auth.requireAuth, async (req, res, next) => {
  try {
    const { url, elementInfo } = req.body;
    
    if (!url || !elementInfo) {
      return res.status(400).json({
        success: false,
        message: 'URL و اطلاعات عنصر الزامی است'
      });
    }
    
    // تولید انتخابگرهای مختلف
    const selectors = [];
    
    // بر اساس ID
    if (elementInfo.id) {
      selectors.push({
        type: 'id',
        selector: `#${elementInfo.id}`,
        priority: 1,
        description: 'انتخابگر بر اساس ID'
      });
    }
    
    // بر اساس کلاس
    if (elementInfo.classes && elementInfo.classes.length > 0) {
      const classSelector = '.' + elementInfo.classes.join('.');
      selectors.push({
        type: 'class',
        selector: classSelector,
        priority: 2,
        description: 'انتخابگر بر اساس کلاس'
      });
    }
    
    // بر اساس تگ و ویژگی‌ها
    if (elementInfo.tagName) {
      let tagSelector = elementInfo.tagName.toLowerCase();
      
      // اضافه کردن ویژگی‌های مهم
      if (elementInfo.attributes) {
        if (elementInfo.attributes.name) {
          tagSelector += `[name="${elementInfo.attributes.name}"]`;
        }
        if (elementInfo.attributes.type) {
          tagSelector += `[type="${elementInfo.attributes.type}"]`;
        }
      }
      
      selectors.push({
        type: 'tag',
        selector: tagSelector,
        priority: 3,
        description: 'انتخابگر بر اساس تگ و ویژگی‌ها'
      });
    }
    
    // مرتب‌سازی بر اساس اولویت
    selectors.sort((a, b) => a.priority - b.priority);
    
    res.json({
      success: true,
      selectors
    });
    
  } catch (error) {
    next(error);
  }
});

// ذخیره پیکربندی selector
router.post('/selector-builder/save-config', auth.requireAuth, async (req, res, next) => {
  try {
    const { name, url, selectors, description } = req.body;
    
    if (!name || !url || !selectors) {
      return res.status(400).json({
        success: false,
        message: 'نام، URL و انتخابگرها الزامی است'
      });
    }
    
    // ذخیره در پایگاه داده
    const query = `
      INSERT INTO selector_configs (name, url, selectors, description, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    
    const result = await connectionPool.query(query, [
      name,
      url,
      JSON.stringify(selectors),
      description
    ]);
    
    res.json({
      success: true,
      message: 'پیکربندی با موفقیت ذخیره شد',
      id: result.rows?.[0]?.id
    });
    
  } catch (error) {
    next(error);
  }
});

// دریافت لیست پیکربندی‌های ذخیره شده
router.get('/selector-builder/configs', auth.requireAuth, async (req, res, next) => {
  try {
    const query = `
      SELECT id, name, url, description, created_at
      FROM selector_configs
      ORDER BY created_at DESC
    `;
    
    const result = await connectionPool.query(query);
    const configs = result.rows || [];
    
    res.json({
      success: true,
      configs
    });
    
  } catch (error) {
    next(error);
  }
});

// دریافت جزئیات یک پیکربندی
router.get('/selector-builder/configs/:id', auth.requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT * FROM selector_configs WHERE id = $1
    `;
    
    const result = await connectionPool.query(query, [id]);
    const config = result.rows?.[0];
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'پیکربندی یافت نشد'
      });
    }
    
    // تبدیل JSON string به object
    config.selectors = JSON.parse(config.selectors);
    
    res.json({
      success: true,
      config
    });
    
  } catch (error) {
    next(error);
  }
});

// به‌روزرسانی پیکربندی
router.put('/selector-builder/configs/:id', auth.requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, url, selectors, description } = req.body;
    
    if (!name || !url || !selectors) {
      return res.status(400).json({
        success: false,
        message: 'نام، URL و انتخابگرها الزامی است'
      });
    }
    
    // بررسی وجود پیکربندی
    const existingResult = await connectionPool.query('SELECT id FROM selector_configs WHERE id = $1', [id]);
    
    if (existingResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'پیکربندی یافت نشد'
      });
    }
    
    // به‌روزرسانی در پایگاه داده
    const query = `
      UPDATE selector_configs 
      SET name = $1, url = $2, selectors = $3, description = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `;
    
    await connectionPool.query(query, [
      name,
      url,
      JSON.stringify(selectors),
      description,
      id
    ]);
    
    res.json({
      success: true,
      message: 'پیکربندی با موفقیت به‌روزرسانی شد'
    });
    
  } catch (error) {
    next(error);
  }
});

// حذف پیکربندی
router.delete('/selector-builder/configs/:id', auth.requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const query = `DELETE FROM selector_configs WHERE id = $1`;
    const result = await connectionPool.query(query, [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'پیکربندی یافت نشد'
      });
    }
    
    res.json({
      success: true,
      message: 'پیکربندی با موفقیت حذف شد'
    });
    
  } catch (error) {
    next(error);
  }
});

// Stability and health endpoints
router.get('/stability/status', auth.requireAuth, async (req, res, next) => {
  try {
    if (!global.stabilityManager) {
      return res.status(503).json({
        success: false,
        message: 'Stability manager not available'
      });
    }
    
    const status = global.stabilityManager.getSystemStatus();
    const stats = global.stabilityManager.getSystemStats();
    
    res.json({
      success: true,
      data: {
        status,
        stats
      }
    });
  } catch (error) {
    next(error);
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {}
    };
    
    // Check database
    try {
      await connectionPool.query('SELECT 1');
      health.services.database = 'healthy';
    } catch (error) {
      health.services.database = 'unhealthy';
      health.status = 'unhealthy';
    }
    
    // Check stability manager
    if (global.stabilityManager) {
      const stabilityStatus = global.stabilityManager.getSystemStatus();
      health.services.stability = stabilityStatus.isRunning ? 'healthy' : 'unhealthy';
      if (!stabilityStatus.isRunning) {
        health.status = 'unhealthy';
      }
    } else {
      health.services.stability = 'not_available';
    }
    
    // Check performance monitor
    if (global.performanceMonitor) {
      health.services.performance = 'healthy';
    } else {
      health.services.performance = 'not_available';
    }
    
    // Check memory manager
    if (global.memoryManager) {
      health.services.memory = 'healthy';
    } else {
      health.services.memory = 'not_available';
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
module.exports = router;
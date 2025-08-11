const crypto = require('crypto');
const database = require('../config/database');
const logger = require('../utils/logger');
const WebDriverManager = require('./webDriverManager');
const memoryManager = require('./memoryManager');
const connectionPool = require('./connectionPool');
const rateLimiter = require('./rateLimiter');
const cacheManager = require('./cacheManager');

class UniversalCrawler {
  constructor(driverType = 'puppeteer') {
    this.webDriverManager = new WebDriverManager(driverType);
    this.activeCrawls = new Set();
    this.maxConcurrentCrawls = 3;
    this.crawlStats = {
      totalCrawls: 0,
      successfulCrawls: 0,
      failedCrawls: 0,
      lastCleanup: Date.now()
    };
    
    // Memory management
    memoryManager.trackResource('webDrivers', 'create');
    
    // Event listeners for memory management
    memoryManager.on('highMemory', () => {
      this.handleHighMemory();
    });
    
    memoryManager.on('criticalMemory', () => {
      this.handleCriticalMemory();
    });
    
    memoryManager.on('emergencyCleanup', () => {
      this.emergencyCleanup();
    });
    
    // Rate limiter setup
    this.setupRateLimiter();
    
    // Cache manager setup
    this.setupCacheManager();
  }

  // تابع اعتبارسنجی و پاکسازی selector
  sanitizeSelector(selector) {
    if (!selector || typeof selector !== 'string') {
      return '';
    }
    
    // حذف کاراکترهای نامعتبر و اضافی
    let cleaned = selector.trim()
      .replace(/\s+/g, ' ') // حذف فاصله‌های اضافی
      .replace(/\.\s+/g, '.') // حذف فاصله بعد از نقطه
      .replace(/\s+\./g, '.') // حذف فاصله قبل از نقطه
      .replace(/\.+/g, '.') // حذف نقطه‌های اضافی
      .replace(/,\s*,/g, ',') // حذف کاما های اضافی
      .replace(/,\s*$/g, '') // حذف کاما در انتها
      .replace(/^\s*,/g, ''); // حذف کاما در ابتدا
    
    // اگر selector خالی شد، بازگرداندن string خالی
    if (!cleaned) {
      return '';
    }
    
    // تست اعتبار selector با try-catch ساده
    try {
      // تست با regex برای شناسایی selector های نامعتبر
      if (cleaned.includes('..') || cleaned.includes(' .') || cleaned.includes('. ')) {
        throw new Error('Invalid selector format');
      }
      return cleaned;
    } catch (error) {
      logger.warn(`Selector نامعتبر حذف شد: ${selector} - خطا: ${error.message}`);
      return '';
    }
  }

  // تابع پاکسازی تمام selectors
  sanitizeSelectors(selectors) {
    const sanitized = {};
    
    Object.keys(selectors).forEach(key => {
      if (typeof selectors[key] === 'string') {
        const cleaned = this.sanitizeSelector(selectors[key]);
        if (cleaned) {
          sanitized[key] = cleaned;
        }
      } else {
        sanitized[key] = selectors[key];
      }
    });
    
    return sanitized;
  }
  
  // تنظیم rate limiter
  setupRateLimiter() {
    // تنظیمات پیش‌فرض برای دامنه‌های مختلف
    const defaultLimits = {
      'farsnews.ir': {
        maxRequests: 5,
        windowMs: 60000, // 1 دقیقه
        minDelay: 2000, // 2 ثانیه
        maxDelay: 10000 // 10 ثانیه
      },
      'mehrnews.com': {
        maxRequests: 8,
        windowMs: 60000,
        minDelay: 1500,
        maxDelay: 8000
      },
      'aryanews.com': {
        maxRequests: 6,
        windowMs: 60000,
        minDelay: 2000,
        maxDelay: 12000
      }
    };
    
    // اعمال تنظیمات
    Object.entries(defaultLimits).forEach(([domain, config]) => {
      rateLimiter.setLimit(domain, config);
    });
    
    logger.info('Rate limiter راه‌اندازی شد');
  }
  
  // تنظیم cache manager
  setupCacheManager() {
    // Event listeners برای cache
    cacheManager.on('hit', (data) => {
      logger.debug(`Cache hit: ${data.key}`);
    });
    
    cacheManager.on('miss', (data) => {
      logger.debug(`Cache miss: ${data.key}`);
    });
    
    cacheManager.on('evicted', (data) => {
      logger.debug(`Cache evicted: ${data.key}`);
    });
    
    logger.info('Cache manager راه‌اندازی شد');
  }

  // تابع کمکی برای evaluate که با همه درایورها کار می‌کند
  async safeEvaluate(page, script, ...args) {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if page is still valid before evaluate
        if (this.webDriverManager.driverType === 'puppeteer') {
          // Check if page is closed or detached
          if (page.isClosed && page.isClosed()) {
            logger.warn('صفحه puppeteer بسته شده است');
            return null;
          }
          
          // Check if main frame is available
          if (!page.mainFrame()) {
            logger.warn('Main frame در دسترس نیست');
            return null;
          }

          return await page.evaluate(script, ...args);
        } else if (this.webDriverManager.driverType === 'playwright') {
          // Check if page is closed
          if (page.isClosed()) {
            logger.warn('صفحه playwright بسته شده است');
            return null;
          }

          // Playwright has different evaluate API
          if (args.length === 0) {
            return await page.evaluate(script);
          } else if (args.length === 1) {
            return await page.evaluate(script, args[0]);
          } else {
            // For multiple arguments, pass as object
            const argsObj = {};
            args.forEach((arg, index) => {
              argsObj[`arg${index}`] = arg;
            });
            return await page.evaluate((argsObj, script) => {
              const args = Object.values(argsObj);
              return script(...args);
            }, argsObj, script);
          }
        } else if (this.webDriverManager.driverType === 'selenium') {
          // برای selenium از executeScript استفاده می‌کنیم
          const scriptString = `return (${script.toString()})(${args.map(arg => JSON.stringify(arg)).join(', ')})`;
          return await page.executeScript(scriptString);
        } else if (this.webDriverManager.driverType === 'cheerio') {
          // برای cheerio از $ استفاده می‌کنیم
          return this.executeCheerioScript(page, script, ...args);
        }
      } catch (error) {
        lastError = error;
        
        // Check if it's a detached frame error
        if (error.message.includes('detached Frame') || 
            error.message.includes('Target closed') ||
            error.message.includes('Session closed')) {
          
          logger.warn(`تلاش ${attempt}/${maxRetries}: Frame detached error - تلاش مجدد...`);
          
          // Wait before retry
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
        }
        
        // For other errors, log and return null immediately
        logger.warn(`خطا در evaluate برای ${this.webDriverManager.driverType} (تلاش ${attempt}):`, error.message);
        
        if (attempt === maxRetries) {
          break;
        }
      }
    }

    logger.error(`تمام تلاش‌ها برای evaluate ناموفق - آخرین خطا:`, lastError?.message);
    return null;
  }

  // Execute script for Cheerio
  executeCheerioScript(page, script, ...args) {
    try {
      const $ = this.webDriverManager.$;
      if (!$) {
        logger.warn('Cheerio $ object not available');
        return null;
      }

      // Simple implementation for common script patterns
      const scriptStr = script.toString();
      
      // Handle title selector script
      if (scriptStr.includes('document.querySelector') && args[0]) {
        const selector = args[0];
        const element = $(selector).first();
        if (element.length > 0) {
          return element.text().trim();
        }
        
        // Try alternative selectors
        const alternatives = ['h1', 'h2', '.title', '.headline', '[class*="title"]', '[class*="headline"]'];
        for (const altSelector of alternatives) {
          const altElement = $(altSelector).first();
          if (altElement.length > 0 && altElement.text().trim().length > 10) {
            return altElement.text().trim();
          }
        }
        return '';
      }
      
      // Handle content selector script
      if (scriptStr.includes('document.querySelectorAll') && args[0]) {
        const selector = args[0];
        const elements = $(selector);
        const content = elements.map((i, el) => $(el).text().trim()).get().join('\n');
        return content;
      }
      
      // Handle language check script
      if (scriptStr.includes('navigator.language')) {
        return {
          language: 'fa-IR',
          languages: ['fa-IR', 'fa', 'en-US', 'en'],
          title: $('title').text(),
          bodyText: $('body').text().substring(0, 100)
        };
      }
      
      // Handle main page content debug script
      if (scriptStr.includes('document.title') && scriptStr.includes('h1Count')) {
        return {
          title: $('title').text(),
          h1Count: $('h1').length,
          h2Count: $('h2').length,
          bodyText: $('body').text().substring(0, 200)
        };
      }
      
      // Handle link extraction script (general case)
      if (scriptStr.includes('href') && args.length >= 2) {
        const selector = args[0];
        const baseUrl = args[1];
        const limit = args[2] || 10;
        const links = [];
        
        $(selector).each((i, el) => {
          const href = $(el).attr('href');
          if (href && href.trim() && href.length > 1 && (href.startsWith('http') || href.startsWith('/'))) {
            const fullUrl = href.startsWith('/') ? baseUrl + href : href;
            if (!links.includes(fullUrl)) {
              links.push(fullUrl);
            }
          }
        });
        return links.slice(0, limit);
      }
      
      // Default fallback
      return null;

    } catch (error) {
      logger.warn('خطا در اجرای اسکریپت Cheerio:', error.message);
      return null;
    }
  }

  // Initialize WebDriver
  async initWebDriver() {
    return await this.webDriverManager.init();
  }

  // Close WebDriver
  async closeWebDriver() {
    await this.webDriverManager.close();
  }

  // Force close WebDriver for fresh start
  async forceCloseWebDriver() {
    await this.webDriverManager.forceClose();
  }

  // Set driver type (puppeteer or selenium)
  setDriverType(driverType) {
    if (this.webDriverManager.getDriverType() !== driverType) {
      this.webDriverManager = new WebDriverManager(driverType);
      logger.info(`WebDriver type changed to: ${driverType}`);
    }
  }

  // Get available driver types
  getAvailableDrivers() {
    return WebDriverManager.getAvailableDrivers();
  }

  // Get crawl statistics
  getStats() {
    return {
      ...this.crawlStats,
      activeCrawls: this.activeCrawls.size,
      maxConcurrentCrawls: this.maxConcurrentCrawls
    };
  }

  // Check if we need cleanup
  async performPeriodicCleanup() {
    const now = Date.now();
    const timeSinceLastCleanup = now - this.crawlStats.lastCleanup;
    
    // Cleanup every 30 minutes or after 50 crawls
    if (timeSinceLastCleanup > 30 * 60 * 1000 || this.crawlStats.totalCrawls % 50 === 0) {
      logger.info('Performing periodic cleanup...');
      
      const cleaned = await this.webDriverManager.cleanupIfNeeded();
      if (cleaned) {
        this.crawlStats.lastCleanup = now;
        logger.info('Periodic cleanup completed');
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.info('Garbage collection triggered');
      }
    }
  }

  generateHash(title, link) {
    return crypto.createHash('md5').update(title + link).digest('hex');
  }

  // Persian language setup is now handled by WebDriverManager

  // اعتبارسنجی تنظیمات کرال
  validateCrawlOptions(options = {}) {
    const {
      limit = 10,
      crawlDepth = 0,
      waitTime = 3000,
      timeout = 180000,
      navigationTimeout = 120000
    } = options;

    const errors = [];

    // اعتبارسنجی تعداد اخبار
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      errors.push('تعداد اخبار باید بین 1 تا 100 باشد');
    }

    // اعتبارسنجی عمق کرال
    if (typeof crawlDepth !== 'number' || crawlDepth < 0 || crawlDepth > 5) {
      errors.push('عمق کرال باید بین 0 تا 5 باشد');
    }

    // اعتبارسنجی زمان انتظار
    if (typeof waitTime !== 'number' || waitTime < 1000 || waitTime > 30000) {
      errors.push('زمان انتظار باید بین 1000 تا 30000 میلی‌ثانیه باشد');
    }

    // اعتبارسنجی timeout
    if (typeof timeout !== 'number' || timeout < 30000 || timeout > 900000) {
      errors.push('Timeout باید بین 30000 تا 900000 میلی‌ثانیه باشد');
    }

    // اعتبارسنجی navigation timeout
    if (typeof navigationTimeout !== 'number' || navigationTimeout < 30000 || navigationTimeout > 900000) {
      errors.push('Navigation timeout باید بین 30000 تا 900000 میلی‌ثانیه باشد');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // تنظیمات پیش‌فرض برای کرال
  getDefaultCrawlOptions() {
    return {
      limit: 10,                    // تعداد اخبار
      crawlDepth: 0,               // عمق کرال
      fullContent: true,           // استخراج محتوای کامل
      waitTime: 12000,             // زمان انتظار (میلی‌ثانیه) - افزایش یافت
      timeout: 900000,             // timeout کلی (میلی‌ثانیه) - افزایش یافت
      navigationTimeout: 600000,   // timeout ناوبری (میلی‌ثانیه) - افزایش یافت
      followLinks: true            // دنبال کردن لینک‌ها
    };
  }

  // تنظیمات پیش‌فرض برای تست سلکتور
  getDefaultTestOptions() {
    return {
      waitTime: 3000,              // زمان انتظار (میلی‌ثانیه)
      timeout: 60000,              // timeout ناوبری (میلی‌ثانیه) - افزایش یافت
      defaultTimeout: 15000,       // timeout پیش‌فرض (میلی‌ثانیه)
      readyStateTimeout: 5000      // timeout برای readyState (میلی‌ثانیه)
    };
  }

  // اعتبارسنجی محتوای مقاله
  validateArticleContent(article) {
    // بررسی وجود عنوان
    if (!article.title || article.title.trim().length < 10) {
      return { isValid: false, reason: 'عنوان خیلی کوتاه یا نامعتبر' };
    }

    // بررسی وجود لینک
    if (!article.link || !article.link.startsWith('http')) {
      return { isValid: false, reason: 'لینک نامعتبر' };
    }

    // بررسی وجود محتوا
    if (!article.content || article.content.trim().length < 50) {
      return { isValid: false, reason: 'محتوا خیلی کوتاه' };
    }

    // بررسی اینکه محتوا فقط شامل فضای خالی، نقطه یا خط تیره نباشد
    const cleanContent = article.content.trim().replace(/[\s\n\r\t\.\-_]+/g, '');
    if (cleanContent.length < 20) {
      return { isValid: false, reason: 'محتوا شامل کاراکترهای معنادار نیست' };
    }

    // بررسی اینکه محتوا شامل کلمات معنادار باشد
    const words = article.content.trim().split(/\s+/);
    if (words.length < 10) {
      return { isValid: false, reason: 'تعداد کلمات ناکافی' };
    }

    return { isValid: true, reason: null };
  }

  async saveArticle(sourceId, article) {
    try {
      const db = database.db;
      const hash = this.generateHash(article.title, article.link);

      // Validate article content
      const validation = this.validateArticleContent(article);
      if (!validation.isValid) {
        logger.warn(`مقاله رد شد: ${validation.reason} - ${article.title}`);
        return { id: null, isNew: false, rejected: true, reason: validation.reason };
      }

      // Check if article already exists by hash or link
      const existingArticle = await db.query(
        'SELECT id FROM articles WHERE hash = $1 OR link = $2', 
        [hash, article.link]
      );

      const existingRows = existingArticle.rows || [];
      if (existingRows.length > 0) {
        logger.info(`مقاله قبلاً وجود دارد: ${article.title}`);
        return { id: existingRows[0].id, isNew: false };
      }

      // Insert new article
      const result = await db.query(`
        INSERT INTO articles (source_id, title, link, content, hash, depth)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        sourceId, 
        article.title, 
        article.link, 
        article.content || '', 
        hash, 
        article.depth || 0
      ]);

      const rows = result.rows || [];
      const newId = rows[0]?.id;
      logger.info(`مقاله جدید ذخیره شد: ${article.title} (ID: ${newId})`);
      
      return { id: newId, isNew: true };

    } catch (error) {
      logger.error(`Error saving article: ${error.message}`);
      throw error;
    }
  }

  async extractArticleContent(page, url, selectors, options = {}) {
    const { 
      waitTime = 3000, 
      timeout = 180000 
    } = options;
    
    try {
      // استخراج دامنه برای rate limiting
      const domain = new URL(url).hostname;
      
      // بررسی cache
      const cacheKey = `article_content_${crypto.createHash('md5').update(url).digest('hex')}`;
      const cachedContent = cacheManager.getCrawlResult(cacheKey);
      
      if (cachedContent) {
        logger.info(`محتوای کش شده برای ${url} یافت شد`);
        return cachedContent;
      }
      
      // لاگ کردن سلکتورهای دریافتی برای اطمینان از انتقال درست
      logger.info(`استخراج محتوا از ${url} با سلکتورها:`, {
        titleSelector: selectors.title_selector,
        contentSelector: selectors.content_selector,
        linkSelector: selectors.link_selector,
        titleSelectors: selectors.title_selectors,
        contentSelectors: selectors.content_selectors
      });
      
      // اجرای درخواست با rate limiting
      const result = await rateLimiter.executeRequest(domain, async () => {
      
      // بررسی وضعیت صفحه قبل از تنظیم زبان
      if (this.webDriverManager.driverType === 'puppeteer' && page.isClosed()) {
        throw new Error('صفحه بسته شده است، نمی‌توان ادامه داد');
      }
      
      // تنظیم مجدد زبان فارسی برای صفحه
      try {
        await this.webDriverManager.setupPersianLanguage(page);
      } catch (setupError) {
        logger.warn('خطا در تنظیم زبان فارسی:', setupError.message);
        // اگر خطای Protocol error یا Session closed باشد، browser را مجدداً راه‌اندازی کن
        if (setupError.message.includes('Protocol error') || setupError.message.includes('Session closed')) {
          logger.info('تشخیص خطای اتصال، تلاش برای راه‌اندازی مجدد browser...');
          try {
            await this.webDriverManager.forceCloseWebDriver();
            await this.webDriverManager.init();
            page = await this.webDriverManager.getPage();
            await this.webDriverManager.setupPersianLanguage(page);
            logger.info('Browser مجدداً راه‌اندازی شد و زبان فارسی تنظیم شد');
          } catch (restartError) {
            logger.error('خطا در راه‌اندازی مجدد browser:', restartError.message);
            throw restartError;
          }
        } else {
          // برای سایر خطاها، فقط warning ثبت کن و ادامه بده
          logger.warn('ادامه بدون تنظیم زبان فارسی');
        }
      }
      
      // استراتژی چندمرحله‌ای برای ناوبری
      let navigationSuccess = false;
      let lastError = null;
      
      // تلاش اول: domcontentloaded
      try {
        // بررسی مجدد وضعیت صفحه قبل از navigation
        if (this.webDriverManager.driverType === 'puppeteer' && page.isClosed()) {
          throw new Error('صفحه در حین navigation بسته شد');
        }
        
        await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: Math.min(timeout, 120000) 
        });
        navigationSuccess = true;
      } catch (navError) {
        lastError = navError;
        if (navError.message.includes('Protocol error') || navError.message.includes('Session closed')) {
          logger.warn(`Browser session بسته شد در domcontentloaded: ${url}`);
          throw navError; // خطاهای session را بلافاصله پرتاب کن
        }
        logger.warn(`Navigation با domcontentloaded ناموفق بود، تلاش با load: ${url}`);
      }
      
      // تلاش دوم: load
      if (!navigationSuccess) {
        try {
          // بررسی مجدد وضعیت صفحه
          if (this.webDriverManager.driverType === 'puppeteer' && page.isClosed()) {
            throw new Error('صفحه در حین navigation بسته شد');
          }
          
          await page.goto(url, { 
            waitUntil: 'load', 
            timeout: Math.min(timeout, 180000) 
          });
          navigationSuccess = true;
        } catch (navError) {
          lastError = navError;
          if (navError.message.includes('Protocol error') || navError.message.includes('Session closed')) {
            logger.warn(`Browser session بسته شد در load: ${url}`);
            throw navError;
          }
          logger.warn(`Navigation با load ناموفق بود، تلاش با networkidle0: ${url}`);
        }
      }
      
      // تلاش سوم: networkidle0
      if (!navigationSuccess) {
        try {
          // بررسی مجدد وضعیت صفحه
          if (this.webDriverManager.driverType === 'puppeteer' && page.isClosed()) {
            throw new Error('صفحه در حین navigation بسته شد');
          }
          
          await page.goto(url, { 
            waitUntil: 'networkidle0', 
            timeout: timeout 
          });
          navigationSuccess = true;
        } catch (navError) {
          lastError = navError;
          if (navError.message.includes('Protocol error') || navError.message.includes('Session closed')) {
            logger.warn(`Browser session بسته شد در networkidle0: ${url}`);
            throw navError;
          }
          throw navError; // اگر همه تلاش‌ها ناموفق بود، خطا را پرتاب کن
        }
      }
      
      // اگر هیچ تلاشی موفق نبود
      if (!navigationSuccess && lastError) {
        throw lastError;
      }
      
      // انتظار فقط برای درایورهای مرورگر
      if (this.webDriverManager.driverType !== 'cheerio') {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // انتظار اضافی برای بارگذاری کامل محتوا
        try {
          await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
          logger.info('صفحه کاملاً بارگذاری شد');
        } catch (waitError) {
          logger.warn('انتظار برای بارگذاری کامل صفحه با خطا مواجه شد');
        }
      }
      
      // Debug: بررسی تنظیمات زبان بعد از navigation (فقط برای درایورهای مرورگر)
      if (this.webDriverManager.driverType !== 'cheerio') {
        const languageAfterNav = await this.safeEvaluate(page, () => {
          return {
            language: navigator.language,
            languages: navigator.languages,
            title: document.title,
            bodyText: document.body.textContent.substring(0, 100)
          };
        });
        if (languageAfterNav) {
          logger.info('تنظیمات زبان بعد از navigation:', languageAfterNav);
        }
      }
      
      // استخراج عنوان
      let title = '';
      
      // استفاده از سلکتورهای چندگانه برای عنوان
      let titleSelectors = [];
      
      // بررسی سلکتورهای چندگانه
      if (selectors.title_selectors) {
        if (Array.isArray(selectors.title_selectors)) {
          titleSelectors = selectors.title_selectors;
        } else if (typeof selectors.title_selectors === 'string') {
          try {
            titleSelectors = JSON.parse(selectors.title_selectors);
          } catch (e) {
            titleSelectors = [selectors.title_selectors];
          }
        }
      }
      
      // اگر سلکتورهای چندگانه خالی بودند، از سلکتور اصلی استفاده کن
      if (titleSelectors.length === 0 && selectors.title_selector) {
        titleSelectors = [selectors.title_selector];
      }
      
      // لاگ کردن سلکتورهای عنوان
      logger.info(`استفاده از ${titleSelectors.length} سلکتور عنوان برای ${url}:`, titleSelectors);
      
      if (titleSelectors.length > 0) {
        if (this.webDriverManager.driverType === 'cheerio') {
          // برای Cheerio از executeCheerioScript استفاده می‌کنیم
          for (const titleSelector of titleSelectors) {
            if (!titleSelector || titleSelector.trim() === '') continue;
            
            const scriptStr = `
              let title = '';
              const element = $("${titleSelector}").first();
              if (element.length > 0) {
                title = element.text().trim();
              }
              return title;
            `;
            
            title = await this.executeCheerioScript(page, scriptStr) || '';
            
            if (title && title.trim().length > 0) {
              logger.info(`عنوان با سلکتور ${titleSelector} یافت شد: ${title.substring(0, 50)}...`);
              break;
            }
          }
          
          // اگر با هیچ یک از سلکتورها عنوان پیدا نشد، از سلکتورهای جایگزین استفاده کنیم
          if (!title) {
            const scriptStr = `
              let title = '';
              const alternativeSelectors = ['h1', 'h2', '.title', '.headline'];
              for (const altSelector of alternativeSelectors) {
                const altElement = $(altSelector).first();
                if (altElement.length > 0 && altElement.text().trim().length > 10) {
                  title = altElement.text().trim();
                  break;
                }
              }
              return title;
            `;
            title = await this.executeCheerioScript(page, scriptStr) || '';
          }
        } else {
          // برای سایر درایورها از safeEvaluate استفاده می‌کنیم
          for (const titleSelector of titleSelectors) {
            if (!titleSelector || titleSelector.trim() === '') continue;
            
            title = await this.safeEvaluate(page, (selector) => {
              console.log('جستجوی سلکتور عنوان:', selector);
              const element = document.querySelector(selector);
              if (element) {
                const text = element.textContent.trim();
                console.log('عنوان یافت شد:', text);
                return text;
              }
              return '';
            }, titleSelector);
            
            if (title && title.trim().length > 0) {
              logger.info(`عنوان با سلکتور ${titleSelector} یافت شد: ${title.substring(0, 50)}...`);
              break;
            }
          }
          
          // اگر با هیچ یک از سلکتورها عنوان پیدا نشد، از سلکتورهای جایگزین استفاده کنیم
          if (!title) {
            title = await this.safeEvaluate(page, () => {
              console.log('سلکتور اصلی یافت نشد، تلاش با سلکتورهای جایگزین');
              // تلاش برای یافتن عنوان با سلکتورهای جایگزین
              const alternativeSelectors = ['h1', 'h2', '.title', '.headline', '[class*="title"]', '[class*="headline"]'];
              for (const altSelector of alternativeSelectors) {
                const altElement = document.querySelector(altSelector);
                if (altElement && altElement.textContent.trim().length > 10) {
                  const text = altElement.textContent.trim();
                  console.log('عنوان با سلکتور جایگزین یافت شد:', text, 'با سلکتور:', altSelector);
                  return text;
                }
              }
              return '';
            });
            
            if (!title) {
              console.log('هیچ عنوانی یافت نشد');
            }
          }
          
          if (title && title.trim().length > 0) {
            logger.info(`Title found with selector: ${title.substring(0, 50)}...`);
          }
        }
      }
      
      // استخراج محتوا
      let content = '';
      
      // استفاده از سلکتورهای چندگانه برای محتوا
      let contentSelectors = [];
      
      // بررسی سلکتورهای چندگانه
      if (selectors.content_selectors) {
        if (Array.isArray(selectors.content_selectors)) {
          contentSelectors = selectors.content_selectors;
        } else if (typeof selectors.content_selectors === 'string') {
          try {
            contentSelectors = JSON.parse(selectors.content_selectors);
          } catch (e) {
            contentSelectors = [selectors.content_selectors];
          }
        }
      }
      
      // اگر سلکتورهای چندگانه خالی بودند، از سلکتور اصلی استفاده کن
      if (contentSelectors.length === 0 && selectors.content_selector) {
        contentSelectors = [selectors.content_selector];
      }
      
      // لاگ کردن سلکتورهای محتوا
      logger.info(`استفاده از ${contentSelectors.length} سلکتور محتوا برای ${url}:`, contentSelectors);
      
      if (contentSelectors.length > 0) {
        if (this.webDriverManager.driverType === 'cheerio') {
          // برای Cheerio از executeCheerioScript استفاده می‌کنیم
          for (const contentSelector of contentSelectors) {
            if (!contentSelector || contentSelector.trim() === '') continue;
            
            const scriptStr = `
              let content = '';
              const elements = $("${contentSelector}");
              if (elements.length > 0) {
                content = elements.map((i, el) => $(el).text().trim()).get().join('\\n');
              }
              return content;
            `;
            
            content = await this.executeCheerioScript(page, scriptStr) || '';
            
            if (content && content.trim().length > 50) { // محتوا باید حداقل 50 کاراکتر باشد
              logger.info(`محتوا با سلکتور ${contentSelector} یافت شد: ${content.substring(0, 50)}...`);
              break;
            }
          }
        } else {
          // برای سایر درایورها از safeEvaluate استفاده می‌کنیم
          for (const contentSelector of contentSelectors) {
            if (!contentSelector || contentSelector.trim() === '') continue;
            
            content = await this.safeEvaluate(page, (selector) => {
              console.log('جستجوی سلکتور محتوا:', selector);
              const elements = document.querySelectorAll(selector);
              console.log('تعداد عناصر محتوا یافت شده:', elements.length);
              const content = Array.from(elements).map(el => el.textContent.trim()).join('\n');
              console.log('طول محتوای استخراج شده:', content.length);
              return content;
            }, contentSelector) || '';
            
            if (content && content.trim().length > 50) { // محتوا باید حداقل 50 کاراکتر باشد
              logger.info(`محتوا با سلکتور ${contentSelector} یافت شد: ${content.substring(0, 50)}...`);
              break;
            }
          }
        }
      }
      
      // استخراج لینک‌های داخلی
      let internalLinks = [];
      if (this.webDriverManager.driverType === 'cheerio') {
        // برای Cheerio از executeCheerioScript استفاده می‌کنیم
        const baseUrl = new URL(url).origin;
        const scriptStr = `
          const links = [];
          const elements = $("${selectors.link_selector || 'a'}");
          elements.each((i, el) => {
            const href = $(el).attr('href');
            if (href && (href.startsWith('${baseUrl}') || href.startsWith('/')) && !href.includes('#') && !href.includes('javascript:')) {
              const fullUrl = href.startsWith('/') ? '${baseUrl}' + href : href;
              links.push({
                url: fullUrl,
                text: $(el).text().trim()
              });
            }
          });
          return links.slice(0, 5);
        `;
        internalLinks = await this.executeCheerioScript(page, scriptStr) || [];
      } else {
        internalLinks = await this.safeEvaluate(page, (baseUrl, linkSelector) => {
          const links = [];
          const elements = document.querySelectorAll(linkSelector || 'a');
          
          elements.forEach(el => {
            const href = el.href;
            if (href && href.includes(baseUrl) && !href.includes('#') && !href.includes('javascript:')) {
              links.push({
                url: href,
                text: el.textContent.trim()
              });
            }
          });
          
          return links.slice(0, 5); // حداکثر 5 لینک
        }, new URL(url).origin, selectors.link_selector) || [];
      }
      
      // Debug: لاگ کردن اطلاعات سلکتورها
      logger.info(`استخراج محتوا از ${url}:`, {
        titleSelector: selectors.title_selector,
        contentSelector: selectors.content_selector,
        titleFound: title ? 'بله' : 'خیر',
        contentLength: content ? content.length : 0
      });
      
      const extractedData = {
        title: title || 'بدون عنوان',
        content,
        internalLinks
      };
      
      return extractedData;
      
      }); // پایان rate limiter executeRequest
      
      // ذخیره در cache
      cacheManager.set(cacheKey, result, 3600 * 1000); // 1 ساعت TTL
      
      return result;
      
    } catch (error) {
      logger.error(`خطا در استخراج محتوا از ${url}:`, error);
      
      // ثبت خطا در rate limiter
      const domain = new URL(url).hostname;
      const errorType = rateLimiter.classifyError(error);
      await rateLimiter.recordFailure(domain, errorType);
      
      return {
        title: 'خطا در استخراج',
        content: '',
        internalLinks: []
      };
    }
  }

  async crawlInternalLinks(page, links, sourceId, selectors, currentDepth, maxDepth) {
    if (currentDepth >= maxDepth || links.length === 0) {
      return [];
    }
    
    const results = [];
    const linksToProcess = links.slice(0, 3); // حداکثر 3 لینک در هر سطح
    
    for (const linkInfo of linksToProcess) {
      try {
        logger.info(`کرال لینک داخلی (عمق ${currentDepth + 1}): ${linkInfo.url}`);
        
        // اطمینان از اینکه سلکتورها به درستی منتقل می‌شوند
        logger.info(`استفاده از سلکتورها برای لینک داخلی ${linkInfo.url}:`, {
          titleSelector: selectors.title_selector,
          contentSelector: selectors.content_selector,
          linkSelector: selectors.link_selector
        });
        
        const articleData = await this.extractArticleContent(page, linkInfo.url, selectors, {
          waitTime: 3000,
          timeout: 180000
        });
        
        const article = {
          title: articleData.title,
          link: linkInfo.url,
          content: articleData.content,
          depth: currentDepth + 1
        };
        
        const saveResult = await this.saveArticle(sourceId, article);
        
        if (saveResult.isNew) {
          results.push(article);
          
          // کرال بازگشتی
          if (articleData.internalLinks.length > 0) {
            const deeperResults = await this.crawlInternalLinks(
              page, 
              articleData.internalLinks, 
              sourceId, 
              selectors, 
              currentDepth + 1, 
              maxDepth
            );
            results.push(...deeperResults);
          }
        }
        
      } catch (error) {
        logger.error(`خطا در کرال لینک داخلی ${linkInfo.url}:`, error);
      }
    }
    
    return results;
  }

  async crawlSource(sourceId, options = {}) {
    const startTime = Date.now();
    let source = null; // تعریف متغیر source در scope بالاتر
    
    const { 
      limit = 10,                    // تعداد اخبار (از ورودی کاربر)
      crawlDepth = 0,               // عمق کرال (از ورودی کاربر)
      fullContent = true,           // استخراج محتوای کامل (از ورودی کاربر)
      waitTime = 3000,              // زمان انتظار (از ورودی کاربر)
      timeout = 180000,             // timeout کلی (از ورودی کاربر)
      navigationTimeout = 120000,   // timeout ناوبری (از ورودی کاربر)
      followLinks = true            // دنبال کردن لینک‌ها (از ورودی کاربر)
    } = options;
    
    // اعتبارسنجی تنظیمات
    const validation = this.validateCrawlOptions(options);
    if (!validation.isValid) {
      return {
        success: false,
        error: 'تنظیمات نامعتبر: ' + validation.errors.join(', '),
        source: sourceId
      };
    }
    
    try {
      // دریافت اطلاعات منبع
      source = await this.getSource(sourceId);
      if (!source) {
        throw new Error(`منبع خبری با شناسه ${sourceId} یافت نشد`);
      }

      // پاکسازی و اعتبارسنجی selectors - موقتاً غیرفعال
      logger.info('Selectors از دیتابیس:', {
        list_selector: source.list_selector,
        title_selector: source.title_selector,
        content_selector: source.content_selector,
        link_selector: source.link_selector
      });
      
      logger.info(`شروع کرال منبع: ${source.name}`);
      
      // تنظیم نوع درایور بر اساس تنظیمات منبع
      const sourceDriverType = source.driver_type || 'puppeteer';
      logger.info(`استفاده از درایور: ${sourceDriverType}`);
      
      // تغییر نوع درایور اگر لازم باشد
      this.setDriverType(sourceDriverType);
      
      // استفاده از webDriver موجود یا ایجاد webDriver جدید
      if (!this.webDriverManager.isConnected()) {
        await this.forceCloseWebDriver();
        await this.initWebDriver();
      }
      const page = await this.webDriverManager.newPage();
      
      // Debug: لاگ کردن تنظیمات مرورگر
      logger.info('تنظیم مرورگر با زبان فارسی...');
      
      // تنظیم زبان فارسی با تابع کمکی
      try {
        await this.webDriverManager.setupPersianLanguage(page);
      } catch (setupError) {
        logger.warn('خطا در تنظیم زبان فارسی:', setupError.message);
        // اگر خطای Protocol error یا Session closed باشد، browser را مجدداً راه‌اندازی کن
        if (setupError.message.includes('Protocol error') || setupError.message.includes('Session closed')) {
          logger.info('تشخیص خطای اتصال، تلاش برای راه‌اندازی مجدد browser...');
          try {
            await this.webDriverManager.forceCloseWebDriver();
            await this.webDriverManager.init();
            const newPage = await this.webDriverManager.getPage();
            await this.webDriverManager.setupPersianLanguage(newPage);
            logger.info('Browser مجدداً راه‌اندازی شد و زبان فارسی تنظیم شد');
            // استفاده از صفحه جدید
            page = newPage;
          } catch (restartError) {
            logger.error('خطا در راه‌اندازی مجدد browser:', restartError.message);
            throw restartError;
          }
        } else {
          // برای سایر خطاها، فقط warning ثبت کن و ادامه بده
          logger.warn('ادامه بدون تنظیم زبان فارسی');
        }
      }
      
      // Debug: بررسی تنظیمات
      const languageCheck = await this.safeEvaluate(page, () => {
        return {
          language: navigator.language,
          languages: navigator.languages,
          userAgent: navigator.userAgent
        };
      });
      if (languageCheck) {
        logger.info('تنظیمات مرورگر:', languageCheck);
      }
      
      // ناوبری به صفحه اصلی
      await this.webDriverManager.goto(page, source.base_url, { 
        waitUntil: "networkidle0",
        timeout: navigationTimeout
      });
      
      // انتظار بر اساس نوع درایور
      if (this.webDriverManager.driverType === 'puppeteer' || this.webDriverManager.driverType === 'playwright') {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else if (this.webDriverManager.driverType === 'selenium') {
        await this.webDriverManager.driver.sleep(waitTime);
      }
      
      // Debug: بررسی محتوای صفحه اصلی
      const mainPageContent = await this.safeEvaluate(page, () => {
        return {
          title: document.title,
          h1Count: document.querySelectorAll('h1').length,
          h2Count: document.querySelectorAll('h2').length,
          bodyText: document.body.textContent.substring(0, 200)
        };
      });
      if (mainPageContent) {
        logger.info('محتوای صفحه اصلی:', mainPageContent);
      }
      
      // استخراج لینک‌های اخبار
      let articleLinks = [];
      
      if (this.webDriverManager.driverType === 'cheerio') {
        // برای Cheerio از executeCheerioScript استفاده می‌کنیم
        const scriptStr = `
          const links = [];
          $("${source.list_selector}").each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.trim() && href.length > 1 && (href.startsWith('http') || href.startsWith('/'))) {
              const fullUrl = href.startsWith('/') ? "${new URL(source.base_url).origin}" + href : href;
              if (!links.includes(fullUrl)) {
                links.push(fullUrl);
              }
            }
          });
          return links.slice(0, ${limit});
        `;
        articleLinks = await this.executeCheerioScript(page, scriptStr, source.list_selector, new URL(source.base_url).origin, limit) || [];
      } else {
        // برای سایر درایورها از safeEvaluate استفاده می‌کنیم
        articleLinks = await this.safeEvaluate(page, (selector, baseUrl, limit) => {
          const links = [];
          const elements = document.querySelectorAll(selector);
          
          elements.forEach(el => {
            const href = el.getAttribute ? el.getAttribute('href') : el.href;
            if (href && href.trim() && href.length > 1 && (href.startsWith('http') || href.startsWith('/'))) {
              const fullUrl = href.startsWith('/') ? baseUrl + href : href;
              if (!links.includes(fullUrl)) {
                links.push(fullUrl);
              }
            }
          });
          
          return links.slice(0, limit);
        }, source.list_selector, new URL(source.base_url).origin, limit) || [];
      }
      
      logger.info(`${articleLinks.length} لینک مقاله یافت شد`);
      logger.info('Debug - articleLinks content:', articleLinks.slice(0, 10));
      
      const mainArticles = [];
      const internalArticles = [];
      let newArticlesCount = 0;
      
      // پردازش اخبار اصلی
      for (let i = 0; i < Math.min(articleLinks.length, limit); i++) {
        const link = articleLinks[i];
        
        try {
          logger.info(`پردازش مقاله ${i + 1}/${Math.min(articleLinks.length, limit)}: ${link}`);
          
          let articleData = { title: '', content: '', internalLinks: [] };
          
          if (fullContent) {
            // Debug: لاگ کردن سلکتورهای استفاده شده
            logger.info(`استفاده از سلکتورها برای ${link}:`, {
              titleSelector: source.title_selector,
              contentSelector: source.content_selector,
              linkSelector: source.link_selector,
              titleSelectors: source.title_selectors,
              contentSelectors: source.content_selectors
            });
            
            // اطمینان از اینکه سلکتورها از دیتابیس استفاده می‌شوند
            const selectors = {
              title_selector: source.title_selector || '',
              content_selector: source.content_selector || '',
              link_selector: source.link_selector || '',
              title_selectors: source.title_selectors || [],
              content_selectors: source.content_selectors || [],
              lead_selector: source.lead_selector || '',
              router_selector: source.router_selector || '',
              lead_selectors: source.lead_selectors || [],
              router_selectors: source.router_selectors || []
            };
            
            // لاگ کردن سلکتورهای استفاده شده
            logger.info('سلکتورهای استفاده شده برای کرال:', {
              title_selector: selectors.title_selector,
              content_selector: selectors.content_selector,
              link_selector: selectors.link_selector,
              title_selectors: selectors.title_selectors,
              content_selectors: selectors.content_selectors
            });
            
            articleData = await this.extractArticleContent(page, link, selectors, {
              waitTime: waitTime,
              timeout: timeout
            });
          } else {
            articleData.title = `مقاله ${i + 1}`;
          }
          
          const article = {
            title: articleData.title,
            link: link,
            content: articleData.content,
            depth: 0
          };
          
          const saveResult = await this.saveArticle(sourceId, article);
          
          if (saveResult.isNew) {
            newArticlesCount++;
          }
          
          mainArticles.push(article);
          
          // کرال عمیق - فقط اگر عمق بیشتر از 0 باشد
          if (followLinks && crawlDepth > 0 && articleData.internalLinks.length > 0) {
            // استفاده از همان متغیر selectors که قبلاً تعریف شده
            const selectors = {
              title_selector: source.title_selector || '',
              content_selector: source.content_selector || '',
              link_selector: source.link_selector || '',
              title_selectors: source.title_selectors || [],
              content_selectors: source.content_selectors || [],
              lead_selector: source.lead_selector || '',
              router_selector: source.router_selector || '',
              lead_selectors: source.lead_selectors || [],
              router_selectors: source.router_selectors || []
            };
            
            logger.info(`شروع کرال عمیق با سلکتورها:`, {
              titleSelector: selectors.title_selector,
              contentSelector: selectors.content_selector,
              linkSelector: selectors.link_selector,
              titleSelectors: selectors.title_selectors,
              contentSelectors: selectors.content_selectors
            });
            
            const deepArticles = await this.crawlInternalLinks(
              page, 
              articleData.internalLinks, 
              sourceId, 
              selectors, 
              0, 
              crawlDepth
            );
            
            internalArticles.push(...deepArticles);
            newArticlesCount += deepArticles.length;
          }
          
        } catch (error) {
          // مدیریت خطاهای مختلف
          if (error.message.includes('Navigation timeout')) {
            logger.warn(`Timeout در پردازش مقاله ${link}: ${error.message}`);
          } else if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
            logger.warn(`مقاله قبلاً وجود دارد: ${link}`);
          } else {
          logger.error(`خطا در پردازش مقاله ${link}:`, error);
          }
        }
      }
      
      await page.close();
      
      // بستن درایور برای جلوگیری از مصرف منابع
      await this.closeWebDriver();
      logger.info('درایور بسته شد تا از مصرف منابع جلوگیری شود');
      
      const duration = Date.now() - startTime;
      const totalProcessed = mainArticles.length + internalArticles.length;
      
      // ثبت تاریخچه کرال
      await this.logCrawlHistory(sourceId, {
        totalFound: articleLinks.length,
        totalProcessed,
        newArticles: newArticlesCount,
        crawlDepth,
        duration
      });
      
      // ثبت لاگ
      await logger.logCrawlOperation(sourceId, 'crawl', 'success', 
        `کرال موفقیت‌آمیز: ${totalProcessed} مقاله پردازش شد`, {
        articlesFound: articleLinks.length,
        articlesProcessed: totalProcessed,
        duration
      });
      
      logger.success(`کرال کامل شد: ${totalProcessed} مقاله در ${duration}ms`);
      
      return {
        success: true,
        source: source.name,
        totalFound: articleLinks.length,
        processed: mainArticles.length,
        internalArticlesCrawled: internalArticles.length,
        totalProcessed,
        newArticles: newArticlesCount,
        crawlDepth,
        mainArticles,
        internalArticles,
        articles: [...mainArticles, ...internalArticles] // برای سازگاری
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // بستن درایور در صورت خطا نیز برای جلوگیری از مصرف منابع
      try {
        await this.closeWebDriver();
        logger.info('درایور در صورت خطا بسته شد');
      } catch (closeError) {
        logger.warn('خطا در بستن درایور:', closeError.message);
      }
      
      // ایجاد پیام خطای مفصل
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        url: source?.url || 'نامشخص',
        timestamp: new Date().toISOString()
      };
      
      await logger.logCrawlOperation(sourceId, 'crawl', 'error', 
        JSON.stringify(errorDetails), {
        duration
      });
      
      logger.error('خطا در کرال:', error);
      
      return {
        success: false,
        error: error.message,
        source: sourceId
      };
    }
  }

  async getSource(sourceId) {
    try {
      const db = database.db;
      const query = 'SELECT * FROM news_sources WHERE id = $1 AND active = true';
      
      const result = await db.query(query, [sourceId]);
      const rows = result.rows || [];
      const row = rows[0];
      
      if (!row) {
        return null;
      }
      
      // تبدیل سلکتورهای چندگانه از رشته JSON به آرایه
      try {
        // تبدیل title_selectors
        if (row.title_selectors) {
          row.title_selectors = JSON.parse(row.title_selectors);
        } else {
          row.title_selectors = row.title_selector ? [row.title_selector] : [];
        }
        
        // تبدیل content_selectors
        if (row.content_selectors) {
          row.content_selectors = JSON.parse(row.content_selectors);
        } else {
          row.content_selectors = row.content_selector ? [row.content_selector] : [];
        }
        
        // تبدیل lead_selectors
        if (row.lead_selectors) {
          row.lead_selectors = JSON.parse(row.lead_selectors);
        } else {
          row.lead_selectors = row.lead_selector ? [row.lead_selector] : [];
        }
        
        // تبدیل router_selectors
        if (row.router_selectors) {
          row.router_selectors = JSON.parse(row.router_selectors);
        } else {
          row.router_selectors = row.router_selector ? [row.router_selector] : [];
        }
      } catch (error) {
        logger.error(`Error parsing selectors for source ${sourceId}:`, error);
      }
      
      return row;
    } catch (error) {
      logger.error(`Error getting source ${sourceId}:`, error);
      throw error;
    }
  }

  async logCrawlHistory(sourceId, stats) {
    try {
      const db = database.db;
      const query = `
        INSERT INTO crawl_history 
        (source_id, total_found, total_processed, new_articles, crawl_depth, duration_ms)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;
      
      const result = await db.query(query, [
        sourceId,
        stats.totalFound,
        stats.totalProcessed,
        stats.newArticles,
        stats.crawlDepth,
        stats.duration
      ]);
      
      const rows = result.rows || [];
      return rows[0]?.id;
    } catch (error) {
      logger.error('Error logging crawl history:', error);
      throw error;
    }
  }

  // تست سلکتور - نسخه حرفه‌ای با مدیریت خطای پیشرفته
  async testSelector(url, selector, type = 'list', driverType = 'cheerio', options = {}) {
    const {
      waitTime = 3000,              // زمان انتظار (از ورودی کاربر)
      timeout = 20000,              // timeout ناوبری (از ورودی کاربر)
      defaultTimeout = 15000,       // timeout پیش‌فرض (از ورودی کاربر)
      readyStateTimeout = 5000      // timeout برای readyState (از ورودی کاربر)
    } = options;
    let browser = null;
    let page = null;
    const startTime = Date.now();
    
    try {
      // اعتبارسنجی تنظیمات timeout
      if (timeout < 5000 || timeout > 120000) {
        throw new Error('Timeout باید بین 5000 تا 120000 میلی‌ثانیه باشد');
      }
      
      if (waitTime < 1000 || waitTime > 30000) {
        throw new Error('زمان انتظار باید بین 1000 تا 30000 میلی‌ثانیه باشد');
      }
      
      // اعتبارسنجی ورودی
      if (!url || !selector) {
        throw new Error('URL و سلکتور الزامی هستند');
      }
      
      // بررسی فرمت URL
      try {
        new URL(url);
      } catch {
        throw new Error('فرمت URL نامعتبر است');
      }
      
      logger.info(`شروع تست سلکتور: ${selector} در ${url} با درایور ${driverType}`);
      
      // انتخاب درایور بر اساس نوع
      if (driverType === 'cheerio') {
        return await this.testSelectorWithCheerio(url, selector, type);
      } else if (driverType === 'puppeteer') {
        return await this.testSelectorWithPuppeteer(url, selector, type, options);
      } else if (driverType === 'selenium') {
        return await this.testSelectorWithSelenium(url, selector, type, options);
      } else {
        // پیش‌فرض: Playwright
        return await this.testSelectorWithPlaywright(url, selector, type, options);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`خطا در تست سلکتور:`, error.message);
      
      return {
        success: false,
        error: error.message,
        url,
        selector,
        type,
        duration,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // تست سلکتور با Playwright
  async testSelectorWithPlaywright(url, selector, type = 'list', options = {}) {
    const {
      waitTime = 3000,
      timeout = 45000,
      defaultTimeout = 30000,
      readyStateTimeout = 10000
    } = options;
    let page = null;
    const startTime = Date.now();
    
    try {
      // راه‌اندازی مرورگر با تنظیمات بهینه
      await this.initWebDriver();
      page = await this.webDriverManager.newPage();
      
      // تنظیم زبان فارسی برای صفحه
      try {
        await this.webDriverManager.setupPersianLanguage(page);
      } catch (setupError) {
        logger.warn('خطا در تنظیم زبان فارسی:', setupError.message);
        // اگر خطای Protocol error یا Session closed باشد، browser را مجدداً راه‌اندازی کن
        if (setupError.message.includes('Protocol error') || setupError.message.includes('Session closed')) {
          logger.info('تشخیص خطای اتصال، تلاش برای راه‌اندازی مجدد browser...');
          try {
            await this.webDriverManager.forceCloseWebDriver();
            await this.webDriverManager.init();
            page = await this.webDriverManager.getPage();
            await this.webDriverManager.setupPersianLanguage(page);
            logger.info('Browser مجدداً راه‌اندازی شد و زبان فارسی تنظیم شد');
          } catch (restartError) {
            logger.error('خطا در راه‌اندازی مجدد browser:', restartError.message);
            throw restartError;
          }
        } else {
          // برای سایر خطاها، فقط warning ثبت کن و ادامه بده
          logger.warn('ادامه بدون تنظیم زبان فارسی');
        }
      }
      
      // تنظیم timeout های مختلف برای مراحل مختلف
      page.setDefaultTimeout(defaultTimeout);
      page.setDefaultNavigationTimeout(timeout);
      
      // بلاک کردن منابع غیرضروری برای سرعت بیشتر
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // رفتن به صفحه با استراتژی چندمرحله‌ای
      const navigationPromise = page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: timeout 
      });
      
      // منتظر بارگذاری صفحه
      await navigationPromise;
      
      // انتظار اضافی برای بارگذاری کامل محتوا
      try {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // تلاش برای انتظار تا عناصر بارگذاری شوند
        await page.waitForFunction(() => document.readyState === 'complete', { timeout: readyStateTimeout });
      } catch (waitError) {
        logger.warn('انتظار برای بارگذاری کامل صفحه با خطا مواجه شد، ادامه می‌دهیم...');
      }
      
      // بررسی وجود سلکتور
      const selectorExists = await this.safeEvaluate(page, (sel) => {
        return document.querySelector(sel) !== null;
      }, selector);
      
      if (!selectorExists) {
        return {
          success: false,
          error: 'سلکتور در صفحه یافت نشد',
          url,
          selector,
          type,
          suggestions: await this.generateSelectorSuggestions(page, selector),
          pageInfo: await this.getPageInfo(page)
        };
      }
      
      // استخراج اطلاعات با سلکتور
      const result = await this.safeEvaluate(page, (sel, testType) => {
        try {
          const elements = document.querySelectorAll(sel);
          
          if (testType === 'list') {
            return {
              count: elements.length,
              samples: Array.from(elements).slice(0, 5).map((el, index) => {
                const text = el.textContent?.trim() || '';
                const href = el.href || el.getAttribute('href') || null;
                
                return {
                  index: index + 1,
                  text: text.substring(0, 150),
                  href: href,
                  tagName: el.tagName.toLowerCase(),
                  className: el.className || '',
                  id: el.id || ''
                };
              })
            };
          } else if (testType === 'content') {
            return {
              count: elements.length,
              samples: Array.from(elements).slice(0, 3).map((el, index) => {
                const text = el.textContent?.trim() || '';
                return {
                  index: index + 1,
                  text: text.substring(0, 300),
                  tagName: el.tagName.toLowerCase(),
                  className: el.className || '',
                  id: el.id || ''
                };
              })
            };
          } else {
            // تست عمومی
            return {
              count: elements.length,
              samples: Array.from(elements).slice(0, 3).map((el, index) => {
                const text = el.textContent?.trim() || '';
                return {
                  index: index + 1,
                  text: text.substring(0, 200),
                  tagName: el.tagName.toLowerCase(),
                  className: el.className || '',
                  id: el.id || '',
                  attributes: Array.from(el.attributes).reduce((acc, attr) => {
                    acc[attr.name] = attr.value;
                    return acc;
                  }, {})
                };
              })
            };
          }
        } catch (evalError) {
          return {
            error: 'خطا در اجرای سلکتور: ' + evalError.message,
            count: 0,
            samples: []
          };
        }
      }, selector, type);
      
      const duration = Date.now() - startTime;
      
      await page.close();
      
      logger.success(`تست سلکتور موفقیت‌آمیز: ${result.count} عنصر یافت شد در ${duration}ms`);
      
      return {
        success: true,
        url,
        selector,
        type,
        result,
        duration,
        timestamp: new Date().toISOString(),
        performance: {
          loadTime: duration,
          elementsFound: result.count,
          status: result.count > 0 ? 'excellent' : 'warning'
        }
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // تشخیص نوع خطا و ارائه راهکار
      let errorType = 'unknown';
      let suggestion = '';
      
      if (error.message.includes('Navigation timeout') || error.message.includes('timeout')) {
        errorType = 'timeout';
        suggestion = 'صفحه در زمان مقرر (45 ثانیه) بارگذاری نشد. لطفاً از درایور Cheerio استفاده کنید یا URL ساده‌تری انتخاب کنید.';
      } else if (error.message.includes('net::ERR_')) {
        errorType = 'network';
        suggestion = 'مشکل در اتصال به سایت. لطفاً URL را بررسی کنید.';
      } else if (error.message.includes('Protocol error')) {
        errorType = 'browser';
        suggestion = 'مشکل در مرورگر. ممکن است نیاز به راه‌اندازی مجدد باشد.';
        // تلاش برای راه‌اندازی مجدد browser
        try {
          logger.info('تلاش برای راه‌اندازی مجدد browser...');
          await this.webDriverManager.forceCloseWebDriver();
          await this.webDriverManager.init();
          logger.info('Browser مجدداً راه‌اندازی شد');
        } catch (restartError) {
          logger.error('خطا در راه‌اندازی مجدد browser:', restartError.message);
        }
      } else if (error.message.includes('Target closed') || error.message.includes('Session closed')) {
        errorType = 'browser';
        suggestion = 'مرورگر به طور غیرمنتظره بسته شد. لطفاً دوباره تلاش کنید.';
        // تلاش برای راه‌اندازی مجدد browser
        try {
          logger.info('تلاش برای راه‌اندازی مجدد browser پس از بسته شدن session...');
          await this.webDriverManager.forceCloseWebDriver();
          await this.webDriverManager.init();
          logger.info('Browser مجدداً راه‌اندازی شد');
        } catch (restartError) {
          logger.error('خطا در راه‌اندازی مجدد browser:', restartError.message);
        }
      }
      
      logger.error(`خطا در تست سلکتور (${errorType}):`, error.message);
      
      // اضافه کردن پیشنهادات مفصل برای خطای timeout
      let suggestions = [];
      if (errorType === 'timeout') {
        suggestions = [
          'از درایور Cheerio استفاده کنید (سریع‌تر است)',
          'URL ساده‌تری انتخاب کنید',
          'اتصال اینترنت خود را بررسی کنید',
          'ممکن است سایت هدف کند باشد',
          'چند دقیقه بعد دوباره تلاش کنید'
        ];
      } else if (errorType === 'network') {
        suggestions = [
          'URL را بررسی کنید',
          'اتصال اینترنت خود را بررسی کنید',
          'ممکن است سایت در دسترس نباشد'
        ];
      } else {
        suggestions = [
          'دوباره تلاش کنید',
          'از درایور دیگری استفاده کنید',
          'در صورت تکرار مشکل، با پشتیبانی تماس بگیرید'
        ];
      }
      
      return {
        success: false,
        error: error.message,
        errorType,
        suggestion,
        suggestions,
        url,
        selector,
        type,
        duration,
        timestamp: new Date().toISOString()
      };
    } finally {
      // تمیز کردن منابع
      try {
        if (page && !page.isClosed()) {
          await page.close();
        }
        // بستن درایور برای جلوگیری از مصرف منابع
        await this.closeWebDriver();
        logger.info('درایور در تست سلکتور بسته شد تا از مصرف منابع جلوگیری شود');
      } catch (closeError) {
        logger.warn('خطا در بستن صفحه یا درایور:', closeError.message);
      }
    }
  }
  
  // تولید پیشنهادات سلکتور
  async generateSelectorSuggestions(page, originalSelector) {
    try {
      return await this.safeEvaluate(page, (original) => {
        const suggestions = [];
        
        // پیشنهادات بر اساس تگ‌های رایج
        const commonTags = ['a', 'h1', 'h2', 'h3', 'p', 'div', 'span', 'article'];
        commonTags.forEach(tag => {
          const elements = document.querySelectorAll(tag);
          if (elements.length > 0) {
            suggestions.push({
              selector: tag,
              count: elements.length,
              description: `همه تگ‌های ${tag}`
            });
          }
        });
        
        // پیشنهادات بر اساس کلاس‌های موجود
        const allElements = document.querySelectorAll('*');
        const classNames = new Set();
        
        Array.from(allElements).forEach(el => {
          if (el.className && typeof el.className === 'string') {
            el.className.split(' ').forEach(cls => {
              if (cls.trim() && cls.includes('news') || cls.includes('article') || cls.includes('link')) {
                classNames.add(cls.trim());
              }
            });
          }
        });
        
        Array.from(classNames).slice(0, 5).forEach(className => {
          const elements = document.querySelectorAll(`.${className}`);
          if (elements.length > 0) {
            suggestions.push({
              selector: `.${className}`,
              count: elements.length,
              description: `عناصر با کلاس ${className}`
            });
          }
        });
        
        return suggestions.slice(0, 10);
      }, originalSelector);
    } catch {
      return [];
    }
  }
  
  // دریافت اطلاعات صفحه
  async getPageInfo(page) {
    try {
      return await this.safeEvaluate(page, () => {
        return {
          title: document.title,
          url: window.location.href,
          totalElements: document.querySelectorAll('*').length,
          links: document.querySelectorAll('a').length,
          images: document.querySelectorAll('img').length,
          readyState: document.readyState
        };
      });
    } catch {
      return {};
    }
  }

  // مدیریت حافظه بالا
  async handleHighMemory() {
    logger.warn('مدیریت حافظه بالا در crawler...');
    
    try {
      // بستن درایورهای غیرضروری
      await this.webDriverManager.forceCloseWebDriver();
      
      // محدود کردن crawl های همزمان
      this.maxConcurrentCrawls = Math.max(1, this.maxConcurrentCrawls - 1);
      
      // پاکسازی دوره‌ای
      await this.performPeriodicCleanup();
      
      logger.info(`تعداد crawl های همزمان کاهش یافت به: ${this.maxConcurrentCrawls}`);
    } catch (error) {
      logger.error('خطا در مدیریت حافظه بالا:', error);
    }
  }

  // مدیریت حافظه بحرانی
  async handleCriticalMemory() {
    logger.error('مدیریت حافظه بحرانی در crawler...');
    
    try {
      // متوقف کردن همه crawl های فعال
      for (const crawlId of this.activeCrawls) {
        logger.warn(`متوقف کردن crawl بحرانی: ${crawlId}`);
      }
      this.activeCrawls.clear();
      
      // بستن اجباری همه درایورها
      await this.webDriverManager.forceCloseWebDriver();
      
      // کاهش شدید همزمانی
      this.maxConcurrentCrawls = 1;
      
      logger.info('همه منابع crawler در حالت بحرانی آزاد شدند');
    } catch (error) {
      logger.error('خطا در مدیریت حافظه بحرانی:', error);
    }
  }

  // پاکسازی اضطراری
  async emergencyCleanup() {
    logger.warn('پاکسازی اضطراری crawler...');
    
    try {
      // پاکسازی همه منابع
      this.activeCrawls.clear();
      await this.webDriverManager.forceCloseWebDriver();
      
      // ریست آمار
      this.crawlStats.lastCleanup = Date.now();
      
      // تنظیم مجدد محدودیت‌ها
      this.maxConcurrentCrawls = 1;
      
      logger.info('پاکسازی اضطراری crawler تکمیل شد');
    } catch (error) {
      logger.error('خطا در پاکسازی اضطراری:', error);
    }
  }

  // تخریب کننده
  async destroy() {
    try {
      // حذف event listeners
      memoryManager.removeAllListeners('highMemory');
      memoryManager.removeAllListeners('criticalMemory');
      memoryManager.removeAllListeners('emergencyCleanup');
      
      // بستن منابع
      await this.webDriverManager.forceCloseWebDriver();
      this.activeCrawls.clear();
      
      // کاهش شمارنده منابع
      memoryManager.trackResource('webDrivers', 'destroy');
      
      logger.info('Crawler با موفقیت تخریب شد');
    } catch (error) {
      logger.error('خطا در تخریب crawler:', error);
    }
  }
  
  // تست سلکتور با Cheerio
  async testSelectorWithCheerio(url, selector, type = 'list') {
    const startTime = Date.now();
    
    try {
      const axios = require('axios');
      const cheerio = require('cheerio');
      
      logger.info(`دریافت صفحه با Cheerio: ${url}`);
      
      // دریافت محتوای صفحه
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const elements = $(selector);
      
      if (elements.length === 0) {
        return {
          success: false,
          error: 'سلکتور در صفحه یافت نشد',
          url,
          selector,
          type,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          suggestions: ['سلکتور را بررسی کنید', 'ممکن است عنصر با JavaScript بارگذاری شود']
        };
      }
      
      // استخراج نمونه‌ها
      const samples = [];
      const maxSamples = type === 'list' ? 5 : 3;
      
      elements.slice(0, maxSamples).each((index, element) => {
        const $el = $(element);
        const text = $el.text().trim();
        
        if (type === 'list') {
          samples.push({
            index: index + 1,
            text: text.substring(0, 150),
            href: $el.attr('href') || null,
            tagName: element.tagName.toLowerCase(),
            className: $el.attr('class') || '',
            id: $el.attr('id') || ''
          });
        } else {
          samples.push({
            index: index + 1,
            text: text.substring(0, 300),
            tagName: element.tagName.toLowerCase(),
            className: $el.attr('class') || '',
            id: $el.attr('id') || ''
          });
        }
      });
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        url,
        selector,
        type,
        result: {
          count: elements.length,
          samples
        },
        duration,
        timestamp: new Date().toISOString(),
        performance: {
          loadTime: duration,
          elementsFound: elements.length,
          status: elements.length > 0 ? 'excellent' : 'warning'
        }
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        error: error.message,
        url,
        selector,
        type,
        duration,
        timestamp: new Date().toISOString(),
        errorType: 'network',
        suggestion: 'مشکل در دریافت صفحه با Cheerio'
      };
     }
   }
   
   // تست سلکتور با Puppeteer
   async testSelectorWithPuppeteer(url, selector, type = 'list', options = {}) {
     const startTime = Date.now();
     
     try {
       // فعلاً از Playwright استفاده می‌کنیم (می‌توان بعداً Puppeteer را اضافه کرد)
       return await this.testSelectorWithPlaywright(url, selector, type, options);
     } catch (error) {
       const duration = Date.now() - startTime;
       
       return {
         success: false,
         error: 'Puppeteer در حال حاضر پشتیبانی نمی‌شود',
         url,
         selector,
         type,
         duration,
         timestamp: new Date().toISOString(),
         suggestion: 'از Playwright یا Cheerio استفاده کنید'
       };
     }
   }
   
   // تست سلکتور با Selenium
   async testSelectorWithSelenium(url, selector, type = 'list', options = {}) {
     const startTime = Date.now();
     
     try {
       // فعلاً از Playwright استفاده می‌کنیم (می‌توان بعداً Selenium را اضافه کرد)
       return await this.testSelectorWithPlaywright(url, selector, type, options);
     } catch (error) {
       const duration = Date.now() - startTime;
       
       return {
         success: false,
         error: 'Selenium در حال حاضر پشتیبانی نمی‌شود',
         url,
         selector,
         type,
         duration,
         timestamp: new Date().toISOString(),
         suggestion: 'از Playwright یا Cheerio استفاده کنید'
       };
     }
   }
 }
 
 module.exports = UniversalCrawler;
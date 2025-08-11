const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class WebDriverOptimizer {
  constructor() {
    this.browser = null;
    this.pages = new Set();
    this.maxPages = 5;
    this.timeout = 30000; // 30 ثانیه
    this.protocolTimeout = 60000; // 60 ثانیه
    this.navigationTimeout = 45000; // 45 ثانیه
    this.isInitialized = false;
  }

  // راه‌اندازی browser با تنظیمات بهینه
  async initialize() {
    if (this.isInitialized) return this.browser;

    try {
      logger.info('راه‌اندازی browser با تنظیمات بهینه...');
      
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--memory-pressure-off',
          '--max_old_space_size=256',
          '--js-flags=--max-old-space-size=256'
        ],
        protocolTimeout: this.protocolTimeout,
        timeout: this.timeout,
        defaultViewport: {
          width: 1280,
          height: 720
        }
      });

      this.isInitialized = true;
      logger.info('Browser با موفقیت راه‌اندازی شد');
      
      return this.browser;
    } catch (error) {
      logger.error('خطا در راه‌اندازی browser:', error);
      throw error;
    }
  }

  // ایجاد صفحه جدید با تنظیمات بهینه
  async createPage() {
    if (!this.browser) {
      await this.initialize();
    }

    if (this.pages.size >= this.maxPages) {
      logger.warn('حداکثر تعداد صفحات فعال رسیده، پاکسازی...');
      await this.cleanupPages();
    }

    try {
      const page = await this.browser.newPage();
      
      // تنظیم timeout ها
      page.setDefaultTimeout(this.timeout);
      page.setDefaultNavigationTimeout(this.navigationTimeout);
      
      // تنظیم user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // تنظیم viewport
      await page.setViewport({
        width: 1280,
        height: 720,
        deviceScaleFactor: 1
      });

      // غیرفعال کردن تصاویر و فونت‌ها برای بهبود سرعت
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // اضافه کردن به لیست صفحات فعال
      this.pages.add(page);
      
      // Event listener برای بستن صفحه
      page.on('close', () => {
        this.pages.delete(page);
      });

      logger.debug('صفحه جدید ایجاد شد');
      return page;
    } catch (error) {
      logger.error('خطا در ایجاد صفحه:', error);
      throw error;
    }
  }

  // پاکسازی صفحات غیرفعال
  async cleanupPages() {
    const pagesToClose = Array.from(this.pages).slice(0, 2);
    
    for (const page of pagesToClose) {
      try {
        if (!page.isClosed()) {
          await page.close();
        }
      } catch (error) {
        logger.warn('خطا در بستن صفحه:', error);
      }
    }
    
    logger.info(`${pagesToClose.length} صفحه پاکسازی شد`);
  }

  // اجرای evaluate با retry logic
  async safeEvaluate(page, script, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await page.evaluate(script);
        return result;
      } catch (error) {
        if (attempt === maxRetries) {
          logger.error('خطا در evaluate برای puppeteer:', error.message);
          throw error;
        }
        
        logger.warn(`تلاش ${attempt} برای evaluate ناموفق، تلاش مجدد...`);
        await this.delay(1000 * attempt); // افزایش delay در هر تلاش
      }
    }
  }

  // اجرای evaluate با timeout طولانی‌تر
  async evaluateWithTimeout(page, script, timeout = 45000) {
    return Promise.race([
      page.evaluate(script),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('evaluate timeout')), timeout)
      )
    ]);
  }

  // انتظار برای بارگذاری کامل صفحه
  async waitForPageLoad(page, url, maxWait = 30000) {
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: maxWait
      });
      
      // انتظار اضافی برای JavaScript
      await page.waitForTimeout(2000);
      
      return true;
    } catch (error) {
      logger.warn('انتظار برای بارگذاری کامل صفحه با خطا مواجه شد');
      return false;
    }
  }

  // بستن browser
  async close() {
    try {
      // بستن تمام صفحات
      for (const page of this.pages) {
        if (!page.isClosed()) {
          await page.close();
        }
      }
      this.pages.clear();

      // بستن browser
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.isInitialized = false;
      logger.info('Browser بسته شد');
    } catch (error) {
      logger.error('خطا در بستن browser:', error);
    }
  }

  // تابع کمکی برای delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // دریافت آمار
  getStats() {
    return {
      activePages: this.pages.size,
      maxPages: this.maxPages,
      isInitialized: this.isInitialized,
      timeout: this.timeout,
      protocolTimeout: this.protocolTimeout
    };
  }

  // تنظیم timeout ها
  setTimeout(timeout) {
    this.timeout = timeout;
    logger.info(`Timeout به ${timeout}ms تغییر یافت`);
  }

  setProtocolTimeout(timeout) {
    this.protocolTimeout = timeout;
    logger.info(`Protocol timeout به ${timeout}ms تغییر یافت`);
  }
}

module.exports = WebDriverOptimizer; 
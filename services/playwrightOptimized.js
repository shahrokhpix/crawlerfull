const { chromium, firefox, webkit } = require('playwright');
const dns = require('dns').promises;
const logger = require('../utils/logger');
const { execSync } = require('child_process');
const os = require('os');

// پاکسازی فایل‌های موقت هنگام خروج از برنامه
process.on('exit', () => {
  try {
    const isWindows = os.platform() === 'win32';
    
    if (isWindows) {
      // پاکسازی برای ویندوز
      execSync('forfiles /p %TEMP% /m "puppeteer_dev_chrome_profile-*" /c "cmd /c rmdir /s /q @path" 2>nul || echo.');
    } else {
      // پاکسازی برای لینوکس/یونیکس
      execSync('rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true');
    }
  } catch (error) {
    // ignore cleanup errors during exit
  }
});

process.on('SIGINT', () => {
  try {
    const isWindows = os.platform() === 'win32';
    
    if (isWindows) {
      execSync('forfiles /p %TEMP% /m "puppeteer_dev_chrome_profile-*" /c "cmd /c rmdir /s /q @path" 2>nul || echo.');
    } else {
      execSync('rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true');
    }
  } catch (error) {
    // ignore cleanup errors
  }
  process.exit(0);
});

class OptimizedPlaywright {
  constructor(options = {}) {
    this.options = {
      browser: options.browser || 'chromium', // chromium, firefox, webkit
      headless: options.headless !== false,
      timeout: options.timeout || 45000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 2000,
      userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: options.viewport || { width: 1920, height: 1080 },
      locale: options.locale || 'fa-IR',
      timezone: options.timezone || 'Asia/Tehran',
      enableProxy: options.enableProxy !== false,
      enableStealth: options.enableStealth !== false,
      waitForNetworkIdle: options.waitForNetworkIdle !== false,
      blockResources: options.blockResources || ['image', 'font', 'media'],
      enableJavaScript: options.enableJavaScript !== false,
      ignoreHTTPSErrors: options.ignoreHTTPSErrors !== false,
      slowMo: options.slowMo || 0,
      ...options
    };
    
    this.browser = null;
    this.context = null;
    this.page = null;
    this.networkDiagnostics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastError: null,
      blockedRequests: 0,
      networkErrors: 0
    };
    
    this.proxyConfig = null;
    this.initializeProxy();
  }
  
  // تشخیص و تنظیم پروکسی
  initializeProxy() {
    try {
      const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
      const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
      
      if (this.options.enableProxy && (httpProxy || httpsProxy)) {
        const proxyUrl = httpsProxy || httpProxy;
        const url = new URL(proxyUrl);
        
        this.proxyConfig = {
          server: `${url.protocol}//${url.host}`,
          username: url.username || undefined,
          password: url.password || undefined
        };
        
        logger.info(`استفاده از پروکسی Playwright: ${this.proxyConfig.server}`);
      }
    } catch (error) {
      logger.warn('خطا در تنظیم پروکسی Playwright:', error.message);
    }
  }
  
  // بررسی سلامت شبکه
  async checkNetworkHealth(hostname) {
    try {
      const startTime = Date.now();
      const dnsResult = await dns.lookup(hostname);
      const dnsTime = Date.now() - startTime;
      
      return {
        healthy: true,
        dnsResolution: dnsResult.address,
        dnsTime,
        message: `DNS سالم: ${hostname} -> ${dnsResult.address} (${dnsTime}ms)`
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        message: `مشکل DNS: ${hostname} - ${error.message}`
      };
    }
  }
  
  // راه‌اندازی مرورگر
  async initializeBrowser() {
    if (this.browser) {
      return this.browser;
    }
    
    try {
      const browserType = this.getBrowserType();
      
      const launchOptions = {
        headless: this.options.headless,
        timeout: this.options.timeout,
        slowMo: this.options.slowMo,
        ignoreHTTPSErrors: this.options.ignoreHTTPSErrors,
        args: this.getBrowserArgs()
      };
      
      if (this.proxyConfig) {
        launchOptions.proxy = this.proxyConfig;
      }
      
      logger.info(`راه‌اندازی مرورگر ${this.options.browser}...`);
      this.browser = await browserType.launch(launchOptions);
      
      return this.browser;
    } catch (error) {
      logger.error('خطا در راه‌اندازی مرورگر:', error.message);
      throw error;
    }
  }
  
  // دریافت نوع مرورگر
  getBrowserType() {
    switch (this.options.browser.toLowerCase()) {
      case 'firefox':
        return firefox;
      case 'webkit':
      case 'safari':
        return webkit;
      case 'chromium':
      case 'chrome':
      default:
        return chromium;
    }
  }
  
  // دریافت آرگومان‌های مرورگر
  getBrowserArgs() {
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ];
    
    if (this.options.enableStealth) {
      args.push(
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor'
      );
    }
    
    return args;
  }
  
  // ایجاد context جدید
  async createContext() {
    if (!this.browser) {
      await this.initializeBrowser();
    }
    
    try {
      const contextOptions = {
        viewport: this.options.viewport,
        userAgent: this.options.userAgent,
        locale: this.options.locale,
        timezoneId: this.options.timezone,
        ignoreHTTPSErrors: this.options.ignoreHTTPSErrors
      };
      
      if (this.proxyConfig) {
        contextOptions.proxy = this.proxyConfig;
      }
      
      this.context = await this.browser.newContext(contextOptions);
      
      // تنظیم stealth mode
      if (this.options.enableStealth) {
        await this.setupStealthMode();
      }
      
      return this.context;
    } catch (error) {
      logger.error('خطا در ایجاد context:', error.message);
      throw error;
    }
  }
  
  // تنظیم حالت stealth
  async setupStealthMode() {
    if (!this.context) return;
    
    try {
      // حذف navigator.webdriver
      await this.context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      
      // تنظیم permissions
      await this.context.grantPermissions(['geolocation']);
      
      // تنظیم extra headers
      await this.context.setExtraHTTPHeaders({
        'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      });
      
    } catch (error) {
      logger.warn('خطا در تنظیم stealth mode:', error.message);
    }
  }
  
  // ایجاد صفحه جدید
  async createPage() {
    if (!this.context) {
      await this.createContext();
    }
    
    try {
      this.page = await this.context.newPage();
      
      // تنظیم timeout
      this.page.setDefaultTimeout(this.options.timeout);
      this.page.setDefaultNavigationTimeout(this.options.timeout);
      
      // مسدود کردن منابع غیرضروری
      if (this.options.blockResources.length > 0) {
        await this.setupResourceBlocking();
      }
      
      // تنظیم event listeners
      await this.setupEventListeners();
      
      return this.page;
    } catch (error) {
      logger.error('خطا در ایجاد صفحه:', error.message);
      throw error;
    }
  }
  
  // مسدود کردن منابع
  async setupResourceBlocking() {
    if (!this.page) return;
    
    try {
      await this.page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        
        if (this.options.blockResources.includes(resourceType)) {
          this.networkDiagnostics.blockedRequests++;
          route.abort();
        } else {
          route.continue();
        }
      });
    } catch (error) {
      logger.warn('خطا در تنظیم مسدودسازی منابع:', error.message);
    }
  }
  
  // تنظیم event listeners
  async setupEventListeners() {
    if (!this.page) return;
    
    try {
      // ردیابی درخواست‌ها
      this.page.on('request', (request) => {
        this.networkDiagnostics.totalRequests++;
      });
      
      this.page.on('response', (response) => {
        if (response.status() >= 200 && response.status() < 400) {
          this.networkDiagnostics.successfulRequests++;
        } else {
          this.networkDiagnostics.failedRequests++;
        }
      });
      
      this.page.on('requestfailed', (request) => {
        this.networkDiagnostics.networkErrors++;
        logger.warn(`درخواست ناموفق: ${request.url()} - ${request.failure()?.errorText}`);
      });
      
      // ردیابی خطاهای console
      this.page.on('console', (msg) => {
        if (msg.type() === 'error') {
          logger.warn(`خطای Console: ${msg.text()}`);
        }
      });
      
      // ردیابی خطاهای صفحه
      this.page.on('pageerror', (error) => {
        logger.warn(`خطای صفحه: ${error.message}`);
      });
      
    } catch (error) {
      logger.warn('خطا در تنظیم event listeners:', error.message);
    }
  }
  
  // بارگذاری صفحه با retry logic
  async goto(url, options = {}) {
    const startTime = Date.now();
    let lastError;
    
    try {
      // بررسی سلامت شبکه
      const parsedUrl = new URL(url);
      const healthCheck = await this.checkNetworkHealth(parsedUrl.hostname);
      
      if (!healthCheck.healthy) {
        logger.warn(healthCheck.message);
      } else {
        logger.info(healthCheck.message);
      }
      
      // اطمینان از وجود صفحه
      if (!this.page) {
        await this.createPage();
      }
      
      // تلاش برای بارگذاری صفحه
      for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
        try {
          logger.info(`تلاش ${attempt}/${this.options.maxRetries} برای ${url}`);
          
          const gotoOptions = {
            waitUntil: this.options.waitForNetworkIdle ? 'networkidle' : 'domcontentloaded',
            timeout: this.options.timeout,
            ...options
          };
          
          const response = await this.page.goto(url, gotoOptions);
          
          if (!response) {
            throw new Error('پاسخی دریافت نشد');
          }
          
          if (!response.ok()) {
            throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
          }
          
          const responseTime = Date.now() - startTime;
          this.updateAverageResponseTime(responseTime);
          
          logger.info(`صفحه ${url} با موفقیت بارگذاری شد در ${responseTime}ms`);
          return response;
          
        } catch (error) {
          lastError = error;
          logger.warn(`تلاش ${attempt} ناموفق برای ${url}: ${error.message}`);
          
          if (this.shouldRetry(error, attempt)) {
            if (attempt < this.options.maxRetries) {
              const delay = this.calculateRetryDelay(attempt, error);
              logger.info(`انتظار ${delay}ms قبل از تلاش مجدد...`);
              await this.sleep(delay);
              continue;
            }
          }
          
          break;
        }
      }
      
      // تمام تلاش‌ها ناموفق
      this.networkDiagnostics.lastError = lastError;
      const errorMessage = this.createDetailedErrorMessage(url, lastError);
      throw new Error(errorMessage);
      
    } catch (error) {
      logger.error(`خطا در بارگذاری ${url}:`, error.message);
      throw error;
    }
  }
  
  // تشخیص اینکه آیا باید retry کرد یا نه
  shouldRetry(error, attempt) {
    const retryableErrors = [
      'net::ERR_CONNECTION_REFUSED',
      'net::ERR_NAME_NOT_RESOLVED',
      'net::ERR_TIMED_OUT',
      'net::ERR_CONNECTION_RESET',
      'net::ERR_NETWORK_CHANGED',
      'Timeout',
      'Navigation timeout'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase())
    );
  }
  
  // محاسبه تاخیر retry
  calculateRetryDelay(attempt, error) {
    let baseDelay = this.options.retryDelay;
    
    // Exponential backoff
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    
    // Jitter
    const jitter = Math.random() * 1000;
    
    // تاخیر بیشتر برای خطاهای خاص
    if (error.message.includes('CONNECTION_REFUSED')) {
      baseDelay *= 2;
    }
    
    return Math.min(exponentialDelay + jitter, 30000);
  }
  
  // ایجاد پیام خطای تفصیلی
  createDetailedErrorMessage(url, error) {
    let message = `نمی‌توان صفحه ${url} را بارگذاری کرد.\n`;
    
    if (error.message.includes('CONNECTION_REFUSED')) {
      message += '🚫 سرور اتصال را رد کرد. احتمالاً:\n';
      message += '   - سرور خاموش است\n';
      message += '   - فایروال اتصال را مسدود کرده\n';
      message += '   - پورت در دسترس نیست\n';
    } else if (error.message.includes('NAME_NOT_RESOLVED')) {
      message += '🔍 نام دامنه پیدا نشد. احتمالاً:\n';
      message += '   - مشکل DNS\n';
      message += '   - اتصال اینترنت قطع است\n';
      message += '   - آدرس اشتباه است\n';
    } else if (error.message.includes('TIMED_OUT') || error.message.includes('Timeout')) {
      message += '⏰ زمان بارگذاری تمام شد. احتمالاً:\n';
      message += '   - اتصال اینترنت کند است\n';
      message += '   - سرور پاسخ نمی‌دهد\n';
      message += '   - صفحه پیچیده است\n';
    } else if (error.message.includes('HTTP')) {
      message += `📄 سرور پاسخ داد اما با خطا: ${error.message}\n`;
    }
    
    message += `\n💡 راهنمایی:\n`;
    message += `   - اتصال اینترنت را بررسی کنید\n`;
    message += `   - تنظیمات فایروال را بررسی کنید\n`;
    message += `   - timeout را افزایش دهید\n`;
    message += `   - headless mode را غیرفعال کنید\n`;
    
    return message;
  }
  
  // دریافت محتوای HTML
  async content() {
    if (!this.page) {
      throw new Error('هیچ صفحه‌ای بارگذاری نشده است.');
    }
    return await this.page.content();
  }
  
  // اجرای selector
  async $(selector) {
    if (!this.page) {
      throw new Error('هیچ صفحه‌ای بارگذاری نشده است.');
    }
    return await this.page.$(selector);
  }
  
  // اجرای چندین selector
  async $$(selector) {
    if (!this.page) {
      throw new Error('هیچ صفحه‌ای بارگذاری نشده است.');
    }
    return await this.page.$$(selector);
  }
  
  // انتظار برای element
  async waitForSelector(selector, options = {}) {
    if (!this.page) {
      throw new Error('هیچ صفحه‌ای بارگذاری نشده است.');
    }
    return await this.page.waitForSelector(selector, {
      timeout: this.options.timeout,
      ...options
    });
  }
  
  // اجرای JavaScript
  async evaluate(pageFunction, ...args) {
    if (!this.page) {
      throw new Error('هیچ صفحه‌ای بارگذاری نشده است.');
    }
    return await this.page.evaluate(pageFunction, ...args);
  }
  
  // گرفتن screenshot
  async screenshot(options = {}) {
    if (!this.page) {
      throw new Error('هیچ صفحه‌ای بارگذاری نشده است.');
    }
    return await this.page.screenshot({
      type: 'png',
      fullPage: true,
      ...options
    });
  }
  
  // دریافت آمار شبکه
  getNetworkDiagnostics() {
    return {
      ...this.networkDiagnostics,
      successRate: this.networkDiagnostics.totalRequests > 0 
        ? (this.networkDiagnostics.successfulRequests / this.networkDiagnostics.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }
  
  // ریست آمار
  resetDiagnostics() {
    this.networkDiagnostics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastError: null,
      blockedRequests: 0,
      networkErrors: 0
    };
  }
  
  // به‌روزرسانی میانگین زمان پاسخ
  updateAverageResponseTime(responseTime) {
    const total = this.networkDiagnostics.successfulRequests;
    const current = this.networkDiagnostics.averageResponseTime;
    this.networkDiagnostics.averageResponseTime = ((current * (total - 1)) + responseTime) / total;
  }
  
  // تابع کمکی sleep
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // بستن صفحه
  async closePage() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
  }
  
  // بستن context
  async closeContext() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
  
  // بستن مرورگر
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
  
  // بستن کامل (cleanup)
  async close() {
    try {
      await this.closePage();
      await this.closeContext();
      await this.closeBrowser();
      
      // پاکسازی فایل‌های موقت
      this.cleanupTempFiles();
      
      logger.info('Playwright با موفقیت بسته شد');
    } catch (error) {
      logger.warn('خطا در بستن Playwright:', error.message);
    }
  }
  
  // پاکسازی فایل‌های موقت
  cleanupTempFiles() {
    try {
      const isWindows = os.platform() === 'win32';
      
      if (isWindows) {
        // پاکسازی برای ویندوز
        execSync('forfiles /p %TEMP% /m "puppeteer_dev_chrome_profile-*" /c "cmd /c rmdir /s /q @path" 2>nul || echo.', { timeout: 10000 });
      } else {
        // پاکسازی برای لینوکس/یونیکس
        execSync('rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true', { timeout: 10000 });
      }
      
      logger.info('فایل‌های موقت Playwright پاک شدند');
    } catch (error) {
      logger.warn('خطا در پاکسازی فایل‌های موقت:', error.message);
    }
  }
}

module.exports = OptimizedPlaywright;
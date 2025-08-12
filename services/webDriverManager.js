const puppeteer = require('puppeteer');
const { Launcher } = require('chrome-launcher');
const fs = require('fs');
const OptimizedCheerio = require('./cheerioOptimized');
const OptimizedPlaywright = require('./playwrightOptimized');
const { getOptimalConfig } = require('../config/cheerioConfig');
const { getOptimalPlaywrightConfig } = require('../config/cheerioConfig');
const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns').promises;
const logger = require('../utils/logger');

// Selenium imports (optional)
let webdriver, chrome, By, until;
try {
  webdriver = require('selenium-webdriver');
  chrome = require('selenium-webdriver/chrome');
  By = webdriver.By;
  until = webdriver.until;
} catch (error) {
  logger.warn('Selenium WebDriver not installed. Only Puppeteer will be available.');
}

// Playwright imports (optional)
let playwright;
try {
  playwright = require('playwright');
} catch (error) {
  logger.warn('Playwright not installed. Only Puppeteer and Selenium will be available.');
}

class WebDriverManager {
  constructor(driverType = 'puppeteer') {
    this.driverType = driverType; // 'puppeteer', 'selenium', 'playwright', or 'cheerio'
    this.browser = null;
    this.driver = null;
    this.pages = new Set(); // Track open pages for cleanup
    this.lastActivity = Date.now();
    this.maxIdleTime = 30 * 60 * 1000; // 30 minutes
    this.maxMemoryUsage = 500 * 1024 * 1024; // 500MB
  }

  // Initialize browser/driver based on type
  async init() {
    logger.info(`🔧 راه‌اندازی وب درایور: ${this.driverType}`);
    
    try {
      let result;
      if (this.driverType === 'puppeteer') {
        result = await this.initPuppeteer();
      } else if (this.driverType === 'selenium') {
        result = await this.initSelenium();
      } else if (this.driverType === 'playwright') {
        result = await this.initPlaywright();
      } else if (this.driverType === 'cheerio') {
        result = await this.initCheerio();
      } else {
        throw new Error(`Unsupported driver type: ${this.driverType}`);
      }
      
      logger.info(`✅ وب درایور ${this.driverType} با موفقیت راه‌اندازی شد`);
      return result;
    } catch (error) {
      logger.error(`❌ خطا در راه‌اندازی وب درایور ${this.driverType}: ${error.message}`);
      throw error;
    }
  }

  // Resolve Chromium executable path with sensible fallbacks
  resolveChromiumPath() {
    const candidates = [];
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      candidates.push(process.env.PUPPETEER_EXECUTABLE_PATH);
    }
    try {
      const installations = typeof Launcher.getInstallations === 'function' ? Launcher.getInstallations() : [];
      if (Array.isArray(installations)) {
        candidates.push(...installations);
      }
    } catch (_) {}
    candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable');

    for (const p of candidates) {
      try {
        if (p && fs.existsSync(p)) return p;
      } catch (_) {}
    }
    // Return first candidate even if not found to let puppeteer throw meaningful error
    return candidates[0] || null;
  }

  // Initialize Puppeteer
  async initPuppeteer() {
    logger.info(`🌐 راه‌اندازی Puppeteer browser`);
    
    if (!this.browser || !this.browser.isConnected()) {
      logger.info(`🔄 بستن browser قبلی و راه‌اندازی مجدد`);
      await this.closePuppeteer();
      
      const chromePath = this.resolveChromiumPath();
      logger.info(`🔧 استفاده از Chrome path: ${chromePath || 'نامشخص'}`);
      
      try {
        this.browser = await puppeteer.launch({
          executablePath: chromePath || undefined,
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--lang=fa-IR',
            '--accept-lang=fa-IR,fa,en-US,en',
            '--force-device-scale-factor=1',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-field-trial-config',
            '--disable-ipc-flooding-protection',
            '--memory-pressure-off',
            '--max_old_space_size=512'
          ],
          protocolTimeout: 300000 // 5 minutes
        });
        
        logger.info(`✅ Puppeteer browser با موفقیت راه‌اندازی شد`);
      } catch (error) {
        logger.error(`❌ خطا در راه‌اندازی Puppeteer: ${error.message}`);
        throw error;
      }
    } else {
      logger.info(`✅ Puppeteer browser قبلاً متصل است`);
    }
    
    return this.browser;
  }

  // Initialize Selenium
  async initSelenium() {
    if (!webdriver) {
      throw new Error('Selenium WebDriver is not installed. Please install selenium-webdriver package.');
    }

    if (!this.driver) {
      const options = new chrome.Options();
      options.addArguments(
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--lang=fa-IR',
        '--accept-lang=fa-IR,fa,en-US,en',
        '--headless'
      );
      // Explicitly set Chromium binary if available
      const chromiumBinary = this.resolveChromiumPath();
      if (typeof options.setChromeBinaryPath === 'function' && chromiumBinary) {
        options.setChromeBinaryPath(chromiumBinary);
        logger.info(`Selenium Chrome binary set to: ${chromiumBinary}`);
      }

      // Explicit Chromedriver path to avoid selenium-manager download issues
      const chromedriverPath = process.env.CHROMEDRIVER_PATH || '/usr/bin/chromedriver';
      const service = new chrome.ServiceBuilder(chromedriverPath);

      this.driver = await new webdriver.Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .setChromeService(service)
        .build();
        
      logger.info('Selenium WebDriver initialized successfully');
    }
    return this.driver;
  }

  // Initialize Playwright
  async initPlaywright() {
    if (!this.optimizedPlaywright) {
      // دریافت تنظیمات بهینه برای Playwright
      const config = getOptimalPlaywrightConfig('', {
        priority: 'balanced',
        networkConditions: {
          hasProxyIssues: process.env.PROXY_ISSUES === 'true',
          hasSSLIssues: process.env.SSL_ISSUES === 'true',
          isUnstableNetwork: process.env.UNSTABLE_NETWORK === 'true'
        }
      });
      
      this.optimizedPlaywright = new OptimizedPlaywright(config);
      
      logger.info('OptimizedPlaywright initialized successfully');
    }
    return this.optimizedPlaywright;
  }

  // Initialize Cheerio (HTTP-based scraping)
  async initCheerio() {
    // Cheerio doesn't need initialization like browsers
    // We'll use axios for HTTP requests and cheerio for parsing
    logger.info('Cheerio scraper initialized successfully');
    return true;
  }

  // Create new page/tab
  async newPage() {
    logger.info(`📄 ایجاد صفحه جدید با درایور: ${this.driverType}`);
    this.lastActivity = Date.now();
    
    try {
      if (this.driverType === 'puppeteer') {
        logger.info(`🌐 ایجاد صفحه Puppeteer`);
        
        // بررسی اتصال browser قبل از ایجاد صفحه جدید
        if (!this.browser || !this.browser.isConnected()) {
          logger.warn(`⚠️ Browser disconnected، تلاش برای راه‌اندازی مجدد...`);
          await this.forceCloseWebDriver();
          await this.init();
        }
        
        const browser = await this.init();
        const page = await browser.newPage();
        
        // اضافه کردن event listener برای بسته شدن صفحه
        page.on('close', () => {
          logger.info(`🔒 صفحه Puppeteer بسته شد`);
          this.pages.delete(page);
        });
        
        page.on('error', (error) => {
          logger.error(`❌ خطا در صفحه Puppeteer: ${error.message}`);
          this.pages.delete(page);
        });
        
        this.pages.add(page);
        
        logger.info(`✅ صفحه Puppeteer ایجاد شد (تعداد صفحات فعال: ${this.pages.size})`);
        
        // Setup Persian language
        await this.setupPersianLanguage(page);
        
        return page;
      } else if (this.driverType === 'selenium') {
        await this.init();
        // Return a wrapper object for selenium
        return {
          goto: async (url, options = {}) => {
            await this.driver.get(url);
            // Wait for page load
            if (options.waitUntil) {
              await this.driver.wait(async () => {
                const readyState = await this.driver.executeScript('return document.readyState');
                return readyState === 'complete';
              }, options.timeout || 30000);
            }
            return { status: 200 };
          },
          waitForTimeout: async (ms) => {
            await this.driver.sleep(ms);
          },
          waitForFunction: async (fn, options = {}) => {
            await this.driver.wait(fn, options.timeout || 10000);
          },
          executeScript: async (script, ...args) => {
            return await this.driver.executeScript(script, ...args);
          },
          close: async () => {
            // Selenium driver will be closed by the manager
          },
          // Expose the original driver for direct access
          _driver: this.driver
        };
      } else if (this.driverType === 'playwright') {
        // بررسی اتصال browser قبل از ایجاد صفحه جدید
        if (!this.optimizedPlaywright || (this.optimizedPlaywright.browser && this.optimizedPlaywright.browser.isConnected && !this.optimizedPlaywright.browser.isConnected())) {
          logger.warn('OptimizedPlaywright disconnected، تلاش برای راه‌اندازی مجدد...');
          await this.forceCloseWebDriver();
          await this.init();
        }
        
        const optimizedPlaywright = await this.init();
        const page = await optimizedPlaywright.createPage();
        this.pages.add(page);
        return page;
      } else if (this.driverType === 'cheerio') {
        await this.init();
        // Return a mock page object for cheerio
        return {
          goto: async (url) => {
            // دریافت تنظیمات بهینه برای این URL
             const config = getOptimalConfig(url, {
               priority: 'balanced',
               networkConditions: {
                 hasProxyIssues: process.env.PROXY_ISSUES === 'true',
                 hasSSLIssues: process.env.SSL_ISSUES === 'true',
                 isUnstableNetwork: process.env.UNSTABLE_NETWORK === 'true'
               }
             });
             
             // استفاده از کلاس بهینه‌شده Cheerio
             const optimizedCheerio = new OptimizedCheerio(config);
            
            const response = await optimizedCheerio.goto(url);
            this.$ = optimizedCheerio.$;
            
            return {
              ...response,
              diagnostics: () => optimizedCheerio.getNetworkDiagnostics()
            };
          },
          $: (selector) => this.$(selector),
          content: () => this.$.html(),
          close: () => Promise.resolve()
        };
      }
    } catch (error) {
      // اگر خطای Protocol error یا Session closed باشد، browser را مجدداً راه‌اندازی کن
      if (error.message.includes('Protocol error') || error.message.includes('Session closed') || error.message.includes('Target closed')) {
        logger.warn('خطای اتصال در newPage، تلاش برای راه‌اندازی مجدد browser...');
        try {
          await this.forceCloseWebDriver();
          await this.init();
          
          // تلاش مجدد برای ایجاد صفحه
          if (this.driverType === 'puppeteer') {
            const browser = await this.init();
            const page = await browser.newPage();
            this.pages.add(page);
            await this.setupPersianLanguage(page);
            return page;
          } else if (this.driverType === 'playwright') {
            const optimizedPlaywright = await this.init();
            const page = await optimizedPlaywright.createPage();
            this.pages.add(page);
            return page;
          }
        } catch (restartError) {
          logger.error('خطا در راه‌اندازی مجدد browser در newPage:', restartError.message);
          throw restartError;
        }
      }
      throw error;
    }
  }

  // Setup Persian language for Puppeteer
  async setupPersianLanguage(page) {
    try {
      // بررسی وضعیت صفحه قبل از انجام عملیات
      if (this.driverType === 'puppeteer') {
        // بررسی اینکه صفحه بسته نشده باشد
        if (page.isClosed()) {
          logger.warn('صفحه بسته شده است، تنظیم زبان فارسی رد شد');
          return;
        }
        
        // بررسی اینکه browser هنوز متصل باشد
        if (!this.browser || !this.browser.isConnected()) {
          logger.warn('Browser disconnected، تنظیم زبان فارسی رد شد');
          return;
        }
        
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        await page.evaluateOnNewDocument(() => {
          try {
            Object.defineProperty(navigator, 'language', {
              get: () => 'fa-IR',
            });
            Object.defineProperty(navigator, 'languages', {
              get: () => ['fa-IR', 'fa', 'en-US', 'en'],
            });
            
            if (document.documentElement) {
              document.documentElement.lang = 'fa-IR';
            }
          } catch (e) {
            // Ignore if property already defined
          }
        });
      } else if (this.driverType === 'playwright') {
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7'
        });
        await page.setViewportSize({ width: 1920, height: 1080 });
      } else if (this.driverType === 'selenium') {
        // Selenium doesn't support setExtraHTTPHeaders, skip language setup
        logger.info('Selenium driver: Persian language setup skipped');
      } else if (this.driverType === 'cheerio') {
        // Cheerio doesn't need browser setup
        logger.info('Cheerio driver: Persian language setup not needed');
      }
      
      logger.info('Persian language settings applied for ' + this.driverType);
    } catch (error) {
      // بررسی نوع خطا و ارائه پیام مناسب
      if (error.message.includes('Protocol error') || error.message.includes('Session closed')) {
        logger.warn('Browser session بسته شده است، تنظیم زبان فارسی رد شد:', error.message);
      } else {
        logger.warn('Error setting up Persian language:', error.message);
      }
    }
  }

  // Navigate to URL
  async goto(page, url, options = {}) {
    logger.info(`🔗 ناوبری به URL: ${url}`, { driverType: this.driverType });
    this.lastActivity = Date.now();
    
    const defaultOptions = {
      waitUntil: 'domcontentloaded',
      timeout: 180000
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    if (this.driverType === 'puppeteer') {
      logger.info(`🌐 ناوبری Puppeteer به: ${url}`);
      
      // Multi-stage navigation strategy
      let navigationSuccess = false;
      
      try {
        logger.debug(`🔄 تلاش ناوبری با domcontentloaded`);
        await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: Math.min(finalOptions.timeout, 120000) 
        });
        navigationSuccess = true;
        logger.info(`✅ ناوبری با domcontentloaded موفق`);
      } catch (navError) {
        logger.warn(`⚠️ ناوبری با domcontentloaded ناموفق، تلاش با load: ${url}`);
      }
      
      if (!navigationSuccess) {
        try {
          logger.debug(`🔄 تلاش ناوبری با load`);
          await page.goto(url, { 
            waitUntil: 'load', 
            timeout: Math.min(finalOptions.timeout, 180000) 
          });
          navigationSuccess = true;
          logger.info(`✅ ناوبری با load موفق`);
        } catch (navError) {
          logger.warn(`⚠️ ناوبری با load ناموفق، تلاش با networkidle0: ${url}`);
        }
      }
      
      if (!navigationSuccess) {
        logger.debug(`🔄 تلاش ناوبری با networkidle0`);
        await page.goto(url, { 
          waitUntil: 'networkidle0', 
          timeout: finalOptions.timeout 
        });
        logger.info(`✅ ناوبری با networkidle0 موفق`);
      }
      
      logger.info(`⏳ انتظار 3 ثانیه برای بارگذاری کامل`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } else if (this.driverType === 'selenium') {
      await this.driver.get(url);
      await this.driver.wait(until.elementLocated(By.tagName('body')), finalOptions.timeout);
    } else if (this.driverType === 'playwright') {
      // OptimizedPlaywright handles navigation internally
      await page.goto(url, finalOptions);
    } else if (this.driverType === 'cheerio') {
      // For cheerio, the goto method is handled in the mock page object
      return await page.goto(url);
    }
  }

  // Close page
  async closePage(page) {
    try {
      if (this.driverType === 'puppeteer' && page) {
        if (page.isClosed()) {
          logger.info(`🔒 صفحه Puppeteer قبلاً بسته شده است`);
          this.pages.delete(page);
        } else {
          logger.info(`🔒 بستن صفحه Puppeteer`);
          this.pages.delete(page);
          await page.close();
          logger.info(`✅ صفحه Puppeteer با موفقیت بسته شد`);
        }
      } else if (this.driverType === 'playwright' && page) {
        logger.info(`🔒 بستن صفحه Playwright`);
        this.pages.delete(page);
        await page.close();
        logger.info(`✅ صفحه Playwright با موفقیت بسته شد`);
      } else if (this.driverType === 'cheerio' && page) {
        logger.info(`🔒 بستن صفحه Cheerio`);
        // Cheerio doesn't need explicit page closing
        await page.close();
        logger.info(`✅ صفحه Cheerio با موفقیت بسته شد`);
      }
    } catch (error) {
      logger.warn(`⚠️ خطا در بستن صفحه: ${error.message}`);
      // حذف صفحه از لیست حتی اگر خطا رخ دهد
      this.pages.delete(page);
    }
  }

  // Close Puppeteer browser
  async closePuppeteer() {
    if (this.browser) {
      try {
        // Close all tracked pages first
        for (const page of this.pages) {
          if (!page.isClosed()) {
            await page.close();
          }
        }
        this.pages.clear();
        
        await this.browser.close();
      } catch (error) {
        logger.warn('Error closing Puppeteer browser:', error.message);
      }
      this.browser = null;
    }
  }

  // Close Selenium driver
  async closeSelenium() {
    if (this.driver) {
      try {
        await this.driver.quit();
      } catch (error) {
        logger.warn('Error closing Selenium driver:', error.message);
      }
      this.driver = null;
    }
  }

  // Close Playwright browser
  async closePlaywright() {
    if (this.optimizedPlaywright) {
      try {
        // Close all tracked pages first
        for (const page of this.pages) {
          try {
            await page.close();
          } catch (error) {
            // Ignore errors when closing individual pages
          }
        }
        this.pages.clear();
        
        await this.optimizedPlaywright.close();
      } catch (error) {
        logger.warn('Error closing OptimizedPlaywright:', error.message);
      }
      this.optimizedPlaywright = null;
    }
  }

  // Close Cheerio (no resources to close)
  async closeCheerio() {
    // Cheerio doesn't maintain persistent connections
    // Just clear any cached data
    this.$ = null;
    logger.info('Cheerio scraper closed');
  }

  // Close all resources
  async close() {
    if (this.driverType === 'puppeteer') {
      await this.closePuppeteer();
    } else if (this.driverType === 'selenium') {
      await this.closeSelenium();
    } else if (this.driverType === 'playwright') {
      await this.closePlaywright();
    } else if (this.driverType === 'cheerio') {
      await this.closeCheerio();
    }
  }

  // Force close for fresh start
  async forceClose() {
    try {
      await this.close();
    } catch (error) {
      logger.warn('Error in force close:', error.message);
    }
  }

  // Check if resources need cleanup
  shouldCleanup() {
    const idleTime = Date.now() - this.lastActivity;
    return idleTime > this.maxIdleTime;
  }

  // Get memory usage (Puppeteer only)
  async getMemoryUsage() {
    if (this.driverType === 'puppeteer' && this.browser) {
      try {
        const pages = await this.browser.pages();
        let totalMemory = 0;
        
        for (const page of pages) {
          const metrics = await page.metrics();
          totalMemory += metrics.JSHeapUsedSize || 0;
        }
        
        return totalMemory;
      } catch (error) {
        logger.warn('Error getting memory usage:', error.message);
        return 0;
      }
    }
    return 0;
  }

  // Check if memory usage is too high
  async isMemoryUsageHigh() {
    const usage = await this.getMemoryUsage();
    return usage > this.maxMemoryUsage;
  }

  // Cleanup if needed
  async cleanupIfNeeded() {
    if (this.shouldCleanup() || await this.isMemoryUsageHigh()) {
      logger.info('Cleaning up WebDriver due to idle time or high memory usage');
      await this.forceClose();
      return true;
    }
    return false;
  }

  // Get driver type
  getDriverType() {
    return this.driverType;
  }

  // Get current driver type (alias for getDriverType)
  getCurrentType() {
    return this.driverType;
  }

  // Check if driver is connected
  isConnected() {
    if (this.driverType === 'puppeteer') {
      return this.browser && this.browser.isConnected();
    } else if (this.driverType === 'selenium') {
      return this.driver !== null;
    }
    return false;
  }

  // Check if driver is available
  static isSeleniumAvailable() {
    return !!webdriver;
  }

  // Get available driver types
  static getAvailableDrivers() {
    const drivers = ['puppeteer'];
    
    // Check if selenium is available
    try {
      require('selenium-webdriver');
      drivers.push('selenium');
    } catch (error) {
      // Selenium not available
    }
    
    // Check if playwright is available
    try {
      require('playwright');
      drivers.push('playwright');
    } catch (error) {
      // Playwright not available
    }
    
    // Cheerio is always available (already in dependencies)
    drivers.push('cheerio');
    
    return drivers;
  }

  // Get a page (alias for newPage)
  async getPage() {
    return await this.newPage();
  }

  // Force close all browser instances and cleanup
  async forceCloseWebDriver() {
    try {
      logger.info(`🔄 شروع بستن اجباری WebDriver (${this.driverType})...`);
      
      // Close all tracked pages first
      if (this.pages && this.pages.size > 0) {
        logger.info(`📄 بستن ${this.pages.size} صفحه فعال`);
        for (const page of this.pages) {
          try {
            if (page && !page.isClosed()) {
              await page.close();
              logger.debug(`✅ صفحه بسته شد`);
            } else {
              logger.debug(`🔒 صفحه قبلاً بسته شده است`);
            }
          } catch (error) {
            logger.warn(`⚠️ خطا در بستن صفحه: ${error.message}`);
          }
        }
        this.pages.clear();
        logger.info(`✅ تمام صفحات بسته شدند`);
      } else {
        logger.info(`📄 هیچ صفحه فعالی برای بستن وجود ندارد`);
      }

      // Close browser/driver based on type
      if (this.driverType === 'puppeteer' && this.browser) {
        try {
          if (this.browser.process() && !this.browser.process().killed) {
            await this.browser.close();
          }
        } catch (error) {
          logger.warn('خطا در بستن Puppeteer browser:', error.message);
          // Force kill the process if normal close fails
          try {
            if (this.browser.process()) {
              this.browser.process().kill('SIGKILL');
            }
          } catch (killError) {
            logger.warn('خطا در kill کردن Puppeteer process:', killError.message);
          }
        }
        this.browser = null;
      } else if (this.driverType === 'selenium' && this.driver) {
        try {
          await this.driver.quit();
        } catch (error) {
          logger.warn('خطا در بستن Selenium driver:', error.message);
        }
        this.driver = null;
      } else if (this.driverType === 'playwright' && this.browser) {
        try {
          await this.browser.close();
        } catch (error) {
          logger.warn('خطا در بستن Playwright browser:', error.message);
        }
        this.browser = null;
      }

      logger.info('WebDriver با موفقیت بسته شد');
    } catch (error) {
      logger.error('خطا در بستن اجباری WebDriver:', error.message);
      // Reset all references even if closing failed
      this.browser = null;
      this.driver = null;
      if (this.pages) {
        this.pages.clear();
      }
    }
  }
}

module.exports = WebDriverManager;
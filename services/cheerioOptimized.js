const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns').promises;
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');
const logger = require('../utils/logger');

class OptimizedCheerio {
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 45000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 2000,
      userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      acceptLanguage: options.acceptLanguage || 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
      followRedirects: options.followRedirects !== false,
      maxRedirects: options.maxRedirects || 5,
      validateSSL: options.validateSSL !== false,
      enableProxy: options.enableProxy !== false,
      fallbackToHttp: options.fallbackToHttp !== false,
      ...options
    };
    
    this.$ = null;
    this.lastResponse = null;
    this.proxyAgent = null;
    this.networkDiagnostics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastError: null
    };
    
    this.initializeProxy();
  }
  
  // تشخیص و تنظیم پروکسی
  initializeProxy() {
    try {
      // غیرفعال کردن کامل پروکسی
      this.proxyAgent = null;
      logger.info('پروکسی غیرفعال شد');
      
      // پاک کردن متغیرهای محیطی پروکسی
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;
      delete process.env.http_proxy;
      delete process.env.https_proxy;
    } catch (error) {
      logger.warn('خطا در غیرفعال کردن پروکسی:', error.message);
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
  
  // ایجاد تنظیمات axios بهینه
  createAxiosConfig(url, customOptions = {}) {
    const parsedUrl = new URL(url);
    
    const config = {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': this.options.acceptLanguage,
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': this.options.userAgent,
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
        ...customOptions.headers
      },
      timeout: customOptions.timeout || this.options.timeout,
      maxRedirects: this.options.maxRedirects,
      validateStatus: (status) => status >= 200 && status < 400,
      responseType: 'text',
      decompress: true,
      ...customOptions
    };
    
    // غیرفعال کردن پروکسی
    config.proxy = false;
    
    // تنظیمات مستقیم بدون پروکسی
    const https = require('https');
    const http = require('http');
    
    if (parsedUrl.protocol === 'https:') {
      config.httpsAgent = new https.Agent({
        rejectUnauthorized: !this.options.validateSSL,
        keepAlive: true
      });
    } else {
      config.httpAgent = new http.Agent({
        keepAlive: true
      });
    }
    
    // تنظیمات SSL
    if (!this.options.validateSSL) {
      config.httpsAgent = new (require('https').Agent)({
        rejectUnauthorized: false
      });
    }
    
    return config;
  }
  
  // درخواست HTTP با retry logic پیشرفته
  async makeRequest(url, options = {}) {
    const startTime = Date.now();
    this.networkDiagnostics.totalRequests++;
    
    let lastError;
    let response;
    
    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        logger.info(`تلاش ${attempt}/${this.options.maxRetries} برای ${url}`);
        
        const axiosConfig = this.createAxiosConfig(url, options);
        response = await axios.get(url, axiosConfig);
        
        // موفقیت
        const responseTime = Date.now() - startTime;
        this.networkDiagnostics.successfulRequests++;
        this.updateAverageResponseTime(responseTime);
        
        logger.info(`درخواست موفق به ${url} در ${responseTime}ms`);
        return response;
        
      } catch (error) {
        lastError = error;
        const responseTime = Date.now() - startTime;
        
        logger.warn(`تلاش ${attempt} ناموفق برای ${url}: ${error.message}`);
        
        // بررسی نوع خطا
        if (this.shouldRetry(error, attempt)) {
          if (attempt < this.options.maxRetries) {
            const delay = this.calculateRetryDelay(attempt, error);
            logger.info(`انتظار ${delay}ms قبل از تلاش مجدد...`);
            await this.sleep(delay);
            
            // تلاش fallback به HTTP اگر HTTPS کار نکرد
            if (error.code === 'ECONNREFUSED' && url.startsWith('https:') && this.options.fallbackToHttp) {
              const httpUrl = url.replace('https:', 'http:');
              logger.info(`تلاش fallback به HTTP: ${httpUrl}`);
              try {
                const httpConfig = this.createAxiosConfig(httpUrl, options);
                response = await axios.get(httpUrl, httpConfig);
                logger.info(`Fallback به HTTP موفق بود`);
                return response;
              } catch (httpError) {
                logger.warn(`Fallback به HTTP نیز ناموفق: ${httpError.message}`);
              }
            }
            
            continue;
          }
        }
        
        // خطای غیرقابل retry یا تمام تلاش‌ها ناموفق
        break;
      }
    }
    
    // تمام تلاش‌ها ناموفق
    this.networkDiagnostics.failedRequests++;
    this.networkDiagnostics.lastError = lastError;
    
    const errorMessage = this.createDetailedErrorMessage(url, lastError);
    throw new Error(errorMessage);
  }
  
  // تشخیص اینکه آیا باید retry کرد یا نه
  shouldRetry(error, attempt) {
    // خطاهای قابل retry
    const retryableCodes = [
      'ECONNREFUSED',
      'ENOTFOUND', 
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE',
      'EHOSTUNREACH',
      'ENETUNREACH'
    ];
    
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    
    if (retryableCodes.includes(error.code)) {
      return true;
    }
    
    if (error.response && retryableStatusCodes.includes(error.response.status)) {
      return true;
    }
    
    return false;
  }
  
  // محاسبه تاخیر retry
  calculateRetryDelay(attempt, error) {
    let baseDelay = this.options.retryDelay;
    
    // Exponential backoff
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    
    // Jitter برای جلوگیری از thundering herd
    const jitter = Math.random() * 1000;
    
    // تاخیر بیشتر برای خطاهای خاص
    if (error.code === 'ECONNREFUSED') {
      baseDelay *= 2;
    }
    
    return Math.min(exponentialDelay + jitter, 30000); // حداکثر 30 ثانیه
  }
  
  // ایجاد پیام خطای تفصیلی
  createDetailedErrorMessage(url, error) {
    let message = `نمی‌توان به ${url} متصل شد.\n`;
    
    if (error.code === 'ECONNREFUSED') {
      message += '🚫 سرور اتصال را رد کرد. احتمالاً:\n';
      message += '   - سرور خاموش است\n';
      message += '   - فایروال اتصال را مسدود کرده\n';
      message += '   - پورت در دسترس نیست\n';
    } else if (error.code === 'ENOTFOUND') {
      message += '🔍 نام دامنه پیدا نشد. احتمالاً:\n';
      message += '   - مشکل DNS\n';
      message += '   - اتصال اینترنت قطع است\n';
      message += '   - آدرس اشتباه است\n';
    } else if (error.code === 'ETIMEDOUT') {
      message += '⏰ زمان اتصال تمام شد. احتمالاً:\n';
      message += '   - اتصال اینترنت کند است\n';
      message += '   - سرور پاسخ نمی‌دهد\n';
      message += '   - مشکل شبکه\n';
    } else if (error.response) {
      message += `📄 سرور پاسخ داد اما با خطا: ${error.response.status} ${error.response.statusText}\n`;
    }
    
    message += `\n💡 راهنمایی:\n`;
    message += `   - اتصال اینترنت را بررسی کنید\n`;
    message += `   - تنظیمات فایروال را بررسی کنید\n`;
    message += `   - در صورت استفاده از پروکسی، تنظیمات آن را بررسی کنید\n`;
    
    return message;
  }
  
  // بارگذاری صفحه
  async goto(url, options = {}) {
    try {
      // بررسی سلامت شبکه
      const parsedUrl = new URL(url);
      const healthCheck = await this.checkNetworkHealth(parsedUrl.hostname);
      
      if (!healthCheck.healthy) {
        logger.warn(healthCheck.message);
      } else {
        logger.info(healthCheck.message);
      }
      
      // درخواست صفحه
      this.lastResponse = await this.makeRequest(url, options);
      
      // بارگذاری محتوا در Cheerio
      this.$ = cheerio.load(this.lastResponse.data, {
        normalizeWhitespace: true,
        xmlMode: false,
        decodeEntities: true
      });
      
      logger.info(`صفحه ${url} با موفقیت بارگذاری شد. اندازه: ${this.lastResponse.data.length} کاراکتر`);
      
      return this.lastResponse;
      
    } catch (error) {
      logger.error(`خطا در بارگذاری ${url}:`, error.message);
      throw error;
    }
  }
  
  // دریافت محتوای HTML
  content() {
    return this.$ ? this.$.html() : '';
  }
  
  // اجرای selector
  $(selector) {
    if (!this.$) {
      throw new Error('هیچ صفحه‌ای بارگذاری نشده است. ابتدا goto() را فراخوانی کنید.');
    }
    return this.$(selector);
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
      lastError: null
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
  
  // بستن (cleanup)
  close() {
    this.$ = null;
    this.lastResponse = null;
    return Promise.resolve();
  }
}

module.exports = OptimizedCheerio;
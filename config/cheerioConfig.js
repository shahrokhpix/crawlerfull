// تنظیمات مختلف برای OptimizedCheerio و OptimizedPlaywright

const cheerioConfigs = {
  // تنظیمات پیش‌فرض - متعادل بین سرعت و قابلیت اطمینان
  default: {
    timeout: 45000,
    maxRetries: 3,
    retryDelay: 2000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptLanguage: 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
    followRedirects: true,
    maxRedirects: 5,
    validateSSL: true,
    enableProxy: true,
    fallbackToHttp: false
  },
  
  // تنظیمات سریع - برای شبکه‌های پایدار
  fast: {
    timeout: 15000,
    maxRetries: 2,
    retryDelay: 1000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    acceptLanguage: 'fa-IR,fa;q=0.9,en;q=0.8',
    followRedirects: true,
    maxRedirects: 3,
    validateSSL: true,
    enableProxy: false,
    fallbackToHttp: false
  },
  
  // تنظیمات قوی - برای شبکه‌های ناپایدار
  robust: {
    timeout: 60000,
    maxRetries: 5,
    retryDelay: 3000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptLanguage: 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
    followRedirects: true,
    maxRedirects: 10,
    validateSSL: false, // برای سایت‌هایی با مشکل SSL
    enableProxy: true,
    fallbackToHttp: true
  },
  
  // تنظیمات محافظه‌کارانه - برای محیط‌های محدود
  conservative: {
    timeout: 30000,
    maxRetries: 2,
    retryDelay: 5000,
    userAgent: 'Mozilla/5.0 (compatible; WebCrawler/1.0)',
    acceptLanguage: 'fa-IR,fa;q=0.9',
    followRedirects: true,
    maxRedirects: 3,
    validateSSL: true,
    enableProxy: true,
    fallbackToHttp: false
  },
  
  // تنظیمات برای سایت‌های ایرانی
  iranian: {
    timeout: 45000,
    maxRetries: 4,
    retryDelay: 2500,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptLanguage: 'fa-IR,fa;q=1.0,en-US;q=0.5,en;q=0.3',
    followRedirects: true,
    maxRedirects: 7,
    validateSSL: false, // بعضی سایت‌های ایرانی مشکل SSL دارند
    enableProxy: true,
    fallbackToHttp: true
  },
  
  // تنظیمات برای تست و توسعه
  development: {
    timeout: 20000,
    maxRetries: 1,
    retryDelay: 1000,
    userAgent: 'Mozilla/5.0 (Development Bot)',
    acceptLanguage: 'en-US,en;q=0.9',
    followRedirects: true,
    maxRedirects: 3,
    validateSSL: false,
    enableProxy: false,
    fallbackToHttp: true
  }
};

// تنظیمات خاص برای دامنه‌های مختلف
const domainSpecificConfigs = {
  'mehrnews.com': {
    ...cheerioConfigs.iranian,
    timeout: 50000,
    maxRetries: 5
  },
  
  'farsnews.ir': {
    ...cheerioConfigs.iranian,
    timeout: 40000,
    retryDelay: 3000
  },
  
  'isna.ir': {
    ...cheerioConfigs.iranian,
    timeout: 35000
  },
  
  'tasnimnews.com': {
    ...cheerioConfigs.iranian,
    maxRetries: 6,
    retryDelay: 2000
  },
  
  'google.com': {
    ...cheerioConfigs.fast,
    validateSSL: true
  },
  
  'httpbin.org': {
    ...cheerioConfigs.fast,
    timeout: 10000
  }
};

/**
 * دریافت تنظیمات بهینه برای یک URL
 * @param {string} url - آدرس URL
 * @param {string} configType - نوع کانفیگ (default, fast, robust, etc.)
 * @returns {Object} تنظیمات Cheerio
 */
function getConfigForUrl(url, configType = 'default') {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // بررسی تنظیمات خاص دامنه
    for (const domain in domainSpecificConfigs) {
      if (hostname.includes(domain)) {
        return domainSpecificConfigs[domain];
      }
    }
    
    // استفاده از تنظیمات عمومی
    return cheerioConfigs[configType] || cheerioConfigs.default;
    
  } catch (error) {
    console.warn(`خطا در پارس URL ${url}:`, error.message);
    return cheerioConfigs[configType] || cheerioConfigs.default;
  }
}

/**
 * دریافت تنظیمات بر اساس شرایط شبکه
 * @param {Object} networkConditions - شرایط شبکه
 * @returns {Object} تنظیمات Cheerio
 */
function getConfigForNetworkConditions(networkConditions = {}) {
  const {
    isSlowNetwork = false,
    hasProxyIssues = false,
    hasSSLIssues = false,
    isUnstableNetwork = false
  } = networkConditions;
  
  if (isUnstableNetwork || hasProxyIssues) {
    return cheerioConfigs.robust;
  }
  
  if (hasSSLIssues) {
    return {
      ...cheerioConfigs.default,
      validateSSL: false,
      fallbackToHttp: true
    };
  }
  
  if (isSlowNetwork) {
    return {
      ...cheerioConfigs.default,
      timeout: 90000,
      maxRetries: 2,
      retryDelay: 5000
    };
  }
  
  return cheerioConfigs.default;
}

/**
 * ایجاد تنظیمات سفارشی
 * @param {Object} customOptions - تنظیمات سفارشی
 * @param {string} baseConfig - کانفیگ پایه
 * @returns {Object} تنظیمات ترکیبی
 */
function createCustomConfig(customOptions = {}, baseConfig = 'default') {
  const base = cheerioConfigs[baseConfig] || cheerioConfigs.default;
  return {
    ...base,
    ...customOptions
  };
}

/**
 * تشخیص بهترین تنظیمات بر اساس URL و شرایط
 * @param {string} url - آدرس URL
 * @param {Object} options - گزینه‌های اضافی
 * @returns {Object} تنظیمات بهینه
 */
function getOptimalConfig(url, options = {}) {
  const {
    priority = 'balanced', // 'speed', 'reliability', 'balanced'
    networkConditions = {},
    customOptions = {}
  } = options;
  
  let baseConfig;
  
  // انتخاب کانفیگ بر اساس اولویت
  switch (priority) {
    case 'speed':
      baseConfig = getConfigForUrl(url, 'fast');
      break;
    case 'reliability':
      baseConfig = getConfigForUrl(url, 'robust');
      break;
    default:
      baseConfig = getConfigForUrl(url, 'default');
  }
  
  // اعمال تنظیمات شرایط شبکه
  if (Object.keys(networkConditions).length > 0) {
    const networkConfig = getConfigForNetworkConditions(networkConditions);
    baseConfig = {
      ...baseConfig,
      ...networkConfig
    };
  }
  
  // اعمال تنظیمات سفارشی
  return {
    ...baseConfig,
    ...customOptions
  };
}

// تنظیمات مختلف برای OptimizedPlaywright
const playwrightConfigs = {
  // تنظیمات پیش‌فرض - متعادل بین سرعت و قابلیت اطمینان
  default: {
    browser: 'chromium',
    headless: true,
    timeout: 45000,
    maxRetries: 3,
    retryDelay: 2000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'fa-IR',
    timezone: 'Asia/Tehran',
    enableProxy: true,
    enableStealth: true,
    waitForNetworkIdle: true,
    blockResources: ['image', 'font', 'media'],
    enableJavaScript: true,
    ignoreHTTPSErrors: false,
    slowMo: 0
  },
  
  // تنظیمات سریع - برای شبکه‌های پایدار
  fast: {
    browser: 'chromium',
    headless: true,
    timeout: 20000,
    maxRetries: 2,
    retryDelay: 1000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'fa-IR',
    timezone: 'Asia/Tehran',
    enableProxy: false,
    enableStealth: false,
    waitForNetworkIdle: false,
    blockResources: ['image', 'font', 'media', 'stylesheet'],
    enableJavaScript: true,
    ignoreHTTPSErrors: false,
    slowMo: 0
  },
  
  // تنظیمات قوی - برای شبکه‌های ناپایدار
  robust: {
    browser: 'chromium',
    headless: true,
    timeout: 90000,
    maxRetries: 5,
    retryDelay: 3000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'fa-IR',
    timezone: 'Asia/Tehran',
    enableProxy: true,
    enableStealth: true,
    waitForNetworkIdle: true,
    blockResources: ['image', 'font'],
    enableJavaScript: true,
    ignoreHTTPSErrors: true,
    slowMo: 100
  },
  
  // تنظیمات محافظه‌کارانه - برای محیط‌های محدود
  conservative: {
    browser: 'chromium',
    headless: true,
    timeout: 60000,
    maxRetries: 2,
    retryDelay: 5000,
    userAgent: 'Mozilla/5.0 (compatible; WebCrawler/1.0)',
    viewport: { width: 1024, height: 768 },
    locale: 'fa-IR',
    timezone: 'Asia/Tehran',
    enableProxy: true,
    enableStealth: false,
    waitForNetworkIdle: false,
    blockResources: ['image', 'font', 'media', 'stylesheet'],
    enableJavaScript: false,
    ignoreHTTPSErrors: true,
    slowMo: 200
  },
  
  // تنظیمات برای سایت‌های ایرانی
  iranian: {
    browser: 'chromium',
    headless: true,
    timeout: 60000,
    maxRetries: 4,
    retryDelay: 2500,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'fa-IR',
    timezone: 'Asia/Tehran',
    enableProxy: true,
    enableStealth: true,
    waitForNetworkIdle: true,
    blockResources: ['font', 'media'],
    enableJavaScript: true,
    ignoreHTTPSErrors: true,
    slowMo: 50
  },
  
  // تنظیمات برای تست و توسعه
  development: {
    browser: 'chromium',
    headless: false,
    timeout: 30000,
    maxRetries: 1,
    retryDelay: 1000,
    userAgent: 'Mozilla/5.0 (Development Bot)',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    timezone: 'UTC',
    enableProxy: false,
    enableStealth: false,
    waitForNetworkIdle: false,
    blockResources: [],
    enableJavaScript: true,
    ignoreHTTPSErrors: true,
    slowMo: 500
  }
};

// تنظیمات خاص برای دامنه‌های مختلف - Playwright
const playwrightDomainConfigs = {
  'mehrnews.com': {
    ...playwrightConfigs.iranian,
    timeout: 70000,
    maxRetries: 5,
    waitForNetworkIdle: true
  },
  
  'farsnews.ir': {
    ...playwrightConfigs.iranian,
    timeout: 60000,
    retryDelay: 3000,
    slowMo: 100
  },
  
  'isna.ir': {
    ...playwrightConfigs.iranian,
    timeout: 50000,
    blockResources: ['image', 'font']
  },
  
  'tasnimnews.com': {
    ...playwrightConfigs.iranian,
    maxRetries: 6,
    retryDelay: 2000,
    enableStealth: true
  }
};

/**
 * دریافت تنظیمات بهینه Playwright برای یک URL
 * @param {string} url - آدرس URL
 * @param {string} configType - نوع کانفیگ
 * @returns {Object} تنظیمات Playwright
 */
function getPlaywrightConfigForUrl(url, configType = 'default') {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // بررسی تنظیمات خاص دامنه
    for (const domain in playwrightDomainConfigs) {
      if (hostname.includes(domain)) {
        return playwrightDomainConfigs[domain];
      }
    }
    
    // استفاده از تنظیمات عمومی
    return playwrightConfigs[configType] || playwrightConfigs.default;
    
  } catch (error) {
    console.warn(`خطا در پارس URL ${url}:`, error.message);
    return playwrightConfigs[configType] || playwrightConfigs.default;
  }
}

/**
 * دریافت تنظیمات Playwright بر اساس شرایط شبکه
 * @param {Object} networkConditions - شرایط شبکه
 * @returns {Object} تنظیمات Playwright
 */
function getPlaywrightConfigForNetworkConditions(networkConditions = {}) {
  const {
    isSlowNetwork = false,
    hasProxyIssues = false,
    hasSSLIssues = false,
    isUnstableNetwork = false,
    needsJavaScript = true
  } = networkConditions;
  
  if (isUnstableNetwork || hasProxyIssues) {
    return playwrightConfigs.robust;
  }
  
  if (hasSSLIssues) {
    return {
      ...playwrightConfigs.default,
      ignoreHTTPSErrors: true,
      enableStealth: true
    };
  }
  
  if (isSlowNetwork) {
    return {
      ...playwrightConfigs.default,
      timeout: 120000,
      maxRetries: 2,
      retryDelay: 5000,
      blockResources: ['image', 'font', 'media', 'stylesheet']
    };
  }
  
  if (!needsJavaScript) {
    return {
      ...playwrightConfigs.conservative,
      enableJavaScript: false
    };
  }
  
  return playwrightConfigs.default;
}

/**
 * تشخیص بهترین تنظیمات Playwright بر اساس URL و شرایط
 * @param {string} url - آدرس URL
 * @param {Object} options - گزینه‌های اضافی
 * @returns {Object} تنظیمات بهینه
 */
function getOptimalPlaywrightConfig(url, options = {}) {
  const {
    priority = 'balanced', // 'speed', 'reliability', 'balanced'
    networkConditions = {},
    customOptions = {},
    engine = 'playwright' // 'playwright', 'cheerio'
  } = options;
  
  let baseConfig;
  
  // انتخاب کانفیگ بر اساس اولویت
  switch (priority) {
    case 'speed':
      baseConfig = getPlaywrightConfigForUrl(url, 'fast');
      break;
    case 'reliability':
      baseConfig = getPlaywrightConfigForUrl(url, 'robust');
      break;
    default:
      baseConfig = getPlaywrightConfigForUrl(url, 'default');
  }
  
  // اعمال تنظیمات شرایط شبکه
  if (Object.keys(networkConditions).length > 0) {
    const networkConfig = getPlaywrightConfigForNetworkConditions(networkConditions);
    baseConfig = {
      ...baseConfig,
      ...networkConfig
    };
  }
  
  // اعمال تنظیمات سفارشی
  return {
    ...baseConfig,
    ...customOptions
  };
}

module.exports = {
  cheerioConfigs,
  domainSpecificConfigs,
  playwrightConfigs,
  playwrightDomainConfigs,
  getConfigForUrl,
  getConfigForNetworkConditions,
  createCustomConfig,
  getOptimalConfig,
  getPlaywrightConfigForUrl,
  getPlaywrightConfigForNetworkConditions,
  getOptimalPlaywrightConfig
};
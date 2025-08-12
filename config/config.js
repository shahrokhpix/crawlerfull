// تنظیمات پلتفرم خبرخوان جهانی
module.exports = {
  // تنظیمات پایگاه داده PostgreSQL
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
    user: process.env.DB_USER || 'crawler_user',
    password: process.env.DB_PASSWORD || 'farsnews123',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    backup: {
      enabled: true,
      interval: '0 2 * * *', // هر روز ساعت 2 صبح
      keepDays: 7
    }
  },

  // تنظیمات وب درایور
  webDriver: {
    // نوع پیش‌فرض درایور: 'puppeteer' یا 'selenium'
    defaultType: 'puppeteer',
    
    // تنظیمات Puppeteer
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--lang=fa-IR'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    },
    
    // تنظیمات Selenium
    selenium: {
      browser: 'chrome', // 'chrome', 'firefox', 'edge'
      headless: true,
      windowSize: {
        width: 1920,
        height: 1080
      },
      chromeOptions: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--lang=fa-IR'
      ]
    },
    
    // تنظیمات مدیریت منابع
    resourceManagement: {
      maxIdleTime: 300000, // 5 دقیقه
      memoryThreshold: 500 * 1024 * 1024, // 500MB
      cleanupInterval: 60000, // 1 دقیقه
      maxConcurrentPages: 5
    }
  },

  // تنظیمات کرال
  crawler: {
    defaultTimeout: 30000,
    navigationTimeout: 45000,
    maxRetries: 3,
    retryDelay: 2000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // تنظیمات عملکرد
    performance: {
      maxConcurrentCrawls: 3,
      cleanupThreshold: 100, // تعداد کرال‌ها
      memoryCleanupInterval: 300000 // 5 دقیقه
    }
  },

  // تنظیمات سرور
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    sessionSecret: process.env.SESSION_SECRET || 'your-secret-key-here'
  },

  // تنظیمات لاگ
  logging: {
    level: process.env.LOG_LEVEL || 'warn', // تغییر از 'info' به 'warn' برای کاهش لاگ‌ها
    console: {
      enabled: true,
      colors: true
    },
    file: {
      enabled: true,
      path: './logs',
      maxSize: '5m', // کاهش از 10m به 5m
      maxFiles: 3,   // کاهش از 5 به 3
      rotateDaily: true
    },
    database: {
      enabled: true,
      cleanupDays: 7, // نگهداری لاگ‌های دیتابیس برای 7 روز
      batchSize: 100  // ثبت لاگ‌ها به صورت دسته‌ای
    }
  },

  // تنظیمات پاکسازی
  cleanup: {
    defaultSchedule: '0 3 * * *', // هر روز ساعت 3 صبح
    defaultKeepCount: 1000
  }
};
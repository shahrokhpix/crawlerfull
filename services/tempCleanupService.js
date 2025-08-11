const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class TempCleanupService {
  constructor() {
    this.isWindows = os.platform() === 'win32';
    this.cleanupInterval = 30 * 60 * 1000; // هر 30 دقیقه
    this.timer = null;
    this.isRunning = false;
  }

  // شروع سرویس پاکسازی
  start() {
    if (this.isRunning) {
      logger.warn('سرویس پاکسازی قبلاً شروع شده است');
      return;
    }

    this.isRunning = true;
    logger.info('سرویس پاکسازی فایل‌های موقت شروع شد');
    
    // پاکسازی اولیه
    this.cleanup();
    
    // تنظیم تایمر برای پاکسازی دوره‌ای
    this.timer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);

    // پاکسازی هنگام خروج
    this.setupExitHandlers();
  }

  // توقف سرویس
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('سرویس پاکسازی فایل‌های موقت متوقف شد');
  }

  // پاکسازی کلی فایل‌های موقت
  cleanup() {
    try {
      logger.info('شروع پاکسازی فایل‌های موقت...');
      
      const cleanupTasks = [
        () => this.cleanupPuppeteerProfiles(),
        () => this.cleanupSnapTempFiles(),
        () => this.cleanupOldTempFiles(),
        () => this.cleanupChromeUserData()
      ];

      let successCount = 0;
      for (const task of cleanupTasks) {
        try {
          task();
          successCount++;
        } catch (error) {
          logger.warn('خطا در یکی از وظایف پاکسازی:', error.message);
        }
      }

      logger.info(`پاکسازی فایل‌های موقت تکمیل شد (${successCount}/${cleanupTasks.length} وظیفه موفق)`);
    } catch (error) {
      logger.error('خطا در پاکسازی فایل‌های موقت:', error);
    }
  }

  // پاکسازی پروفایل‌های Puppeteer
  cleanupPuppeteerProfiles() {
    try {
      if (this.isWindows) {
        // ویندوز
        const tempDir = process.env.TEMP || process.env.TMP || os.tmpdir();
        execSync(`forfiles /p "${tempDir}" /m "puppeteer_dev_chrome_profile-*" /c "cmd /c rmdir /s /q @path" 2>nul || echo.`, { timeout: 30000 });
      } else {
        // لینوکس/یونیکس
        execSync('find /tmp -name "puppeteer_dev_chrome_profile-*" -type d -mmin +60 -exec rm -rf {} + 2>/dev/null || true', { timeout: 30000 });
      }
      logger.info('پروفایل‌های Puppeteer پاک شدند');
    } catch (error) {
      logger.warn('خطا در پاکسازی پروفایل‌های Puppeteer:', error.message);
    }
  }

  // پاکسازی فایل‌های موقت Snap
  cleanupSnapTempFiles() {
    if (this.isWindows) return; // Snap فقط در لینوکس
    
    try {
      // پاکسازی فایل‌های قدیمی snap-private-tmp
      execSync('find /tmp/snap-private-tmp -type f -mmin +120 -delete 2>/dev/null || true', { timeout: 30000 });
      
      // پاکسازی پوشه‌های خالی
      execSync('find /tmp/snap-private-tmp -type d -empty -delete 2>/dev/null || true', { timeout: 10000 });
      
      logger.info('فایل‌های موقت Snap پاک شدند');
    } catch (error) {
      logger.warn('خطا در پاکسازی فایل‌های Snap:', error.message);
    }
  }

  // پاکسازی فایل‌های موقت قدیمی
  cleanupOldTempFiles() {
    try {
      if (this.isWindows) {
        // ویندوز - پاکسازی فایل‌های قدیمی‌تر از 24 ساعت
        const tempDir = process.env.TEMP || process.env.TMP || os.tmpdir();
        execSync(`forfiles /p "${tempDir}" /m *.tmp /d -1 /c "cmd /c del @path" 2>nul || echo.`, { timeout: 30000 });
      } else {
        // لینوکس/یونیکس - پاکسازی فایل‌های قدیمی‌تر از 24 ساعت
        execSync('find /tmp -type f -name "*.tmp" -mtime +1 -delete 2>/dev/null || true', { timeout: 30000 });
        execSync('find /tmp -type f -name "core.*" -mtime +1 -delete 2>/dev/null || true', { timeout: 30000 });
      }
      logger.info('فایل‌های موقت قدیمی پاک شدند');
    } catch (error) {
      logger.warn('خطا در پاکسازی فایل‌های موقت قدیمی:', error.message);
    }
  }

  // پاکسازی داده‌های کاربری Chrome
  cleanupChromeUserData() {
    try {
      if (this.isWindows) {
        // ویندوز
        const tempDir = process.env.TEMP || process.env.TMP || os.tmpdir();
        execSync(`forfiles /p "${tempDir}" /m "scoped_dir*" /c "cmd /c rmdir /s /q @path" 2>nul || echo.`, { timeout: 30000 });
      } else {
        // لینوکس/یونیکس
        execSync('find /tmp -name "scoped_dir*" -type d -mmin +60 -exec rm -rf {} + 2>/dev/null || true', { timeout: 30000 });
      }
      logger.info('داده‌های موقت Chrome پاک شدند');
    } catch (error) {
      logger.warn('خطا در پاکسازی داده‌های Chrome:', error.message);
    }
  }

  // تنظیم handler های خروج
  setupExitHandlers() {
    const exitHandler = () => {
      logger.info('پاکسازی نهایی فایل‌های موقت...');
      try {
        this.cleanupPuppeteerProfiles();
        this.cleanupChromeUserData();
      } catch (error) {
        // ignore cleanup errors during exit
      }
    };

    process.on('exit', exitHandler);
    process.on('SIGINT', () => {
      exitHandler();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      exitHandler();
      process.exit(0);
    });
  }

  // دریافت آمار فضای استفاده شده
  async getTempSpaceStats() {
    try {
      const stats = {
        totalTempSize: 0,
        puppeteerProfiles: 0,
        snapFiles: 0,
        otherTempFiles: 0
      };

      if (this.isWindows) {
        // برای ویندوز - استفاده از PowerShell
        const tempDir = process.env.TEMP || process.env.TMP || os.tmpdir();
        try {
          const result = execSync(`powershell "Get-ChildItem '${tempDir}' -Recurse | Measure-Object -Property Length -Sum | Select-Object Sum"`, { encoding: 'utf8', timeout: 10000 });
          const match = result.match(/\d+/);
          if (match) {
            stats.totalTempSize = parseInt(match[0]);
          }
        } catch (error) {
          logger.warn('خطا در محاسبه اندازه فایل‌های موقت:', error.message);
        }
      } else {
        // برای لینوکس/یونیکس
        try {
          const result = execSync('du -sb /tmp 2>/dev/null | cut -f1', { encoding: 'utf8', timeout: 10000 });
          stats.totalTempSize = parseInt(result.trim()) || 0;
        } catch (error) {
          logger.warn('خطا در محاسبه اندازه /tmp:', error.message);
        }
      }

      return stats;
    } catch (error) {
      logger.error('خطا در دریافت آمار فضای موقت:', error);
      return null;
    }
  }

  // تنظیم فاصله زمانی پاکسازی
  setCleanupInterval(intervalMs) {
    this.cleanupInterval = intervalMs;
    if (this.isRunning && this.timer) {
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        this.cleanup();
      }, this.cleanupInterval);
    }
    logger.info(`فاصله زمانی پاکسازی تنظیم شد: ${intervalMs}ms`);
  }
}

// Singleton instance
const tempCleanupService = new TempCleanupService();

module.exports = tempCleanupService;
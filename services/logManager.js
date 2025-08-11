const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const crypto = require('crypto');

class LogManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.setMaxListeners(50); // افزایش حد مجاز listener ها
    
    this.options = {
      logDir: options.logDir || path.join(process.cwd(), 'logs'),
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: options.maxFiles || 10,
      rotationInterval: options.rotationInterval || 24 * 60 * 60 * 1000, // 24 ساعت
      compressionEnabled: options.compressionEnabled || true,
      retentionDays: options.retentionDays || 30,
      bufferSize: options.bufferSize || 1000,
      flushInterval: options.flushInterval || 5000, // 5 ثانیه
      logLevels: options.logLevels || ['error', 'warn', 'info', 'debug'],
      enableMetrics: options.enableMetrics !== false,
      enableStructuredLogging: options.enableStructuredLogging !== false,
      ...options
    };
    
    // سطوح لاگ
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    // بافرهای لاگ
    this.buffers = new Map();
    
    // آمار
    this.metrics = {
      totalLogs: 0,
      logsByLevel: {},
      logsByCategory: {},
      errors: 0,
      lastFlush: Date.now(),
      bufferSize: 0
    };
    
    // تایمرها
    this.flushTimer = null;
    this.rotationTimer = null;
    this.cleanupTimer = null;
    
    // وضعیت
    this.isInitialized = false;
    this.isShuttingDown = false;
    
    // مقداردهی اولیه
    this.init();
  }

  // مقداردهی اولیه
  async init() {
    try {
      // ایجاد دایرکتوری لاگ
      await this.ensureLogDirectory();
      
      // شروع flush دوره‌ای
      this.startPeriodicFlush();
      
      // شروع rotation دوره‌ای
      this.startPeriodicRotation();
      
      // شروع cleanup دوره‌ای
      this.startPeriodicCleanup();
      
      // مقداردهی آمار
      this.initMetrics();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('Log Manager راه‌اندازی شد');
      
    } catch (error) {
      console.error('خطا در راه‌اندازی Log Manager:', error);
      throw error;
    }
  }

  // اطمینان از وجود دایرکتوری لاگ
  async ensureLogDirectory() {
    try {
      await fs.access(this.options.logDir);
    } catch (error) {
      await fs.mkdir(this.options.logDir, { recursive: true });
    }
  }

  // مقداردهی آمار
  initMetrics() {
    Object.keys(this.levels).forEach(level => {
      this.metrics.logsByLevel[level] = 0;
    });
  }

  // ثبت لاگ
  async log(level, message, meta = {}, category = 'general') {
    if (!this.isInitialized || this.isShuttingDown) {
      return;
    }
    
    // بررسی سطح لاگ
    if (!this.shouldLog(level)) {
      return;
    }
    
    const logEntry = this.createLogEntry(level, message, meta, category);
    
    // اضافه کردن به بافر
    await this.addToBuffer(logEntry, category);
    
    // به‌روزرسانی آمار
    this.updateMetrics(level, category);
    
    // emit رویداد
    this.emit('log', logEntry);
    
    // flush فوری برای خطاهای بحرانی
    if (level === 'error') {
      await this.flush();
    }
  }

  // بررسی نیاز به ثبت لاگ
  shouldLog(level) {
    return this.options.logLevels.includes(level);
  }

  // ایجاد ورودی لاگ
  createLogEntry(level, message, meta, category) {
    const timestamp = new Date().toISOString();
    const id = crypto.randomBytes(8).toString('hex');
    
    const baseEntry = {
      id,
      timestamp,
      level,
      category,
      message,
      pid: process.pid,
      hostname: require('os').hostname()
    };
    
    if (this.options.enableStructuredLogging) {
      return {
        ...baseEntry,
        meta: meta || {},
        stack: level === 'error' && meta.stack ? meta.stack : undefined
      };
    } else {
      // فرمت ساده
      const metaStr = Object.keys(meta || {}).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return {
        ...baseEntry,
        formatted: `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`
      };
    }
  }

  // اضافه کردن به بافر
  async addToBuffer(logEntry, category) {
    if (!this.buffers.has(category)) {
      this.buffers.set(category, []);
    }
    
    const buffer = this.buffers.get(category);
    buffer.push(logEntry);
    
    this.metrics.bufferSize++;
    
    // بررسی نیاز به flush
    if (buffer.length >= this.options.bufferSize) {
      await this.flushCategory(category);
    }
  }

  // به‌روزرسانی آمار
  updateMetrics(level, category) {
    this.metrics.totalLogs++;
    this.metrics.logsByLevel[level] = (this.metrics.logsByLevel[level] || 0) + 1;
    this.metrics.logsByCategory[category] = (this.metrics.logsByCategory[category] || 0) + 1;
    
    if (level === 'error') {
      this.metrics.errors++;
    }
  }

  // flush همه بافرها
  async flush() {
    if (this.isShuttingDown) {
      return;
    }
    
    const categories = Array.from(this.buffers.keys());
    
    for (const category of categories) {
      await this.flushCategory(category);
    }
    
    this.metrics.lastFlush = Date.now();
    this.emit('flushed');
  }

  // flush یک دسته خاص
  async flushCategory(category) {
    const buffer = this.buffers.get(category);
    
    if (!buffer || buffer.length === 0) {
      return;
    }
    
    try {
      const filename = this.getLogFilename(category);
      const filepath = path.join(this.options.logDir, filename);
      
      // تبدیل لاگ‌ها به رشته
      const logLines = buffer.map(entry => {
        if (this.options.enableStructuredLogging) {
          return JSON.stringify(entry);
        } else {
          return entry.formatted;
        }
      }).join('\n') + '\n';
      
      // نوشتن به فایل
      await fs.appendFile(filepath, logLines, 'utf8');
      
      // پاک کردن بافر
      buffer.length = 0;
      this.metrics.bufferSize -= buffer.length;
      
      // بررسی نیاز به rotation
      await this.checkRotation(filepath, category);
      
    } catch (error) {
      console.error(`خطا در flush لاگ دسته ${category}:`, error);
      this.emit('error', error);
    }
  }

  // دریافت نام فایل لاگ
  getLogFilename(category, date = new Date()) {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `${category}-${dateStr}.log`;
  }

  // بررسی نیاز به rotation
  async checkRotation(filepath, category) {
    try {
      const stats = await fs.stat(filepath);
      
      if (stats.size >= this.options.maxFileSize) {
        await this.rotateFile(filepath, category);
      }
    } catch (error) {
      // فایل وجود ندارد، نیازی به rotation نیست
    }
  }

  // rotation فایل
  async rotateFile(filepath, category) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = path.extname(filepath);
      const basename = path.basename(filepath, ext);
      const dirname = path.dirname(filepath);
      
      const rotatedFilename = `${basename}-${timestamp}${ext}`;
      const rotatedPath = path.join(dirname, rotatedFilename);
      
      // تغییر نام فایل فعلی
      await fs.rename(filepath, rotatedPath);
      
      // فشرده‌سازی در صورت فعال بودن
      if (this.options.compressionEnabled) {
        await this.compressFile(rotatedPath);
      }
      
      this.emit('rotated', { category, oldPath: filepath, newPath: rotatedPath });
      
      // پاکسازی فایل‌های قدیمی
      await this.cleanupOldFiles(category);
      
    } catch (error) {
      console.error(`خطا در rotation فایل ${filepath}:`, error);
      this.emit('error', error);
    }
  }

  // فشرده‌سازی فایل
  async compressFile(filepath) {
    try {
      const zlib = require('zlib');
      const { pipeline } = require('stream/promises');
      
      const readStream = require('fs').createReadStream(filepath);
      const gzipStream = zlib.createGzip();
      const writeStream = require('fs').createWriteStream(filepath + '.gz');
      
      await pipeline(readStream, gzipStream, writeStream);
      
      // حذف فایل اصلی
      await fs.unlink(filepath);
      
    } catch (error) {
      console.error(`خطا در فشرده‌سازی فایل ${filepath}:`, error);
    }
  }

  // پاکسازی فایل‌های قدیمی
  async cleanupOldFiles(category) {
    try {
      const files = await fs.readdir(this.options.logDir);
      const categoryFiles = files
        .filter(file => file.startsWith(category + '-'))
        .map(file => ({
          name: file,
          path: path.join(this.options.logDir, file),
          stat: null
        }));
      
      // دریافت آمار فایل‌ها
      for (const file of categoryFiles) {
        try {
          file.stat = await fs.stat(file.path);
        } catch (error) {
          // فایل وجود ندارد
        }
      }
      
      // مرتب‌سازی بر اساس تاریخ تغییر
      const validFiles = categoryFiles
        .filter(file => file.stat)
        .sort((a, b) => b.stat.mtime - a.stat.mtime);
      
      // حذف فایل‌های اضافی
      if (validFiles.length > this.options.maxFiles) {
        const filesToDelete = validFiles.slice(this.options.maxFiles);
        
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
          this.emit('fileDeleted', { path: file.path, reason: 'max_files_exceeded' });
        }
      }
      
      // حذف فایل‌های قدیمی بر اساس تاریخ
      const cutoffDate = new Date(Date.now() - (this.options.retentionDays * 24 * 60 * 60 * 1000));
      
      for (const file of validFiles) {
        if (file.stat.mtime < cutoffDate) {
          await fs.unlink(file.path);
          this.emit('fileDeleted', { path: file.path, reason: 'retention_expired' });
        }
      }
      
    } catch (error) {
      console.error(`خطا در پاکسازی فایل‌های قدیمی دسته ${category}:`, error);
    }
  }

  // شروع flush دوره‌ای
  startPeriodicFlush() {
    this.flushTimer = setInterval(async () => {
      await this.flush();
    }, this.options.flushInterval);
  }

  // شروع rotation دوره‌ای
  startPeriodicRotation() {
    this.rotationTimer = setInterval(async () => {
      await this.checkAllFilesForRotation();
    }, this.options.rotationInterval);
  }

  // شروع cleanup دوره‌ای
  startPeriodicCleanup() {
    this.cleanupTimer = setInterval(async () => {
      const categories = Array.from(this.buffers.keys());
      for (const category of categories) {
        await this.cleanupOldFiles(category);
      }
    }, 24 * 60 * 60 * 1000); // روزانه
  }

  // بررسی همه فایل‌ها برای rotation
  async checkAllFilesForRotation() {
    try {
      const files = await fs.readdir(this.options.logDir);
      
      for (const file of files) {
        if (file.endsWith('.log')) {
          const filepath = path.join(this.options.logDir, file);
          const category = file.split('-')[0];
          await this.checkRotation(filepath, category);
        }
      }
    } catch (error) {
      console.error('خطا در بررسی فایل‌ها برای rotation:', error);
    }
  }

  // دریافت آمار
  getMetrics() {
    return {
      ...this.metrics,
      bufferSizes: Object.fromEntries(
        Array.from(this.buffers.entries()).map(([category, buffer]) => [
          category,
          buffer.length
        ])
      ),
      uptime: Date.now() - this.metrics.lastFlush,
      isInitialized: this.isInitialized,
      isShuttingDown: this.isShuttingDown
    };
  }

  // جستجو در لاگ‌ها
  async searchLogs(query, options = {}) {
    const {
      category = null,
      level = null,
      startDate = null,
      endDate = null,
      limit = 100
    } = options;
    
    try {
      const files = await fs.readdir(this.options.logDir);
      const results = [];
      
      for (const file of files) {
        if (category && !file.startsWith(category + '-')) {
          continue;
        }
        
        if (!file.endsWith('.log')) {
          continue;
        }
        
        const filepath = path.join(this.options.logDir, file);
        const content = await fs.readFile(filepath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            let logEntry;
            
            if (this.options.enableStructuredLogging) {
              logEntry = JSON.parse(line);
            } else {
              // پارس ساده برای فرمت غیرساختاری
              const match = line.match(/\[(.*?)\] (\w+): (.*)/);
              if (match) {
                logEntry = {
                  timestamp: match[1],
                  level: match[2].toLowerCase(),
                  message: match[3]
                };
              }
            }
            
            if (!logEntry) continue;
            
            // فیلتر بر اساس سطح
            if (level && logEntry.level !== level) {
              continue;
            }
            
            // فیلتر بر اساس تاریخ
            const logDate = new Date(logEntry.timestamp);
            if (startDate && logDate < new Date(startDate)) {
              continue;
            }
            if (endDate && logDate > new Date(endDate)) {
              continue;
            }
            
            // جستجو در متن
            if (query && !logEntry.message.toLowerCase().includes(query.toLowerCase())) {
              continue;
            }
            
            results.push(logEntry);
            
            if (results.length >= limit) {
              break;
            }
            
          } catch (parseError) {
            // خط قابل پارس نیست
          }
        }
        
        if (results.length >= limit) {
          break;
        }
      }
      
      return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
    } catch (error) {
      console.error('خطا در جستجوی لاگ‌ها:', error);
      return [];
    }
  }

  // متدهای کمکی برای سطوح مختلف لاگ
  async error(message, meta = {}, category = 'general') {
    return this.log('error', message, meta, category);
  }

  async warn(message, meta = {}, category = 'general') {
    return this.log('warn', message, meta, category);
  }

  async info(message, meta = {}, category = 'general') {
    return this.log('info', message, meta, category);
  }

  async debug(message, meta = {}, category = 'general') {
    return this.log('debug', message, meta, category);
  }

  // خاموش کردن
  async shutdown() {
    this.isShuttingDown = true;
    
    // پاک کردن تایمرها
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // flush نهایی
    await this.flush();
    
    this.emit('shutdown');
    this.removeAllListeners();
    
    console.log('Log Manager خاموش شد');
  }
}

// Singleton instance
const logManager = new LogManager();

module.exports = {
  LogManager,
  logManager
};
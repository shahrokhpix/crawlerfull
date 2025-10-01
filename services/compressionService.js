const zlib = require('zlib');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const database = require('../config/database');

class CompressionService {
  constructor() {
    this.db = database.getDb();
    this.compressionLevel = 6; // متعادل بین سرعت و فشردگی
    this.batchSize = 100; // تعداد مقالات در هر دسته
    this.oldDataThreshold = 30; // روز
    this.maxContentLength = 50000; // حداکثر طول محتوا قبل از فشردگی
  }

  // فشرده‌سازی داده‌های قدیمی
  async compressOldData(options = {}) {
    const {
      daysOld = this.oldDataThreshold,
      batchSize = this.batchSize,
      dryRun = false
    } = options;

    logger.info(`شروع فشرده‌سازی داده‌های قدیمی‌تر از ${daysOld} روز...`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffTimestamp = cutoffDate.toISOString();

    let totalProcessed = 0;
    let totalCompressed = 0;
    let totalSaved = 0;

    try {
      // دریافت مقالات قدیمی که فشرده نشده‌اند
      const articles = await this.getUncompressedOldArticles(cutoffTimestamp, batchSize);
      
      if (articles.length === 0) {
        logger.info('هیچ مقاله‌ای برای فشردگی یافت نشد');
        return { processed: 0, compressed: 0, saved: 0 };
      }

      logger.info(`${articles.length} مقاله برای فشردگی یافت شد`);

      // پردازش دسته‌ای
      for (let i = 0; i < articles.length; i += batchSize) {
        const batch = articles.slice(i, i + batchSize);
        const batchResult = await this.compressBatch(batch, dryRun);
        
        totalProcessed += batchResult.processed;
        totalCompressed += batchResult.compressed;
        totalSaved += batchResult.saved;

        // استراحت کوتاه بین دسته‌ها
        await this.sleep(100);
      }

      // فشردگی فایل‌های لاگ قدیمی
      const logResult = await this.compressOldLogs(daysOld, dryRun);
      totalSaved += logResult.saved;

      // پاکسازی داده‌های موقت
      await this.cleanupTempData(dryRun);

      const result = {
        processed: totalProcessed,
        compressed: totalCompressed,
        saved: totalSaved,
        savedMB: Math.round(totalSaved / 1024 / 1024 * 100) / 100
      };

      logger.info(`فشردگی تکمیل شد: ${result.compressed}/${result.processed} مقاله، ${result.savedMB}MB ذخیره شد`);
      return result;

    } catch (error) {
      logger.error('خطا در فشردگی داده‌ها:', error);
      throw error;
    }
  }

  // دریافت مقالات قدیمی فشرده نشده
  async getUncompressedOldArticles(cutoffTimestamp, limit) {
    try {
      const query = `
        SELECT id, title, content, link, created_at
        FROM articles 
        WHERE created_at < $1 
        AND (compressed IS NULL OR compressed = false)
        AND content IS NOT NULL 
        AND LENGTH(content) > 1000
        ORDER BY created_at ASC
        LIMIT $2
      `;
      
      const result = await this.db.query(query, [cutoffTimestamp, limit]);
      return result.rows || [];
    } catch (error) {
      logger.error('خطا در دریافت مقالات قدیمی:', error);
      return [];
    }
  }

  // فشردگی دسته‌ای مقالات
  async compressBatch(articles, dryRun = false) {
    let processed = 0;
    let compressed = 0;
    let saved = 0;

    for (const article of articles) {
      try {
        processed++;
        
        if (!article.content || article.content.length < 1000) {
          continue; // رد کردن محتوای کوتاه
        }

        const originalSize = Buffer.byteLength(article.content, 'utf8');
        
        // فشردگی محتوا
        const compressedContent = await this.compressText(article.content);
        const compressedSize = compressedContent.length;
        
        const savedBytes = originalSize - compressedSize;
        const compressionRatio = (savedBytes / originalSize) * 100;

        // ذخیره فقط اگر فشردگی مؤثر باشد (حداقل 20% کاهش)
        if (compressionRatio > 20 && !dryRun) {
          await this.updateCompressedArticle(article.id, compressedContent);
          compressed++;
          saved += savedBytes;
          
          logger.debug(`مقاله ${article.id} فشرده شد: ${Math.round(compressionRatio)}% کاهش`);
        } else if (compressionRatio > 20) {
          // حالت تست
          compressed++;
          saved += savedBytes;
        }

      } catch (error) {
        logger.warn(`خطا در فشردگی مقاله ${article.id}:`, error.message);
      }
    }

    return { processed, compressed, saved };
  }

  // فشردگی متن
  async compressText(text) {
    return new Promise((resolve, reject) => {
      zlib.gzip(text, { level: this.compressionLevel }, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed);
      });
    });
  }

  // باز کردن متن فشرده
  async decompressText(compressedData) {
    return new Promise((resolve, reject) => {
      zlib.gunzip(compressedData, (err, decompressed) => {
        if (err) reject(err);
        else resolve(decompressed.toString('utf8'));
      });
    });
  }

  // به‌روزرسانی مقاله فشرده شده
  async updateCompressedArticle(articleId, compressedContent) {
    try {
      const query = `
        UPDATE articles 
        SET content = $1, compressed = true, compressed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      
      await this.db.query(query, [compressedContent, articleId]);
    } catch (error) {
      logger.error('خطا در به‌روزرسانی مقاله فشرده شده:', error);
      throw error;
    }
  }

  // فشردگی فایل‌های لاگ قدیمی
  async compressOldLogs(daysOld, dryRun = false) {
    const logsDir = path.join(__dirname, '..', 'logs');
    let totalSaved = 0;

    try {
      const files = await fs.readdir(logsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      for (const file of files) {
        if (!file.endsWith('.log') || file.endsWith('.gz')) continue;

        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          const saved = await this.compressLogFile(filePath, dryRun);
          totalSaved += saved;
        }
      }

      if (totalSaved > 0) {
        logger.info(`فایل‌های لاگ فشرده شدند: ${Math.round(totalSaved / 1024)}KB ذخیره شد`);
      }

    } catch (error) {
      logger.warn('خطا در فشردگی فایل‌های لاگ:', error.message);
    }

    return { saved: totalSaved };
  }

  // فشردگی یک فایل لاگ
  async compressLogFile(filePath, dryRun = false) {
    try {
      const content = await fs.readFile(filePath);
      const originalSize = content.length;
      
      if (originalSize < 1024) return 0; // رد کردن فایل‌های کوچک

      const compressed = await new Promise((resolve, reject) => {
        zlib.gzip(content, { level: this.compressionLevel }, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const compressedSize = compressed.length;
      const saved = originalSize - compressedSize;

      if (saved > originalSize * 0.3 && !dryRun) { // حداقل 30% کاهش
        const compressedPath = filePath + '.gz';
        await fs.writeFile(compressedPath, compressed);
        await fs.unlink(filePath);
        
        logger.debug(`فایل لاگ فشرده شد: ${path.basename(filePath)}`);
        return saved;
      }

      return dryRun ? saved : 0;

    } catch (error) {
      logger.warn(`خطا در فشردگی فایل ${filePath}:`, error.message);
      return 0;
    }
  }

  // پاکسازی داده‌های موقت
  async cleanupTempData(dryRun = false) {
    if (dryRun) return;

    try {
      // پاکسازی مقالات تکراری
      await this.removeDuplicateArticles();
      
      // پاکسازی مقالات خالی
      await this.removeEmptyArticles();
      
      // بهینه‌سازی دیتابیس
      await this.optimizeDatabase();
      
      logger.info('پاکسازی داده‌های موقت تکمیل شد');
      
    } catch (error) {
      logger.warn('خطا در پاکسازی داده‌های موقت:', error.message);
    }
  }

  // حذف مقالات تکراری
  async removeDuplicateArticles() {
    try {
      const query = `
        DELETE FROM articles 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM articles 
          GROUP BY hash
        )
      `;
      
      await this.db.query(query);
      logger.info('مقالات تکراری حذف شدند');
    } catch (error) {
      logger.error('خطا در حذف مقالات تکراری:', error);
      throw error;
    }
  }

  // حذف مقالات خالی
  async removeEmptyArticles() {
    try {
      const query = `
        DELETE FROM articles 
        WHERE (content IS NULL OR content = '' OR LENGTH(content) < 100)
        AND created_at < NOW() - INTERVAL '7 days'
      `;
      
      await this.db.query(query);
      logger.info('مقالات خالی حذف شدند');
    } catch (error) {
      logger.error('خطا در حذف مقالات خالی:', error);
      throw error;
    }
  }

  // بهینه‌سازی دیتابیس
  async optimizeDatabase() {
    try {
      // PostgreSQL از VACUUM استفاده می‌کند
      await this.db.query('VACUUM ANALYZE');
      logger.info('دیتابیس بهینه‌سازی شد');
    } catch (error) {
      logger.error('خطا در بهینه‌سازی دیتابیس:', error);
      throw error;
    }
  }

  // دریافت محتوای فشرده شده
  async getCompressedContent(articleId) {
    try {
      const query = `
        SELECT content, compressed 
        FROM articles 
        WHERE id = $1
      `;
      
      const result = await this.db.query(query, [articleId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      
      if (row.compressed) {
        const decompressed = await this.decompressText(row.content);
        return decompressed;
      } else {
        return row.content;
      }
    } catch (error) {
      logger.error('خطا در دریافت محتوای فشرده شده:', error);
      throw error;
    }
  }

  // آمار فشردگی
  async getCompressionStats() {
    try {
      const query = `
        SELECT 
          COUNT(*)::int as total_articles,
          SUM(CASE WHEN compressed = true THEN 1 ELSE 0 END)::int as compressed_articles,
          AVG(CASE WHEN compressed = true THEN LENGTH(content) ELSE NULL END)::numeric as avg_compressed_size,
          AVG(CASE WHEN compressed = false OR compressed IS NULL THEN LENGTH(content) ELSE NULL END)::numeric as avg_uncompressed_size
        FROM articles 
        WHERE content IS NOT NULL
      `;
      
      const result = await this.db.query(query);
      const stats = result.rows[0] || {};
      
      const compressionRatio = stats.avg_uncompressed_size && stats.avg_compressed_size 
        ? ((stats.avg_uncompressed_size - stats.avg_compressed_size) / stats.avg_uncompressed_size * 100)
        : 0;
      
      return {
        totalArticles: stats.total_articles || 0,
        compressedArticles: stats.compressed_articles || 0,
        compressionRatio: Math.round(compressionRatio * 100) / 100,
        avgCompressedSize: Math.round(stats.avg_compressed_size || 0),
        avgUncompressedSize: Math.round(stats.avg_uncompressed_size || 0)
      };
    } catch (error) {
      logger.error('خطا در دریافت آمار فشردگی:', error);
      return {
        totalArticles: 0,
        compressedArticles: 0,
        compressionRatio: 0,
        avgCompressedSize: 0,
        avgUncompressedSize: 0
      };
    }
  }

  // تابع کمکی برای sleep
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CompressionService;
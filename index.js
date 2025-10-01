const express = require("express");
const puppeteer = require("puppeteer");
const fs = require('fs');
const { Feed } = require('feed');
const crypto = require('crypto');
const path = require('path');

// Import our new modules
const config = require('./config/config');
const Database = require('./config/database');
const Logger = require('./utils/logger');
const UniversalCrawler = require('./services/crawler');
const AuthMiddleware = require('./middleware/auth');
const cookieParser = require('cookie-parser');
const { globalErrorHandler, setupProcessErrorHandlers } = require('./middleware/errorHandler');
const apiRoutes = require('./routes/api');
const scheduler = require('./services/scheduler');
const cleanup = require('./services/cleanup');
const QueueManager = require('./services/queueManager');
const CompressionService = require('./services/compressionService');
const PerformanceMonitor = require('./services/performanceMonitor');

// Import new performance and reliability services
const memoryManager = require('./services/memoryManager');
const connectionPool = require('./services/connectionPool');
const cacheManager = require('./services/cacheManager');
const rateLimiter = require('./services/rateLimiter');
const circuitBreakerManager = require('./services/circuitBreakerManager');
const logManager = require('./services/logManager');
const SelectorBuilderWebSocket = require('./services/selectorBuilderWebSocket');

// Import new optimization services
const WebDriverOptimizer = require('./services/webDriverOptimizer');
const DatabaseOptimizer = require('./services/databaseOptimizer');
const LoadBalancerCron = require('./services/loadBalancerCron');
const StabilityManager = require('./services/stabilityManager');

const app = express();
const PORT = process.env.PORT || 3004;

// Initialize components
const database = Database; // Database is already an instance
const logger = Logger; // Logger is already an instance
const crawler = new UniversalCrawler(config.webDriver.defaultType);
const auth = AuthMiddleware; // AuthMiddleware is already an instance

// Initialize optimization services
const webDriverOptimizer = new WebDriverOptimizer();
const databaseOptimizer = new DatabaseOptimizer();
const loadBalancerCron = new LoadBalancerCron();
const stabilityManager = new StabilityManager();

// Initialize reliability services
global.cacheManager = cacheManager;
global.rateLimiter = rateLimiter;
global.circuitBreakerManager = circuitBreakerManager;
global.logManager = logManager;
global.memoryManager = memoryManager;
global.connectionPool = connectionPool;
global.webDriverOptimizer = webDriverOptimizer;
global.databaseOptimizer = databaseOptimizer;
global.loadBalancerCron = loadBalancerCron;
global.stabilityManager = stabilityManager;

// Initialize performance systems with delay to ensure database tables are created
let queueManager, compressionService;

// Initialize services after database tables are ready
setTimeout(async () => {
  try {
    // بهینه‌سازی دیتابیس
    await databaseOptimizer.optimize();
    
    queueManager = new QueueManager();
    compressionService = new CompressionService();
    
    // Make services globally available
    global.queueManager = queueManager;
    global.compressionService = compressionService;
    
    console.log('ℹ️ سیستم‌های عملکرد آماده شدند...');
    
    // شروع load balancer cron jobs
    loadBalancerCron.start();
    console.log('ℹ️ سیستم مدیریت بار فعال شد...');
    
    // Schedule automatic compression
    setInterval(() => {
      queueManager.addJob({
        type: 'compression',
        options: { daysOld: 30 }
      }, 'low');
    }, 24 * 60 * 60 * 1000); // روزانه
    
    // Schedule automatic cleanup
    setInterval(() => {
      queueManager.addJob({
        type: 'cleanup',
        options: {}
      }, 'low');
    }, 6 * 60 * 60 * 1000); // هر 6 ساعت
    
    // Schedule database optimization
    setInterval(async () => {
      try {
        await databaseOptimizer.cleanupOldData();
        await databaseOptimizer.analyzeTables();
      } catch (error) {
        logger.error('خطا در بهینه‌سازی دوره‌ای دیتابیس:', error);
      }
    }, 12 * 60 * 60 * 1000); // هر 12 ساعت
    
  } catch (error) {
    logger.error('خطا در راه‌اندازی سیستم‌های عملکرد:', error);
  }
}, 2000); // افزایش delay برای اطمینان از آماده بودن دیتابیس

// Initialize performance monitor after database tables are ready
setTimeout(() => {
  const performanceMonitor = new PerformanceMonitor();
  global.performanceMonitor = performanceMonitor;
  
  // Start performance monitoring
  performanceMonitor.startMonitoring();
  console.log('ℹ️ شروع مانیتورینگ عملکرد...');
  
  // Setup performance alerts
  performanceMonitor.on('alert', (alert) => {
    logger.warn(`🚨 هشدار عملکرد: ${alert.message}`);
    
    // اقدامات خودکار بر اساس نوع هشدار
    if (alert.type === 'memory' && alert.level === 'critical') {
      // فشردگی اضطراری
      if (global.queueManager) {
        global.queueManager.addJob({
          type: 'compression',
          options: { daysOld: 7, emergency: true }
        }, 'high');
      }
      
      // پاکسازی cache
      if (global.cacheManager) {
        global.cacheManager.clearAll();
      }
      
      // پاکسازی cache دیتابیس
      if (global.databaseOptimizer) {
        global.databaseOptimizer.clearCache();
      }
      
      // تنظیم حالت اضطراری در load balancer
      if (global.loadBalancerCron) {
        global.loadBalancerCron.loadBalancer.setLoadMode('emergency');
      }
    }
    
    if (alert.type === 'database' && alert.level === 'warning') {
      // بهینه‌سازی دیتابیس
      if (global.databaseOptimizer) {
        global.databaseOptimizer.analyzeTables();
      }
    }
  });
  
  // Setup memory manager alerts
  memoryManager.on('alert', (alert) => {
    logger.warn(`🚨 هشدار حافظه: ${alert.message}`);
    
    if (alert.level === 'emergency') {
      // اقدامات اضطراری
      if (global.webDriverOptimizer) {
        global.webDriverOptimizer.close();
      }
      
      if (global.databaseOptimizer) {
        global.databaseOptimizer.clearCache();
      }
      
      // تنظیم حالت اضطراری در load balancer
      if (global.loadBalancerCron) {
        global.loadBalancerCron.loadBalancer.setLoadMode('emergency');
      }
    }
  });
  
  // Setup load balancer events
  if (global.loadBalancerCron) {
    global.loadBalancerCron.loadBalancer.on('loadModeChange', (data) => {
      logger.info(`🔄 تغییر حالت بار: ${data.previousMode} → ${data.newMode}`);
      
      // تنظیم تعداد کرال‌های همزمان
      if (global.crawler) {
        global.crawler.maxConcurrentCrawls = data.config.concurrentCrawls;
      }
    });
    
    global.loadBalancerCron.loadBalancer.on('loadCheck', (data) => {
      if (data.level !== 'normal') {
        logger.warn(`⚠️ بار سیستم: ${data.level} - CPU: ${data.stats.cpu}%, Memory: ${data.stats.memory}%`);
      }
    });
  }
  
}, 3000);

// Start stability manager after all services are initialized
setTimeout(() => {
  stabilityManager.start();
  console.log('🛡️ مدیریت پایداری فعال شد');
}, 5000);

// Use the same database as the crawler service
const db = database.getDb();

// Database tables are already created by database.js
// No need for legacy table creation

// Database is already initialized in the module
logger.info('New database system initialized successfully');

// Middleware
app.use(express.json());
app.use(cookieParser());

// Set proper MIME types for static files
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=UTF-8');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    }
  }
}));

app.use('/admin', express.static(path.join(__dirname, 'public', 'admin'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=UTF-8');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    }
  }
}));

// Root route - redirect to admin
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Ensure /admin returns index.html (without trailing slash)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Also provide a basic health endpoint for Docker and uptime checks
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// API Routes - New system
// Block invalid CDN requests
app.use('/cdn-cgi', (req, res) => {
  res.status(404).json({ error: 'CDN resource not found' });
});

app.use('/api', apiRoutes);

// Setup process error handlers
setupProcessErrorHandlers();

// Error handling middleware (must be last)
app.use(globalErrorHandler);

// Performance alerts will be setup after monitor initialization

// Automatic scheduling will be setup after services initialization

// Load and start cron jobs
scheduler.loadSchedules();

// Routes already defined above

// Helper function to generate hash for article
function generateHash(title, link) {
  return crypto.createHash('md5').update(title + link).digest('hex');
}

// Helper function to extract article content and internal links
async function extractArticleContent(page, url) {
  try {
    // تنظیم زبان فارسی برای صفحه
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7'
    });
    
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const result = await page.evaluate(() => {
      // Try different selectors for article content
      const selectors = [
        'article .content',
        '.article-content',
        '.news-content',
        '.post-content',
        '[class*="content"]',
        'main p',
        '.entry-content'
      ];
      
      let content = '';
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > 100) {
          content = element.textContent.trim();
          break;
        }
      }
      
      // Fallback: get all paragraphs
      if (!content) {
        const paragraphs = Array.from(document.querySelectorAll('p'));
        const text = paragraphs
          .map(p => p.textContent.trim())
          .filter(text => text.length > 20)
          .join(' ');
        
        content = text.length > 100 ? text : 'محتوای مقاله قابل استخراج نیست';
      }
      
      // Extract internal links from the article
      const internalLinks = [];
      const links = document.querySelectorAll('a[href]');
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        const title = link.textContent?.trim();
        
        if (href && title && title.length > 10) {
          // Check if it's an internal farsnews link
          if (href.includes('farsnews.ir') || href.startsWith('/')) {
            const fullLink = href.startsWith('http') ? href : `https://www.farsnews.ir${href}`;
            
            // Avoid duplicate links and self-references
            if (!internalLinks.some(l => l.link === fullLink) && fullLink !== window.location.href) {
              internalLinks.push({
                title: title,
                link: fullLink
              });
            }
          }
        }
      });
      
      return {
        content: content,
        internalLinks: internalLinks.slice(0, 5) // Limit to 5 internal links per article
      };
    });
    
    return result;
  } catch (error) {
    console.log(`Error extracting content from ${url}:`, error.message);
    return {
      content: 'خطا در استخراج محتوا',
      internalLinks: []
    };
  }
}

// Helper function to crawl internal links recursively
async function crawlInternalLinks(page, links, maxDepth = 1, currentDepth = 0) {
  if (currentDepth >= maxDepth || links.length === 0) {
    return [];
  }
  
  const crawledArticles = [];
  
  for (const link of links.slice(0, 3)) { // Limit to 3 links per level
    try {
      console.log(`  Crawling internal link (depth ${currentDepth + 1}): ${link.title}`);
      
      const result = await extractArticleContent(page, link.link);
      
      const article = {
        title: link.title,
        link: link.link,
        content: result.content,
        summary: result.content.substring(0, 200) + '...',
        published_date: new Date().toISOString(),
        depth: currentDepth + 1
      };
      
      crawledArticles.push(article);
      
      // Recursively crawl deeper if there are more internal links
      if (result.internalLinks && result.internalLinks.length > 0 && currentDepth + 1 < maxDepth) {
        const deeperArticles = await crawlInternalLinks(page, result.internalLinks, maxDepth, currentDepth + 1);
        crawledArticles.push(...deeperArticles);
      }
      
    } catch (error) {
      console.error(`Error crawling internal link ${link.link}:`, error.message);
    }
  }
  
  return crawledArticles;
}

// Helper function to validate article content
function validateArticleContent(article) {
  // بررسی وجود عنوان
  if (!article.title || article.title.trim().length < 10) {
    return false;
  }

  // بررسی وجود لینک
  if (!article.link || !article.link.startsWith('http')) {
    return false;
  }

  // بررسی وجود محتوا
  if (!article.content || article.content.trim().length < 50) {
    return false;
  }

  // بررسی اینکه محتوا فقط شامل فضای خالی، نقطه یا خط تیره نباشد
  const cleanContent = article.content.trim().replace(/[\s\n\r\t\.\-_]+/g, '');
  if (cleanContent.length < 20) {
    return false;
  }

  // بررسی اینکه محتوا شامل کلمات معنادار باشد
  const words = article.content.trim().split(/\s+/);
  if (words.length < 10) {
    return false;
  }

  return true;
}

// Helper function to save article to database
function saveArticle(article) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = database.db;
      
      if (!article.title || !article.link) {
        resolve({ saved: false, reason: 'invalid_data' });
        return;
      }

      const hash = generateHash(article.title, article.link);
      
      // Check if article already exists
      const existingResult = await db.query('SELECT id FROM articles WHERE hash = $1', [hash]);
      
      if (existingResult.length > 0) {
        // Article already exists
        resolve({ saved: false, reason: 'exists' });
        return;
      }
      
      // Insert new article
      const insertResult = await db.query(`
        INSERT INTO articles 
        (title, link, content, summary, published_date, crawled_date, hash, is_new, depth) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
        RETURNING id
      `, [
        article.title,
        article.link,
        article.content || '',
        article.summary || article.title,
        article.published_date || new Date().toISOString(),
        new Date().toISOString(),
        hash,
        article.depth || 0
      ]);
      
      resolve({ saved: true, id: insertResult.rows?.[0]?.id });
      
    } catch (error) {
      reject(error);
    }
  });
}

app.get("/api/farsnews", async (req, res) => {
  try {
    const crawlWithContent = req.query.full === 'true';
    const maxArticles = parseInt(req.query.limit) || 10;
    const crawlDepth = parseInt(req.query.depth) || 0;
    
    console.log(`🚀 Legacy farsnews API called with limit=${maxArticles}, full=${crawlWithContent}, depth=${crawlDepth}`);
    
    // Use UniversalCrawler instead of direct puppeteer
    const crawler = new UniversalCrawler('puppeteer');
    
    const options = {
      limit: maxArticles,
      crawlDepth: crawlDepth,
      fullContent: crawlWithContent,
      waitTime: 3000,
      timeout: crawlDepth > 0 ? 180000 : 60000,
      followLinks: crawlDepth > 0
    };
    
    // Get Farsnews source ID dynamically (fallback to first active)
    let sourceId = null;
    
    try {
      const db = database.getDb();
      const sourceResult = await db.query(
        "SELECT id FROM news_sources WHERE name IN ('فارس‌نیوز','farsnews','farsnews.ir') AND active = true ORDER BY id ASC LIMIT 1"
      );
      if (sourceResult.rows && sourceResult.rows.length > 0) {
        sourceId = sourceResult.rows[0].id;
      } else {
        const anyActive = await db.query("SELECT id FROM news_sources WHERE active = true ORDER BY id ASC LIMIT 1");
        sourceId = anyActive.rows?.[0]?.id || null;
      }
    } catch (dbError) {
      logger.warn('Could not get source ID from database:', dbError.message);
    }
    
    if (!sourceId) {
      return res.status(404).json({ success: false, message: 'هیچ منبع فعالی یافت نشد' });
    }
    
    console.log(`🎯 Starting crawl with source ID: ${sourceId}`);
    console.log(`⚙️ Options:`, options);
    
    const result = await crawler.crawlSource(sourceId, options);
    
    console.log(`✅ Crawl completed:`, {
      success: result.success,
      source: result.source,
      totalProcessed: result.totalProcessed,
      newArticles: result.newArticles
    });
    
    // Format response to match legacy API format
    const response = {
      success: result.success || true,
      source: result.source || "فارس‌نیوز",
      totalFound: result.totalFound || 0,
      processed: result.processed || 0,
      internalArticlesCrawled: result.internalArticlesCrawled || 0,
      totalProcessed: result.totalProcessed || 0,
      newArticles: result.newArticles || 0,
      crawlDepth: crawlDepth,
      mainArticles: result.mainArticles || [],
      internalArticles: result.internalArticles || [],
      articles: result.articles || [] // Combined for backward compatibility
    };
    
    if (result.error) {
      response.error = result.error;
      response.success = false;
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API to get stored articles
app.get('/api/articles', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const onlyNew = req.query.new === 'true';
    
    let query = 'SELECT * FROM articles';
    let params = [];
    
    if (onlyNew) {
      query += ' WHERE is_new = true';
    }
    
    query += ' ORDER BY crawled_date DESC LIMIT $1';
    params.push(limit);
    
    const rows = await db.query(query, params);
    
    res.json({
      success: true,
      count: rows.length,
      articles: rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API to mark articles as read (not new)
app.post('/api/articles/mark-read', async (req, res) => {
  try {
    await db.query('UPDATE articles SET is_new = false');
    res.json({ success: true, message: 'All articles marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API to get crawl statistics
app.get('/api/stats', async (req, res) => {
  try {
    const queries = {
      totalArticles: "SELECT COUNT(*)::int as count FROM articles",
      // Treat 'new' as unread in our schema
      newArticles: "SELECT COUNT(*)::int as count FROM articles WHERE is_read = false",
      // Count recent crawls in last 24 hours
      recentCrawls: "SELECT COUNT(*)::int as count FROM crawl_history WHERE created_at >= NOW() - INTERVAL '24 hours'",
      // Top sources by article count
      topSources: `
        SELECT ns.id, ns.name, COUNT(a.id)::int AS article_count
        FROM news_sources ns
        LEFT JOIN articles a ON a.source_id = ns.id
        GROUP BY ns.id, ns.name
        ORDER BY article_count DESC
        LIMIT 5
      `,
      // Recent activity messages from crawl_logs
      recentActivity: `
        SELECT message, created_at as timestamp
        FROM crawl_logs
        ORDER BY id DESC
        LIMIT 10
      `
    };

    const results = {};

    // Execute queries in parallel
    const [
      totalArticlesResult,
      newArticlesResult,
      recentCrawlsCountResult,
      topSourcesResult,
      recentActivityResult,
    ] = await Promise.all([
      db.query(queries.totalArticles),
      db.query(queries.newArticles),
      db.query(queries.recentCrawls),
      db.query(queries.topSources),
      db.query(queries.recentActivity),
    ]);

    results.totalArticles = parseInt(totalArticlesResult.rows?.[0]?.count || 0);
    results.newArticles = parseInt(newArticlesResult.rows?.[0]?.count || 0);
    results.recentCrawls = parseInt(recentCrawlsCountResult.rows?.[0]?.count || 0);
    results.topSources = topSourcesResult.rows || [];
    results.recentActivity = recentActivityResult.rows || [];

    res.json({ success: true, stats: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to create feed
function createFeed(articles, baseUrl) {
  const feed = new Feed({
    title: process.env.RSS_TITLE || 'فارس نیوز - اخبار',
    description: process.env.RSS_DESCRIPTION || 'آخرین اخبار از منابع مختلف',
    id: baseUrl,
    link: baseUrl,
    language: process.env.RSS_LANGUAGE || 'fa-IR',
    image: `${baseUrl}/favicon.ico`,
    favicon: `${baseUrl}/favicon.ico`,
    copyright: process.env.RSS_COPYRIGHT || '© 2024 FarsNews Crawler',
    updated: new Date(),
    generator: 'FarsNews Crawler RSS Generator',
    feedLinks: {
      rss2: `${baseUrl}/rss`,
      json: `${baseUrl}/feed.json`,
      atom: `${baseUrl}/atom.xml`
    },
    author: {
      name: 'FarsNews Crawler',
      email: 'admin@farsnews-crawler.local',
      link: baseUrl
    },
    ttl: parseInt(process.env.RSS_TTL) || 60
  });
  
  articles.forEach(article => {
    feed.addItem({
      title: article.title || 'بدون عنوان',
      id: article.link || `${baseUrl}/article/${article.id}`,
      link: article.link || `${baseUrl}/article/${article.id}`,
      description: article.summary || article.title || 'محتوای خلاصه در دسترس نیست',
      content: article.content || article.summary || article.title || 'محتوای کامل در دسترس نیست',
      author: [{
        name: 'FarsNews Crawler',
        email: 'admin@farsnews-crawler.local',
        link: baseUrl
      }],
      date: new Date(article.published_date || article.crawled_date),
      image: article.image_url || null
    });
  });
  
  return feed;
}

// RSS Feed endpoint
app.get('/rss', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const rows = await db.query('SELECT * FROM articles ORDER BY crawled_date DESC LIMIT $1', [limit]);
    
    const feed = createFeed(rows, `http://localhost:${PORT}`);
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(feed.rss2());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atom Feed endpoint
app.get('/atom.xml', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const rows = await db.query('SELECT * FROM articles ORDER BY crawled_date DESC LIMIT $1', [limit]);
    
    const feed = createFeed(rows, `http://localhost:${PORT}`);
    res.set('Content-Type', 'application/atom+xml; charset=utf-8');
    res.send(feed.atom1());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// JSON Feed endpoint
app.get('/feed.json', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const rows = await db.query('SELECT * FROM articles ORDER BY crawled_date DESC LIMIT $1', [limit]);
    
    const feed = createFeed(rows, `http://localhost:${PORT}`);
    res.set('Content-Type', 'application/feed+json; charset=utf-8');
    res.send(feed.json1());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API to get a specific article
app.get('/api/articles/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    const result = await db.query('SELECT * FROM articles WHERE id = $1', [id]);
    const row = result.rows?.[0];
    
    if (!row) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }
    
    res.json({
      success: true,
      article: row
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`);
  console.log(`🔧 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`📰 RSS Feed available at: http://localhost:${PORT}/rss`);
  console.log(`📊 API Endpoints:`);
  console.log(`   Legacy Endpoints:`);
  console.log(`   GET /api/farsnews - Crawl new articles`);
  console.log(`   GET /api/farsnews?full=true&limit=5 - Crawl with full content`);
  console.log(`   GET /api/articles - Get stored articles`);
  console.log(`   GET /api/articles?new=true - Get only new articles`);
  console.log(`   GET /api/stats - Get crawl statistics`);
  console.log(`   GET /rss - RSS feed`);
  console.log(``);
  
  // راه‌اندازی WebSocket server برای Selector Builder
  try {
    const selectorBuilderWS = new SelectorBuilderWebSocket(3006);
    console.log(`🔌 Selector Builder WebSocket server started on port 3006`);
  } catch (error) {
    console.error('خطا در راه‌اندازی WebSocket server:', error);
  }

  // راه‌اندازی WebSocket برای لاگ‌های realtime
  try {
    const WebSocket = require('ws');
    const logsWSS = new WebSocket.Server({ 
      port: 3007,
      path: '/ws/logs'
    });

    logsWSS.on('connection', (ws, req) => {
      console.log('🔌 اتصال WebSocket لاگ‌ها برقرار شد');
      
      // ارسال پیام خوش‌آمدگویی
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'اتصال WebSocket لاگ‌ها برقرار شد',
        timestamp: new Date().toISOString()
      }));

      ws.on('close', () => {
        console.log('🔌 اتصال WebSocket لاگ‌ها بسته شد');
      });

      ws.on('error', (error) => {
        console.error('خطا در WebSocket لاگ‌ها:', error);
      });
    });

    // ذخیره WebSocket server برای استفاده در logger
    global.logsWebSocketServer = logsWSS;
    console.log(`🔌 WebSocket server برای لاگ‌ها راه‌اندازی شد`);
  } catch (error) {
    console.error('خطا در راه‌اندازی WebSocket لاگ‌ها:', error);
  }
  console.log(`   New Universal Crawler API:`);
  console.log(`   POST /api/auth/login - Admin login`);
  console.log(`   GET /api/sources - Manage news sources`);
  console.log(`   POST /api/crawler/crawl - Universal crawler`);
  console.log(`   POST /api/crawler/test-selector - Test selectors`);
  console.log(`   GET /api/logs - View crawl logs`);
  console.log(``);
  console.log(`👤 Default admin: username=admin, password=admin123`);
  
  // شروع زمانبندی‌های پاک‌سازی
  await cleanup.startAllJobs();
});


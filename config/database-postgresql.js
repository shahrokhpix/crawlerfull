const { Pool } = require('pg');
const Logger = require('../utils/logger');

class PostgreSQLDatabase {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'crawler_user',
      host: process.env.DB_HOST || 'postgres',
      database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
      password: process.env.DB_PASSWORD || '8bmh8y19zNJahAv5Aa4B',
      port: parseInt(process.env.DB_PORT) || 5432,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('connect', () => {
      Logger.info('✅ Connected to PostgreSQL database');
    });

    this.pool.on('error', (err) => {
      Logger.error('❌ PostgreSQL connection error:', err);
    });
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      Logger.info(`📊 Query executed in ${duration}ms: ${text.substring(0, 50)}...`);
      return result;
    } catch (error) {
      Logger.error('❌ Database query error:', error);
      throw error;
    }
  }

  // ==================== NEWS SOURCES ====================
  
  async getSources() {
    const result = await this.query('SELECT * FROM news_sources WHERE active = true ORDER BY id');
    return result.rows;
  }

  async getSourceById(id) {
    const result = await this.query('SELECT * FROM news_sources WHERE id = $1', [id]);
    const rows = result.rows || [];
    return rows[0];
  }

  async createSource(source) {
    const {
      name, base_url, list_selector, title_selector, content_selector,
      link_selector, lead_selector, router_selector, title_selectors = '[]',
      content_selectors = '[]', lead_selectors = '[]', router_selectors = '[]',
      driver_type = 'puppeteer', active = true
    } = source;

    const result = await this.query(`
      INSERT INTO news_sources (
        name, base_url, list_selector, title_selector, content_selector,
        link_selector, lead_selector, router_selector, title_selectors,
        content_selectors, lead_selectors, router_selectors, driver_type,
        active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *
    `, [
      name, base_url, list_selector, title_selector, content_selector,
      link_selector, lead_selector, router_selector, title_selectors,
      content_selectors, lead_selectors, router_selectors, driver_type, active
    ]);

    return result.rows[0];
  }

  async updateSource(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.query(`
      UPDATE news_sources 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    return result.rows[0];
  }

  // ==================== ARTICLES ====================
  
  async saveArticle(article) {
    const { 
      source_id, title, link, content, lead, router, hash, 
      depth = 0, is_read = false, compressed = 0 
    } = article;
    
    const result = await this.query(`
      INSERT INTO articles (
        source_id, title, link, content, lead, router, hash, 
        depth, is_read, compressed, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (link) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        lead = EXCLUDED.lead,
        router = EXCLUDED.router,
        hash = EXCLUDED.hash,
        depth = EXCLUDED.depth,
        updated_at = NOW()
      RETURNING id
    `, [source_id, title, link, content, lead || '', router || '', hash, depth, is_read, compressed]);
    
    const rows = result.rows || [];
    return rows[0];
  }

  async getArticles(limit = 100, offset = 0, filters = {}) {
    let query = `
      SELECT a.*, s.name as source_name 
      FROM articles a 
      JOIN news_sources s ON a.source_id = s.id 
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.source_id) {
      query += ` AND a.source_id = $${paramCount}`;
      params.push(filters.source_id);
      paramCount++;
    }

    if (filters.is_read !== undefined) {
      query += ` AND a.is_read = $${paramCount}`;
      params.push(filters.is_read);
      paramCount++;
    }

    if (filters.compressed !== undefined) {
      query += ` AND a.compressed = $${paramCount}`;
      params.push(filters.compressed);
      paramCount++;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await this.query(query, params);
    return result.rows;
  }

  async getArticleByHash(hash) {
    const result = await this.query('SELECT * FROM articles WHERE hash = $1', [hash]);
    const rows = result.rows || [];
    return rows[0];
  }

  async getArticleById(id) {
    const result = await this.query('SELECT * FROM articles WHERE id = $1', [id]);
    return result.rows[0];
  }

  async markArticleAsRead(id) {
    await this.query('UPDATE articles SET is_read = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  async compressArticle(id) {
    await this.query(`
      UPDATE articles 
      SET compressed = 1, compressed_at = NOW(), updated_at = NOW() 
      WHERE id = $1
    `, [id]);
  }

  // ==================== CRAWL HISTORY ====================
  
  async saveCrawlHistory(history) {
    const { 
      source_id, total_found = 0, total_processed = 0, 
      new_articles = 0, crawl_depth = 0, duration_ms 
    } = history;
    
    const result = await this.query(`
      INSERT INTO crawl_history (
        source_id, total_found, total_processed, new_articles, 
        crawl_depth, duration_ms, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id
    `, [source_id, total_found, total_processed, new_articles, crawl_depth, duration_ms]);
    
    const rows = result.rows || [];
    return rows[0];
  }

  async getCrawlHistory(source_id = null, limit = 100) {
    let query = 'SELECT * FROM crawl_history';
    const params = [];

    if (source_id) {
      query += ' WHERE source_id = $1';
      params.push(source_id);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.query(query, params);
    return result.rows;
  }

  // ==================== CRAWL LOGS ====================
  
  async saveCrawlLog(log) {
    const { 
      source_id, action, status, message, 
      articles_found = 0, articles_processed = 0, duration_ms 
    } = log;
    
    await this.query(`
      INSERT INTO crawl_logs (
        source_id, action, status, message, articles_found, 
        articles_processed, duration_ms, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [source_id, action, status, message, articles_found, articles_processed, duration_ms]);
  }

  async getCrawlLogs(source_id = null, limit = 100) {
    let query = 'SELECT * FROM crawl_logs';
    const params = [];

    if (source_id) {
      query += ' WHERE source_id = $1';
      params.push(source_id);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.query(query, params);
    return result.rows;
  }

  // ==================== OPERATION LOGS ====================
  
  async saveOperationLog(log) {
    const { source_id, action, status, message, details } = log;
    
    await this.query(`
      INSERT INTO operation_logs (source_id, action, status, message, details, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [source_id, action, status, message, details || null]);
  }

  async getOperationLogs(source_id = null, limit = 100) {
    let query = 'SELECT * FROM operation_logs';
    const params = [];

    if (source_id) {
      query += ' WHERE source_id = $1';
      params.push(source_id);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.query(query, params);
    return result.rows;
  }

  // ==================== PERFORMANCE METRICS ====================
  
  async savePerformanceMetric(metric) {
    const { timestamp, metric_type, metric_name, value, metadata } = metric;
    
    await this.query(`
      INSERT INTO performance_metrics (timestamp, metric_type, metric_name, value, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [timestamp, metric_type, metric_name, value, metadata ? JSON.stringify(metadata) : null]);
  }

  async getPerformanceMetrics(limit = 100, metric_type = null) {
    let query = 'SELECT * FROM performance_metrics';
    const params = [];

    if (metric_type) {
      query += ' WHERE metric_type = $1';
      params.push(metric_type);
    }

    query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.query(query, params);
    return result.rows;
  }

  // ==================== SCHEDULES ====================
  
  async getSchedules(active = null) {
    let query = 'SELECT s.*, ns.name as source_name FROM schedules s JOIN news_sources ns ON s.source_id = ns.id';
    const params = [];

    if (active !== null) {
      query += ' WHERE s.active = $1';
      params.push(active);
    }

    query += ' ORDER BY s.id';

    const result = await this.query(query, params);
    return result.rows;
  }

  async createSchedule(schedule) {
    const {
      source_id, cron_expression, active = true, crawl_depth = 1,
      full_content = false, article_limit = 10, timeout_ms = 30000,
      follow_links = true
    } = schedule;

    const result = await this.query(`
      INSERT INTO schedules (
        source_id, cron_expression, active, crawl_depth, full_content,
        article_limit, timeout_ms, follow_links, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [source_id, cron_expression, active, crawl_depth, full_content, article_limit, timeout_ms, follow_links]);

    return result.rows[0];
  }

  async updateSchedule(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.query(`
      UPDATE schedules 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    return result.rows[0];
  }

  async updateScheduleRun(id, last_run, next_run) {
    await this.query(`
      UPDATE schedules 
      SET last_run = $1, next_run = $2, updated_at = NOW()
      WHERE id = $3
    `, [last_run, next_run, id]);
  }

  // ==================== CLEANUP SCHEDULES ====================
  
  async getCleanupSchedules(active = null) {
    let query = 'SELECT * FROM cleanup_schedules';
    const params = [];

    if (active !== null) {
      query += ' WHERE is_active = $1';
      params.push(active);
    }

    query += ' ORDER BY id';

    const result = await this.query(query, params);
    return result.rows;
  }

  async createCleanupSchedule(schedule) {
    const {
      name, cron_expression, keep_articles_count = 1000, is_active = true
    } = schedule;

    const result = await this.query(`
      INSERT INTO cleanup_schedules (
        name, cron_expression, keep_articles_count, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `, [name, cron_expression, keep_articles_count, is_active]);

    return result.rows[0];
  }

  async updateCleanupScheduleRun(id, last_run, next_run) {
    await this.query(`
      UPDATE cleanup_schedules 
      SET last_run = $1, next_run = $2, updated_at = NOW()
      WHERE id = $3
    `, [last_run, next_run, id]);
  }

  // ==================== QUEUE JOBS ====================
  
  async createQueueJob(job) {
    const { id, type, priority = 'normal', data, created_at } = job;
    
    await this.query(`
      INSERT INTO queue_jobs (id, type, priority, status, data, attempts, created_at, updated_at)
      VALUES ($1, $2, $3, 'queued', $4, 0, $5, NOW())
    `, [id, type, priority, JSON.stringify(data), created_at]);
  }

  async getQueueJob(id) {
    const result = await this.query('SELECT * FROM queue_jobs WHERE id = $1', [id]);
    return result.rows[0];
  }

  async updateQueueJobStatus(id, status, updates = {}) {
    const fields = [`status = $2`];
    const values = [id, status];
    let paramCount = 3;

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    fields.push(`updated_at = NOW()`);

    await this.query(`
      UPDATE queue_jobs 
      SET ${fields.join(', ')}
      WHERE id = $1
    `, values);
  }

  async getQueuedJobs(limit = 10) {
    const result = await this.query(`
      SELECT * FROM queue_jobs 
      WHERE status = 'queued' 
      ORDER BY 
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'normal' THEN 2 
          WHEN 'low' THEN 3 
        END,
        created_at ASC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  // ==================== ADMIN USERS ====================
  
  async getAdminUser(username) {
    const result = await this.query('SELECT * FROM admin_users WHERE username = $1 AND active = true', [username]);
    return result.rows[0];
  }

  async createAdminUser(user) {
    const { username, password_hash, email } = user;
    
    const result = await this.query(`
      INSERT INTO admin_users (username, password_hash, email, active, created_at)
      VALUES ($1, $2, $3, true, NOW())
      RETURNING id, username, email, active, created_at
    `, [username, password_hash, email]);

    return result.rows[0];
  }

  // ==================== SELECTOR CONFIGS ====================
  
  async getSelectorConfigs() {
    const result = await this.query('SELECT * FROM selector_configs ORDER BY created_at DESC');
    return result.rows;
  }

  async createSelectorConfig(config) {
    const { name, url, selectors, description } = config;
    
    const result = await this.query(`
      INSERT INTO selector_configs (name, url, selectors, description, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `, [name, url, JSON.stringify(selectors), description]);

    return result.rows[0];
  }

  // ==================== CLEANUP & MAINTENANCE ====================
  
  async cleanup(keep_articles_count = 1000) {
    // Delete old articles, keeping only the most recent ones per source
    await this.query(`
      DELETE FROM articles 
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY created_at DESC) as rn
          FROM articles
        ) t
        WHERE rn <= $1
      )
    `, [keep_articles_count]);
    
    // Delete old performance metrics (older than 7 days)
    await this.query(`
      DELETE FROM performance_metrics 
      WHERE timestamp < EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
    `);
    
    // Delete old crawl logs (older than 14 days)
    await this.query(`
      DELETE FROM crawl_logs 
      WHERE created_at < NOW() - INTERVAL '14 days'
    `);

    // Delete old operation logs (older than 14 days)
    await this.query(`
      DELETE FROM operation_logs 
      WHERE created_at < NOW() - INTERVAL '14 days'
    `);

    // Delete completed/failed queue jobs (older than 24 hours)
    await this.query(`
      DELETE FROM queue_jobs 
      WHERE status IN ('completed', 'failed') 
      AND updated_at < NOW() - INTERVAL '24 hours'
    `);
  }

  async getStats() {
    const articlesCount = await this.query('SELECT COUNT(*) as count FROM articles');
    const sourcesCount = await this.query('SELECT COUNT(*) as count FROM news_sources WHERE active = true');
    const schedulesCount = await this.query('SELECT COUNT(*) as count FROM schedules WHERE active = true');
    const queuedJobsCount = await this.query('SELECT COUNT(*) as count FROM queue_jobs WHERE status = \'queued\'');

    return {
      articles: parseInt(articlesCount.rows[0].count),
      sources: parseInt(sourcesCount.rows[0].count),
      schedules: parseInt(schedulesCount.rows[0].count),
      queuedJobs: parseInt(queuedJobsCount.rows[0].count)
    };
  }

  async close() {
    await this.pool.end();
    Logger.info('📊 PostgreSQL connection pool closed');
  }
}

module.exports = new PostgreSQLDatabase();
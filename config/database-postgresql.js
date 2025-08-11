const { Pool } = require('pg');
const Logger = require('../utils/logger');

class PostgreSQLDatabase {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'crawler_user',
      host: process.env.DB_HOST || 'postgres',
      database: process.env.DB_NAME || 'crawler_db',
      password: process.env.DB_PASSWORD || 'your_secure_password',
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

  async getSources() {
    const result = await this.query('SELECT * FROM news_sources WHERE active = true ORDER BY id');
    return result.rows;
  }

  async getSourceById(id) {
    const result = await this.query('SELECT * FROM news_sources WHERE id = $1', [id]);
    const rows = result.rows || [];
    return rows[0];
  }

  async saveArticle(article) {
    const { source_id, title, link, content, hash, depth = 0 } = article;
    
    const result = await this.query(`
      INSERT INTO articles (source_id, title, link, content, hash, depth, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (link) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        hash = EXCLUDED.hash,
        updated_at = NOW()
      RETURNING id
    `, [source_id, title, link, content, hash, depth]);
    
    const rows = result.rows || [];
    return rows[0];
  }

  async getArticles(limit = 100, offset = 0) {
    const result = await this.query(`
      SELECT a.*, s.name as source_name 
      FROM articles a 
      JOIN news_sources s ON a.source_id = s.id 
      ORDER BY a.created_at DESC 
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
  }

  async getArticleByHash(hash) {
    const result = await this.query('SELECT * FROM articles WHERE hash = $1', [hash]);
    const rows = result.rows || [];
    return rows[0];
  }

  async saveCrawlHistory(history) {
    const { source_id, articles_found, articles_saved, errors, status } = history;
    
    const result = await this.query(`
      INSERT INTO crawl_history (source_id, articles_found, articles_saved, errors, status, start_time, end_time)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id
    `, [source_id, articles_found, articles_saved, errors, status]);
    
    const rows = result.rows || [];
    return rows[0];
  }

  async savePerformanceMetric(metric) {
    const { timestamp, metric_type, metric_name, value, metadata } = metric;
    
    await this.query(`
      INSERT INTO performance_metrics (timestamp, metric_type, metric_name, value, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [timestamp, metric_type, metric_name, value, metadata ? JSON.stringify(metadata) : null]);
  }

  async getPerformanceMetrics(limit = 100) {
    const result = await this.query(`
      SELECT * FROM performance_metrics 
      ORDER BY timestamp DESC 
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  async cleanup() {
    // Delete old articles (older than 30 days)
    await this.query(`
      DELETE FROM articles 
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);
    
    // Delete old performance metrics (older than 7 days)
    await this.query(`
      DELETE FROM performance_metrics 
      WHERE timestamp < EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
    `);
    
    // Delete old crawl history (older than 14 days)
    await this.query(`
      DELETE FROM crawl_history 
      WHERE start_time < NOW() - INTERVAL '14 days'
    `);
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = new PostgreSQLDatabase(); 
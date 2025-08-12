-- PostgreSQL Initial Setup Script for FarsNews Crawler
-- This script runs when the PostgreSQL container starts for the first time

-- Create database if not exists (already created by environment variables)
-- CREATE DATABASE farsnews_crawler_spider_db;

-- Connect to the database
\c farsnews_crawler_spider_db;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create tables
CREATE TABLE IF NOT EXISTS news_sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL,
  list_selector TEXT NOT NULL,
  title_selector TEXT,
  content_selector TEXT,
  link_selector TEXT,
  lead_selector TEXT,
  router_selector TEXT,
  title_selectors TEXT DEFAULT '[]',
  content_selectors TEXT DEFAULT '[]',
  lead_selectors TEXT DEFAULT '[]',
  router_selectors TEXT DEFAULT '[]',
  driver_type TEXT DEFAULT 'puppeteer',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES news_sources(id),
  title TEXT NOT NULL,
  link TEXT NOT NULL UNIQUE,
  content TEXT,
  hash TEXT UNIQUE,
  depth INTEGER DEFAULT 0,
  is_read BOOLEAN DEFAULT FALSE,
  compressed INTEGER DEFAULT 0,
  compressed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'queued',
  data TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at BIGINT,
  completed_at BIGINT,
  failed_at BIGINT
);

CREATE TABLE IF NOT EXISTS performance_metrics (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value REAL NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS selector_configs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  selectors TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crawl_logs (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES news_sources(id),
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  articles_found INTEGER DEFAULT 0,
  articles_processed INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES news_sources(id),
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crawl_history (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES news_sources(id),
  total_found INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  new_articles INTEGER DEFAULT 0,
  crawl_depth INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES news_sources(id),
  cron_expression TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  crawl_depth INTEGER DEFAULT 1,
  full_content BOOLEAN DEFAULT FALSE,
  article_limit INTEGER DEFAULT 10,
  timeout_ms INTEGER DEFAULT 30000,
  follow_links BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cleanup_schedules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  keep_articles_count INTEGER DEFAULT 1000,
  is_active BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at);
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(hash);
CREATE INDEX IF NOT EXISTS idx_articles_link ON articles(link);
CREATE INDEX IF NOT EXISTS idx_sources_active ON news_sources(active);
CREATE INDEX IF NOT EXISTS idx_crawl_history_timestamp ON crawl_history(created_at);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_queue_status_priority ON queue_jobs(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_source_id ON crawl_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_source_id ON operation_logs(source_id);

-- Insert initial data
INSERT INTO news_sources (name, base_url, list_selector, title_selector, content_selector, link_selector)
VALUES 
  ('فارس‌نیوز', 'https://www.farsnews.ir/showcase', 'a[href*="/news/"]', 'h1, .title', '.story, .content, .news-content, p', 'a'),
  ('مهر-آخرین اخبار', 'https://www.mehrnews.com/news', 'a[href*="/news/"]', 'h1, .title', '.content, .news-content, p', 'a'),
  ('آریا', 'https://www.aryanews.com/news', 'a[href*="/news/"]', 'h1, .title', '.content, .news-content, p', 'a'),
  ('ایرنا', 'https://www.irna.ir/news', 'a[href*="/news/"]', 'h1, .title', '.content, .news-content, p', 'a')
ON CONFLICT (name) DO NOTHING;

-- Insert default admin user (password: admin123)
INSERT INTO admin_users (username, password_hash, email)
VALUES ('admin', '$2a$10$6Pf5M88A/ih16lsZQplsledbO/vIqoIc5QJ49RwLaCHkxqjgk/DQa', 'admin@crawler.local')
ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    email = EXCLUDED.email;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crawler_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crawler_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO crawler_user;

-- Analyze tables for better query planning
ANALYZE;

-- Log completion
\echo 'PostgreSQL setup completed successfully!' 
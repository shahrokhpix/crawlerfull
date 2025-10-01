-- PostgreSQL Initial Setup Script for FarsNews Crawler
-- This script runs when the PostgreSQL container starts for the first time
-- Uses complete database template from existing system

-- Connect to the database
\c farsnews_crawler_spider_db;

-- Import complete database structure and data from template
\i /docker-entrypoint-initdb.d/database-template.sql
const { Pool } = require('pg');

// PostgreSQL Configuration
const pool = new Pool({
  user: 'farsnews_user',
  host: 'localhost',
  database: 'crawler_db',
  password: 'farsnews123',
  port: 5432,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool; 
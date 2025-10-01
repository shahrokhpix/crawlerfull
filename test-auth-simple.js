const { Pool } = require('pg');

async function testAuthSimple() {
  const pool = new Pool({
    user: process.env.DB_USER || 'crawler_user',
    host: process.env.DB_HOST || 'postgres',
    database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
    password: process.env.DB_PASSWORD || '8bmh8y19zNJahAv5Aa4B',
    port: parseInt(process.env.DB_PORT) || 5432,
  });

  try {
    console.log('🔍 تست ساده auth...');
    
    // تست 1: بررسی کاربر admin
    const query = `SELECT * FROM admin_users WHERE username = 'admin' AND active = true`;
    console.log('📝 Query:', query);
    
    const result = await pool.query(query);
    console.log('✅ نتیجه:', result.rows);
    console.log('📊 تعداد رکوردها:', result.rows.length);
    
    if (result.rows.length > 0) {
      console.log('👤 کاربر یافت شد:', {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email,
        active: result.rows[0].active
      });
    } else {
      console.log('❌ کاربر یافت نشد');
    }
    
  } catch (error) {
    console.error('❌ خطا:', error);
  } finally {
    await pool.end();
  }
}

testAuthSimple(); 
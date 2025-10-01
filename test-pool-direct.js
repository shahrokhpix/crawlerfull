const { Pool } = require('pg');

async function testPoolDirect() {
  const pool = new Pool({
    user: process.env.DB_USER || 'crawler_user',
    host: process.env.DB_HOST || 'postgres',
    database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
    password: process.env.DB_PASSWORD || '8bmh8y19zNJahAv5Aa4B',
    port: parseInt(process.env.DB_PORT) || 5432,
  });

  try {
    console.log('🔍 تست مستقیم Pool...');
    
    const query = 'SELECT * FROM admin_users WHERE username = $1 AND active = true';
    console.log('📝 Query:', query);
    console.log('📝 Params:', ['admin']);
    
    const result = await pool.query(query, ['admin']);
    console.log('✅ نتیجه Pool:', result.rows);
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

testPoolDirect(); 
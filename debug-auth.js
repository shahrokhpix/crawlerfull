const { Pool } = require('pg');

async function debugAuth() {
  const pool = new Pool({
    user: process.env.DB_USER || 'crawler_user',
    host: process.env.DB_HOST || 'postgres',
    database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
    password: process.env.DB_PASSWORD || '8bmh8y19zNJahAv5Aa4B',
    port: parseInt(process.env.DB_PORT) || 5432,
  });

  try {
    console.log('🔍 تست مستقیم دیتابیس...');
    
    // تست 1: بررسی اتصال
    const testResult = await pool.query('SELECT 1 as test');
    console.log('✅ اتصال دیتابیس:', testResult.rows[0]);
    
    // تست 2: بررسی جدول admin_users
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_users'
      );
    `);
    console.log('✅ جدول admin_users وجود دارد:', tableResult.rows[0].exists);
    
    // تست 3: بررسی کاربر admin
    const userResult = await pool.query('SELECT * FROM admin_users WHERE username = $1', ['admin']);
    console.log('✅ تعداد کاربران admin:', userResult.rows.length);
    
    if (userResult.rows.length > 0) {
      console.log('👤 کاربر admin:', {
        id: userResult.rows[0].id,
        username: userResult.rows[0].username,
        email: userResult.rows[0].email,
        active: userResult.rows[0].active,
        password_hash: userResult.rows[0].password_hash.substring(0, 20) + '...'
      });
    }
    
    // تست 4: بررسی کاربر فعال
    const activeUserResult = await pool.query('SELECT * FROM admin_users WHERE username = $1 AND active = true', ['admin']);
    console.log('✅ تعداد کاربران admin فعال:', activeUserResult.rows.length);
    
  } catch (error) {
    console.error('❌ خطا:', error);
  } finally {
    await pool.end();
  }
}

debugAuth(); 
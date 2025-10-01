const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'crawler_user',
  host: process.env.DB_HOST || 'postgres',
  database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
  password: process.env.DB_PASSWORD || '8bmh8y19zNJahAv5Aa4B',
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function createAdminUser() {
  try {
    // بررسی وجود جدول admin_users
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_users'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ جدول admin_users وجود ندارد. ابتدا باید جداول دیتابیس ایجاد شوند.');
      return;
    }

    // بررسی وجود کاربر ادمین
    const existingUser = await pool.query(
      'SELECT id FROM admin_users WHERE username = $1',
      [process.env.ADMIN_USERNAME || 'admin']
    );

    if (existingUser.rows.length > 0) {
      console.log('✅ کاربر ادمین قبلاً وجود دارد');
      console.log('🔄 به‌روزرسانی رمز عبور...');
      
      // هش کردن رمز عبور با bcrypt
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(
        process.env.ADMIN_PASSWORD || 'admin123', 
        saltRounds
      );

      // به‌روزرسانی رمز عبور
      await pool.query(`
        UPDATE admin_users 
        SET password_hash = $1 
        WHERE username = $2
      `, [hashedPassword, process.env.ADMIN_USERNAME || 'admin']);

      console.log('✅ رمز عبور به‌روزرسانی شد');
      return;
    }

    // هش کردن رمز عبور با bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || 'admin123', 
      saltRounds
    );

    // ایجاد کاربر ادمین
    const result = await pool.query(`
      INSERT INTO admin_users (username, password_hash, email, active)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username
    `, [
      process.env.ADMIN_USERNAME || 'admin',
      hashedPassword,
      'admin@crawler.local',
      true
    ]);

    console.log('✅ کاربر ادمین با موفقیت ایجاد شد:');
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Username: ${result.rows[0].username}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);

  } catch (error) {
    console.error('❌ خطا در ایجاد کاربر ادمین:', error.message);
  } finally {
    await pool.end();
  }
}

// اجرای اسکریپت
createAdminUser();
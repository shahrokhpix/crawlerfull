const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

const JWT_SECRET = process.env.JWT_SECRET || 'crawler-secret-key-2024';
const JWT_EXPIRES_IN = '24h';

class AuthMiddleware {
  // ایجاد توکن JWT
  generateToken(user) {
    return jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        email: user.email 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  // تأیید توکن JWT
  verifyToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'توکن احراز هویت مورد نیاز است' 
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      logger.warn('توکن نامعتبر:', { token: token.substring(0, 20) + '...' });
      return res.status(401).json({ 
        success: false, 
        message: 'توکن نامعتبر است' 
      });
    }
  }

  // ورود کاربر
  async login(username, password) {
    const pool = new Pool({
      user: process.env.DB_USER || 'crawler_user',
      host: process.env.DB_HOST || 'postgres',
      database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
      password: process.env.DB_PASSWORD || '8bmh8y19zNJahAv5Aa4B',
      port: parseInt(process.env.DB_PORT) || 5432,
    });

    try {
      // استفاده از query ساده بدون parameter
      const query = `SELECT * FROM admin_users WHERE username = '${username}' AND active = true`;
      console.log('🔍 Query:', query);
      const result = await pool.query(query);
      console.log('✅ نتیجه:', result.rows);
      const user = result.rows && result.rows.length > 0 ? result.rows[0] : null;
      
      if (!user) {
        return { success: false, message: 'کاربر یافت نشد' };
      }
        
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        logger.warn('تلاش ورود ناموفق:', { username });
        return { success: false, message: 'رمز عبور اشتباه است' };
      }
      
      const token = this.generateToken(user);
      
      logger.info('ورود موفقیت‌آمیز:', { username, userId: user.id });
      
      return {
        success: true,
        message: 'ورود موفقیت‌آمیز',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      };
       
     } catch (error) {
       logger.error('خطا در ورود:', error);
       throw error;
     } finally {
       await pool.end();
     }
   }

  // ایجاد کاربر جدید
  async createUser(userData) {
    const { username, password, email } = userData;
    
    const pool = new Pool({
      user: process.env.DB_USER || 'crawler_user',
      host: process.env.DB_HOST || 'postgres',
      database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
      password: process.env.DB_PASSWORD || '8bmh8y19zNJahAv5Aa4B',
      port: parseInt(process.env.DB_PORT) || 5432,
    });
    
    // لاگ شروع ایجاد کاربر
    logger.info('شروع ایجاد کاربر جدید:', {
      username: username,
      email: email,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      
      const query = `
        INSERT INTO admin_users (username, password_hash, email)
        VALUES ('${username}', '${passwordHash}', '${email}')
        RETURNING id
      `;
      
      const result = await pool.query(query);
      const rows = result.rows || [];
      
      logger.info('کاربر جدید با موفقیت ایجاد شد:', {
        userId: rows[0]?.id,
        username: username
      });
      
      return {
        success: true,
        message: 'کاربر با موفقیت ایجاد شد',
        userId: rows[0]?.id
      };
      
    } catch (err) {
      if (err.code === '23505' || err.message.includes('duplicate key')) {
        logger.warn('تلاش ایجاد کاربر تکراری:', { username });
        return {
          success: false,
          message: 'نام کاربری قبلاً استفاده شده است'
        };
      }
      
      logger.error('خطا در ایجاد کاربر:', err);
      throw err;
    } finally {
      await pool.end();
    }
  }

  // تغییر رمز عبور
  async changePassword(userId, oldPassword, newPassword) {
    const pool = new Pool({
      user: process.env.DB_USER || 'crawler_user',
      host: process.env.DB_HOST || 'postgres',
      database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
      password: process.env.DB_PASSWORD || '8bmh8y19zNJahAv5Aa4B',
      port: parseInt(process.env.DB_PORT) || 5432,
    });
    
    // لاگ شروع تغییر رمز عبور
    logger.info('شروع تغییر رمز عبور:', {
      userId: userId,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    
    try {
      // ابتدا کاربر را پیدا کنیم
      const getUserQuery = `SELECT * FROM admin_users WHERE id = ${userId}`;
      const result = await pool.query(getUserQuery);
      const rows = result.rows || [];
      const user = rows[0];
      
      if (!user) {
        logger.warn('تلاش برای تغییر رمز عبور کاربر ناموجود:', {
          userId: userId,
          timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
        });
        return { success: false, message: 'کاربر یافت نشد' };
      }
      
      // بررسی رمز عبور قدیمی
      const isValidOldPassword = await bcrypt.compare(oldPassword, user.password_hash);
      
      if (!isValidOldPassword) {
        logger.warn('تلاش تغییر رمز عبور با رمز قدیمی اشتباه:', {
          userId: userId,
          timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
        });
        return { success: false, message: 'رمز عبور قدیمی اشتباه است' };
      }
      
      // هش کردن رمز عبور جدید
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      
      // به‌روزرسانی رمز عبور
      const updateQuery = `UPDATE admin_users SET password_hash = '${newPasswordHash}' WHERE id = ${userId}`;
      const updateResult = await pool.query(updateQuery);
      
      if (updateResult.rowCount > 0) {
        logger.info('رمز عبور با موفقیت تغییر کرد:', {
          userId: userId,
          timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
        });
        return { success: true, message: 'رمز عبور با موفقیت تغییر کرد' };
      } else {
        return { success: false, message: 'خطا در تغییر رمز عبور' };
      }
      
    } catch (error) {
      logger.error('خطا در تغییر رمز عبور:', {
        error: error.message,
        userId: userId,
        timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
      });
      throw error;
    } finally {
      await pool.end();
    }
  }

  // دریافت اطلاعات کاربر
  async getUserInfo(userId) {
    const pool = new Pool({
      user: process.env.DB_USER || 'crawler_user',
      host: process.env.DB_HOST || 'postgres',
      database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
      password: process.env.DB_PASSWORD || '8bmh8y19zNJahAv5Aa4B',
      port: parseInt(process.env.DB_PORT) || 5432,
    });
    
    try {
      const query = `SELECT id, username, email, created_at FROM admin_users WHERE id = ${userId} AND active = true`;
      const result = await pool.query(query);
      const rows = result.rows || [];
      return rows[0];
    } catch (error) {
      logger.error('خطا در دریافت اطلاعات کاربر:', error);
      throw error;
    } finally {
      await pool.end();
    }
  }

  // لیست کاربران (فقط برای ادمین اصلی)
  async getAllUsers() {
    const pool = new Pool({
      user: process.env.DB_USER || 'crawler_user',
      host: process.env.DB_HOST || 'postgres',
      database: process.env.DB_NAME || 'farsnews_crawler_spider_db',
      password: process.env.DB_PASSWORD || '8bmh8y19zNJahAv5Aa4B',
      port: parseInt(process.env.DB_PORT) || 5432,
    });
    
    try {
      const query = 'SELECT id, username, email, active, created_at FROM admin_users ORDER BY created_at DESC';
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('خطا در دریافت لیست کاربران:', error);
      throw error;
    } finally {
      await pool.end();
    }
  }

  // Alias for verifyToken for backward compatibility
  requireAuth = (req, res, next) => {
    return this.verifyToken(req, res, next);
  }
}

module.exports = new AuthMiddleware(); 
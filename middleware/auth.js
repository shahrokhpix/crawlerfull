const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const connectionPool = require('../services/connectionPool');
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
    try {
      const query = 'SELECT * FROM admin_users WHERE username = $1 AND active = true';
      const result = await connectionPool.query(query, [username]);
      const rows = result.rows || [];
      const user = rows[0];
      
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
     }
   }

  // ایجاد کاربر جدید
  async createUser(userData) {
    const { username, password, email } = userData;
    
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
        VALUES ($1, $2, $3)
        RETURNING id
      `;
      
      const result = await connectionPool.query(query, [username, passwordHash, email]);
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
    }
  }

  // تغییر رمز عبور
  async changePassword(userId, oldPassword, newPassword) {
    // لاگ شروع تغییر رمز عبور
    logger.info('شروع تغییر رمز عبور:', {
      userId: userId,
      timestamp: moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss')
    });
    
    try {
      // ابتدا کاربر را پیدا کنیم
      const getUserQuery = 'SELECT * FROM admin_users WHERE id = $1';
      const result = await connectionPool.query(getUserQuery, [userId]);
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
      const updateQuery = 'UPDATE admin_users SET password_hash = $1 WHERE id = $2';
      const updateResult = await connectionPool.query(updateQuery, [newPasswordHash, userId]);
      
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
    }
  }

  // دریافت اطلاعات کاربر
  async getUserInfo(userId) {
    try {
      const query = 'SELECT id, username, email, created_at FROM admin_users WHERE id = $1 AND active = true';
      const result = await connectionPool.query(query, [userId]);
      const rows = result.rows || [];
    return rows[0];
    } catch (error) {
      logger.error('خطا در دریافت اطلاعات کاربر:', error);
      throw error;
    }
  }

  // لیست کاربران (فقط برای ادمین اصلی)
  async getAllUsers() {
    try {
      const query = 'SELECT id, username, email, active, created_at FROM admin_users ORDER BY created_at DESC';
      const result = await connectionPool.query(query, []);
      return result.rows;
    } catch (error) {
      logger.error('خطا در دریافت لیست کاربران:', error);
      throw error;
    }
  }

  // Alias for verifyToken for backward compatibility
  requireAuth = (req, res, next) => {
    return this.verifyToken(req, res, next);
  }
}

module.exports = new AuthMiddleware();
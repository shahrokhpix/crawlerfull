const connectionPool = require('./services/connectionPool');

async function testDb() {
  try {
    console.log('🔍 تست اتصال دیتابیس...');
    
    const query = 'SELECT * FROM admin_users WHERE username = $1 AND active = true';
    const result = await connectionPool.query(query, ['admin']);
    
    console.log('✅ نتیجه query:', result);
    console.log('📊 تعداد رکوردها:', result.length);
    
    if (result.length > 0) {
      console.log('👤 کاربر یافت شد:', {
        id: result[0].id,
        username: result[0].username,
        email: result[0].email,
        active: result[0].active
      });
    } else {
      console.log('❌ کاربر یافت نشد');
    }
    
  } catch (error) {
    console.error('❌ خطا:', error);
  } finally {
    await connectionPool.shutdown();
  }
}

testDb(); 
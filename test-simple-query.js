const connectionPool = require('./services/connectionPool');

async function testSimpleQuery() {
  try {
    console.log('🔍 تست query ساده...');
    
    // تست 1: query بدون parameter
    const result1 = await connectionPool.query('SELECT 1 as test');
    console.log('✅ تست 1:', result1);
    
    // تست 2: query ساده
    const result2 = await connectionPool.query('SELECT * FROM admin_users');
    console.log('✅ تست 2 - تعداد کاربران:', result2.length);
    
    // تست 3: query با parameter ساده
    const result3 = await connectionPool.query('SELECT * FROM admin_users WHERE username = $1', ['admin']);
    console.log('✅ تست 3 - کاربر admin:', result3.length);
    
  } catch (error) {
    console.error('❌ خطا:', error);
  } finally {
    await connectionPool.shutdown();
  }
}

testSimpleQuery(); 
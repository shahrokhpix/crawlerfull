const connectionPool = require('./services/connectionPool');

async function testConnectionPool() {
  try {
    console.log('🔍 تست connectionPool...');
    
    const query = 'SELECT * FROM admin_users WHERE username = $1 AND active = true';
    console.log('📝 Query:', query);
    console.log('📝 Params:', ['admin']);
    
    const result = await connectionPool.query(query, ['admin']);
    console.log('✅ نتیجه connectionPool:', result);
    console.log('📊 نوع نتیجه:', typeof result);
    console.log('📊 آیا آرایه است:', Array.isArray(result));
    console.log('📊 طول نتیجه:', result ? result.length : 'null');
    
    if (result && result.length > 0) {
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
    console.error('❌ خطا در connectionPool:', error);
  } finally {
    await connectionPool.shutdown();
  }
}

testConnectionPool(); 
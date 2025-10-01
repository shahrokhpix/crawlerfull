const auth = require('./middleware/auth');

async function testAuthDirect() {
  
  try {
    console.log('🔍 تست مستقیم middleware auth...');
    
    const result = await auth.login('admin', 'rQR7!O9uS@');
    console.log('✅ نتیجه auth:', result);
    
  } catch (error) {
    console.error('❌ خطا در auth:', error);
  }
}

testAuthDirect(); 
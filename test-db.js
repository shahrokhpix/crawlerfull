const Database = require('./config/database');

async function testDatabase() {
  try {
    const db = Database.getDb();
    console.log('Database connection successful');
    
    const result = await db.query("SELECT id, name, base_url, list_selector FROM news_sources WHERE name = 'فارس‌نیوز'");
    console.log('FarsNews source:', JSON.stringify(result.rows, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Database error:', error.message);
    process.exit(1);
  }
}

testDatabase(); 
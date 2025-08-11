const UniversalCrawler = require('./services/crawler');
const Logger = require('./utils/logger');

async function debugCrawl() {
  try {
    console.log('=== شروع دیباگ کرال ===');
    
    const crawler = new UniversalCrawler('puppeteer');
    
    console.log('1. دریافت اطلاعات منبع...');
    const source = await crawler.getSource(1);
    
    if (!source) {
      console.error('منبع یافت نشد!');
      return;
    }
    
    console.log('2. اطلاعات منبع:', {
      id: source.id,
      name: source.name,
      base_url: source.base_url,
      list_selector: source.list_selector,
      title_selector: source.title_selector,
      content_selector: source.content_selector,
      driver_type: source.driver_type
    });
    
    console.log('3. شروع کرال...');
    const options = {
      limit: 2,
      crawlDepth: 0,
      fullContent: true,
      waitTime: 3000,
      timeout: 60000,
      followLinks: false
    };
    
    console.log('4. تنظیمات کرال:', options);
    
    const result = await crawler.crawlSource(1, options);
    
    console.log('5. نتیجه کرال:', JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('خطا در دیباگ کرال:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

debugCrawl(); 
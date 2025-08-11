const UniversalCrawler = require('./services/crawler');
const Logger = require('./utils/logger');

async function testCrawl() {
  try {
    console.log('Starting crawl test...');
    
    const crawler = new UniversalCrawler('puppeteer');
    
    const options = {
      limit: 2,
      crawlDepth: 0,
      fullContent: false,
      waitTime: 3000,
      timeout: 60000,
      followLinks: false
    };
    
    console.log('Crawl options:', options);
    
    const result = await crawler.crawlSource(1, options);
    
    console.log('Crawl result:', JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Crawl error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testCrawl(); 
const puppeteer = require('puppeteer');

async function testPage() {
  let browser = null;
  let page = null;
  
  try {
    console.log('Starting page test...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    page = await browser.newPage();
    
    console.log('Navigating to FarsNews...');
    await page.goto('https://www.farsnews.ir/showcase', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    console.log('Page loaded successfully');
    
    // Test different selectors
    const selectors = [
      'a[href*="/news/"]',
      'a.title',
      '.title a',
      '.story-title a',
      'a[href*="news"]',
      'a'
    ];
    
    for (const selector of selectors) {
      try {
        const elements = await page.$$(selector);
        console.log(`Selector "${selector}": ${elements.length} elements found`);
        
        if (elements.length > 0) {
          const firstElement = elements[0];
          const text = await page.evaluate(el => el.textContent?.trim(), firstElement);
          const href = await page.evaluate(el => el.href, firstElement);
          console.log(`  First element: text="${text?.substring(0, 50)}...", href="${href}"`);
        }
      } catch (error) {
        console.log(`Selector "${selector}": Error - ${error.message}`);
      }
    }
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Get page content length
    const content = await page.evaluate(() => document.body.textContent);
    console.log('Page content length:', content.length);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

testPage(); 
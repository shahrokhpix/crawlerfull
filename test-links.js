const puppeteer = require('puppeteer');

async function testLinks() {
  let browser = null;
  let page = null;
  
  try {
    console.log('Starting links analysis...');
    
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
    
    // Get all links with their text and href
    const links = await page.evaluate(() => {
      const allLinks = document.querySelectorAll('a[href]');
      const linkData = [];
      
      allLinks.forEach((link, index) => {
        const href = link.href;
        const text = link.textContent?.trim();
        const className = link.className;
        const id = link.id;
        
        // Only include links that might be news
        if (text && text.length > 5 && href && !href.includes('javascript:')) {
          linkData.push({
            index,
            text: text.substring(0, 100),
            href,
            className,
            id
          });
        }
      });
      
      return linkData;
    });
    
    console.log(`Found ${links.length} potential news links:`);
    links.forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}" -> ${link.href}`);
      if (link.className) console.log(`   Class: ${link.className}`);
      if (link.id) console.log(`   ID: ${link.id}`);
    });
    
    // Look for patterns in hrefs
    const hrefPatterns = links.map(l => l.href).filter(href => href.includes('farsnews.ir'));
    console.log('\nHref patterns found:');
    hrefPatterns.forEach(href => {
      console.log(`  ${href}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

testLinks(); 
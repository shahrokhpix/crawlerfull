const puppeteer = require('puppeteer');

async function testSimpleSelectors() {
  let browser = null;
  let page = null;
  
  try {
    console.log('=== تست Selector های ساده ===');
    
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
    
    console.log('1. رفتن به صفحه FarsNews...');
    await page.goto('https://www.farsnews.ir/showcase', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    console.log('2. تست selector های ساده...');
    
    // تست list_selector: '.pb-3 a'
    const listElements = await page.$$('.pb-3 a');
    console.log(`   .pb-3 a: ${listElements.length} عنصر یافت شد`);
    
    if (listElements.length > 0) {
      const firstLink = await page.evaluate(el => ({
        text: el.textContent?.trim().substring(0, 50),
        href: el.href
      }), listElements[0]);
      console.log(`   اولین لینک: "${firstLink.text}" -> ${firstLink.href}`);
    }
    
    // تست title_selector: '.prosed'
    const titleElements = await page.$$('.prosed');
    console.log(`   .prosed: ${titleElements.length} عنصر یافت شد`);
    
    if (titleElements.length > 0) {
      const firstTitle = await page.evaluate(el => el.textContent?.trim().substring(0, 50), titleElements[0]);
      console.log(`   اولین عنوان: "${firstTitle}"`);
    }
    
    // تست content_selector: '.pb-2'
    const contentElements = await page.$$('.pb-2');
    console.log(`   .pb-2: ${contentElements.length} عنصر یافت شد`);
    
    if (contentElements.length > 0) {
      const firstContent = await page.evaluate(el => el.textContent?.trim().substring(0, 100), contentElements[0]);
      console.log(`   اولین محتوا: "${firstContent}"`);
    }
    
    // تست ترکیبی: از .pb-3 لینک ها را بگیر
    console.log('3. تست ترکیبی: از .pb-3 لینک ها...');
    const pb3Elements = await page.$$('.pb-3');
    console.log(`   .pb-3: ${pb3Elements.length} عنصر یافت شد`);
    
    for (let i = 0; i < Math.min(pb3Elements.length, 3); i++) {
      const links = await page.evaluate(el => {
        const linkElements = el.querySelectorAll('a');
        return Array.from(linkElements).map(a => ({
          text: a.textContent?.trim().substring(0, 50),
          href: a.href
        }));
      }, pb3Elements[i]);
      
      console.log(`   عنصر ${i + 1}: ${links.length} لینک یافت شد`);
      links.forEach((link, j) => {
        console.log(`     لینک ${j + 1}: "${link.text}" -> ${link.href}`);
      });
    }
    
    // تست عنوان از .prosed
    console.log('4. تست عنوان از .prosed...');
    const prosedElements = await page.$$('.prosed');
    console.log(`   .prosed: ${prosedElements.length} عنصر یافت شد`);
    
    for (let i = 0; i < Math.min(prosedElements.length, 3); i++) {
      const title = await page.evaluate(el => el.textContent?.trim(), prosedElements[i]);
      console.log(`   عنوان ${i + 1}: "${title?.substring(0, 100)}"`);
    }
    
    // تست محتوا از .pb-2
    console.log('5. تست محتوا از .pb-2...');
    const pb2Elements = await page.$$('.pb-2');
    console.log(`   .pb-2: ${pb2Elements.length} عنصر یافت شد`);
    
    for (let i = 0; i < Math.min(pb2Elements.length, 3); i++) {
      const content = await page.evaluate(el => el.textContent?.trim(), pb2Elements[i]);
      console.log(`   محتوا ${i + 1}: "${content?.substring(0, 100)}"`);
    }
    
  } catch (error) {
    console.error('خطا در تست selector ها:', error.message);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

testSimpleSelectors(); 
const axios = require('axios');

class SimpleTest {
  constructor() {
    this.baseUrl = 'http://localhost:3004';
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errors: [],
      responseTimes: [],
      startTime: Date.now()
    };
  }

  // اجرای تست ساده
  async runSimpleTest() {
    console.log('🚀 شروع تست ساده...');
    console.log('📊 تست با یک کاربر و تاخیر طولانی');
    console.log('');

    const endpoints = [
      '/api/health',
      '/api/stats',
      '/api/articles',
      '/api/sources'
    ];

    for (let i = 0; i < 10; i++) {
      const endpoint = endpoints[i % endpoints.length];
      await this.makeRequest(endpoint, i + 1);
      await this.delay(2000); // تاخیر 2 ثانیه
    }

    this.displayResults();
  }

  // انجام یک درخواست
  async makeRequest(endpoint, requestNumber) {
    try {
      console.log(`🔍 درخواست ${requestNumber}: ${endpoint}`);
      
      const startTime = Date.now();
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'SimpleTest-User',
          'X-Request-ID': `simple-req-${requestNumber}`
        }
      });

      const responseTime = Date.now() - startTime;
      
      this.results.totalRequests++;
      this.results.successfulRequests++;
      this.results.responseTimes.push(responseTime);

      console.log(`✅ درخواست ${requestNumber} موفق: ${responseTime}ms`);
      
      // نمایش اطلاعات اضافی برای برخی endpoint ها
      if (endpoint === '/api/stats' && response.data) {
        console.log(`   📊 آمار: ${response.data.totalArticles || 'N/A'} مقاله`);
      }

    } catch (error) {
      this.results.totalRequests++;
      this.results.failedRequests++;
      
      const errorInfo = {
        requestNumber,
        endpoint,
        error: error.message,
        status: error.response?.status,
        timestamp: new Date().toISOString()
      };
      
      this.results.errors.push(errorInfo);
      
      if (error.response?.status === 429) {
        console.log(`⚠️ درخواست ${requestNumber}: Rate Limited - منتظر...`);
        await this.delay(5000); // تاخیر بیشتر برای Rate Limiting
      } else {
        console.log(`❌ درخواست ${requestNumber} ناموفق: ${error.message}`);
      }
    }
  }

  // تاخیر
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // نمایش نتایج
  displayResults() {
    const duration = Date.now() - this.results.startTime;
    const successRate = (this.results.successfulRequests / this.results.totalRequests * 100).toFixed(2);
    const avgResponseTime = this.results.responseTimes.length > 0 
      ? (this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length).toFixed(2)
      : 0;

    console.log('\n📊 نتایج تست ساده:');
    console.log('=====================================');
    console.log(`⏱️ مدت زمان: ${(duration / 1000).toFixed(2)} ثانیه`);
    console.log(`📈 کل درخواست‌ها: ${this.results.totalRequests}`);
    console.log(`✅ درخواست‌های موفق: ${this.results.successfulRequests}`);
    console.log(`❌ درخواست‌های ناموفق: ${this.results.failedRequests}`);
    console.log(`📊 نرخ موفقیت: ${successRate}%`);
    console.log(`⚡ میانگین زمان پاسخ: ${avgResponseTime}ms`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ خطاهای رخ داده:');
      console.log('=====================================');
      
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.endpoint}: ${error.error}`);
      });
    }

    // تحلیل زمان پاسخ
    if (this.results.responseTimes.length > 0) {
      const minTime = Math.min(...this.results.responseTimes);
      const maxTime = Math.max(...this.results.responseTimes);
      
      console.log('\n⚡ تحلیل زمان پاسخ:');
      console.log('=====================================');
      console.log(`📉 حداقل: ${minTime}ms`);
      console.log(`📈 حداکثر: ${maxTime}ms`);
      console.log(`📊 میانگین: ${avgResponseTime}ms`);
      
      // ارزیابی عملکرد
      if (avgResponseTime < 500) {
        console.log('🎉 عملکرد: عالی');
      } else if (avgResponseTime < 1000) {
        console.log('👍 عملکرد: خوب');
      } else if (avgResponseTime < 2000) {
        console.log('⚠️ عملکرد: متوسط');
      } else {
        console.log('❌ عملکرد: ضعیف');
      }
    }

    console.log('\n✅ تست ساده تکمیل شد');
  }
}

// اجرای تست
async function main() {
  const simpleTest = new SimpleTest();
  await simpleTest.runSimpleTest();
}

// اجرا اگر فایل مستقیماً اجرا شود
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SimpleTest; 
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class LightStressTest {
  constructor() {
    this.baseUrl = 'http://localhost:3004';
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errors: [],
      responseTimes: [],
      memoryUsage: [],
      startTime: Date.now()
    };
    
    this.testConfig = {
      concurrentUsers: 5,        // تعداد کمتری کاربر
      requestsPerUser: 20,       // درخواست‌های کمتر
      delayBetweenRequests: 200, // تاخیر بیشتر
      testDuration: 60000,       // 1 دقیقه
      endpoints: [
        '/api/health',
        '/api/stats',
        '/api/articles',
        '/api/sources'
      ]
    };
  }

  // شروع تست استرس سبک
  async startLightStressTest() {
    console.log('🚀 شروع تست استرس سبک...');
    console.log(`📊 تنظیمات تست:`);
    console.log(`   - تعداد کاربران همزمان: ${this.testConfig.concurrentUsers}`);
    console.log(`   - درخواست‌ها به ازای هر کاربر: ${this.testConfig.requestsPerUser}`);
    console.log(`   - مدت زمان تست: ${this.testConfig.testDuration / 1000} ثانیه`);
    console.log(`   - تعداد endpoint ها: ${this.testConfig.endpoints.length}`);
    console.log('');

    // شروع monitoring حافظه
    this.startMemoryMonitoring();

    // شروع تست‌های همزمان
    const promises = [];
    for (let i = 0; i < this.testConfig.concurrentUsers; i++) {
      promises.push(this.simulateUser(i));
    }

    // انتظار برای تکمیل تست
    await Promise.all(promises);

    // نمایش نتایج
    this.displayResults();
  }

  // شبیه‌سازی یک کاربر
  async simulateUser(userId) {
    console.log(`👤 شروع کاربر ${userId + 1}`);
    
    for (let i = 0; i < this.testConfig.requestsPerUser; i++) {
      try {
        const endpoint = this.testConfig.endpoints[Math.floor(Math.random() * this.testConfig.endpoints.length)];
        const startTime = Date.now();
        
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          timeout: 10000,
          headers: {
            'User-Agent': `LightStressTest-User-${userId}`,
            'X-Request-ID': `light-req-${userId}-${i}`
          }
        });

        const responseTime = Date.now() - startTime;
        
        this.results.totalRequests++;
        this.results.successfulRequests++;
        this.results.responseTimes.push(responseTime);

        if (i % 5 === 0) {
          console.log(`✅ کاربر ${userId + 1}: درخواست ${i + 1}/${this.testConfig.requestsPerUser} - ${endpoint} (${responseTime}ms)`);
        }

        // تاخیر بین درخواست‌ها
        await this.delay(this.testConfig.delayBetweenRequests);

      } catch (error) {
        this.results.totalRequests++;
        this.results.failedRequests++;
        
        const errorInfo = {
          userId,
          requestNumber: i + 1,
          endpoint: error.config?.url || 'unknown',
          error: error.message,
          status: error.response?.status,
          timestamp: new Date().toISOString()
        };
        
        this.results.errors.push(errorInfo);
        
        if (error.response?.status === 429) {
          console.log(`⚠️ کاربر ${userId + 1}: Rate Limited در درخواست ${i + 1} - منتظر...`);
          await this.delay(1000); // تاخیر بیشتر برای Rate Limiting
        } else {
          console.log(`❌ کاربر ${userId + 1}: خطا در درخواست ${i + 1} - ${error.message}`);
        }
      }
    }
    
    console.log(`✅ کاربر ${userId + 1} تکمیل شد`);
  }

  // شروع monitoring حافظه
  startMemoryMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.results.memoryUsage.push({
        timestamp: Date.now(),
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      });
    }, 10000); // هر 10 ثانیه
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

    console.log('\n📊 نتایج تست استرس سبک:');
    console.log('=====================================');
    console.log(`⏱️ مدت زمان تست: ${(duration / 1000).toFixed(2)} ثانیه`);
    console.log(`📈 کل درخواست‌ها: ${this.results.totalRequests}`);
    console.log(`✅ درخواست‌های موفق: ${this.results.successfulRequests}`);
    console.log(`❌ درخواست‌های ناموفق: ${this.results.failedRequests}`);
    console.log(`📊 نرخ موفقیت: ${successRate}%`);
    console.log(`⚡ میانگین زمان پاسخ: ${avgResponseTime}ms`);
    console.log(`🧠 تعداد نمونه‌های حافظه: ${this.results.memoryUsage.length}`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ خطاهای رخ داده:');
      console.log('=====================================');
      
      // گروه‌بندی خطاها
      const errorGroups = {};
      this.results.errors.forEach(error => {
        const key = error.error || error.message || 'Unknown';
        if (!errorGroups[key]) {
          errorGroups[key] = 0;
        }
        errorGroups[key]++;
      });

      Object.entries(errorGroups).forEach(([error, count]) => {
        console.log(`   ${error}: ${count} بار`);
      });
    }

    // تحلیل حافظه
    if (this.results.memoryUsage.length > 0) {
      this.analyzeMemoryUsage();
    }

    console.log('\n✅ تست استرس سبک تکمیل شد');
  }

  // تحلیل استفاده حافظه
  analyzeMemoryUsage() {
    const memoryData = this.results.memoryUsage;
    const rssValues = memoryData.map(m => m.rss);
    const heapUsedValues = memoryData.map(m => m.heapUsed);
    
    const maxRSS = Math.max(...rssValues);
    const minRSS = Math.min(...rssValues);
    const avgRSS = rssValues.reduce((a, b) => a + b, 0) / rssValues.length;
    
    const maxHeap = Math.max(...heapUsedValues);
    const minHeap = Math.min(...heapUsedValues);
    const avgHeap = heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length;

    console.log('\n🧠 تحلیل حافظه:');
    console.log('=====================================');
    console.log(`📈 حداکثر RSS: ${(maxRSS / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📉 حداقل RSS: ${(minRSS / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📊 میانگین RSS: ${(avgRSS / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📈 حداکثر Heap: ${(maxHeap / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📉 حداقل Heap: ${(minHeap / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📊 میانگین Heap: ${(avgHeap / 1024 / 1024).toFixed(2)} MB`);
  }
}

// اجرای تست
async function main() {
  const lightStressTest = new LightStressTest();
  await lightStressTest.startLightStressTest();
}

// اجرا اگر فایل مستقیماً اجرا شود
if (require.main === module) {
  main().catch(console.error);
}

module.exports = LightStressTest; 
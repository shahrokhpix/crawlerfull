const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');

class StressTest {
  constructor() {
    this.baseUrl = 'http://localhost:3004';
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errors: [],
      responseTimes: [],
      memoryUsage: [],
      startTime: Date.now(),
      loadBalancerStats: {},
      websocketStats: {},
      databaseStats: {}
    };
    
    this.testConfig = {
      concurrentUsers: 50,
      requestsPerUser: 100,
      delayBetweenRequests: 100, // ms
      testDuration: 300000, // 5 minutes
      endpoints: [
        '/api/health',
        '/api/stats',
        '/api/articles',
        '/api/sources',
        '/api/logs',
        '/api/stability/status',
        '/api/performance/stats',
        '/api/queue/status',
        '/api/compression/stats',
        '/api/load-balancer/status',
        '/api/circuit-breaker/status',
        '/api/cache/stats'
      ]
    };
  }

  // شروع تست استرس
  async startStressTest() {
    console.log('🚀 شروع تست استرس...');
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
            'User-Agent': `StressTest-User-${userId}`,
            'X-Request-ID': `req-${userId}-${i}`
          }
        });

        const responseTime = Date.now() - startTime;
        
        this.results.totalRequests++;
        this.results.successfulRequests++;
        this.results.responseTimes.push(responseTime);

        if (i % 10 === 0) {
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
        
        console.log(`❌ کاربر ${userId + 1}: خطا در درخواست ${i + 1} - ${error.message}`);
      }
    }
    
    console.log(`✅ کاربر ${userId + 1} تکمیل شد`);
  }

  // تست کرال همزمان
  async startConcurrentCrawlTest() {
    console.log('🕷️ شروع تست کرال همزمان...');
    
    const crawlPromises = [];
    for (let i = 0; i < 10; i++) {
      crawlPromises.push(this.simulateCrawl(i));
    }
    
    await Promise.all(crawlPromises);
  }

  // شبیه‌سازی کرال
  async simulateCrawl(crawlId) {
    try {
      console.log(`🕷️ شروع کرال ${crawlId + 1}`);
      
      const response = await axios.post(`${this.baseUrl}/api/crawler/crawl`, {
        sourceId: 1,
        options: {
          fullContent: true,
          followLinks: false,
          maxDepth: 1
        }
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });
      
      console.log(`✅ کرال ${crawlId + 1} تکمیل شد`);
      
    } catch (error) {
      console.log(`❌ خطا در کرال ${crawlId + 1}: ${error.message}`);
      this.results.errors.push({
        type: 'crawl',
        crawlId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // تست دیتابیس
  async startDatabaseStressTest() {
    console.log('🗄️ شروع تست استرس دیتابیس...');
    
    const dbPromises = [];
    for (let i = 0; i < 20; i++) {
      dbPromises.push(this.simulateDatabaseOperation(i));
    }
    
    await Promise.all(dbPromises);
  }

  // شبیه‌سازی عملیات دیتابیس
  async simulateDatabaseOperation(opId) {
    try {
      console.log(`🗄️ شروع عملیات دیتابیس ${opId + 1}`);
      
      // تست‌های مختلف دیتابیس
      const tests = [
        axios.get(`${this.baseUrl}/api/articles?limit=100`),
        axios.get(`${this.baseUrl}/api/sources`),
        axios.get(`${this.baseUrl}/api/logs?limit=50`),
        axios.get(`${this.baseUrl}/api/stats`)
      ];
      
      const results = await Promise.all(tests);
      
      // ثبت آمار دیتابیس
      this.results.databaseStats[`operation_${opId}`] = {
        success: true,
        responseTimes: results.map((_, index) => Date.now() - Date.now()), // Placeholder
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ عملیات دیتابیس ${opId + 1} تکمیل شد`);
      
    } catch (error) {
      console.log(`❌ خطا در عملیات دیتابیس ${opId + 1}: ${error.message}`);
      this.results.errors.push({
        type: 'database',
        operationId: opId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // تست حافظه
  async startMemoryStressTest() {
    console.log('🧠 شروع تست استرس حافظه...');
    
    const memoryPromises = [];
    for (let i = 0; i < 30; i++) {
      memoryPromises.push(this.simulateMemoryIntensiveOperation(i));
    }
    
    await Promise.all(memoryPromises);
  }

  // شبیه‌سازی عملیات حافظه‌بر
  async simulateMemoryIntensiveOperation(opId) {
    try {
      console.log(`🧠 شروع عملیات حافظه ${opId + 1}`);
      
      // درخواست‌های حافظه‌بر
      const response = await axios.get(`${this.baseUrl}/api/articles?limit=1000&full=true`);
      
      // پردازش داده‌ها (شبیه‌سازی)
      const data = response.data;
      if (data.articles) {
        // شبیه‌سازی پردازش حافظه‌بر
        const processedData = data.articles.map(article => ({
          ...article,
          processed: true,
          timestamp: new Date().toISOString()
        }));
        
        // نگه داشتن داده‌ها در حافظه برای مدتی
        await this.delay(1000);
      }
      
      console.log(`✅ عملیات حافظه ${opId + 1} تکمیل شد`);
      
    } catch (error) {
      console.log(`❌ خطا در عملیات حافظه ${opId + 1}: ${error.message}`);
      this.results.errors.push({
        type: 'memory',
        operationId: opId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // تست API های مدیریتی
  async startAdminAPITest() {
    console.log('🔧 شروع تست API های مدیریتی...');
    
    const adminTests = [
      this.testAdminLogin(),
      this.testSourceManagement(),
      this.testScheduleManagement(),
      this.testCleanupManagement()
    ];
    
    await Promise.all(adminTests);
  }

  // تست لاگین ادمین
  async testAdminLogin() {
    try {
      const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
        username: 'admin',
        password: 'admin123'
      });
      
      if (response.data.success) {
        console.log('✅ تست لاگین ادمین موفق');
        return response.data.token;
      }
    } catch (error) {
      console.log(`❌ خطا در تست لاگین ادمین: ${error.message}`);
    }
  }

  // تست مدیریت منابع
  async testSourceManagement() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/sources`);
      console.log('✅ تست مدیریت منابع موفق');
    } catch (error) {
      console.log(`❌ خطا در تست مدیریت منابع: ${error.message}`);
    }
  }

  // تست مدیریت زمان‌بندی
  async testScheduleManagement() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/schedules`);
      console.log('✅ تست مدیریت زمان‌بندی موفق');
    } catch (error) {
      console.log(`❌ خطا در تست مدیریت زمان‌بندی: ${error.message}`);
    }
  }

  // تست مدیریت پاک‌سازی
  async testCleanupManagement() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/cleanup-schedules`);
      console.log('✅ تست مدیریت پاک‌سازی موفق');
    } catch (error) {
      console.log(`❌ خطا در تست مدیریت پاک‌سازی: ${error.message}`);
    }
  }

  // تست Load Balancer
  async startLoadBalancerTest() {
    console.log('⚖️ شروع تست Load Balancer...');
    
    const lbPromises = [];
    for (let i = 0; i < 15; i++) {
      lbPromises.push(this.simulateLoadBalancedRequest(i));
    }
    
    await Promise.all(lbPromises);
  }

  // شبیه‌سازی درخواست Load Balanced
  async simulateLoadBalancedRequest(reqId) {
    try {
      console.log(`⚖️ شروع درخواست Load Balanced ${reqId + 1}`);
      
      const response = await axios.get(`${this.baseUrl}/api/load-balancer/status`, {
        headers: {
          'X-Request-ID': `lb-req-${reqId}`,
          'X-Client-ID': `client-${reqId % 5}`
        }
      });
      
      this.results.loadBalancerStats[`request_${reqId}`] = {
        success: true,
        responseTime: Date.now() - Date.now(), // Placeholder
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ درخواست Load Balanced ${reqId + 1} تکمیل شد`);
      
    } catch (error) {
      console.log(`❌ خطا در درخواست Load Balanced ${reqId + 1}: ${error.message}`);
      this.results.errors.push({
        type: 'load_balancer',
        requestId: reqId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // تست WebSocket
  async startWebSocketTest() {
    console.log('🔌 شروع تست WebSocket...');
    
    try {
      const ws = new WebSocket('ws://localhost:3004/ws');
      
      return new Promise((resolve, reject) => {
        ws.on('open', () => {
          console.log('✅ اتصال WebSocket برقرار شد');
          
          // ارسال پیام تست
          ws.send(JSON.stringify({
            type: 'test',
            message: 'Stress test message',
            timestamp: new Date().toISOString()
          }));
          
          this.results.websocketStats.connection = {
            success: true,
            timestamp: new Date().toISOString()
          };
        });
        
        ws.on('message', (data) => {
          console.log('📨 پیام WebSocket دریافت شد:', data.toString());
          this.results.websocketStats.messageReceived = {
            success: true,
            data: data.toString(),
            timestamp: new Date().toISOString()
          };
        });
        
        ws.on('error', (error) => {
          console.log('❌ خطا در WebSocket:', error.message);
          this.results.errors.push({
            type: 'websocket',
            error: error.message,
            timestamp: new Date().toISOString()
          });
          reject(error);
        });
        
        ws.on('close', () => {
          console.log('🔌 اتصال WebSocket بسته شد');
          resolve();
        });
        
        // بستن اتصال بعد از 5 ثانیه
        setTimeout(() => {
          ws.close();
        }, 5000);
      });
      
    } catch (error) {
      console.log(`❌ خطا در تست WebSocket: ${error.message}`);
      this.results.errors.push({
        type: 'websocket',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // تست Circuit Breaker
  async startCircuitBreakerTest() {
    console.log('🔌 شروع تست Circuit Breaker...');
    
    const cbPromises = [];
    for (let i = 0; i < 10; i++) {
      cbPromises.push(this.simulateCircuitBreakerRequest(i));
    }
    
    await Promise.all(cbPromises);
  }

  // شبیه‌سازی درخواست Circuit Breaker
  async simulateCircuitBreakerRequest(reqId) {
    try {
      console.log(`🔌 شروع درخواست Circuit Breaker ${reqId + 1}`);
      
      const response = await axios.get(`${this.baseUrl}/api/circuit-breaker/status`, {
        timeout: 5000
      });
      
      console.log(`✅ درخواست Circuit Breaker ${reqId + 1} تکمیل شد`);
      
    } catch (error) {
      console.log(`❌ خطا در درخواست Circuit Breaker ${reqId + 1}: ${error.message}`);
      this.results.errors.push({
        type: 'circuit_breaker',
        requestId: reqId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
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
    }, 5000); // هر 5 ثانیه
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

    console.log('\n📊 نتایج تست استرس:');
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

      // ذخیره خطاها در فایل
      this.saveErrorsToFile();
    }

    // تحلیل حافظه
    if (this.results.memoryUsage.length > 0) {
      this.analyzeMemoryUsage();
    }

    // تحلیل Load Balancer
    if (Object.keys(this.results.loadBalancerStats).length > 0) {
      this.analyzeLoadBalancerStats();
    }

    // تحلیل WebSocket
    if (Object.keys(this.results.websocketStats).length > 0) {
      this.analyzeWebSocketStats();
    }

    console.log('\n✅ تست استرس تکمیل شد');
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

  // تحلیل آمار Load Balancer
  analyzeLoadBalancerStats() {
    const lbStats = this.results.loadBalancerStats;
    const successfulRequests = Object.values(lbStats).filter(stat => stat.success).length;
    const totalRequests = Object.keys(lbStats).length;
    const successRate = (successfulRequests / totalRequests * 100).toFixed(2);

    console.log('\n⚖️ تحلیل Load Balancer:');
    console.log('=====================================');
    console.log(`📈 کل درخواست‌ها: ${totalRequests}`);
    console.log(`✅ درخواست‌های موفق: ${successfulRequests}`);
    console.log(`📊 نرخ موفقیت: ${successRate}%`);
  }

  // تحلیل آمار WebSocket
  analyzeWebSocketStats() {
    const wsStats = this.results.websocketStats;
    
    console.log('\n🔌 تحلیل WebSocket:');
    console.log('=====================================');
    console.log(`🔗 اتصال: ${wsStats.connection?.success ? '✅ موفق' : '❌ ناموفق'}`);
    console.log(`📨 پیام: ${wsStats.messageReceived?.success ? '✅ دریافت شد' : '❌ دریافت نشد'}`);
  }

  // ذخیره خطاها در فایل
  async saveErrorsToFile() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `stress-test-errors-${timestamp}.json`;
      const filepath = path.join(__dirname, 'results', filename);
      
      // ایجاد پوشه results اگر وجود ندارد
      await fs.mkdir(path.join(__dirname, 'results'), { recursive: true });
      
      await fs.writeFile(filepath, JSON.stringify(this.results.errors, null, 2));
      console.log(`💾 خطاها در فایل ${filename} ذخیره شد`);
    } catch (error) {
      console.log(`❌ خطا در ذخیره فایل: ${error.message}`);
    }
  }

  // ذخیره نتایج کامل در فایل
  async saveFullResultsToFile() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `stress-test-results-${timestamp}.json`;
      const filepath = path.join(__dirname, 'results', filename);
      
      // ایجاد پوشه results اگر وجود ندارد
      await fs.mkdir(path.join(__dirname, 'results'), { recursive: true });
      
      const fullResults = {
        ...this.results,
        endTime: Date.now(),
        duration: Date.now() - this.results.startTime
      };
      
      await fs.writeFile(filepath, JSON.stringify(fullResults, null, 2));
      console.log(`💾 نتایج کامل در فایل ${filename} ذخیره شد`);
    } catch (error) {
      console.log(`❌ خطا در ذخیره نتایج: ${error.message}`);
    }
  }

  // تست کامل
  async runFullStressTest() {
    console.log('🚀 شروع تست استرس کامل...\n');
    
    try {
      // تست‌های مختلف را به صورت متوالی اجرا می‌کنیم
      await this.startStressTest();
      await this.delay(5000);
      
      await this.startConcurrentCrawlTest();
      await this.delay(5000);
      
      await this.startDatabaseStressTest();
      await this.delay(5000);
      
      await this.startMemoryStressTest();
      await this.delay(5000);
      
      await this.startAdminAPITest();
      await this.delay(5000);
      
      await this.startLoadBalancerTest();
      await this.delay(5000);
      
      await this.startWebSocketTest();
      await this.delay(5000);
      
      await this.startCircuitBreakerTest();
      
      // ذخیره نتایج کامل
      await this.saveFullResultsToFile();
      
    } catch (error) {
      console.log(`❌ خطا در اجرای تست کامل: ${error.message}`);
    }
  }
}

// اجرای تست
async function main() {
  const stressTest = new StressTest();
  
  // بررسی آرگومان‌های خط فرمان
  const args = process.argv.slice(2);
  
  if (args.includes('--full')) {
    await stressTest.runFullStressTest();
  } else if (args.includes('--crawl')) {
    await stressTest.startConcurrentCrawlTest();
  } else if (args.includes('--database')) {
    await stressTest.startDatabaseStressTest();
  } else if (args.includes('--memory')) {
    await stressTest.startMemoryStressTest();
  } else if (args.includes('--admin')) {
    await stressTest.startAdminAPITest();
  } else if (args.includes('--load-balancer')) {
    await stressTest.startLoadBalancerTest();
  } else if (args.includes('--websocket')) {
    await stressTest.startWebSocketTest();
  } else if (args.includes('--circuit-breaker')) {
    await stressTest.startCircuitBreakerTest();
  } else {
    await stressTest.startStressTest();
  }
}

// اجرا اگر فایل مستقیماً اجرا شود
if (require.main === module) {
  main().catch(console.error);
}

module.exports = StressTest; 
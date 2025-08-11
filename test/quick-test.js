const axios = require('axios');

class QuickTest {
  constructor() {
    this.baseUrl = 'http://localhost:3004';
    this.results = {
      tests: [],
      errors: [],
      startTime: Date.now()
    };
  }

  // تست سریع
  async runQuickTest() {
    console.log('🚀 شروع تست سریع...\n');

    const tests = [
      { name: 'Health Check', fn: () => this.testHealth() },
      { name: 'Database Connection', fn: () => this.testDatabase() },
      { name: 'API Endpoints', fn: () => this.testAPIEndpoints() },
      { name: 'Memory Usage', fn: () => this.testMemoryUsage() },
      { name: 'Stability Status', fn: () => this.testStabilityStatus() },
      { name: 'Performance Stats', fn: () => this.testPerformanceStats() },
      { name: 'Queue Status', fn: () => this.testQueueStatus() },
      { name: 'Compression Stats', fn: () => this.testCompressionStats() },
      { name: 'Admin Login', fn: () => this.testAdminLogin() },
      { name: 'Crawler Test', fn: () => this.testCrawler() }
    ];

    for (const test of tests) {
      await this.runTest(test.name, test.fn);
      await this.delay(1000); // تاخیر 1 ثانیه بین تست‌ها
    }

    this.displayResults();
  }

  // اجرای یک تست
  async runTest(name, testFn) {
    console.log(`🔍 تست: ${name}`);
    
    try {
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      
      this.results.tests.push({
        name,
        status: 'PASS',
        duration,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ ${name}: موفق (${duration}ms)\n`);
      
    } catch (error) {
      this.results.tests.push({
        name,
        status: 'FAIL',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      this.results.errors.push({
        test: name,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      console.log(`❌ ${name}: ناموفق - ${error.message}\n`);
    }
  }

  // تست Health Check
  async testHealth() {
    const response = await axios.get(`${this.baseUrl}/api/health`, { timeout: 5000 });
    
    if (response.data.status !== 'healthy') {
      throw new Error(`Health check failed: ${response.data.status}`);
    }
  }

  // تست اتصال دیتابیس
  async testDatabase() {
    const response = await axios.get(`${this.baseUrl}/api/stats`, { timeout: 5000 });
    
    if (!response.data.success) {
      throw new Error('Database connection failed');
    }
  }

  // تست API Endpoints
  async testAPIEndpoints() {
    const endpoints = [
      '/api/articles',
      '/api/sources',
      '/api/logs'
    ];

    for (const endpoint of endpoints) {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, { timeout: 5000 });
      
      if (response.status !== 200) {
        throw new Error(`Endpoint ${endpoint} returned status ${response.status}`);
      }
    }
  }

  // تست استفاده حافظه
  async testMemoryUsage() {
    const response = await axios.get(`${this.baseUrl}/api/performance/stats`, { timeout: 5000 });
    
    if (!response.data.success) {
      throw new Error('Memory usage check failed');
    }
  }

  // تست وضعیت پایداری
  async testStabilityStatus() {
    const response = await axios.get(`${this.baseUrl}/api/stability/status`, { timeout: 5000 });
    
    if (!response.data.success) {
      throw new Error('Stability status check failed');
    }
  }

  // تست آمار عملکرد
  async testPerformanceStats() {
    const response = await axios.get(`${this.baseUrl}/api/performance/stats`, { timeout: 5000 });
    
    if (!response.data.success) {
      throw new Error('Performance stats check failed');
    }
  }

  // تست وضعیت صف
  async testQueueStatus() {
    const response = await axios.get(`${this.baseUrl}/api/queue/status`, { timeout: 5000 });
    
    if (!response.data.success) {
      throw new Error('Queue status check failed');
    }
  }

  // تست آمار فشردگی
  async testCompressionStats() {
    const response = await axios.get(`${this.baseUrl}/api/compression/stats`, { timeout: 5000 });
    
    if (!response.data.success) {
      throw new Error('Compression stats check failed');
    }
  }

  // تست لاگین ادمین
  async testAdminLogin() {
    const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    }, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.data.success) {
      throw new Error('Admin login failed');
    }
  }

  // تست کرالر
  async testCrawler() {
    const response = await axios.post(`${this.baseUrl}/api/crawler/crawl`, {
      sourceId: 1,
      options: {
        fullContent: false,
        followLinks: false,
        maxDepth: 0
      }
    }, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.data.success) {
      throw new Error('Crawler test failed');
    }
  }

  // تاخیر
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // نمایش نتایج
  displayResults() {
    const duration = Date.now() - this.results.startTime;
    const passedTests = this.results.tests.filter(t => t.status === 'PASS').length;
    const failedTests = this.results.tests.filter(t => t.status === 'FAIL').length;
    const totalTests = this.results.tests.length;

    console.log('📊 نتایج تست سریع:');
    console.log('=====================================');
    console.log(`⏱️ مدت زمان: ${(duration / 1000).toFixed(2)} ثانیه`);
    console.log(`📈 کل تست‌ها: ${totalTests}`);
    console.log(`✅ موفق: ${passedTests}`);
    console.log(`❌ ناموفق: ${failedTests}`);
    console.log(`📊 نرخ موفقیت: ${(passedTests / totalTests * 100).toFixed(2)}%`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ خطاهای رخ داده:');
      console.log('=====================================');
      
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.test}: ${error.error}`);
      });
    }

    console.log('\n✅ تست سریع تکمیل شد');
  }
}

// اجرای تست
async function main() {
  const quickTest = new QuickTest();
  await quickTest.runQuickTest();
}

// اجرا اگر فایل مستقیماً اجرا شود
if (require.main === module) {
  main().catch(console.error);
}

module.exports = QuickTest; 
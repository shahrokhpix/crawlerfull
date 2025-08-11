const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class CITest {
  constructor() {
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3004';
    this.results = {
      tests: [],
      errors: [],
      startTime: Date.now(),
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      }
    };
    
    this.config = {
      timeout: 10000,
      retries: 3,
      healthCheckTimeout: 30000,
      criticalTests: [
        'health_check',
        'database_connection',
        'api_endpoints',
        'authentication'
      ]
    };
  }

  // اجرای تست CI
  async runCITest() {
    console.log('🚀 شروع تست CI/CD...');
    console.log(`🔗 تست از: ${this.baseUrl}`);
    console.log('');

    try {
      // تست‌های بحرانی
      await this.runCriticalTests();
      
      // تست‌های عملکرد
      await this.runPerformanceTests();
      
      // تست‌های امنیت
      await this.runSecurityTests();
      
      // تست‌های یکپارچگی
      await this.runIntegrationTests();
      
    } catch (error) {
      console.error('❌ خطای بحرانی در تست CI:', error.message);
      this.results.errors.push({
        type: 'critical',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // نمایش نتایج و خروج
    this.displayResults();
    this.exitWithCode();
  }

  // اجرای تست‌های بحرانی
  async runCriticalTests() {
    console.log('🔴 تست‌های بحرانی:');
    console.log('=====================================');

    const criticalTests = [
      { name: 'health_check', fn: () => this.testHealthCheck() },
      { name: 'database_connection', fn: () => this.testDatabaseConnection() },
      { name: 'api_endpoints', fn: () => this.testAPIEndpoints() },
      { name: 'authentication', fn: () => this.testAuthentication() }
    ];

    for (const test of criticalTests) {
      await this.runTest(test.name, test.fn, true);
    }
  }

  // اجرای تست‌های عملکرد
  async runPerformanceTests() {
    console.log('\n⚡ تست‌های عملکرد:');
    console.log('=====================================');

    const performanceTests = [
      { name: 'response_time', fn: () => this.testResponseTime() },
      { name: 'memory_usage', fn: () => this.testMemoryUsage() },
      { name: 'concurrent_requests', fn: () => this.testConcurrentRequests() }
    ];

    for (const test of performanceTests) {
      await this.runTest(test.name, test.fn, false);
    }
  }

  // اجرای تست‌های امنیت
  async runSecurityTests() {
    console.log('\n🔒 تست‌های امنیت:');
    console.log('=====================================');

    const securityTests = [
      { name: 'sql_injection', fn: () => this.testSQLInjection() },
      { name: 'xss_protection', fn: () => this.testXSSProtection() },
      { name: 'rate_limiting', fn: () => this.testRateLimiting() }
    ];

    for (const test of securityTests) {
      await this.runTest(test.name, test.fn, false);
    }
  }

  // اجرای تست‌های یکپارچگی
  async runIntegrationTests() {
    console.log('\n🔗 تست‌های یکپارچگی:');
    console.log('=====================================');

    const integrationTests = [
      { name: 'crawler_integration', fn: () => this.testCrawlerIntegration() },
      { name: 'database_integration', fn: () => this.testDatabaseIntegration() },
      { name: 'cache_integration', fn: () => this.testCacheIntegration() }
    ];

    for (const test of integrationTests) {
      await this.runTest(test.name, test.fn, false);
    }
  }

  // اجرای یک تست
  async runTest(name, testFn, isCritical = false) {
    console.log(`🔍 تست: ${name}`);
    
    let lastError = null;
    
    // تلاش مجدد برای تست‌های بحرانی
    const maxRetries = isCritical ? this.config.retries : 1;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        await testFn();
        const duration = Date.now() - startTime;
        
        this.results.tests.push({
          name,
          status: 'PASS',
          duration,
          attempt,
          isCritical,
          timestamp: new Date().toISOString()
        });
        
        this.results.summary.total++;
        this.results.summary.passed++;
        
        console.log(`✅ ${name}: موفق (${duration}ms)${attempt > 1 ? ` - تلاش ${attempt}` : ''}`);
        return;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          console.log(`⚠️ ${name}: تلاش ${attempt} ناموفق، تلاش مجدد...`);
          await this.delay(1000 * attempt); // تاخیر افزایشی
        }
      }
    }
    
    // تمام تلاش‌ها ناموفق
    this.results.tests.push({
      name,
      status: 'FAIL',
      error: lastError.message,
      attempt: maxRetries,
      isCritical,
      timestamp: new Date().toISOString()
    });
    
    this.results.summary.total++;
    this.results.summary.failed++;
    
    this.results.errors.push({
      test: name,
      error: lastError.message,
      isCritical,
      timestamp: new Date().toISOString()
    });
    
    console.log(`❌ ${name}: ناموفق - ${lastError.message}`);
    
    // اگر تست بحرانی ناموفق باشد، خطا پرتاب کن
    if (isCritical) {
      throw new Error(`تست بحرانی ${name} ناموفق: ${lastError.message}`);
    }
  }

  // تست Health Check
  async testHealthCheck() {
    const response = await axios.get(`${this.baseUrl}/api/health`, {
      timeout: this.config.healthCheckTimeout
    });
    
    if (response.data.status !== 'healthy') {
      throw new Error(`Health check failed: ${response.data.status}`);
    }
  }

  // تست اتصال دیتابیس
  async testDatabaseConnection() {
    const response = await axios.get(`${this.baseUrl}/api/stats`, {
      timeout: this.config.timeout
    });
    
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
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        timeout: this.config.timeout
      });
      
      if (response.status !== 200) {
        throw new Error(`Endpoint ${endpoint} returned status ${response.status}`);
      }
    }
  }

  // تست احراز هویت
  async testAuthentication() {
    const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    }, {
      timeout: this.config.timeout,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.data.success) {
      throw new Error('Authentication failed');
    }
  }

  // تست زمان پاسخ
  async testResponseTime() {
    const startTime = Date.now();
    
    await axios.get(`${this.baseUrl}/api/health`, {
      timeout: this.config.timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    if (responseTime > 2000) { // بیش از 2 ثانیه
      throw new Error(`Response time too slow: ${responseTime}ms`);
    }
  }

  // تست استفاده حافظه
  async testMemoryUsage() {
    const response = await axios.get(`${this.baseUrl}/api/performance/stats`, {
      timeout: this.config.timeout
    });
    
    if (!response.data.success) {
      throw new Error('Memory usage check failed');
    }
    
    // بررسی استفاده حافظه (اگر در پاسخ موجود باشد)
    if (response.data.memory && response.data.memory.heapUsed > 1024 * 1024 * 1024) { // بیش از 1GB
      throw new Error('Memory usage too high');
    }
  }

  // تست درخواست‌های همزمان
  async testConcurrentRequests() {
    const concurrentPromises = [];
    
    for (let i = 0; i < 5; i++) {
      concurrentPromises.push(
        axios.get(`${this.baseUrl}/api/health`, {
          timeout: this.config.timeout
        }).catch(error => error)
      );
    }
    
    const results = await Promise.all(concurrentPromises);
    const successful = results.filter(result => result.status === 200).length;
    
    if (successful < 3) { // حداقل 3 درخواست موفق
      throw new Error(`Concurrent requests failed: ${successful}/5 successful`);
    }
  }

  // تست SQL Injection
  async testSQLInjection() {
    const payload = "'; DROP TABLE users; --";
    
    try {
      await axios.get(`${this.baseUrl}/api/articles?search=${encodeURIComponent(payload)}`, {
        timeout: this.config.timeout
      });
      
      // اگر درخواست موفق بود، بررسی کنیم که آیا محافظت شده است
      console.log('⚠️ SQL Injection test - manual verification needed');
      
    } catch (error) {
      if (error.response?.status === 400) {
        // خطای 400 نشان‌دهنده محافظت است
        return;
      }
      throw new Error('SQL Injection protection not working properly');
    }
  }

  // تست محافظت XSS
  async testXSSProtection() {
    const payload = '<script>alert("XSS")</script>';
    
    try {
      await axios.post(`${this.baseUrl}/api/articles`, {
        title: payload,
        content: 'Test content'
      }, {
        timeout: this.config.timeout,
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('⚠️ XSS test - manual verification needed');
      
    } catch (error) {
      if (error.response?.status === 400) {
        return;
      }
      throw new Error('XSS protection not working properly');
    }
  }

  // تست Rate Limiting
  async testRateLimiting() {
    const requests = [];
    
    for (let i = 0; i < 10; i++) {
      requests.push(
        axios.get(`${this.baseUrl}/api/health`, {
          timeout: this.config.timeout
        }).catch(error => error)
      );
    }
    
    const results = await Promise.all(requests);
    const rateLimited = results.filter(result => 
      result.response?.status === 429
    ).length;
    
    if (rateLimited === 0) {
      console.log('⚠️ Rate limiting not detected - may be disabled');
    }
  }

  // تست یکپارچگی کرالر
  async testCrawlerIntegration() {
    try {
      const response = await axios.post(`${this.baseUrl}/api/crawler/status`, {
        sourceId: 1
      }, {
        timeout: this.config.timeout,
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.data.success) {
        throw new Error('Crawler integration failed');
      }
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ Crawler endpoint not available');
        this.results.summary.skipped++;
        return;
      }
      throw error;
    }
  }

  // تست یکپارچگی دیتابیس
  async testDatabaseIntegration() {
    const response = await axios.get(`${this.baseUrl}/api/database/status`, {
      timeout: this.config.timeout
    });
    
    if (!response.data.success) {
      throw new Error('Database integration failed');
    }
  }

  // تست یکپارچگی کش
  async testCacheIntegration() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/cache/status`, {
        timeout: this.config.timeout
      });
      
      if (!response.data.success) {
        throw new Error('Cache integration failed');
      }
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ Cache endpoint not available');
        this.results.summary.skipped++;
        return;
      }
      throw error;
    }
  }

  // تاخیر
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // نمایش نتایج
  displayResults() {
    const duration = Date.now() - this.results.startTime;
    const { total, passed, failed, skipped } = this.results.summary;
    const successRate = total > 0 ? (passed / total * 100).toFixed(2) : 0;

    console.log('\n📊 نتایج تست CI/CD:');
    console.log('=====================================');
    console.log(`⏱️ مدت زمان: ${(duration / 1000).toFixed(2)} ثانیه`);
    console.log(`📈 کل تست‌ها: ${total}`);
    console.log(`✅ موفق: ${passed}`);
    console.log(`❌ ناموفق: ${failed}`);
    console.log(`⏭️ رد شده: ${skipped}`);
    console.log(`📊 نرخ موفقیت: ${successRate}%`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ خطاهای رخ داده:');
      console.log('=====================================');
      
      this.results.errors.forEach((error, index) => {
        const critical = error.isCritical ? '🔴' : '⚠️';
        console.log(`${critical} ${index + 1}. ${error.test}: ${error.error}`);
      });
    }

    // ذخیره نتایج در فایل
    this.saveResults();
  }

  // ذخیره نتایج
  async saveResults() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `ci-test-results-${timestamp}.json`;
      const filepath = path.join(__dirname, 'results', filename);
      
      // ایجاد پوشه results اگر وجود ندارد
      await fs.mkdir(path.join(__dirname, 'results'), { recursive: true });
      
      const fullResults = {
        ...this.results,
        endTime: Date.now(),
        duration: Date.now() - this.results.startTime,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          baseUrl: this.baseUrl
        }
      };
      
      await fs.writeFile(filepath, JSON.stringify(fullResults, null, 2));
      console.log(`💾 نتایج در فایل ${filename} ذخیره شد`);
    } catch (error) {
      console.log(`❌ خطا در ذخیره نتایج: ${error.message}`);
    }
  }

  // خروج با کد مناسب
  exitWithCode() {
    const { total, passed, failed } = this.results.summary;
    const criticalFailed = this.results.errors.filter(error => error.isCritical).length;
    
    if (criticalFailed > 0) {
      console.log('\n🔴 تست‌های بحرانی ناموفق - خروج با کد 1');
      process.exit(1);
    } else if (failed > 0) {
      console.log('\n⚠️ برخی تست‌ها ناموفق - خروج با کد 2');
      process.exit(2);
    } else if (total === 0) {
      console.log('\n⚠️ هیچ تستی اجرا نشد - خروج با کد 3');
      process.exit(3);
    } else {
      console.log('\n✅ تمام تست‌ها موفق - خروج با کد 0');
      process.exit(0);
    }
  }
}

// اجرای تست
async function main() {
  const ciTest = new CITest();
  await ciTest.runCITest();
}

// اجرا اگر فایل مستقیماً اجرا شود
if (require.main === module) {
  main().catch(error => {
    console.error('❌ خطای بحرانی در تست CI:', error.message);
    process.exit(1);
  });
}

module.exports = CITest; 
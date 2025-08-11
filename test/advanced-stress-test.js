const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

class AdvancedStressTest {
  constructor() {
    this.baseUrl = 'http://localhost:3004';
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errors: [],
      responseTimes: [],
      memoryUsage: [],
      cpuUsage: [],
      networkStats: [],
      rateLimitStats: {},
      connectionPoolStats: {},
      performanceMetrics: {},
      startTime: Date.now()
    };
    
    this.testConfig = {
      concurrentUsers: 100,
      requestsPerUser: 200,
      delayBetweenRequests: 50,
      testDuration: 600000, // 10 minutes
      rateLimitThreshold: 1000,
      connectionPoolSize: 50,
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
        '/api/cache/stats',
        '/api/rate-limiter/status',
        '/api/connection-pool/status'
      ]
    };
  }

  // شروع تست پیشرفته
  async startAdvancedStressTest() {
    console.log('🚀 شروع تست استرس پیشرفته...');
    console.log(`📊 تنظیمات تست:`);
    console.log(`   - تعداد کاربران همزمان: ${this.testConfig.concurrentUsers}`);
    console.log(`   - درخواست‌ها به ازای هر کاربر: ${this.testConfig.requestsPerUser}`);
    console.log(`   - مدت زمان تست: ${this.testConfig.testDuration / 1000} ثانیه`);
    console.log(`   - آستانه Rate Limit: ${this.testConfig.rateLimitThreshold}`);
    console.log(`   - اندازه Connection Pool: ${this.testConfig.connectionPoolSize}`);
    console.log('');

    // شروع monitoring سیستم
    this.startSystemMonitoring();

    // شروع تست‌های مختلف
    const testPromises = [
      this.startConcurrentUserTest(),
      this.startRateLimitTest(),
      this.startConnectionPoolTest(),
      this.startPerformanceTest(),
      this.startNetworkTest()
    ];

    await Promise.all(testPromises);

    // نمایش نتایج
    this.displayAdvancedResults();
  }

  // تست کاربران همزمان پیشرفته
  async startConcurrentUserTest() {
    console.log('👥 شروع تست کاربران همزمان پیشرفته...');
    
    const userPromises = [];
    for (let i = 0; i < this.testConfig.concurrentUsers; i++) {
      userPromises.push(this.simulateAdvancedUser(i));
    }
    
    await Promise.all(userPromises);
  }

  // شبیه‌سازی کاربر پیشرفته
  async simulateAdvancedUser(userId) {
    console.log(`👤 شروع کاربر پیشرفته ${userId + 1}`);
    
    const userStats = {
      requests: 0,
      successful: 0,
      failed: 0,
      totalResponseTime: 0,
      errors: []
    };

    for (let i = 0; i < this.testConfig.requestsPerUser; i++) {
      try {
        const endpoint = this.testConfig.endpoints[Math.floor(Math.random() * this.testConfig.endpoints.length)];
        const startTime = performance.now();
        
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          timeout: 15000,
          headers: {
            'User-Agent': `AdvancedStressTest-User-${userId}`,
            'X-Request-ID': `adv-req-${userId}-${i}`,
            'X-Client-Version': '2.0.0',
            'X-Test-Type': 'advanced'
          }
        });

        const responseTime = performance.now() - startTime;
        
        this.results.totalRequests++;
        this.results.successfulRequests++;
        this.results.responseTimes.push(responseTime);
        
        userStats.requests++;
        userStats.successful++;
        userStats.totalResponseTime += responseTime;

        if (i % 20 === 0) {
          console.log(`✅ کاربر ${userId + 1}: درخواست ${i + 1}/${this.testConfig.requestsPerUser} - ${endpoint} (${responseTime.toFixed(2)}ms)`);
        }

        // تاخیر متغیر بین درخواست‌ها
        const randomDelay = Math.random() * this.testConfig.delayBetweenRequests;
        await this.delay(randomDelay);

      } catch (error) {
        this.results.totalRequests++;
        this.results.failedRequests++;
        
        userStats.requests++;
        userStats.failed++;
        
        const errorInfo = {
          userId,
          requestNumber: i + 1,
          endpoint: error.config?.url || 'unknown',
          error: error.message,
          status: error.response?.status,
          timestamp: new Date().toISOString()
        };
        
        this.results.errors.push(errorInfo);
        userStats.errors.push(errorInfo);
        
        console.log(`❌ کاربر ${userId + 1}: خطا در درخواست ${i + 1} - ${error.message}`);
      }
    }
    
    console.log(`✅ کاربر پیشرفته ${userId + 1} تکمیل شد - موفق: ${userStats.successful}/${userStats.requests}`);
  }

  // تست Rate Limiting
  async startRateLimitTest() {
    console.log('🚦 شروع تست Rate Limiting...');
    
    const rateLimitPromises = [];
    for (let i = 0; i < this.testConfig.rateLimitThreshold; i++) {
      rateLimitPromises.push(this.simulateRateLimitedRequest(i));
    }
    
    await Promise.all(rateLimitPromises);
  }

  // شبیه‌سازی درخواست Rate Limited
  async simulateRateLimitedRequest(reqId) {
    try {
      const startTime = performance.now();
      
      const response = await axios.get(`${this.baseUrl}/api/rate-limiter/status`, {
        timeout: 5000,
        headers: {
          'X-Request-ID': `rate-req-${reqId}`,
          'X-Rate-Limit-Test': 'true'
        }
      });

      const responseTime = performance.now() - startTime;
      
      this.results.rateLimitStats[`request_${reqId}`] = {
        success: true,
        responseTime,
        status: response.status,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.results.rateLimitStats[`request_${reqId}`] = {
        success: false,
        error: error.message,
        status: error.response?.status,
        timestamp: new Date().toISOString()
      };
    }
  }

  // تست Connection Pool
  async startConnectionPoolTest() {
    console.log('🔗 شروع تست Connection Pool...');
    
    const poolPromises = [];
    for (let i = 0; i < this.testConfig.connectionPoolSize; i++) {
      poolPromises.push(this.simulatePooledConnection(i));
    }
    
    await Promise.all(poolPromises);
  }

  // شبیه‌سازی اتصال Pooled
  async simulatePooledConnection(connId) {
    try {
      const startTime = performance.now();
      
      const response = await axios.get(`${this.baseUrl}/api/connection-pool/status`, {
        timeout: 10000,
        headers: {
          'X-Connection-ID': `pool-conn-${connId}`,
          'X-Pool-Test': 'true'
        }
      });

      const responseTime = performance.now() - startTime;
      
      this.results.connectionPoolStats[`connection_${connId}`] = {
        success: true,
        responseTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.results.connectionPoolStats[`connection_${connId}`] = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // تست عملکرد
  async startPerformanceTest() {
    console.log('⚡ شروع تست عملکرد...');
    
    const perfTests = [
      this.testDatabasePerformance(),
      this.testMemoryPerformance(),
      this.testNetworkPerformance(),
      this.testCpuPerformance()
    ];
    
    await Promise.all(perfTests);
  }

  // تست عملکرد دیتابیس
  async testDatabasePerformance() {
    try {
      const startTime = performance.now();
      
      const response = await axios.get(`${this.baseUrl}/api/articles?limit=1000&performance=true`);
      
      const responseTime = performance.now() - startTime;
      
      this.results.performanceMetrics.database = {
        success: true,
        responseTime,
        dataSize: JSON.stringify(response.data).length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.results.performanceMetrics.database = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // تست عملکرد حافظه
  async testMemoryPerformance() {
    try {
      const startTime = performance.now();
      
      const response = await axios.get(`${this.baseUrl}/api/performance/memory-test`);
      
      const responseTime = performance.now() - startTime;
      
      this.results.performanceMetrics.memory = {
        success: true,
        responseTime,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.results.performanceMetrics.memory = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // تست عملکرد شبکه
  async testNetworkPerformance() {
    try {
      const startTime = performance.now();
      
      const response = await axios.get(`${this.baseUrl}/api/performance/network-test`);
      
      const responseTime = performance.now() - startTime;
      
      this.results.performanceMetrics.network = {
        success: true,
        responseTime,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.results.performanceMetrics.network = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // تست عملکرد CPU
  async testCpuPerformance() {
    try {
      const startTime = performance.now();
      
      const response = await axios.get(`${this.baseUrl}/api/performance/cpu-test`);
      
      const responseTime = performance.now() - startTime;
      
      this.results.performanceMetrics.cpu = {
        success: true,
        responseTime,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.results.performanceMetrics.cpu = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // تست شبکه
  async startNetworkTest() {
    console.log('🌐 شروع تست شبکه...');
    
    const networkTests = [
      this.testLatency(),
      this.testBandwidth(),
      this.testConnectionStability()
    ];
    
    await Promise.all(networkTests);
  }

  // تست تاخیر شبکه
  async testLatency() {
    const latencies = [];
    
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      
      try {
        await axios.get(`${this.baseUrl}/api/health`, { timeout: 5000 });
        const latency = performance.now() - startTime;
        latencies.push(latency);
      } catch (error) {
        latencies.push(-1); // خطا
      }
    }
    
    const avgLatency = latencies.filter(l => l > 0).reduce((a, b) => a + b, 0) / latencies.filter(l => l > 0).length;
    
    this.results.networkStats.latency = {
      average: avgLatency,
      min: Math.min(...latencies.filter(l => l > 0)),
      max: Math.max(...latencies.filter(l => l > 0)),
      samples: latencies.length
    };
  }

  // تست پهنای باند
  async testBandwidth() {
    try {
      const startTime = performance.now();
      
      const response = await axios.get(`${this.baseUrl}/api/articles?limit=100&full=true`);
      
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000; // ثانیه
      const dataSize = JSON.stringify(response.data).length; // بایت
      const bandwidth = dataSize / duration; // بایت بر ثانیه
      
      this.results.networkStats.bandwidth = {
        bytesPerSecond: bandwidth,
        megabytesPerSecond: bandwidth / (1024 * 1024),
        dataSize,
        duration
      };
      
    } catch (error) {
      this.results.networkStats.bandwidth = {
        error: error.message
      };
    }
  }

  // تست پایداری اتصال
  async testConnectionStability() {
    const connectionTests = [];
    
    for (let i = 0; i < 20; i++) {
      connectionTests.push(this.testSingleConnection(i));
    }
    
    const results = await Promise.all(connectionTests);
    const successful = results.filter(r => r.success).length;
    
    this.results.networkStats.connectionStability = {
      total: results.length,
      successful,
      failed: results.length - successful,
      successRate: (successful / results.length * 100).toFixed(2)
    };
  }

  // تست اتصال واحد
  async testSingleConnection(connId) {
    try {
      await axios.get(`${this.baseUrl}/api/health`, { timeout: 3000 });
      return { success: true, connId };
    } catch (error) {
      return { success: false, connId, error: error.message };
    }
  }

  // شروع monitoring سیستم
  startSystemMonitoring() {
    // Monitoring حافظه
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.results.memoryUsage.push({
        timestamp: Date.now(),
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      });
    }, 3000);

    // Monitoring CPU (شبیه‌سازی)
    setInterval(() => {
      this.results.cpuUsage.push({
        timestamp: Date.now(),
        usage: Math.random() * 100, // شبیه‌سازی
        load: Math.random() * 10
      });
    }, 5000);
  }

  // تاخیر
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // نمایش نتایج پیشرفته
  displayAdvancedResults() {
    const duration = Date.now() - this.results.startTime;
    const successRate = (this.results.successfulRequests / this.results.totalRequests * 100).toFixed(2);
    const avgResponseTime = this.results.responseTimes.length > 0 
      ? (this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length).toFixed(2)
      : 0;

    console.log('\n📊 نتایج تست استرس پیشرفته:');
    console.log('=====================================');
    console.log(`⏱️ مدت زمان تست: ${(duration / 1000).toFixed(2)} ثانیه`);
    console.log(`📈 کل درخواست‌ها: ${this.results.totalRequests}`);
    console.log(`✅ درخواست‌های موفق: ${this.results.successfulRequests}`);
    console.log(`❌ درخواست‌های ناموفق: ${this.results.failedRequests}`);
    console.log(`📊 نرخ موفقیت: ${successRate}%`);
    console.log(`⚡ میانگین زمان پاسخ: ${avgResponseTime}ms`);

    // تحلیل Rate Limiting
    this.analyzeRateLimitStats();

    // تحلیل Connection Pool
    this.analyzeConnectionPoolStats();

    // تحلیل عملکرد
    this.analyzePerformanceMetrics();

    // تحلیل شبکه
    this.analyzeNetworkStats();

    // تحلیل حافظه
    if (this.results.memoryUsage.length > 0) {
      this.analyzeMemoryUsage();
    }

    // ذخیره نتایج
    this.saveAdvancedResults();
  }

  // تحلیل آمار Rate Limiting
  analyzeRateLimitStats() {
    const rateLimitData = Object.values(this.results.rateLimitStats);
    const successful = rateLimitData.filter(r => r.success).length;
    const total = rateLimitData.length;
    const successRate = (successful / total * 100).toFixed(2);

    console.log('\n🚦 تحلیل Rate Limiting:');
    console.log('=====================================');
    console.log(`📈 کل درخواست‌ها: ${total}`);
    console.log(`✅ موفق: ${successful}`);
    console.log(`📊 نرخ موفقیت: ${successRate}%`);
  }

  // تحلیل آمار Connection Pool
  analyzeConnectionPoolStats() {
    const poolData = Object.values(this.results.connectionPoolStats);
    const successful = poolData.filter(c => c.success).length;
    const total = poolData.length;
    const successRate = (successful / total * 100).toFixed(2);

    console.log('\n🔗 تحلیل Connection Pool:');
    console.log('=====================================');
    console.log(`📈 کل اتصالات: ${total}`);
    console.log(`✅ موفق: ${successful}`);
    console.log(`📊 نرخ موفقیت: ${successRate}%`);
  }

  // تحلیل متریک‌های عملکرد
  analyzePerformanceMetrics() {
    console.log('\n⚡ تحلیل عملکرد:');
    console.log('=====================================');
    
    Object.entries(this.results.performanceMetrics).forEach(([component, metrics]) => {
      if (metrics.success) {
        console.log(`✅ ${component}: ${metrics.responseTime.toFixed(2)}ms`);
      } else {
        console.log(`❌ ${component}: ${metrics.error}`);
      }
    });
  }

  // تحلیل آمار شبکه
  analyzeNetworkStats() {
    console.log('\n🌐 تحلیل شبکه:');
    console.log('=====================================');
    
    if (this.results.networkStats.latency) {
      console.log(`📡 تاخیر متوسط: ${this.results.networkStats.latency.average.toFixed(2)}ms`);
    }
    
    if (this.results.networkStats.bandwidth) {
      console.log(`📊 پهنای باند: ${this.results.networkStats.bandwidth.megabytesPerSecond.toFixed(2)} MB/s`);
    }
    
    if (this.results.networkStats.connectionStability) {
      console.log(`🔗 پایداری اتصال: ${this.results.networkStats.connectionStability.successRate}%`);
    }
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

  // ذخیره نتایج پیشرفته
  async saveAdvancedResults() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `advanced-stress-test-results-${timestamp}.json`;
      const filepath = path.join(__dirname, 'results', filename);
      
      // ایجاد پوشه results اگر وجود ندارد
      await fs.mkdir(path.join(__dirname, 'results'), { recursive: true });
      
      const fullResults = {
        ...this.results,
        endTime: Date.now(),
        duration: Date.now() - this.results.startTime,
        testType: 'advanced'
      };
      
      await fs.writeFile(filepath, JSON.stringify(fullResults, null, 2));
      console.log(`💾 نتایج پیشرفته در فایل ${filename} ذخیره شد`);
    } catch (error) {
      console.log(`❌ خطا در ذخیره نتایج: ${error.message}`);
    }
  }
}

// اجرای تست
async function main() {
  const advancedStressTest = new AdvancedStressTest();
  await advancedStressTest.startAdvancedStressTest();
}

// اجرا اگر فایل مستقیماً اجرا شود
if (require.main === module) {
  main().catch(console.error);
}

module.exports = AdvancedStressTest; 
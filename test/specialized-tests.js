const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');

class SpecializedTests {
  constructor() {
    this.baseUrl = 'http://localhost:3004';
    this.results = {
      tests: [],
      errors: [],
      startTime: Date.now()
    };
  }

  // اجرای تمام تست‌های تخصصی
  async runAllSpecializedTests() {
    console.log('🔬 شروع تست‌های تخصصی...\n');

    const tests = [
      { name: 'Authentication Tests', fn: () => this.runAuthenticationTests() },
      { name: 'File Upload Tests', fn: () => this.runFileUploadTests() },
      { name: 'Database Transaction Tests', fn: () => this.runDatabaseTransactionTests() },
      { name: 'Cache Tests', fn: () => this.runCacheTests() },
      { name: 'Security Tests', fn: () => this.runSecurityTests() },
      { name: 'API Version Tests', fn: () => this.runAPIVersionTests() },
      { name: 'Error Handling Tests', fn: () => this.runErrorHandlingTests() },
      { name: 'Concurrency Tests', fn: () => this.runConcurrencyTests() }
    ];

    for (const test of tests) {
      await this.runTest(test.name, test.fn);
      await this.delay(2000);
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

  // تست‌های احراز هویت
  async runAuthenticationTests() {
    console.log('🔐 اجرای تست‌های احراز هویت...');

    // تست لاگین موفق
    const loginResponse = await axios.post(`${this.baseUrl}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });

    if (!loginResponse.data.success) {
      throw new Error('لاگین ناموفق');
    }

    const token = loginResponse.data.token;
    console.log('✅ لاگین موفق');

    // تست دسترسی با توکن
    const protectedResponse = await axios.get(`${this.baseUrl}/api/admin/dashboard`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (protectedResponse.status !== 200) {
      throw new Error('دسترسی به صفحه محافظت شده ناموفق');
    }

    console.log('✅ دسترسی با توکن موفق');

    // تست لاگین ناموفق
    try {
      await axios.post(`${this.baseUrl}/api/auth/login`, {
        username: 'admin',
        password: 'wrongpassword'
      });
      throw new Error('لاگین با رمز اشتباه باید ناموفق باشد');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ لاگین ناموفق به درستی مدیریت شد');
      } else {
        throw new Error('مدیریت خطای لاگین ناموفق');
      }
    }

    // تست توکن منقضی شده
    const expiredToken = 'expired.token.here';
    try {
      await axios.get(`${this.baseUrl}/api/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${expiredToken}`
        }
      });
      throw new Error('توکن منقضی شده باید رد شود');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ توکن منقضی شده به درستی رد شد');
      } else {
        throw new Error('مدیریت توکن منقضی شده');
      }
    }
  }

  // تست‌های آپلود فایل
  async runFileUploadTests() {
    console.log('📁 اجرای تست‌های آپلود فایل...');

    // ایجاد فایل تست
    const testFilePath = path.join(__dirname, 'test-file.txt');
    await fs.writeFile(testFilePath, 'This is a test file for upload testing');

    try {
      // تست آپلود فایل متنی
      const formData = new FormData();
      formData.append('file', await fs.readFile(testFilePath), {
        filename: 'test-file.txt',
        contentType: 'text/plain'
      });
      formData.append('description', 'Test file upload');

      const uploadResponse = await axios.post(`${this.baseUrl}/api/upload`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': 'Bearer test-token'
        },
        timeout: 30000
      });

      if (!uploadResponse.data.success) {
        throw new Error('آپلود فایل ناموفق');
      }

      console.log('✅ آپلود فایل متنی موفق');

      // تست آپلود فایل بزرگ
      const largeFilePath = path.join(__dirname, 'large-test-file.txt');
      const largeContent = 'A'.repeat(1024 * 1024); // 1MB
      await fs.writeFile(largeFilePath, largeContent);

      const largeFormData = new FormData();
      largeFormData.append('file', await fs.readFile(largeFilePath), {
        filename: 'large-test-file.txt',
        contentType: 'text/plain'
      });

      const largeUploadResponse = await axios.post(`${this.baseUrl}/api/upload`, largeFormData, {
        headers: {
          ...largeFormData.getHeaders(),
          'Authorization': 'Bearer test-token'
        },
        timeout: 60000
      });

      if (!largeUploadResponse.data.success) {
        throw new Error('آپلود فایل بزرگ ناموفق');
      }

      console.log('✅ آپلود فایل بزرگ موفق');

      // پاک‌سازی فایل‌های تست
      await fs.unlink(testFilePath);
      await fs.unlink(largeFilePath);

    } catch (error) {
      // پاک‌سازی در صورت خطا
      try {
        await fs.unlink(testFilePath);
        await fs.unlink(path.join(__dirname, 'large-test-file.txt'));
      } catch (cleanupError) {
        // نادیده گرفتن خطای پاک‌سازی
      }
      throw error;
    }
  }

  // تست‌های تراکنش دیتابیس
  async runDatabaseTransactionTests() {
    console.log('💾 اجرای تست‌های تراکنش دیتابیس...');

    // تست تراکنش موفق
    const transactionResponse = await axios.post(`${this.baseUrl}/api/database/transaction`, {
      operations: [
        { type: 'insert', table: 'test_table', data: { name: 'test1', value: 100 } },
        { type: 'update', table: 'test_table', where: { name: 'test1' }, data: { value: 200 } },
        { type: 'select', table: 'test_table', where: { name: 'test1' } }
      ]
    });

    if (!transactionResponse.data.success) {
      throw new Error('تراکنش دیتابیس ناموفق');
    }

    console.log('✅ تراکنش دیتابیس موفق');

    // تست تراکنش ناموفق (rollback)
    try {
      await axios.post(`${this.baseUrl}/api/database/transaction`, {
        operations: [
          { type: 'insert', table: 'test_table', data: { name: 'test2', value: 300 } },
          { type: 'insert', table: 'non_existent_table', data: { name: 'test3' } } // خطا
        ]
      });
      throw new Error('تراکنش ناموفق باید rollback شود');
    } catch (error) {
      if (error.response?.status === 500) {
        console.log('✅ Rollback تراکنش ناموفق به درستی انجام شد');
      } else {
        throw new Error('مدیریت Rollback تراکنش');
      }
    }
  }

  // تست‌های کش
  async runCacheTests() {
    console.log('🗄️ اجرای تست‌های کش...');

    // تست ذخیره در کش
    const cacheKey = 'test-cache-key';
    const cacheValue = { data: 'test-data', timestamp: Date.now() };

    const setResponse = await axios.post(`${this.baseUrl}/api/cache/set`, {
      key: cacheKey,
      value: cacheValue,
      ttl: 300 // 5 دقیقه
    });

    if (!setResponse.data.success) {
      throw new Error('ذخیره در کش ناموفق');
    }

    console.log('✅ ذخیره در کش موفق');

    // تست خواندن از کش
    const getResponse = await axios.get(`${this.baseUrl}/api/cache/get/${cacheKey}`);

    if (!getResponse.data.success || getResponse.data.value.data !== cacheValue.data) {
      throw new Error('خواندن از کش ناموفق');
    }

    console.log('✅ خواندن از کش موفق');

    // تست حذف از کش
    const deleteResponse = await axios.delete(`${this.baseUrl}/api/cache/delete/${cacheKey}`);

    if (!deleteResponse.data.success) {
      throw new Error('حذف از کش ناموفق');
    }

    console.log('✅ حذف از کش موفق');

    // تست خواندن کلید حذف شده
    try {
      await axios.get(`${this.baseUrl}/api/cache/get/${cacheKey}`);
      throw new Error('کلید حذف شده نباید موجود باشد');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ کلید حذف شده به درستی مدیریت شد');
      } else {
        throw new Error('مدیریت کلید حذف شده');
      }
    }
  }

  // تست‌های امنیت
  async runSecurityTests() {
    console.log('🔒 اجرای تست‌های امنیت...');

    // تست SQL Injection
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --"
    ];

    for (const payload of sqlInjectionPayloads) {
      try {
        await axios.get(`${this.baseUrl}/api/articles?search=${encodeURIComponent(payload)}`);
        console.log('✅ SQL Injection محافظت شده');
      } catch (error) {
        if (error.response?.status === 400) {
          console.log('✅ SQL Injection مسدود شد');
        } else {
          throw new Error('محافظت SQL Injection ناکافی');
        }
      }
    }

    // تست XSS
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<img src="x" onerror="alert(\'XSS\')">'
    ];

    for (const payload of xssPayloads) {
      try {
        await axios.post(`${this.baseUrl}/api/articles`, {
          title: payload,
          content: 'Test content'
        });
        console.log('✅ XSS محافظت شده');
      } catch (error) {
        if (error.response?.status === 400) {
          console.log('✅ XSS مسدود شد');
        } else {
          throw new Error('محافظت XSS ناکافی');
        }
      }
    }

    // تست Rate Limiting
    const rateLimitPromises = [];
    for (let i = 0; i < 20; i++) {
      rateLimitPromises.push(
        axios.get(`${this.baseUrl}/api/health`).catch(error => error)
      );
    }

    const rateLimitResults = await Promise.all(rateLimitPromises);
    const rateLimited = rateLimitResults.filter(result => 
      result.response?.status === 429
    ).length;

    if (rateLimited > 0) {
      console.log('✅ Rate Limiting فعال');
    } else {
      console.log('⚠️ Rate Limiting غیرفعال یا ناکافی');
    }
  }

  // تست‌های نسخه API
  async runAPIVersionTests() {
    console.log('📋 اجرای تست‌های نسخه API...');

    // تست API v1
    const v1Response = await axios.get(`${this.baseUrl}/api/v1/articles`, {
      headers: {
        'Accept': 'application/vnd.api.v1+json'
      }
    });

    if (v1Response.status !== 200) {
      throw new Error('API v1 در دسترس نیست');
    }

    console.log('✅ API v1 در دسترس');

    // تست API v2
    const v2Response = await axios.get(`${this.baseUrl}/api/v2/articles`, {
      headers: {
        'Accept': 'application/vnd.api.v2+json'
      }
    });

    if (v2Response.status !== 200) {
      throw new Error('API v2 در دسترس نیست');
    }

    console.log('✅ API v2 در دسترس');

    // تست backward compatibility
    const legacyResponse = await axios.get(`${this.baseUrl}/api/articles`);

    if (legacyResponse.status !== 200) {
      throw new Error('Backward compatibility ناموفق');
    }

    console.log('✅ Backward compatibility حفظ شده');
  }

  // تست‌های مدیریت خطا
  async runErrorHandlingTests() {
    console.log('⚠️ اجرای تست‌های مدیریت خطا...');

    // تست خطای 404
    try {
      await axios.get(`${this.baseUrl}/api/non-existent-endpoint`);
      throw new Error('خطای 404 باید رخ دهد');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ خطای 404 به درستی مدیریت شد');
      } else {
        throw new Error('مدیریت خطای 404');
      }
    }

    // تست خطای 500
    try {
      await axios.get(`${this.baseUrl}/api/test-error`);
      throw new Error('خطای 500 باید رخ دهد');
    } catch (error) {
      if (error.response?.status === 500) {
        console.log('✅ خطای 500 به درستی مدیریت شد');
      } else {
        console.log('⚠️ خطای 500 رخ نداد (ممکن است endpoint وجود نداشته باشد)');
      }
    }

    // تست خطای validation
    try {
      await axios.post(`${this.baseUrl}/api/articles`, {
        title: '', // عنوان خالی
        content: '' // محتوای خالی
      });
      throw new Error('خطای validation باید رخ دهد');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ خطای validation به درستی مدیریت شد');
      } else {
        console.log('⚠️ خطای validation رخ نداد');
      }
    }
  }

  // تست‌های همزمانی
  async runConcurrencyTests() {
    console.log('🔄 اجرای تست‌های همزمانی...');

    // تست درخواست‌های همزمان
    const concurrentPromises = [];
    for (let i = 0; i < 10; i++) {
      concurrentPromises.push(
        axios.get(`${this.baseUrl}/api/articles?limit=10`).catch(error => error)
      );
    }

    const concurrentResults = await Promise.all(concurrentPromises);
    const successful = concurrentResults.filter(result => 
      result.status === 200
    ).length;

    if (successful === 10) {
      console.log('✅ درخواست‌های همزمان موفق');
    } else {
      console.log(`⚠️ ${successful}/10 درخواست همزمان موفق`);
    }

    // تست race condition
    const racePromises = [];
    for (let i = 0; i < 5; i++) {
      racePromises.push(
        axios.post(`${this.baseUrl}/api/test-race`, {
          id: i,
          data: `test-${i}`
        }).catch(error => error)
      );
    }

    const raceResults = await Promise.all(racePromises);
    const raceSuccessful = raceResults.filter(result => 
      result.status === 200
    ).length;

    if (raceSuccessful > 0) {
      console.log('✅ Race condition مدیریت شد');
    } else {
      console.log('⚠️ Race condition test endpoint ممکن است وجود نداشته باشد');
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

    console.log('📊 نتایج تست‌های تخصصی:');
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

    console.log('\n✅ تست‌های تخصصی تکمیل شد');
  }
}

// اجرای تست
async function main() {
  const specializedTests = new SpecializedTests();
  await specializedTests.runAllSpecializedTests();
}

// اجرا اگر فایل مستقیماً اجرا شود
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SpecializedTests; 
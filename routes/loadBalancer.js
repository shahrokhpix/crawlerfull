const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// دریافت وضعیت load balancer
router.get('/status', (req, res) => {
  try {
    if (!global.loadBalancerCron) {
      return res.status(503).json({
        error: 'Load balancer در دسترس نیست'
      });
    }

    const stats = global.loadBalancerCron.getStats();
    const loadBalancerStats = global.loadBalancerCron.loadBalancer.getCurrentConfig();
    
    res.json({
      status: 'success',
      data: {
        isRunning: stats.isRunning,
        loadBalancer: loadBalancerStats,
        activeJobs: stats.activeJobs,
        cronJobs: stats.cronJobs
      }
    });
  } catch (error) {
    logger.error('خطا در دریافت وضعیت load balancer:', error);
    res.status(500).json({
      error: 'خطا در دریافت وضعیت'
    });
  }
});

// تنظیم حالت بار
router.post('/mode', (req, res) => {
  try {
    const { mode } = req.body;
    
    if (!global.loadBalancerCron) {
      return res.status(503).json({
        error: 'Load balancer در دسترس نیست'
      });
    }

    if (!mode || !['normal', 'moderate', 'high', 'emergency'].includes(mode)) {
      return res.status(400).json({
        error: 'حالت نامعتبر. حالت‌های مجاز: normal, moderate, high, emergency'
      });
    }

    global.loadBalancerCron.loadBalancer.setLoadMode(mode);
    
    res.json({
      status: 'success',
      message: `حالت بار به ${mode} تغییر یافت`,
      data: {
        mode,
        config: global.loadBalancerCron.loadBalancer.loadModes[mode]
      }
    });
  } catch (error) {
    logger.error('خطا در تنظیم حالت بار:', error);
    res.status(500).json({
      error: 'خطا در تنظیم حالت بار'
    });
  }
});

// اجرای پاکسازی اضطراری
router.post('/emergency-cleanup', (req, res) => {
  try {
    if (!global.loadBalancerCron) {
      return res.status(503).json({
        error: 'Load balancer در دسترس نیست'
      });
    }

    // اجرای پاکسازی اضطراری
    global.loadBalancerCron.emergencyCleanup();
    
    res.json({
      status: 'success',
      message: 'پاکسازی اضطراری شروع شد'
    });
  } catch (error) {
    logger.error('خطا در پاکسازی اضطراری:', error);
    res.status(500).json({
      error: 'خطا در پاکسازی اضطراری'
    });
  }
});

// اجرای پاکسازی حافظه
router.post('/memory-cleanup', (req, res) => {
  try {
    if (!global.loadBalancerCron) {
      return res.status(503).json({
        error: 'Load balancer در دسترس نیست'
      });
    }

    // اجرای پاکسازی حافظه
    global.loadBalancerCron.performMemoryCleanup();
    
    res.json({
      status: 'success',
      message: 'پاکسازی حافظه شروع شد'
    });
  } catch (error) {
    logger.error('خطا در پاکسازی حافظه:', error);
    res.status(500).json({
      error: 'خطا در پاکسازی حافظه'
    });
  }
});

// اجرای بهینه‌سازی دیتابیس
router.post('/database-optimization', (req, res) => {
  try {
    if (!global.loadBalancerCron) {
      return res.status(503).json({
        error: 'Load balancer در دسترس نیست'
      });
    }

    // اجرای بهینه‌سازی دیتابیس
    global.loadBalancerCron.performDatabaseOptimization();
    
    res.json({
      status: 'success',
      message: 'بهینه‌سازی دیتابیس شروع شد'
    });
  } catch (error) {
    logger.error('خطا در بهینه‌سازی دیتابیس:', error);
    res.status(500).json({
      error: 'خطا در بهینه‌سازی دیتابیس'
    });
  }
});

// تنظیم آستانه‌ها
router.post('/thresholds', (req, res) => {
  try {
    const { cpu, memory, disk, database } = req.body;
    
    if (!global.loadBalancerCron) {
      return res.status(503).json({
        error: 'Load balancer در دسترس نیست'
      });
    }

    // تنظیم آستانه‌های جدید
    global.loadBalancerCron.loadBalancer.setThresholds(
      cpu || 70,
      memory || 75,
      disk || 85,
      database || 2000
    );
    
    res.json({
      status: 'success',
      message: 'آستانه‌ها به‌روزرسانی شدند',
      data: {
        cpu: cpu || 70,
        memory: memory || 75,
        disk: disk || 85,
        database: database || 2000
      }
    });
  } catch (error) {
    logger.error('خطا در تنظیم آستانه‌ها:', error);
    res.status(500).json({
      error: 'خطا در تنظیم آستانه‌ها'
    });
  }
});

// دریافت آمار سیستم
router.get('/system-stats', (req, res) => {
  try {
    if (!global.loadBalancerCron) {
      return res.status(503).json({
        error: 'Load balancer در دسترس نیست'
      });
    }

    const stats = global.loadBalancerCron.loadBalancer.systemStats;
    const loadLevel = global.loadBalancerCron.loadBalancer.determineLoadLevel();
    
    res.json({
      status: 'success',
      data: {
        stats,
        loadLevel,
        currentMode: global.loadBalancerCron.loadBalancer.currentMode,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('خطا در دریافت آمار سیستم:', error);
    res.status(500).json({
      error: 'خطا در دریافت آمار سیستم'
    });
  }
});

// شروع/توقف load balancer
router.post('/toggle', (req, res) => {
  try {
    if (!global.loadBalancerCron) {
      return res.status(503).json({
        error: 'Load balancer در دسترس نیست'
      });
    }

    const { action } = req.body;
    
    if (action === 'start') {
      global.loadBalancerCron.start();
      res.json({
        status: 'success',
        message: 'Load balancer شروع شد'
      });
    } else if (action === 'stop') {
      global.loadBalancerCron.stop();
      res.json({
        status: 'success',
        message: 'Load balancer متوقف شد'
      });
    } else {
      res.status(400).json({
        error: 'عملیات نامعتبر. عملیات‌های مجاز: start, stop'
      });
    }
  } catch (error) {
    logger.error('خطا در تغییر وضعیت load balancer:', error);
    res.status(500).json({
      error: 'خطا در تغییر وضعیت load balancer'
    });
  }
});

module.exports = router; 
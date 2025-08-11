const logger = require('../utils/logger');

// Global error handler
const globalErrorHandler = (error, req, res, next) => {
  try {
    // Log the error
    logger.error('Unhandled error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Prevent error details from being sent to client in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: error.message,
        stack: error.stack
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal Server Error'
      });
    }
  } catch (handlerError) {
    // If error handler itself fails, send basic error
    console.error('Error handler failed:', handlerError);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Database error handler
const databaseErrorHandler = (error) => {
  logger.error('Database error:', {
    message: error.message,
    code: error.code,
    detail: error.detail,
    hint: error.hint,
    position: error.position,
    timestamp: new Date().toISOString()
  });

  // Handle specific database errors
  switch (error.code) {
    case 'ECONNREFUSED':
      logger.error('Database connection refused - attempting reconnect');
      // Trigger reconnection logic
      if (global.connectionPool) {
        global.connectionPool.pool.end();
        // Reconnection will be handled by connection pool
      }
      break;
      
    case 'ENOTFOUND':
      logger.error('Database host not found');
      break;
      
    case 'ETIMEDOUT':
      logger.error('Database connection timeout');
      break;
      
    case '23505': // Unique violation
      logger.warn('Database unique constraint violation:', error.detail);
      break;
      
    case '23503': // Foreign key violation
      logger.warn('Database foreign key violation:', error.detail);
      break;
      
    case '42P01': // Undefined table
      logger.error('Database table not found:', error.detail);
      break;
      
    case '42703': // Undefined column
      logger.error('Database column not found:', error.detail);
      break;
      
    default:
      logger.error('Unknown database error:', error);
  }
};

// Memory error handler
const memoryErrorHandler = (error) => {
  logger.error('Memory error:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Trigger memory cleanup
  if (global.memoryManager) {
    global.memoryManager.emergencyCleanup();
  }
  
  if (global.cacheManager) {
    global.cacheManager.clearAll();
  }
  
  if (global.databaseOptimizer) {
    global.databaseOptimizer.clearCache();
  }
};

// Network error handler
const networkErrorHandler = (error) => {
  logger.error('Network error:', {
    message: error.message,
    code: error.code,
    url: error.config?.url,
    timestamp: new Date().toISOString()
  });

  // Handle specific network errors
  switch (error.code) {
    case 'ECONNRESET':
      logger.warn('Connection reset by peer');
      break;
      
    case 'ENOTFOUND':
      logger.warn('DNS lookup failed');
      break;
      
    case 'ETIMEDOUT':
      logger.warn('Request timeout');
      break;
      
    case 'ECONNREFUSED':
      logger.warn('Connection refused');
      break;
      
    default:
      logger.warn('Unknown network error:', error.code);
  }
};

// WebDriver error handler
const webDriverErrorHandler = (error) => {
  logger.error('WebDriver error:', {
    message: error.message,
    name: error.name,
    timestamp: new Date().toISOString()
  });

  // Handle specific WebDriver errors
  if (error.message.includes('Target closed')) {
    logger.warn('Browser target closed - attempting restart');
    if (global.webDriverOptimizer) {
      global.webDriverOptimizer.restart();
    }
  } else if (error.message.includes('Navigation timeout')) {
    logger.warn('Navigation timeout - increasing timeout');
    // Increase timeout for next requests
  } else if (error.message.includes('Protocol error')) {
    logger.warn('Protocol error - restarting browser');
    if (global.webDriverOptimizer) {
      global.webDriverOptimizer.restart();
    }
  }
};

// Process error handlers
const setupProcessErrorHandlers = () => {
  // Uncaught exception handler
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Attempt graceful shutdown
    gracefulShutdown('uncaughtException');
  });

  // Unhandled rejection handler
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', {
      reason: reason,
      promise: promise,
      timestamp: new Date().toISOString()
    });

    // Attempt graceful shutdown
    gracefulShutdown('unhandledRejection');
  });

  // SIGTERM handler
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received - starting graceful shutdown');
    gracefulShutdown('SIGTERM');
  });

  // SIGINT handler
  process.on('SIGINT', () => {
    logger.info('SIGINT received - starting graceful shutdown');
    gracefulShutdown('SIGINT');
  });

  // Warning handler
  process.on('warning', (warning) => {
    logger.warn('Process warning:', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
      timestamp: new Date().toISOString()
    });
  });
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`🛑 Starting graceful shutdown (${signal})...`);
  
  try {
    // Stop accepting new requests
    if (global.app) {
      global.app.close();
    }
    
    // Stop stability manager
    if (global.stabilityManager) {
      global.stabilityManager.stop();
    }
    
    // Stop performance monitor
    if (global.performanceMonitor) {
      global.performanceMonitor.stopMonitoring();
    }
    
    // Stop load balancer
    if (global.loadBalancerCron) {
      global.loadBalancerCron.stop();
    }
    
    // Close database connections
    if (global.connectionPool) {
      await global.connectionPool.pool.end();
    }
    
    // Close web drivers
    if (global.webDriverOptimizer) {
      await global.webDriverOptimizer.close();
    }
    
    // Clear caches
    if (global.cacheManager && typeof global.cacheManager.clearAll === 'function') {
      global.cacheManager.clearAll();
    }
    
    if (global.databaseOptimizer) {
      global.databaseOptimizer.clearCache();
    }
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Request timeout handler
const requestTimeoutHandler = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      logger.warn('Request timeout:', {
        url: req.url,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: 'Request timeout'
        });
      }
    }, timeout);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
};

// Rate limiting error handler
const rateLimitErrorHandler = (error) => {
  logger.warn('Rate limit exceeded:', {
    message: error.message,
    ip: error.ip,
    timestamp: new Date().toISOString()
  });
};

// Validation error handler
const validationErrorHandler = (error) => {
  logger.warn('Validation error:', {
    message: error.message,
    field: error.field,
    value: error.value,
    timestamp: new Date().toISOString()
  });
};

// Authentication error handler
const authErrorHandler = (error) => {
  logger.warn('Authentication error:', {
    message: error.message,
    ip: error.ip,
    userAgent: error.userAgent,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  globalErrorHandler,
  asyncHandler,
  databaseErrorHandler,
  memoryErrorHandler,
  networkErrorHandler,
  webDriverErrorHandler,
  setupProcessErrorHandlers,
  gracefulShutdown,
  requestTimeoutHandler,
  rateLimitErrorHandler,
  validationErrorHandler,
  authErrorHandler
};
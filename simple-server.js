const express = require("express");
const app = express();
const PORT = 3004;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple health endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'FarsNews Crawler Server is running',
    timestamp: new Date().toISOString()
  });
});

// Simple stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Stats endpoint working',
    server: 'FarsNews Crawler',
    version: '1.0.0'
  });
});

// Simple articles endpoint
app.get('/api/articles', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Articles endpoint working',
    articles: []
  });
});

// Simple sources endpoint
app.get('/api/sources', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Sources endpoint working',
    sources: []
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FarsNews Crawler Server ready at http://localhost:${PORT}`);
  console.log(`🔧 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`📰 RSS Feed available at: http://localhost:${PORT}/rss`);
  console.log(`📊 API Endpoints:`);
  console.log(`   GET /api/health - Health check`);
  console.log(`   GET /api/stats - Get statistics`);
  console.log(`   GET /api/articles - Get articles`);
  console.log(`   GET /api/sources - Get sources`);
  console.log(``);
  console.log(`👤 Server is running in simplified mode`);
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('🛑 Server shutting down...');
  process.exit(0);
}); 
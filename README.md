# 🚀 Advanced News Crawler

A production-ready news crawling platform with an admin panel, full REST API, PostgreSQL, Redis, WebSockets, and first-class Docker support.

## 🌟 Key Features

- **Docker-first**: One-command setup, reproducible builds (Node 20 Alpine)
- **Universal crawler**: Pluggable news sources with simple CSS selectors
- **Simple selectors**: Easy-to-use CSS selectors (.pb-3 a, .prosed, .pb-2)
- **Admin panel**: Manage sources, schedules, logs
- **Real-time logs**: WebSocket streaming
- **PostgreSQL + Redis**: Reliable storage and caching
- **Robust logging and scheduling**
- **Iran-optimized**: Built with Iranian npm mirrors for better reliability

## 🎯 Simple CSS Selectors

The crawler now uses simple, easy-to-understand CSS selectors:

```sql
-- Example selectors for FarsNews
list_selector: '.pb-3 a'     -- Extract links from .pb-3 containers
title_selector: '.prosed'    -- Extract article titles
content_selector: '.pb-2'    -- Extract article content
```

### How it works:
1. **List selector** (`.pb-3 a`): Finds all `<a>` tags inside elements with class `.pb-3`
2. **Title selector** (`.prosed`): Extracts text from elements with class `.prosed`
3. **Content selector** (`.pb-2`): Extracts text from elements with class `.pb-2`

### Benefits:
- ✅ **Simple and readable**: Easy to understand and modify
- ✅ **Flexible**: Can be easily changed for different websites
- ✅ **Reliable**: Works consistently across different page structures
- ✅ **Maintainable**: No complex regex or XPath needed

## ⚙️ Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

## 🚀 Quick Start (Recommended)

```bash
# 1) Clone
git clone https://github.com/shahrokhpix/crawlerfull.git
cd crawlerfull

# 2) Environment
cp .env.example .env
# Edit .env if needed (DB_PASSWORD, ADMIN credentials, etc.)

# 3) Build and run (Linux/macOS)
chmod +x docker-start.sh
./docker-start.sh --iran   # uses Node 20 Alpine + Iran mirrors

# Windows (PowerShell or CMD)
./docker-start.bat --iran
```

Service access (default host):
- Admin Panel: http://localhost:3005/admin
- API: http://localhost:3005/api
- RSS: http://localhost:3005/rss
- PostgreSQL: localhost:5433 (db=crawler_db user=crawler_user)
- Redis: localhost:6380

Ports are mapped as follows:
- App 3005 -> container 3004
- PostgreSQL 5433 -> 5432
- Redis 6380 -> 6379

## 🔌 API Endpoints

### Legacy Endpoint (FarsNews)
```bash
# Get latest articles
curl "http://localhost:3005/api/farsnews?limit=5&full=true"

# Parameters:
# - limit: Number of articles (default: 10, max: 100)
# - full: Include full content (true/false)
# - depth: Crawl depth (0-5)
```

### Universal Crawler API
```bash
# Crawl any source
curl -X POST "http://localhost:3005/api/crawler/crawl" \
  -H "Content-Type: application/json" \
  -d '{"sourceId": 1, "limit": 5, "fullContent": true}'

# Test selectors
curl -X POST "http://localhost:3005/api/crawler/test-selector" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.farsnews.ir/showcase", "selector": ".pb-3 a", "type": "list"}'
```

### Health Check
```bash
curl "http://localhost:3005/api/health"
```

### Admin Authentication
```bash
# Login (default: admin/admin123)
curl -X POST "http://localhost:3005/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

## 🧪 Testing & Debugging

### Test Simple Selectors
```bash
# Test selectors on actual page
docker exec crawler_app node /app/test-simple-selectors.js

# Debug crawl process
docker exec crawler_app node /app/debug-crawl.js
```

### Database Queries
```bash
# Check current selectors
docker exec crawler_postgres psql -U crawler_user -d crawler_db -c "SELECT name, list_selector, title_selector, content_selector FROM news_sources;"

# Update selectors
docker exec crawler_postgres psql -U crawler_user -d crawler_db -c "UPDATE news_sources SET list_selector = '.pb-3 a', title_selector = '.prosed', content_selector = '.pb-2' WHERE name = 'فارس‌نیوز';"
```

### View Logs
```bash
# Container logs
docker-compose -f docker-compose-simple.yml logs -f crawler

# Application logs
docker exec crawler_app tail -f /app/logs/crawler-$(date +%Y-%m-%d).log
```

### Manual Testing
```bash
# Test legacy endpoint
curl "http://localhost:3005/api/farsnews?limit=2&full=true"

# Test universal crawler
curl -X POST "http://localhost:3005/api/crawler/crawl" \
  -H "Content-Type: application/json" \
  -d '{"sourceId": 1, "limit": 2, "fullContent": true}'
```

## 🇮🇷 Iran-friendly build
We provide an Iran-optimized build path (Dockerfile.iran) using `npmmirror` to improve reliability.
- Linux/macOS: `./docker-start.sh --iran`
- Windows: `docker-start.bat --iran`

## 🧰 Other run modes
```bash
./docker-start.sh --full          # default full stack
./docker-start.sh --no-nginx      # run without nginx
./docker-start.sh --pm2           # pm2 profile
./docker-start.sh --dev           # compose + compose.dev
./docker-start.sh --no-puppeteer  # build without puppeteer
./docker-start.sh --alpine        # force Dockerfile.alpine
./docker-start.sh --clean         # prune and rebuild
```

Windows equivalents: pass the same flags to `docker-start.bat`.

## 🔐 Database bootstrap
- On first run, the init script creates both the role and database if missing:
  - Role: `crawler_user`
  - Database: `crawler_db`
  - Password: from `.env` (`DB_PASSWORD`, default `your_secure_password`)
- Schema, indices, seed data, and default admin user are created idempotently.

Manual DB check:
```bash
docker-compose exec postgres psql -U crawler_user -d crawler_db -c "\dt"
```

## 🧪 Tests
```bash
cd test
node quick-test.js
node stress-test.js
node advanced-stress-test.js
```

## 📚 More Docs
- Docker guide: README-Docker.md
- Server deployment: SERVER_DEPLOYMENT_GUIDE.md

## �� Troubleshooting

- **Health check / app restart loop**:
  - Ensure ports 3005, 5433, 6380 are free
  - Use clean start: `./docker-start.sh --clean`
- **PostgreSQL role/database missing or corrupted data volume**:
  - `chmod +x fix-postgres.sh && ./fix-postgres.sh`
- **Slow installs from Iran**:
  - Use `--iran` mode to enable mirrors
- **Crawling returns 0 articles**:
  - Check selector syntax in database: `docker exec crawler_postgres psql -U crawler_user -d crawler_db -c "SELECT list_selector, title_selector, content_selector FROM news_sources WHERE name = 'فارس‌نیوز';"`
  - Update selectors if needed: `docker exec crawler_postgres psql -U crawler_user -d crawler_db -c "UPDATE news_sources SET list_selector = '.pb-3 a', title_selector = '.prosed', content_selector = '.pb-2' WHERE name = 'فارس‌نیوز';"`
- **Invalid CSS selector errors**:
  - Use simple selectors like `.pb-3 a` instead of complex ones
  - Test selectors manually: `docker exec crawler_app node /app/test-simple-selectors.js`
- **PowerShell ampersand errors**:
  - Use `Start-Process` or run commands without `&` in PowerShell
  - Use CMD instead of PowerShell for Docker commands

## 📦 Project Structure
```
project/
├── index.js                 # Main app
├── config/                  # Configs
├── services/                # Core services
├── routes/                  # API routes
├── middleware/              # Middlewares
├── public/                  # Admin UI
├── scripts/                 # DB init, helpers
├── logs/                    # Logs
├── utils/                   # Utilities
├── test/                    # Tests
├── docker-compose.yml       # Docker Compose
├── Dockerfile*              # Build variants (iran, alpine, no-puppeteer)
└── docker-start.*           # Non-interactive start scripts
```

## 🔒 Security checklist
- Change default admin password in `.env`
- If exposed to the internet, place behind HTTPS (nginx) and restrict access
- Rotate JWT/Session secrets

## 🤝 Contributing
1) Fork  2) `git checkout -b feature/...`  3) Commit  4) Push  5) PR

## 📄 License
MIT
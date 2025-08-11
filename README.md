# 🚀 Advanced News Crawler

A production-ready news crawling platform with an admin panel, full REST API, PostgreSQL, Redis, WebSockets, and first-class Docker support.

## 🌟 Key Features

- **Docker-first**: One-command setup, reproducible builds (Node 20 Alpine)
- **Universal crawler**: Pluggable news sources and selectors
- **Admin panel**: Manage sources, schedules, logs
- **Real-time logs**: WebSocket streaming
- **PostgreSQL + Redis**: Reliable storage and caching
- **Robust logging and scheduling**

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

## 🐛 Troubleshooting

- Health check / app restart loop:
  - Ensure ports 3005, 5433, 6380 are free
  - Use clean start: `./docker-start.sh --clean`
- PostgreSQL role/database missing or corrupted data volume:
  - `chmod +x fix-postgres.sh && ./fix-postgres.sh`
- Slow installs from Iran:
  - Use `--iran` mode to enable mirrors

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
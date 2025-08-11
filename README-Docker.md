# Docker Guide for Advanced News Crawler

## 🐳 Requirements
- Docker 20.10+
- Docker Compose 2.0+

## 🚀 Quick Start

```bash
git clone https://github.com/shahrokhpix/crawlerfull.git
cd crawlerfull
cp .env.example .env

# Linux/macOS
chmod +x docker-start.sh
./docker-start.sh --iran   # Node 20 Alpine + Iran mirrors

# Windows
./docker-start.bat --iran
```

## 🔌 Service Access (defaults)
- Admin Panel: http://localhost:3005/admin
- API: http://localhost:3005/api
- RSS: http://localhost:3005/rss
- PostgreSQL: localhost:5433 (db=crawler_db user=crawler_user)
- Redis: localhost:6380

Ports mapping:
- App: 3005 -> 3004
- PG: 5433 -> 5432
- Redis: 6380 -> 6379

## 🧱 Dockerfile (Node 20 Alpine)
```dockerfile
FROM node:20-alpine
RUN apk add --no-cache chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts && npm cache clean --force
COPY . .
EXPOSE 3004
CMD ["npm","start"]
```

## 🧩 docker-compose.yml (excerpt)
```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: crawler_db
      POSTGRES_USER: crawler_user
      POSTGRES_PASSWORD: ${DB_PASSWORD:-your_secure_password}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-postgres.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5433:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports:
      - "6380:6379"
    volumes:
      - redis_data:/data

  crawler:
    build:
      context: .
      dockerfile: ${DOCKERFILE:-Dockerfile}
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=crawler_db
      - DB_USER=crawler_user
      - DB_PASSWORD=${DB_PASSWORD:-your_secure_password}
    ports:
      - "3005:3004"
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
  redis_data:
```

## 🇮🇷 Iran mirrors
The Iran build path `Dockerfile.iran` uses `https://registry.npmmirror.com` and related mirrors. Use `--iran` flag in the start scripts.

## 🗄️ Database initialization
On the first run, `scripts/init-postgres.sql` will:
- Create role `crawler_user` (LOGIN) if missing
- Create database `crawler_db` owned by `crawler_user` if missing
- Create schema, indices, and seed data
- Grant all privileges to `crawler_user`

Check DB:
```bash
docker-compose exec postgres psql -U crawler_user -d crawler_db -c "\dt"
```

## 🔧 Useful commands
```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
./docker-start.sh --clean   # prune + rebuild
```

## 🔐 Security notes
- Change DB and admin passwords in `.env`
- Use HTTPS with nginx in production
- Restrict firewall ports when exposing publicly
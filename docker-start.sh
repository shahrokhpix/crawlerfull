#!/bin/bash

set -euo pipefail

MODE="full"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --full) MODE="full"; shift ;;
    --no-nginx) MODE="no-nginx"; shift ;;
    --pm2) MODE="pm2"; shift ;;
    --dev) MODE="dev"; shift ;;
    --no-puppeteer) MODE="no-puppeteer"; shift ;;
    --alpine) MODE="alpine"; shift ;;
    --iran) MODE="iran"; shift ;;
    --clean) MODE="clean"; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if ! command -v docker &> /dev/null; then echo "Docker not found"; exit 1; fi
if ! command -v docker-compose &> /dev/null; then echo "Docker Compose not found"; exit 1; fi

[ -f .env ] || cp .env.example .env

echo "Building with Node 20 Alpine..."
DOCKERFILE_OPT="Dockerfile.iran"

case "$MODE" in
  full)
    docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=$DOCKERFILE_OPT
    docker-compose up -d
    ;;
  no-nginx)
    docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=$DOCKERFILE_OPT
    docker-compose up -d postgres redis crawler
    ;;
  pm2)
    docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=$DOCKERFILE_OPT
    docker-compose --profile pm2 up -d
    ;;
  dev)
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --build-arg DOCKERFILE=$DOCKERFILE_OPT
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    ;;
  no-puppeteer)
    docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.no-puppeteer
    docker-compose up -d postgres redis crawler
    ;;
  alpine)
    docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.alpine
    docker-compose up -d
    ;;
  iran)
    docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.iran
    docker-compose up -d
    ;;
  clean)
    docker-compose down -v || true
    docker system prune -a -f --volumes || true
    docker-compose -f docker-compose.yml build --no-cache --build-arg DOCKERFILE=$DOCKERFILE_OPT
    docker-compose up -d
    ;;
  *) echo "Unknown mode"; exit 1 ;;
esac

echo "Waiting for services..."; sleep 10

docker-compose ps

echo "Service access:"
echo "  Admin:  http://localhost:3005/admin"
echo "  API:    http://localhost:3005/api"
echo "  RSS:    http://localhost:3005/rss"
echo "  PG:     localhost:5433"
echo "  Redis:  localhost:6380" 
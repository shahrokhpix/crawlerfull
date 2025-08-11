#!/bin/bash

echo "🚀 Quick Start - News Crawler"
echo "========================================"

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Remove old volumes
echo "🧹 Cleaning old volumes..."
docker volume rm crawlerfull_postgres_data 2>/dev/null || true
docker volume rm crawlerfull_redis_data 2>/dev/null || true

# Start services in order
echo "📦 Starting PostgreSQL..."
docker-compose up -d postgres

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 20

echo "📦 Starting Redis..."
docker-compose up -d redis

echo "⏳ Waiting for Redis to be ready..."
sleep 10

echo "📦 Starting Application..."
docker-compose up -d crawler

echo "⏳ Waiting for application to start..."
sleep 30

echo ""
echo "📊 Container status:"
docker-compose ps

echo ""
echo "🌐 Service access:"
echo "   Admin Panel: http://YOUR_SERVER_IP:3005/admin"
echo "   API: http://YOUR_SERVER_IP:3005/api"
echo "   RSS Feed: http://YOUR_SERVER_IP:3005/rss"
echo "   PostgreSQL: YOUR_SERVER_IP:5433"
echo "   Redis: YOUR_SERVER_IP:6380"
echo ""

echo "🔍 Checking application health..."
sleep 10
curl -f http://localhost:3005/api/health 2>/dev/null && echo "✅ Application is healthy!" || echo "⚠️ Application is starting..."

echo ""
echo "Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop: docker-compose down"
echo "  Restart: docker-compose restart"
echo "" 
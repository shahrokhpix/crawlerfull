#!/bin/bash

echo "🔄 Restarting with correct port configuration"
echo "========================================"

# Stop all containers
echo "🛑 Stopping all containers..."
docker-compose down

# Remove old containers and images
echo "🧹 Cleaning old containers and images..."
docker-compose rm -f
docker image rm crawlerfull-crawler 2>/dev/null || true

# Rebuild with correct port
echo "📦 Rebuilding with correct port configuration..."
docker-compose build --no-cache

# Start services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

echo ""
echo "📊 Container status:"
docker-compose ps

echo ""
echo "🌐 Service access:"
echo "   Admin Panel: http://188.121.119.135:3005/admin"
echo "   API: http://188.121.119.135:3005/api"
echo "   RSS Feed: http://188.121.119.135:3005/rss"
echo "   PostgreSQL: 188.121.119.135:5433"
echo "   Redis: 188.121.119.135:6380"
echo ""

echo "🔍 Checking application health..."
sleep 10
curl -f http://localhost:3005/api/health 2>/dev/null && echo "✅ Application is healthy!" || echo "⚠️ Application is starting..."

echo ""
echo "📋 Port mapping check:"
docker-compose ps --format "table {{.Name}}\t{{.Ports}}"

echo ""
echo "Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop: docker-compose down"
echo "  Restart: docker-compose restart"
echo "" 
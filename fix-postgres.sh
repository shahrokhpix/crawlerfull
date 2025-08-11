#!/bin/bash

echo "🔧 Fixing PostgreSQL Issues"
echo "========================================"

# Stop all containers
echo "🛑 Stopping all containers..."
docker-compose down

# Remove PostgreSQL volume completely
echo "🧹 Removing PostgreSQL volume..."
docker volume rm crawlerfull_postgres_data 2>/dev/null || true

# Remove any existing PostgreSQL containers
echo "🧹 Removing existing PostgreSQL containers..."
docker rm -f crawler_postgres 2>/dev/null || true

# Start PostgreSQL first
echo "📦 Starting PostgreSQL..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to initialize..."
sleep 30

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL status..."
docker-compose ps postgres

# Test PostgreSQL connection
echo "🔍 Testing PostgreSQL connection..."
docker-compose exec postgres pg_isready -U crawler_user -d crawler_db

if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL is ready!"
    
    # Start Redis
    echo "📦 Starting Redis..."
    docker-compose up -d redis
    
    # Wait for Redis
    sleep 10
    
    # Start Application
    echo "📦 Starting Application..."
    docker-compose up -d crawler
    
    # Wait for application
    echo "⏳ Waiting for application to start..."
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
    
    echo "🔍 Testing application health..."
    sleep 10
    curl -f http://localhost:3005/api/health 2>/dev/null && echo "✅ Application is healthy!" || echo "⚠️ Application is starting..."
    
else
    echo "❌ PostgreSQL failed to start properly"
    echo "📋 PostgreSQL logs:"
    docker-compose logs postgres
    exit 1
fi

echo ""
echo "Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop: docker-compose down"
echo "  Restart: docker-compose restart"
echo "" 
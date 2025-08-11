#!/bin/bash

# Docker Debug Script for Crawler Project
# Use this to check logs and debug issues

echo "=== Docker Debug Helper ==="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    exit 1
fi

echo "🔍 Available commands:"
echo "1. Show all container status"
echo "2. Show PostgreSQL logs"
echo "3. Show application logs"
echo "4. Show Redis logs"
echo "5. Show all logs (live)"
echo "6. Connect to PostgreSQL"
echo "7. Reset everything and restart"
echo "8. Show container resource usage"
echo ""

read -p "Select option (1-8): " choice

case $choice in
    1)
        echo "📊 Container Status:"
        docker-compose ps
        echo ""
        echo "🔍 Detailed Status:"
        docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ;;
    2)
        echo "📜 PostgreSQL Logs (last 50 lines):"
        docker-compose logs --tail=50 postgres
        echo ""
        echo "🔴 Follow PostgreSQL logs (Ctrl+C to stop):"
        docker-compose logs -f postgres
        ;;
    3)
        echo "📜 Application Logs (last 50 lines):"
        docker-compose logs --tail=50 crawler
        echo ""
        echo "🔴 Follow Application logs (Ctrl+C to stop):"
        docker-compose logs -f crawler
        ;;
    4)
        echo "📜 Redis Logs (last 50 lines):"
        docker-compose logs --tail=50 redis
        ;;
    5)
        echo "📜 All Service Logs (live - Ctrl+C to stop):"
        docker-compose logs -f
        ;;
    6)
        echo "🔌 Connecting to PostgreSQL..."
        docker exec -it crawler_postgres psql -U crawler_user -d crawler_db
        ;;
    7)
        echo "🔄 Resetting everything..."
        docker-compose down -v
        docker system prune -f
        echo "🚀 Starting fresh..."
        docker-compose up -d --build
        echo "⏳ Waiting for services..."
        sleep 15
        docker-compose ps
        ;;
    8)
        echo "💻 Container Resource Usage:"
        docker stats --no-stream
        ;;
    *)
        echo "❌ Invalid option"
        ;;
esac

echo ""
echo "🌐 Service URLs:"
echo "  Admin Panel: http://localhost:3005/admin"
echo "  API Health:  http://localhost:3005/api/health"
echo "  PostgreSQL:  localhost:5433"
echo "  Redis:       localhost:6380" 
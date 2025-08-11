#!/bin/bash

echo "🔧 Fixing Docker Issues"
echo "========================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi

echo "✅ Docker is ready"
echo ""

echo "Select issue to fix:"
echo "1. Fix Puppeteer download issues"
echo "2. Fix memory issues"
echo "3. Fix network issues"
echo "4. Fix permission issues"
echo "5. Fix PostgreSQL health check issues"
echo "6. Complete cleanup and restart"
echo ""

read -p "Please select issue to fix (1-6): " choice

case $choice in
    1)
        echo "🔧 Fixing Puppeteer download issues..."
        
        # Stop containers
        docker-compose down
        
        # Clean cache
        docker system prune -f
        
        # Rebuild with Puppeteer settings
        echo "📦 Rebuilding with Puppeteer settings..."
        docker-compose build --no-cache --build-arg DOCKERFILE=Dockerfile.iran
        
        # Start
        docker-compose up -d
        
        echo "✅ Puppeteer download issues fixed"
        ;;
    2)
        echo "🔧 Fixing memory issues..."
        
        # Clean unused images
        docker image prune -a -f
        
        # Clean stopped containers
        docker container prune -f
        
        # Clean unused volumes
        docker volume prune -f
        
        # Clean unused networks
        docker network prune -f
        
        echo "✅ Memory cleaned"
        ;;
    3)
        echo "🔧 Fixing network issues..."
        
        # Stop containers
        docker-compose down
        
        # Clean networks
        docker network prune -f
        
        # Restart
        docker-compose up -d
        
        echo "✅ Network reset"
        ;;
    4)
        echo "🔧 Fixing permission issues..."
        
        # Set file permissions
        chmod +x *.sh
        chmod 755 logs data config public
        
        # Set ownership
        sudo chown -R $USER:$USER .
        
        echo "✅ Permissions fixed"
        ;;
    5)
        echo "🔧 Fixing PostgreSQL health check issues..."
        
        # Stop containers
        docker-compose down
        
        # Remove PostgreSQL volume
        docker volume rm crawlerfull_postgres_data
        
        # Start PostgreSQL first
        docker-compose up -d postgres
        
        # Wait for PostgreSQL to be ready
        echo "⏳ Waiting for PostgreSQL to be ready..."
        sleep 30
        
        # Start other services
        docker-compose up -d redis crawler
        
        echo "✅ PostgreSQL health check issues fixed"
        ;;
    6)
        echo "🧹 Complete cleanup and restart..."
        
        # Stop all containers
        docker-compose down -v
        
        # Clean everything
        docker system prune -a -f --volumes
        
        # Remove temporary files
        rm -rf node_modules package-lock.json
        
        # Reinstall
        npm install
        
        # Rebuild
        docker-compose build --no-cache
        
        # Start
        docker-compose up -d
        
        echo "✅ System completely reset"
        ;;
    *)
        echo "❌ Invalid selection"
        exit 1
        ;;
esac

echo ""
echo "📊 Container status:"
docker-compose ps

echo ""
echo "🌐 Service access:"
echo "   Admin Panel: http://localhost:3005/admin"
echo "   API: http://localhost:3005/api"
echo "   RSS Feed: http://localhost:3005/rss"
echo "   PostgreSQL: localhost:5433"
echo "   Redis: localhost:6380"
echo "" 
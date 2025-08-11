#!/bin/bash

echo "🐳 Starting News Crawler with Docker"
echo "========================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker and Docker Compose are ready"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️ .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please check the settings."
    echo ""
fi

echo "Select execution type:"
echo "1. Full execution (Recommended)"
echo "2. Execute without Nginx"
echo "3. Execute with PM2"
echo "4. Execute in development mode"
echo "5. Execute without Puppeteer (for problematic servers)"
echo "6. Execute with alternative Dockerfile"
echo "7. Execute with Iranian mirrors (Recommended for Iran)"
echo "8. Clean and restart"
echo ""

read -p "Please select execution type (1-8): " choice

case $choice in
    1)
        echo "🚀 Starting full project..."
        docker-compose up -d
        ;;
    2)
        echo "🚀 Execute without Nginx..."
        docker-compose up -d postgres redis crawler
        ;;
    3)
        echo "🚀 Execute with PM2..."
        docker-compose --profile pm2 up -d
        ;;
    4)
        echo "🚀 Execute in development mode..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
        ;;
    5)
        echo "🚀 Execute without Puppeteer..."
        docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.no-puppeteer
        docker-compose up -d postgres redis crawler
        ;;
    6)
        echo "🚀 Execute with alternative Dockerfile..."
        docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.alpine
        docker-compose up -d
        ;;
    7)
        echo "🚀 Execute with Iranian mirrors..."
        docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.iran
        docker-compose up -d
        ;;
    8)
        echo "🧹 Clean and restart..."
        docker-compose down -v
        docker-compose build --no-cache
        docker-compose up -d
        ;;
    *)
        echo "❌ Invalid selection"
        exit 1
        ;;
esac

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

echo ""
echo "📊 Container status:"
docker-compose ps

echo ""
echo "🌐 Service access:"
echo "   Admin Panel: http://localhost:3004/admin"
echo "   API: http://localhost:3004/api"
echo "   RSS Feed: http://localhost:3004/rss"
echo ""

echo "Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop: docker-compose down"
echo "  Restart: docker-compose restart"
echo "" 
.PHONY: help build up down restart logs shell clean backup restore health

# Default target
help:
	@echo "FarsNews Crawler - Docker Management"
	@echo "===================================="
	@echo "Available commands:"
	@echo "  build     - Build the Docker image"
	@echo "  up        - Start the application"
	@echo "  down      - Stop the application"
	@echo "  restart   - Restart the application"
	@echo "  logs      - Show application logs"
	@echo "  shell     - Access container shell"
	@echo "  clean     - Clean up Docker resources"
	@echo "  backup    - Create backup of data"
	@echo "  restore   - Restore from backup"
	@echo "  health    - Check application health"
	@echo "  prod-up   - Start with production config"
	@echo "  prod-down - Stop production setup"
	@echo "  monitor   - Start with monitoring"
	@echo ""
	@echo "Usage: make <command>"

# Development commands
build:
	@echo "Building Docker image..."
	docker-compose build

up:
	@echo "Starting application..."
	docker-compose up -d
	@echo "Application started at http://localhost:3004"

down:
	@echo "Stopping application..."
	docker-compose down

restart:
	@echo "Restarting application..."
	docker-compose restart

logs:
	@echo "Showing application logs..."
	docker-compose logs -f

shell:
	@echo "Accessing container shell..."
	docker-compose exec farsnews-crawler bash

# Production commands
prod-up:
	@echo "Starting production setup..."
	docker-compose -f docker-compose.prod.yml up -d
	@echo "Production application started"

prod-down:
	@echo "Stopping production setup..."
	docker-compose -f docker-compose.prod.yml down

prod-logs:
	@echo "Showing production logs..."
	docker-compose -f docker-compose.prod.yml logs -f

# Monitoring
monitor:
	@echo "Starting with monitoring..."
	docker-compose -f docker-compose.prod.yml --profile monitoring up -d
	@echo "Monitoring available at:"
	@echo "  Prometheus: http://localhost:9090"
	@echo "  Grafana: http://localhost:3000 (admin/admin)"

# Maintenance commands
clean:
	@echo "Cleaning up Docker resources..."
	docker-compose down -v
	docker system prune -f
	docker volume prune -f

clean-all:
	@echo "Cleaning up all Docker resources..."
	docker-compose down -v --rmi all
	docker system prune -a -f

backup:
	@echo "Creating backup..."
	@mkdir -p backups
	@tar -czf backups/farsnews-backup-$$(date +%Y%m%d_%H%M%S).tar.gz data logs
	@echo "Backup created in backups/ directory"

restore:
	@echo "Available backups:"
	@ls -la backups/ 2>/dev/null || echo "No backups found"
	@echo "To restore: tar -xzf backups/backup-file.tar.gz"

# Health and status
health:
	@echo "Checking application health..."
	@docker-compose ps
	@echo ""
	@echo "Testing HTTP endpoint..."
	@curl -f http://localhost:3004/ > /dev/null 2>&1 && echo "✅ Application is healthy" || echo "❌ Application is not responding"

status:
	@echo "Container status:"
	@docker-compose ps
	@echo ""
	@echo "Resource usage:"
	@docker stats --no-stream farsnews-crawler 2>/dev/null || echo "Container not running"

# Development helpers
dev:
	@echo "Starting development environment..."
	docker-compose up

dev-build:
	@echo "Building and starting development environment..."
	docker-compose up --build

update:
	@echo "Updating application..."
	docker-compose pull
	docker-compose up -d

# Database operations
db-backup:
	@echo "Backing up PostgreSQL database..."
	@mkdir -p backups
	@docker-compose exec -T farsnews-crawler pg_dump -U farsnews_user farsnews_crawler_spider_db > backups/postgresql-backup-$$(date +%Y%m%d_%H%M%S).sql
	@echo "PostgreSQL database backup created"

db-shell:
	@echo "Accessing database shell..."
	docker-compose exec farsnews-crawler psql -U farsnews_user -d farsnews_crawler_spider_db

# Nginx operations (when using production setup)
nginx-reload:
	@echo "Reloading Nginx configuration..."
	docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

nginx-test:
	@echo "Testing Nginx configuration..."
	docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# SSL certificate operations
ssl-generate:
	@echo "Generating self-signed SSL certificate..."
	@mkdir -p ssl
	@openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout ssl/private.key \
		-out ssl/certificate.crt \
		-subj "/C=IR/ST=Tehran/L=Tehran/O=FarsNews/CN=localhost"
	@echo "SSL certificate generated in ssl/ directory"

# Quick commands
quick-start: build up
	@echo "Quick start completed!"

quick-stop: down clean
	@echo "Quick stop completed!"

# Install dependencies
install-deps:
	@echo "Installing system dependencies..."
	@command -v docker >/dev/null 2>&1 || { echo "Docker not found. Please install Docker first."; exit 1; }
	@command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose not found. Please install Docker Compose first."; exit 1; }
	@echo "All dependencies are installed!"

# Show configuration
config:
	@echo "Current configuration:"
	@docker-compose config

config-prod:
	@echo "Production configuration:"
	@docker-compose -f docker-compose.prod.yml config
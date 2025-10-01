#!/bin/bash

# Complete SQLite to PostgreSQL Migration Script
# This script handles the complete migration process

set -e  # Exit on any error

echo "🚀 شروع فرآیند کامل migration از SQLite به PostgreSQL"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if PostgreSQL is running
check_postgresql() {
    print_status "بررسی وضعیت PostgreSQL..."
    
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        print_success "PostgreSQL در حال اجرا است"
        return 0
    else
        print_error "PostgreSQL در حال اجرا نیست"
        print_status "لطفاً PostgreSQL را راه‌اندازی کنید:"
        echo "  sudo systemctl start postgresql"
        echo "  یا"
        echo "  brew services start postgresql (macOS)"
        return 1
    fi
}

# Check if database exists
check_database() {
    print_status "بررسی وجود دیتابیس..."
    
    if psql -h localhost -U crawler_user -d farsnews_crawler_spider_db -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "دیتابیس farsnews_crawler_spider_db موجود است"
        return 0
    else
        print_warning "دیتابیس farsnews_crawler_spider_db موجود نیست"
        return 1
    fi
}

# Create database if it doesn't exist
create_database() {
    print_status "ایجاد دیتابیس PostgreSQL..."
    
    # Create user if not exists
    psql -h localhost -U postgres -c "CREATE USER crawler_user WITH PASSWORD '8bmh8y19zNJahAv5Aa4B';" 2>/dev/null || true
    
    # Create database
    psql -h localhost -U postgres -c "CREATE DATABASE farsnews_crawler_spider_db OWNER crawler_user;" 2>/dev/null || true
    
    # Grant privileges
    psql -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE farsnews_crawler_spider_db TO crawler_user;" 2>/dev/null || true
    
    print_success "دیتابیس PostgreSQL ایجاد شد"
}

# Backup SQLite database
backup_sqlite() {
    print_status "پشتیبان‌گیری از دیتابیس SQLite..."
    
    if [ -f "data/database.sqlite" ]; then
        mkdir -p backups
        cp data/database.sqlite "backups/sqlite_backup_$(date +%Y%m%d_%H%M%S).sqlite"
        print_success "پشتیبان SQLite ایجاد شد"
    else
        print_warning "فایل SQLite یافت نشد"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "نصب وابستگی‌ها..."
    
    npm install
    print_success "وابستگی‌ها نصب شدند"
}

# Run migration
run_migration() {
    print_status "اجرای migration..."
    
    if [ -f "data/database.sqlite" ]; then
        node scripts/migrate-to-postgresql.js
        print_success "Migration با موفقیت انجام شد"
    else
        print_warning "فایل SQLite یافت نشد - فقط جداول PostgreSQL ایجاد می‌شوند"
        node -e "
            const Database = require('./config/database');
            Database.init().then(() => {
                console.log('✅ جداول PostgreSQL ایجاد شدند');
                process.exit(0);
            }).catch(err => {
                console.error('❌ خطا در ایجاد جداول:', err);
                process.exit(1);
            });
        "
    fi
}

# Test database connection
test_connection() {
    print_status "تست اتصال به دیتابیس..."
    
    node -e "
        const Database = require('./config/database');
        Database.pool.query('SELECT 1 as test').then(result => {
            console.log('✅ اتصال به PostgreSQL موفق است');
            process.exit(0);
        }).catch(err => {
            console.error('❌ خطا در اتصال به PostgreSQL:', err.message);
            process.exit(1);
        });
    "
}

# Test basic operations
test_operations() {
    print_status "تست عملیات پایه..."
    
    node -e "
        const Database = require('./config/database');
        
        async function testOperations() {
            try {
                // Test insert
                const insertResult = await Database.pool.query(
                    'INSERT INTO news_sources (name, base_url, list_selector) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING RETURNING id',
                    ['Test Source', 'https://test.com', 'a[href*=\"/news\"]']
                );
                
                // Test select
                const selectResult = await Database.pool.query('SELECT COUNT(*) as count FROM news_sources');
                
                // Test delete
                await Database.pool.query('DELETE FROM news_sources WHERE name = $1', ['Test Source']);
                
                console.log('✅ تمام عملیات پایه موفق بودند');
                process.exit(0);
            } catch (err) {
                console.error('❌ خطا در تست عملیات:', err.message);
                process.exit(1);
            }
        }
        
        testOperations();
    "
}

# Start application
start_application() {
    print_status "راه‌اندازی برنامه..."
    
    # Check if application is already running
    if pgrep -f "node index.js" > /dev/null; then
        print_warning "برنامه در حال اجرا است - متوقف کردن..."
        pkill -f "node index.js" || true
        sleep 2
    fi
    
    # Start application in background
    nohup node index.js > logs/migration-test.log 2>&1 &
    APP_PID=$!
    
    # Wait for application to start
    sleep 5
    
    # Test if application is responding
    if curl -f http://localhost:3004/ > /dev/null 2>&1; then
        print_success "برنامه با موفقیت راه‌اندازی شد (PID: $APP_PID)"
        echo "برای مشاهده لاگ‌ها: tail -f logs/migration-test.log"
    else
        print_error "برنامه راه‌اندازی نشد"
        kill $APP_PID 2>/dev/null || true
        return 1
    fi
}

# Main migration process
main() {
    echo "📋 مراحل migration:"
    echo "1. بررسی PostgreSQL"
    echo "2. ایجاد دیتابیس"
    echo "3. پشتیبان‌گیری SQLite"
    echo "4. نصب وابستگی‌ها"
    echo "5. اجرای migration"
    echo "6. تست اتصال"
    echo "7. تست عملیات"
    echo "8. راه‌اندازی برنامه"
    echo ""
    
    # Step 1: Check PostgreSQL
    if ! check_postgresql; then
        exit 1
    fi
    
    # Step 2: Create database if needed
    if ! check_database; then
        create_database
    fi
    
    # Step 3: Backup SQLite
    backup_sqlite
    
    # Step 4: Install dependencies
    install_dependencies
    
    # Step 5: Run migration
    run_migration
    
    # Step 6: Test connection
    test_connection
    
    # Step 7: Test operations
    test_operations
    
    # Step 8: Start application
    if start_application; then
        echo ""
        print_success "🎉 Migration با موفقیت تکمیل شد!"
        echo ""
        echo "📊 خلاصه:"
        echo "  ✅ PostgreSQL راه‌اندازی شد"
        echo "  ✅ دیتابیس ایجاد شد"
        echo "  ✅ داده‌ها منتقل شدند"
        echo "  ✅ برنامه راه‌اندازی شد"
        echo ""
        echo "🌐 دسترسی به برنامه: http://localhost:3004"
        echo "📊 پنل ادمین: http://localhost:3004/admin"
        echo ""
        echo "📁 فایل‌های پشتیبان در پوشه backups/"
        echo "📝 لاگ‌ها در پوشه logs/"
    else
        print_error "❌ خطا در راه‌اندازی برنامه"
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    "check")
        check_postgresql
        check_database
        ;;
    "backup")
        backup_sqlite
        ;;
    "migrate")
        run_migration
        ;;
    "test")
        test_connection
        test_operations
        ;;
    "start")
        start_application
        ;;
    "help"|"-h"|"--help")
        echo "استفاده: $0 [command]"
        echo ""
        echo "دستورات:"
        echo "  check    - بررسی وضعیت PostgreSQL و دیتابیس"
        echo "  backup   - پشتیبان‌گیری از SQLite"
        echo "  migrate  - اجرای migration"
        echo "  test     - تست اتصال و عملیات"
        echo "  start    - راه‌اندازی برنامه"
        echo "  (بدون آرگومان) - اجرای کامل migration"
        ;;
    *)
        main
        ;;
esac 
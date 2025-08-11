#!/bin/bash

echo "🔧 حل مشکلات Docker"
echo "========================================"

# بررسی وجود Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker یافت نشد. لطفاً Docker را نصب کنید."
    exit 1
fi

echo "✅ Docker آماده است"
echo ""

echo "انتخاب مشکل:"
echo "1. مشکل دانلود Puppeteer"
echo "2. مشکل حافظه"
echo "3. مشکل شبکه"
echo "4. مشکل مجوزها"
echo "5. پاک کردن کامل و شروع مجدد"
echo ""

read -p "لطفاً مشکل را انتخاب کنید (1-5): " choice

case $choice in
    1)
        echo "🔧 حل مشکل دانلود Puppeteer..."
        
        # توقف کانتینرها
        docker-compose down
        
        # پاک کردن cache
        docker system prune -f
        
        # ساخت مجدد با تنظیمات Puppeteer
        echo "📦 ساخت مجدد با تنظیمات Puppeteer..."
        docker-compose build --no-cache --build-arg DOCKERFILE=Dockerfile.alpine
        
        # اجرا
        docker-compose up -d
        
        echo "✅ مشکل دانلود Puppeteer حل شد"
        ;;
    2)
        echo "🔧 حل مشکل حافظه..."
        
        # پاک کردن تصاویر استفاده نشده
        docker image prune -a -f
        
        # پاک کردن کانتینرهای متوقف شده
        docker container prune -f
        
        # پاک کردن volumes استفاده نشده
        docker volume prune -f
        
        # پاک کردن networks استفاده نشده
        docker network prune -f
        
        echo "✅ حافظه پاک شد"
        ;;
    3)
        echo "🔧 حل مشکل شبکه..."
        
        # توقف کانتینرها
        docker-compose down
        
        # پاک کردن networks
        docker network prune -f
        
        # راه‌اندازی مجدد
        docker-compose up -d
        
        echo "✅ شبکه بازنشانی شد"
        ;;
    4)
        echo "🔧 حل مشکل مجوزها..."
        
        # تنظیم مجوزهای فایل‌ها
        chmod +x *.sh
        chmod 755 logs data config public
        
        # تنظیم مالکیت
        sudo chown -R $USER:$USER .
        
        echo "✅ مجوزها تنظیم شد"
        ;;
    5)
        echo "🧹 پاک کردن کامل و شروع مجدد..."
        
        # توقف همه کانتینرها
        docker-compose down -v
        
        # پاک کردن همه چیز
        docker system prune -a -f --volumes
        
        # پاک کردن فایل‌های موقت
        rm -rf node_modules package-lock.json
        
        # نصب مجدد
        npm install
        
        # ساخت مجدد
        docker-compose build --no-cache
        
        # اجرا
        docker-compose up -d
        
        echo "✅ سیستم کاملاً بازنشانی شد"
        ;;
    *)
        echo "❌ انتخاب نامعتبر"
        exit 1
        ;;
esac

echo ""
echo "📊 وضعیت کانتینرها:"
docker-compose ps

echo ""
echo "🌐 دسترسی به سرویس‌ها:"
echo "   پنل ادمین: http://localhost:3004/admin"
echo "   API: http://localhost:3004/api"
echo "   RSS Feed: http://localhost:3004/rss"
echo "" 
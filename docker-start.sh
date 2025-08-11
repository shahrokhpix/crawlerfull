#!/bin/bash

echo "🐳 راه‌اندازی کرالر خبری با Docker"
echo "========================================"

# بررسی وجود Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker یافت نشد. لطفاً Docker را نصب کنید."
    exit 1
fi

# بررسی وجود Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose یافت نشد. لطفاً Docker Compose را نصب کنید."
    exit 1
fi

echo "✅ Docker و Docker Compose آماده هستند"
echo ""

# بررسی وجود فایل .env
if [ ! -f ".env" ]; then
    echo "⚠️ فایل .env یافت نشد. فایل .env.example کپی می‌شود..."
    cp .env.example .env
    echo "✅ فایل .env ایجاد شد. لطفاً تنظیمات را بررسی کنید."
    echo ""
fi

echo "انتخاب نوع اجرا:"
echo "1. اجرای کامل (پیشنهادی)"
echo "2. اجرا بدون Nginx"
echo "3. اجرا با PM2"
echo "4. اجرا در حالت توسعه"
echo "5. پاک کردن و اجرای مجدد"
echo ""

read -p "لطفاً نوع اجرا را انتخاب کنید (1-5): " choice

case $choice in
    1)
        echo "🚀 اجرای کامل پروژه..."
        docker-compose up -d
        ;;
    2)
        echo "🚀 اجرا بدون Nginx..."
        docker-compose up -d postgres redis crawler
        ;;
    3)
        echo "🚀 اجرا با PM2..."
        docker-compose --profile pm2 up -d
        ;;
    4)
        echo "🚀 اجرا در حالت توسعه..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
        ;;
    5)
        echo "🧹 پاک کردن و اجرای مجدد..."
        docker-compose down -v
        docker-compose build --no-cache
        docker-compose up -d
        ;;
    *)
        echo "❌ انتخاب نامعتبر"
        exit 1
        ;;
esac

echo ""
echo "⏳ منتظر راه‌اندازی سرویس‌ها..."
sleep 10

echo ""
echo "📊 وضعیت کانتینرها:"
docker-compose ps

echo ""
echo "🌐 دسترسی به سرویس‌ها:"
echo "   پنل ادمین: http://localhost:3004/admin"
echo "   API: http://localhost:3004/api"
echo "   RSS Feed: http://localhost:3004/rss"
echo ""

echo "دستورات مفید:"
echo "  مشاهده لاگ‌ها: docker-compose logs -f"
echo "  توقف: docker-compose down"
echo "  راه‌اندازی مجدد: docker-compose restart"
echo "" 
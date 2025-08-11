#!/bin/bash

echo "🚀 شروع تست استرس سیستم"
echo "======================================"

# بررسی وجود Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js یافت نشد. لطفاً Node.js را نصب کنید."
    exit 1
fi

# بررسی وجود فایل تست
if [ ! -f "stress-test.js" ]; then
    echo "❌ فایل stress-test.js یافت نشد."
    exit 1
fi

echo "✅ Node.js و فایل تست آماده هستند"
echo ""

echo "انتخاب نوع تست:"
echo "1. تست کامل استرس (پیشنهادی)"
echo "2. تست کرال همزمان"
echo "3. تست استرس دیتابیس"
echo "4. تست استرس حافظه"
echo "5. تست API های مدیریتی"
echo "6. تست Load Balancer"
echo "7. تست WebSocket"
echo "8. تست Circuit Breaker"
echo "9. تست ساده"
echo ""

read -p "لطفاً نوع تست را انتخاب کنید (1-9): " choice

case $choice in
    1)
        echo "🚀 اجرای تست کامل استرس..."
        node stress-test.js --full
        ;;
    2)
        echo "🕷️ اجرای تست کرال همزمان..."
        node stress-test.js --crawl
        ;;
    3)
        echo "🗄️ اجرای تست استرس دیتابیس..."
        node stress-test.js --database
        ;;
    4)
        echo "🧠 اجرای تست استرس حافظه..."
        node stress-test.js --memory
        ;;
    5)
        echo "🔧 اجرای تست API های مدیریتی..."
        node stress-test.js --admin
        ;;
    6)
        echo "⚖️ اجرای تست Load Balancer..."
        node stress-test.js --load-balancer
        ;;
    7)
        echo "🔌 اجرای تست WebSocket..."
        node stress-test.js --websocket
        ;;
    8)
        echo "🔌 اجرای تست Circuit Breaker..."
        node stress-test.js --circuit-breaker
        ;;
    9)
        echo "📊 اجرای تست ساده..."
        node stress-test.js
        ;;
    *)
        echo "❌ انتخاب نامعتبر"
        exit 1
        ;;
esac

echo ""
echo "✅ تست تکمیل شد"
echo "📁 نتایج در پوشه results ذخیره شده‌اند"
echo "" 
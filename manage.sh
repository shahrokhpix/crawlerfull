#!/bin/bash
case "$1" in
    start)
        pm2 start ecosystem.config.js --env production
        ;;
    stop)
        pm2 stop farsnews-crawler
        ;;
    restart)
        pm2 restart farsnews-crawler
        ;;
    status)
        pm2 status
        ;;
    logs)
        pm2 logs farsnews-crawler
        ;;
    monitor)
        pm2 monit
        ;;
    *)
        echo "استفاده: $0 {start|stop|restart|status|logs|monitor}"
        exit 1
        ;;
esac

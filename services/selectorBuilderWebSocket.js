const WebSocket = require('ws');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const logger = require('../utils/logger');

class SelectorBuilderWebSocket {
    constructor(port = 3005) {
        this.port = port;
        this.wss = null;
        this.browser = null;
        this.activeSessions = new Map();
        
        this.init();
    }
    
    async init() {
        try {
            // Initialize WebSocket server
            this.wss = new WebSocket.Server({ port: this.port });
            
            this.wss.on('connection', (ws, req) => {
                const sessionId = this.generateSessionId();
                this.activeSessions.set(sessionId, { ws, browser: null });
                
                logger.info(`Selector Builder WebSocket client connected: ${sessionId}`);
                
                ws.on('message', async (message) => {
                    try {
                        const data = JSON.parse(message);
                        await this.handleMessage(sessionId, data);
                    } catch (error) {
                        logger.error('Error handling WebSocket message:', error);
                        this.sendError(ws, 'خطا در پردازش پیام');
                    }
                });
                
                ws.on('close', () => {
                    logger.info(`Selector Builder WebSocket client disconnected: ${sessionId}`);
                    this.cleanupSession(sessionId);
                });
                
                ws.on('error', (error) => {
                    logger.error(`WebSocket error for session ${sessionId}:`, error);
                    this.cleanupSession(sessionId);
                });
            });
            
            logger.info(`Selector Builder WebSocket server started on port ${this.port}`);
            
        } catch (error) {
            logger.error('Failed to initialize Selector Builder WebSocket:', error);
        }
    }
    
    generateSessionId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    
    async handleMessage(sessionId, data) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;
        
        switch (data.type) {
            case 'test-selector':
                await this.testSelector(session, data);
                break;
            case 'validate-selectors':
                await this.validateSelectors(session, data);
                break;
            case 'extract-content':
                await this.extractContent(session, data);
                break;
            default:
                this.sendError(session.ws, 'نوع پیام نامشخص');
        }
    }
    
    async testSelector(session, data) {
        try {
            const { url, selector, elementType, elementId } = data;
            
            logger.info(`Testing selector: ${selector} on ${url}`);
            
            // Try different methods to test the selector
            const results = await Promise.allSettled([
                this.testWithPuppeteer(url, selector),
                this.testWithCheerio(url, selector)
            ]);
            
            let bestResult = null;
            let success = false;
            
            // Check Puppeteer result first (more reliable)
            if (results[0].status === 'fulfilled' && results[0].value.success) {
                bestResult = results[0].value;
                success = true;
            } else if (results[1].status === 'fulfilled' && results[1].value.success) {
                bestResult = results[1].value;
                success = true;
            }
            
            const response = {
                type: 'test-result',
                elementId,
                elementType,
                selector,
                success,
                data: bestResult ? bestResult.data : null,
                count: bestResult ? bestResult.count : 0,
                method: bestResult ? bestResult.method : null,
                error: success ? null : this.getErrorMessage(results)
            };
            
            session.ws.send(JSON.stringify(response));
            
        } catch (error) {
            logger.error('Error testing selector:', error);
            this.sendError(session.ws, 'خطا در تست انتخابگر');
        }
    }
    
    async testWithPuppeteer(url, selector) {
        let browser = null;
        let page = null;
        
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });
            
            page = await browser.newPage();
            
            // Set user agent and viewport
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            await page.setViewport({ width: 1920, height: 1080 });
            
            // Navigate to page with timeout
            await page.goto(url, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Wait a bit for dynamic content
            await page.waitForTimeout(2000);
            
            // Test the selector
            const elements = await page.$$(selector);
            
            if (elements.length === 0) {
                return {
                    success: false,
                    method: 'puppeteer',
                    error: 'هیچ عنصری با این انتخابگر یافت نشد'
                };
            }
            
            // Get text content from first element
            const textContent = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element ? element.textContent.trim() : '';
            }, selector);
            
            return {
                success: true,
                method: 'puppeteer',
                data: textContent,
                count: elements.length
            };
            
        } catch (error) {
            logger.error('Puppeteer test error:', error);
            return {
                success: false,
                method: 'puppeteer',
                error: error.message
            };
        } finally {
            if (page) await page.close();
            if (browser) await browser.close();
        }
    }
    
    async testWithCheerio(url, selector) {
        try {
            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            const elements = $(selector);
            
            if (elements.length === 0) {
                return {
                    success: false,
                    method: 'cheerio',
                    error: 'هیچ عنصری با این انتخابگر یافت نشد'
                };
            }
            
            const textContent = elements.first().text().trim();
            
            return {
                success: true,
                method: 'cheerio',
                data: textContent,
                count: elements.length
            };
            
        } catch (error) {
            logger.error('Cheerio test error:', error);
            return {
                success: false,
                method: 'cheerio',
                error: error.message
            };
        }
    }
    
    async validateSelectors(session, data) {
        try {
            const { url, selectors } = data;
            const results = {};
            
            for (const [type, selector] of Object.entries(selectors)) {
                const result = await this.testWithPuppeteer(url, selector);
                results[type] = result;
            }
            
            session.ws.send(JSON.stringify({
                type: 'validation-result',
                results
            }));
            
        } catch (error) {
            logger.error('Error validating selectors:', error);
            this.sendError(session.ws, 'خطا در اعتبارسنجی انتخابگرها');
        }
    }
    
    async extractContent(session, data) {
        try {
            const { url, selectors } = data;
            const extractedData = {};
            
            // Use Puppeteer for more reliable extraction
            let browser = null;
            let page = null;
            
            try {
                browser = await puppeteer.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
                
                page = await browser.newPage();
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                await page.waitForTimeout(2000);
                
                for (const [type, selector] of Object.entries(selectors)) {
                    try {
                        const content = await page.evaluate((sel) => {
                            const element = document.querySelector(sel);
                            if (!element) return null;
                            
                            // Different extraction based on element type
                            if (element.tagName.toLowerCase() === 'img') {
                                return element.src;
                            } else if (element.tagName.toLowerCase() === 'a') {
                                return element.href;
                            } else {
                                return element.textContent.trim();
                            }
                        }, selector);
                        
                        extractedData[type] = content;
                    } catch (error) {
                        logger.error(`Error extracting ${type}:`, error);
                        extractedData[type] = null;
                    }
                }
                
            } finally {
                if (page) await page.close();
                if (browser) await browser.close();
            }
            
            session.ws.send(JSON.stringify({
                type: 'extraction-result',
                data: extractedData
            }));
            
        } catch (error) {
            logger.error('Error extracting content:', error);
            this.sendError(session.ws, 'خطا در استخراج محتوا');
        }
    }
    
    getErrorMessage(results) {
        const errors = results
            .filter(r => r.status === 'rejected')
            .map(r => r.reason.message);
        
        if (errors.length > 0) {
            return errors[0];
        }
        
        const failedResults = results
            .filter(r => r.status === 'fulfilled' && !r.value.success)
            .map(r => r.value.error);
        
        return failedResults[0] || 'خطای نامشخص';
    }
    
    sendError(ws, message) {
        try {
            ws.send(JSON.stringify({
                type: 'error',
                message
            }));
        } catch (error) {
            logger.error('Error sending WebSocket error message:', error);
        }
    }
    
    async cleanupSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session && session.browser) {
            try {
                await session.browser.close();
            } catch (error) {
                logger.error('Error closing browser for session:', error);
            }
        }
        this.activeSessions.delete(sessionId);
    }
    
    async shutdown() {
        logger.info('Shutting down Selector Builder WebSocket server...');
        
        // Close all active sessions
        for (const [sessionId, session] of this.activeSessions) {
            await this.cleanupSession(sessionId);
        }
        
        // Close WebSocket server
        if (this.wss) {
            this.wss.close();
        }
        
        logger.info('Selector Builder WebSocket server shut down complete');
    }
}

module.exports = SelectorBuilderWebSocket;
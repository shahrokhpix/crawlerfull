class VisualSelectorBuilder {
    constructor() {
        this.selectedElements = [];
        this.isSelectionActive = false;
        this.websocket = null;
        this.currentUrl = '';
        this.selectorGenerator = new SmartSelectorGenerator();
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.connectWebSocket();
        this.updateUI();
    }
    
    setupEventListeners() {
        // Check if elements exist before adding listeners
        const targetUrl = document.getElementById('targetUrl');
        if (targetUrl) {
            targetUrl.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    loadPage();
                }
            });
        }
        
        // Note: Other event listeners are handled by inline onclick handlers in HTML
        console.log('Event listeners setup completed');
    }
    
    connectWebSocket() {
        try {
            this.websocket = new WebSocket('ws://localhost:3005');
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected');
                // Connection status element may not exist in this HTML version
                const statusEl = document.getElementById('connection-status');
                if (statusEl) {
                    statusEl.innerHTML = '🟢 متصل';
                }
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket disconnected');
                document.getElementById('connection-status').innerHTML = '🔴 قطع';
                // Try to reconnect after 3 seconds
                setTimeout(() => this.connectWebSocket(), 3000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                document.getElementById('connection-status').innerHTML = '🟡 خطا';
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            document.getElementById('connection-status').innerHTML = '🔴 قطع';
        }
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'test-result':
                this.displayTestResult(data.result);
                break;
            case 'element-selected':
                this.addSelectedElement(data.element);
                break;
            case 'error':
                this.showError(data.message);
                break;
        }
    }
    
    loadSite() {
        const url = document.getElementById('target-url').value;
        if (!url) {
            alert('لطفاً آدرس سایت را وارد کنید');
            return;
        }
        
        this.currentUrl = url;
        const iframe = document.getElementById('preview-iframe');
        
        // Create a proxy URL to avoid CORS issues
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        iframe.src = proxyUrl;
        
        iframe.onload = () => {
            this.injectSelectionScript();
        };
    }
    
    injectSelectionScript() {
        const iframe = document.getElementById('preview-iframe');
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            // Inject our selection script
            const script = iframeDoc.createElement('script');
            script.textContent = `
                window.selectorBuilder = {
                    isActive: false,
                    hoveredElement: null,
                    
                    activate: function() {
                        this.isActive = true;
                        document.addEventListener('click', this.handleClick.bind(this), true);
                        document.addEventListener('mouseover', this.handleMouseOver.bind(this), true);
                        document.addEventListener('mouseout', this.handleMouseOut.bind(this), true);
                        document.body.style.cursor = 'crosshair';
                    },
                    
                    deactivate: function() {
                        this.isActive = false;
                        document.removeEventListener('click', this.handleClick.bind(this), true);
                        document.removeEventListener('mouseover', this.handleMouseOver.bind(this), true);
                        document.removeEventListener('mouseout', this.handleMouseOut.bind(this), true);
                        document.body.style.cursor = 'default';
                        this.removeHighlight();
                    },
                    
                    handleClick: function(e) {
                        if (!this.isActive) return;
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const element = e.target;
                        const elementData = this.getElementData(element);
                        
                        // Send to parent window
                        window.parent.postMessage({
                            type: 'element-selected',
                            element: elementData
                        }, '*');
                    },
                    
                    handleMouseOver: function(e) {
                        if (!this.isActive) return;
                        this.highlightElement(e.target);
                    },
                    
                    handleMouseOut: function(e) {
                        if (!this.isActive) return;
                        this.removeHighlight();
                    },
                    
                    highlightElement: function(element) {
                        this.removeHighlight();
                        element.style.outline = '2px solid #3498db';
                        element.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
                        this.hoveredElement = element;
                    },
                    
                    removeHighlight: function() {
                        if (this.hoveredElement) {
                            this.hoveredElement.style.outline = '';
                            this.hoveredElement.style.backgroundColor = '';
                            this.hoveredElement = null;
                        }
                    },
                    
                    getElementData: function(element) {
                        return {
                            tagName: element.tagName.toLowerCase(),
                            className: element.className,
                            id: element.id,
                            textContent: element.textContent.trim().substring(0, 100),
                            innerHTML: element.innerHTML.substring(0, 200),
                            attributes: this.getElementAttributes(element),
                            xpath: this.getXPath(element),
                            cssSelector: this.generateCSSSelector(element)
                        };
                    },
                    
                    getElementAttributes: function(element) {
                        const attrs = {};
                        for (let attr of element.attributes) {
                            attrs[attr.name] = attr.value;
                        }
                        return attrs;
                    },
                    
                    getXPath: function(element) {
                        if (element.id !== '') {
                            return 'id("' + element.id + '")';
                        }
                        if (element === document.body) {
                            return element.tagName;
                        }
                        
                        let ix = 0;
                        const siblings = element.parentNode.childNodes;
                        for (let i = 0; i < siblings.length; i++) {
                            const sibling = siblings[i];
                            if (sibling === element) {
                                return this.getXPath(element.parentNode) + '/' + element.tagName + '[' + (ix + 1) + ']';
                            }
                            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                                ix++;
                            }
                        }
                    },
                    
                    generateCSSSelector: function(element) {
                        if (element.id) {
                            return '#' + element.id;
                        }
                        
                        let selector = element.tagName.toLowerCase();
                        
                        if (element.className) {
                            const classes = element.className.split(' ').filter(c => c.trim());
                            if (classes.length > 0) {
                                selector += '.' + classes.join('.');
                            }
                        }
                        
                        // Add parent context if needed
                        let parent = element.parentElement;
                        if (parent && parent !== document.body) {
                            let parentSelector = parent.tagName.toLowerCase();
                            if (parent.className) {
                                const parentClasses = parent.className.split(' ').filter(c => c.trim());
                                if (parentClasses.length > 0) {
                                    parentSelector += '.' + parentClasses[0];
                                }
                            }
                            selector = parentSelector + ' > ' + selector;
                        }
                        
                        return selector;
                    }
                };
            `;
            
            iframeDoc.head.appendChild(script);
            
            // Listen for messages from iframe
            window.addEventListener('message', (event) => {
                if (event.data.type === 'element-selected') {
                    this.addSelectedElement(event.data.element);
                }
            });
            
        } catch (error) {
            console.error('Cannot inject script into iframe:', error);
            alert('خطا در بارگذاری سایت. ممکن است سایت از CORS محافظت کند.');
        }
    }
    
    startSelection() {
        if (!this.currentUrl) {
            alert('ابتدا سایت را بارگذاری کنید');
            return;
        }
        
        this.isSelectionActive = true;
        document.getElementById('start-selection').style.display = 'none';
        document.getElementById('stop-selection').style.display = 'inline-block';
        document.getElementById('selection-mode').textContent = 'فعال';
        
        // Activate selection in iframe
        const iframe = document.getElementById('preview-iframe');
        try {
            iframe.contentWindow.selectorBuilder.activate();
        } catch (error) {
            console.error('Cannot activate selection:', error);
        }
    }
    
    stopSelection() {
        this.isSelectionActive = false;
        document.getElementById('start-selection').style.display = 'inline-block';
        document.getElementById('stop-selection').style.display = 'none';
        document.getElementById('selection-mode').textContent = 'غیرفعال';
        
        // Deactivate selection in iframe
        const iframe = document.getElementById('preview-iframe');
        try {
            iframe.contentWindow.selectorBuilder.deactivate();
        } catch (error) {
            console.error('Cannot deactivate selection:', error);
        }
    }
    
    addSelectedElement(elementData) {
        const elementType = document.getElementById('element-type').value;
        
        // Generate optimized selector
        const optimizedSelector = this.selectorGenerator.generateOptimizedSelector(elementData);
        
        const selectedElement = {
            id: Date.now(),
            type: elementType,
            data: elementData,
            selector: optimizedSelector,
            status: 'pending'
        };
        
        this.selectedElements.push(selectedElement);
        this.updateSelectedElementsUI();
        
        // Auto-test the selector
        this.testSelector(selectedElement);
    }
    
    updateSelectedElementsUI() {
        const container = document.getElementById('selected-elements');
        container.innerHTML = '';
        
        this.selectedElements.forEach(element => {
            const elementDiv = document.createElement('div');
            elementDiv.className = 'selected-element';
            elementDiv.innerHTML = `
                <div class="element-type">${this.getElementTypeLabel(element.type)}</div>
                <div class="element-selector">${element.selector}</div>
                <div style="margin-top: 5px;">
                    <span class="status-indicator status-${element.status}"></span>
                    <small>${element.data.textContent}</small>
                </div>
                <div style="margin-top: 10px;">
                    <button class="delete-button" onclick="selectorBuilder.removeElement(${element.id})">حذف</button>
                    <button class="test-button" onclick="selectorBuilder.testSelector({id: ${element.id}})">تست</button>
                </div>
            `;
            container.appendChild(elementDiv);
        });
    }
    
    getElementTypeLabel(type) {
        const labels = {
            'title': 'عنوان خبر',
            'content': 'متن خبر',
            'summary': 'خلاصه',
            'date': 'تاریخ',
            'author': 'نویسنده',
            'image': 'تصویر',
            'link': 'لینک',
            'category': 'دسته‌بندی'
        };
        return labels[type] || type;
    }
    
    removeElement(elementId) {
        this.selectedElements = this.selectedElements.filter(el => el.id !== elementId);
        this.updateSelectedElementsUI();
    }
    
    testSelector(element) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            alert('اتصال WebSocket برقرار نیست');
            return;
        }
        
        const elementToTest = this.selectedElements.find(el => el.id === element.id);
        if (!elementToTest) return;
        
        elementToTest.status = 'testing';
        this.updateSelectedElementsUI();
        
        this.websocket.send(JSON.stringify({
            type: 'test-selector',
            url: this.currentUrl,
            selector: elementToTest.selector,
            elementType: elementToTest.type,
            elementId: elementToTest.id
        }));
    }
    
    testAllSelectors() {
        this.selectedElements.forEach(element => {
            this.testSelector(element);
        });
    }
    
    displayTestResult(result) {
        // Update element status
        const element = this.selectedElements.find(el => el.id === result.elementId);
        if (element) {
            element.status = result.success ? 'success' : 'error';
            element.testResult = result;
        }
        
        this.updateSelectedElementsUI();
        
        // Display in preview results
        const container = document.getElementById('preview-results');
        const resultDiv = document.createElement('div');
        resultDiv.className = `preview-result ${result.success ? '' : 'error-result'}`;
        resultDiv.innerHTML = `
            <strong>${this.getElementTypeLabel(result.elementType)}</strong><br>
            <code>${result.selector}</code><br>
            <small>نتیجه: ${result.success ? 'موفق' : 'ناموفق'}</small><br>
            ${result.data ? `<small>داده یافت شده: ${result.data.substring(0, 100)}...</small>` : ''}
            ${result.error ? `<small style="color: red;">خطا: ${result.error}</small>` : ''}
        `;
        container.appendChild(resultDiv);
        
        // Keep only last 10 results
        while (container.children.length > 10) {
            container.removeChild(container.firstChild);
        }
    }
    
    clearAll() {
        this.selectedElements = [];
        this.updateSelectedElementsUI();
        document.getElementById('preview-results').innerHTML = '';
    }
    
    saveConfiguration() {
        const sourceName = document.getElementById('source-name').value;
        if (!sourceName) {
            alert('لطفاً نام منبع خبری را وارد کنید');
            return;
        }
        
        if (this.selectedElements.length === 0) {
            alert('هیچ عنصری انتخاب نشده است');
            return;
        }
        
        const config = {
            name: sourceName,
            url: this.currentUrl,
            selectors: {},
            createdAt: new Date().toISOString()
        };
        
        this.selectedElements.forEach(element => {
            config.selectors[element.type] = element.selector;
        });
        
        // Send to server
        fetch('/api/sources', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('پیکربندی با موفقیت ذخیره شد');
                this.clearAll();
                document.getElementById('source-name').value = '';
            } else {
                alert('خطا در ذخیره پیکربندی: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error saving configuration:', error);
            alert('خطا در ذخیره پیکربندی');
        });
    }
    
    updateUI() {
        // Update current element type display if elements exist
        const elementType = document.getElementById('element-type');
        const currentElementType = document.getElementById('current-element-type');
        
        if (elementType && currentElementType) {
            currentElementType.textContent = elementType.options[elementType.selectedIndex].text;
        }
        
        console.log('UI updated');
    }
    
    showError(message) {
        alert('خطا: ' + message);
    }
}

class SmartSelectorGenerator {
    generateOptimizedSelector(elementData) {
        const selectors = [
            this.generateByClass(elementData),
            this.generateByAttribute(elementData),
            this.generateByStructure(elementData),
            this.generateByText(elementData)
        ].filter(s => s);
        
        return this.selectBestSelector(selectors) || elementData.cssSelector;
    }
    
    generateByClass(elementData) {
        if (!elementData.className) return null;
        
        const classes = elementData.className.split(' ').filter(c => c.trim());
        if (classes.length === 0) return null;
        
        // Prefer classes that seem semantic
        const semanticClasses = classes.filter(c => 
            c.includes('title') || c.includes('content') || c.includes('text') ||
            c.includes('article') || c.includes('news') || c.includes('post')
        );
        
        if (semanticClasses.length > 0) {
            return elementData.tagName + '.' + semanticClasses[0];
        }
        
        return elementData.tagName + '.' + classes[0];
    }
    
    generateByAttribute(elementData) {
        const attrs = elementData.attributes;
        
        // Check for semantic attributes
        if (attrs['data-role']) {
            return `[data-role="${attrs['data-role']}"]`;
        }
        
        if (attrs['data-type']) {
            return `[data-type="${attrs['data-type']}"]`;
        }
        
        if (attrs['itemprop']) {
            return `[itemprop="${attrs['itemprop']}"]`;
        }
        
        return null;
    }
    
    generateByStructure(elementData) {
        // This would need more context about the page structure
        return null;
    }
    
    generateByText(elementData) {
        // For elements with unique text patterns
        if (elementData.textContent.length < 5) return null;
        
        // This is risky as text changes, so we'll skip it for now
        return null;
    }
    
    selectBestSelector(selectors) {
        if (selectors.length === 0) return null;
        
        // Prefer shorter, more specific selectors
        return selectors.sort((a, b) => a.length - b.length)[0];
    }
}

// Initialize the selector builder when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const selectorBuilder = new VisualSelectorBuilder();
});
// Global variables
let authToken = localStorage.getItem('authToken');
let currentUser = null;
let toastTimeout;
let pageLoadingTimeout;

// Loading functions
function showLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // شروع نشانگر بارگذاری صفحه
    startPageLoading();
    
    // اضافه کردن کلاس برای انیمیشن اولیه
    document.body.classList.add('page-loaded');
    
    if (authToken) {
        checkAuth();
    } else {
        showLogin();
    }
    
    setupEventListeners();
    
    // اضافه کردن تم تاریک/روشن
    setupThemeToggle();
    
    // پایان نشانگر بارگذاری صفحه پس از تکمیل بارگذاری
    setTimeout(() => {
        stopPageLoading();
    }, 800);
});

// Setup event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            if (section) {
                showSection(section);
                updateActiveNav(this);
                
                // اضافه کردن به تاریخچه مرورگر برای امکان استفاده از دکمه بازگشت
                window.history.pushState({section: section}, '', `#${section}`);
            }
        });
    });
    
    // پشتیبانی از دکمه بازگشت مرورگر
    window.addEventListener('popstate', function(e) {
        if (e.state && e.state.section) {
            showSection(e.state.section);
            updateActiveNav(document.querySelector(`.nav-link[data-section="${e.state.section}"]`));
        }
    });
    
    // Crawl form
    document.getElementById('crawlForm').addEventListener('submit', handleCrawl);
    
    // Test form
    document.getElementById('testForm').addEventListener('submit', handleTest);
    
    // اضافه کردن گوش‌دهنده برای دکمه تخلیه کامل
    document.getElementById('clearAllDataBtn')?.addEventListener('click', handleClearAllData);
    
    // اضافه کردن گوش‌دهنده برای کلیدهای میانبر
    document.addEventListener('keydown', function(e) {
        // Alt+D برای داشبورد
        if (e.altKey && e.key === 'd') {
            e.preventDefault();
            showSection('dashboard');
            updateActiveNav(document.querySelector('.nav-link[data-section="dashboard"]'));
        }
        // Alt+S برای منابع
        else if (e.altKey && e.key === 's') {
            e.preventDefault();
            showSection('sources');
            updateActiveNav(document.querySelector('.nav-link[data-section="sources"]'));
        }
        // Alt+C برای کرالر
        else if (e.altKey && e.key === 'c') {
            e.preventDefault();
            showSection('crawler');
            updateActiveNav(document.querySelector('.nav-link[data-section="crawler"]'));
        }
        // Alt+A برای اخبار
        else if (e.altKey && e.key === 'a') {
            e.preventDefault();
            showSection('articles');
            updateActiveNav(document.querySelector('.nav-link[data-section="articles"]'));
        }
        // Alt+L برای لاگ‌ها
        else if (e.altKey && e.key === 'l') {
            e.preventDefault();
            showSection('logs');
            updateActiveNav(document.querySelector('.nav-link[data-section="logs"]'));
        }
        // Alt+T برای تست سلکتور
        else if (e.altKey && e.key === 't') {
            e.preventDefault();
            showSection('test');
            updateActiveNav(document.querySelector('.nav-link[data-section="test"]'));
        }
        // Alt+H برای زمان‌بندی‌ها
        else if (e.altKey && e.key === 'h') {
            e.preventDefault();
            showSection('schedules');
            updateActiveNav(document.querySelector('.nav-link[data-section="schedules"]'));
        }
    });
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const data = await apiCall('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            currentUser = data.user;
            showMainPanel();
            loadDashboard();
        } else {
            showError('loginError', data.message || 'خطا در ورود');
        }
    } catch (error) {
        showError('loginError', error.message || 'خطا در اتصال به سرور');
    }
}

async function checkAuth() {
    try {
        const data = await apiCall('/api/auth/me');
        
        currentUser = data.user;
        showMainPanel();
        loadDashboard();
    } catch (error) {
        logout();
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    showLogin();
}

// UI functions
function showLogin() {
    document.getElementById('loginPage').classList.remove('d-none');
    document.getElementById('mainPanel').classList.add('d-none');
}

function showMainPanel() {
    document.getElementById('loginPage').classList.add('d-none');
    document.getElementById('mainPanel').classList.remove('d-none');
    
    if (currentUser) {
        document.getElementById('userInfo').textContent = `خوش آمدید، ${currentUser.username}`;
    }
}

function showSection(sectionName) {
    // Stop any existing auto-refresh
    stopWebDriverAutoRefresh();
    
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
    }
    
    // Load section data
    switch(sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'sources':
            loadSources();
            break;
        case 'crawler':
            loadCrawlerSources();
            break;
        case 'articles':
            loadArticles(1);
            loadArticleSources();
            break;
        case 'logs':
            loadLogs();
            break;
        case 'schedules':
            loadSchedules();
            loadScheduleSources();
            break;
        case 'cleanup':
            loadCleanupSchedules();
            break;
        case 'webdriver':
            loadWebDriverStatus();
            startWebDriverAutoRefresh();
            break;
    }
}

function updateActiveNav(activeLink) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    activeLink.classList.add('active');
}

// این تابع قبلاً جایگزین شده است

function showSuccess(message, duration = 3000) {
    // پاکسازی توست قبلی اگر وجود داشته باشد
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }
    }
    
    // ایجاد توست جدید
    const toast = document.createElement('div');
    toast.className = 'toast-notification alert alert-success';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-check-circle me-2"></i>
            <span>${message}</span>
            <button type="button" class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
        <div class="toast-progress"></div>
    `;
    document.body.appendChild(toast);
    
    // اضافه کردن انیمیشن پیشرفت
    const progressBar = toast.querySelector('.toast-progress');
    progressBar.style.transition = `width ${duration}ms linear`;
    
    // تاخیر کوتاه برای اطمینان از اعمال استایل‌ها
    setTimeout(() => {
        progressBar.style.width = '0%';
    }, 10);
    
    // حذف توست پس از زمان مشخص
    toastTimeout = setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showError(elementId, message, duration = 5000) {
    // اگر المنت ID ارائه شده باشد، خطا را در آن نمایش می‌دهیم
    if (elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, duration);
            return;
        }
    }
    
    // در غیر این صورت، یک توست خطا نمایش می‌دهیم
    // پاکسازی توست قبلی اگر وجود داشته باشد
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }
    }
    
    // ایجاد توست جدید
    const toast = document.createElement('div');
    toast.className = 'toast-notification alert alert-danger';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-exclamation-circle me-2"></i>
            <span>${message}</span>
            <button type="button" class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
        <div class="toast-progress"></div>
    `;
    document.body.appendChild(toast);
    
    // اضافه کردن انیمیشن پیشرفت
    const progressBar = toast.querySelector('.toast-progress');
    progressBar.style.transition = `width ${duration}ms linear`;
    
    // تاخیر کوتاه برای اطمینان از اعمال استایل‌ها
    setTimeout(() => {
        progressBar.style.width = '0%';
    }, 10);
    
    // حذف توست پس از زمان مشخص
    toastTimeout = setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// تابع تنظیم تم تاریک/روشن
function setupThemeToggle() {
    // بررسی تنظیمات ذخیره شده
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
    
    // اضافه کردن دکمه تغییر تم به نوار کناری
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        const themeToggle = document.createElement('button');
        themeToggle.className = 'btn btn-outline-light btn-sm w-100 mt-2';
        themeToggle.innerHTML = '<i class="fas fa-moon me-2"></i>تغییر تم';
        themeToggle.onclick = toggleTheme;
        
        // اضافه کردن به بخش پایین نوار کناری
        const logoutButton = document.querySelector('.sidebar .btn-outline-light');
        if (logoutButton && logoutButton.parentElement) {
            logoutButton.parentElement.insertBefore(themeToggle, logoutButton);
        }
    }
    
    // اضافه کردن کلید میانبر برای تغییر تم (Alt+T)
    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.key === 'z') {
            e.preventDefault();
            toggleTheme();
        }
    });
}

// تابع تغییر تم
function toggleTheme() {
    if (document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
        showSuccess('تم روشن فعال شد');
    } else {
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
        showSuccess('تم تاریک فعال شد');
    }
}

// API helper function
async function apiCall(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    try {
        // نمایش نشانگر بارگذاری صفحه
        startPageLoading();
        
        // نمایش نشانگر بارگذاری
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loadingIndicator);
        
        const response = await fetch(url, mergedOptions);
        const data = await response.json();
        
        // حذف نشانگر بارگذاری
        loadingIndicator.remove();
        
        // پایان نشانگر بارگذاری صفحه
        stopPageLoading();
        
        if (!response.ok) {
            // بررسی وضعیت پاسخ برای خطای احراز هویت
            if (response.status === 401) {
                // خطای احراز هویت - خروج کاربر
                logout();
                throw new Error('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
            }
            throw new Error(data.message || 'خطا در درخواست');
        }
        
        return data;
    } catch (error) {
        // حذف نشانگر بارگذاری در صورت خطا
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        // پایان نشانگر بارگذاری صفحه در صورت خطا
        stopPageLoading();
        
        console.error('API Error:', error);
        // نمایش خطا به کاربر
        showError(null, error.message || 'خطا در ارتباط با سرور');
        throw error;
    }
}

// Dashboard functions
async function loadDashboard() {
    try {
        // اضافه کردن کلاس انیمیشن به کارت‌های آمار
        const statCards = document.querySelectorAll('.stats-card');
        statCards.forEach((card, index) => {
            card.style.setProperty('--animation-order', index);
        });
        
        const data = await apiCall('/api/stats');
        const stats = data.stats;
        
        // نمایش آمار با انیمیشن شمارش
        animateCounter('totalArticles', 0, stats.totalArticles || 0);
        animateCounter('newArticles', 0, stats.newArticles || 0);
        animateCounter('totalSources', 0, stats.totalSources || 0);
        animateCounter('recentCrawls', 0, stats.recentCrawls || 0);
        
        // Load top sources
        if (stats.topSources && stats.topSources.length > 0) {
            const topSourcesHtml = stats.topSources.map((source, index) => 
                `<div class="d-flex justify-content-between align-items-center mb-2" 
                      style="animation-delay: ${index * 100}ms; animation: fadeIn 0.5s ease forwards;">
                    <span>${source.name}</span>
                    <span class="badge bg-primary">${source.article_count}</span>
                </div>`
            ).join('');
            document.getElementById('topSources').innerHTML = topSourcesHtml;
        } else {
            document.getElementById('topSources').innerHTML = '<p class="text-muted">هنوز داده‌ای موجود نیست</p>';
        }
        
        // Load recent activity - اگر عنصر موجود باشد
        const recentActivityElement = document.getElementById('recentActivity');
        if (recentActivityElement) {
            if (stats.recentActivity && stats.recentActivity.length > 0) {
                const activityHtml = stats.recentActivity.map((activity, index) => 
                    `<div class="d-flex justify-content-between align-items-center mb-2"
                          style="animation-delay: ${index * 100}ms; animation: fadeIn 0.5s ease forwards;">
                        <small>${activity.message}</small>
                        <small class="text-muted">${formatDate(activity.timestamp)}</small>
                    </div>`
                ).join('');
                recentActivityElement.innerHTML = activityHtml;
            } else {
                recentActivityElement.innerHTML = '<p class="text-muted">هنوز فعالیتی ثبت نشده</p>';
            }
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        // نمایش پیام خطا در صورت عدم موفقیت
        document.getElementById('totalArticles').textContent = 'خطا';
        document.getElementById('newArticles').textContent = 'خطا';
        document.getElementById('totalSources').textContent = 'خطا';
        document.getElementById('recentCrawls').textContent = 'خطا';
        
        // نمایش پیام خطا به کاربر
        showError(null, 'خطا در بارگذاری اطلاعات داشبورد');
    }
}

// تابع انیمیشن شمارش
function animateCounter(elementId, start, end, duration = 1000) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value;
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = end;
            // اضافه کردن کلاس برای انیمیشن پالس
            element.classList.add('pulse-once');
            setTimeout(() => {
                element.classList.remove('pulse-once');
            }, 1000);
        }
    };
    window.requestAnimationFrame(step);
}

async function refreshStats() {
    await loadDashboard();
    showSuccess('آمار به‌روزرسانی شد');
}

// تابع تخلیه کامل دیتابیس
async function handleClearAllData() {
    const button = document.getElementById('clearAllDataBtn');
    const originalText = button ? button.textContent : 'تخلیه کامل دیتابیس';
    
    try {
        // نمایش تاییدیه
        const confirmed = confirm('⚠️ هشدار: این عملیات تمام مقالات، تاریخچه کرال و لاگ‌ها را حذف می‌کند.\n\nآیا مطمئن هستید که می‌خواهید تمام داده‌ها را تخلیه کنید؟\n\nاین عملیات قابل بازگشت نیست!');
        
        if (!confirmed) {
            return;
        }
        
        // نمایش loading
        if (button) {
            button.textContent = 'در حال تخلیه...';
            button.disabled = true;
        }
        
        const response = await apiCall('/api/database/clear-all', {
            method: 'POST'
        });
        
        if (response.success) {
            showSuccess(`تخلیه کامل دیتابیس با موفقیت انجام شد!\n\nجزئیات:\n- مقالات حذف شده: ${response.details.articlesDeleted}\n- تاریخچه کرال حذف شده: ${response.details.historyDeleted}\n- لاگ‌های عملیات حذف شده: ${response.details.logsDeleted}\n- مجموع: ${response.details.totalDeleted} رکورد`);
            
            // بازنشانی داشبورد
            await loadDashboard();
            
            // بازنشانی سایر صفحات
            if (document.getElementById('articlesContent').style.display !== 'none') {
                await loadArticles(1);
            }
            if (document.getElementById('logsContent').style.display !== 'none') {
                await loadLogs();
            }
            
        } else {
            showError('dashboardContent', 'خطا در تخلیه دیتابیس: ' + response.message);
        }
        
    } catch (error) {
        console.error('Error clearing database:', error);
        showError('dashboardContent', 'خطا در تخلیه دیتابیس');
    } finally {
        // بازگردانی دکمه
        if (button) {
            button.textContent = originalText;
            button.disabled = false;
        }
    }
}

// Sources management
async function loadSources() {
    try {
        const data = await apiCall('/api/sources');
        const sources = data.sources || [];
        
        const tableBody = document.getElementById('sourcesTable');
        
        if (sources.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">هیچ منبعی یافت نشد</td></tr>';
            return;
        }
        
        const sourcesHtml = sources.map(source => `
            <tr>
                <td>${source.name}</td>
                <td><a href="${source.base_url}" target="_blank">${source.base_url}</a></td>
                <td>
                    <span class="badge ${source.driver_type === 'selenium' ? 'bg-info' : source.driver_type === 'playwright' ? 'bg-success' : source.driver_type === 'cheerio' ? 'bg-warning' : 'bg-primary'}">
                        ${source.driver_type === 'selenium' ? 'Selenium' : source.driver_type === 'playwright' ? 'Playwright' : source.driver_type === 'cheerio' ? 'Cheerio' : 'Puppeteer'}
                    </span>
                </td>
                <td>
                    <span class="badge ${source.active ? 'bg-success' : 'bg-secondary'}">
                        ${source.active ? 'فعال' : 'غیرفعال'}
                    </span>
                </td>
                <td>${formatDate(source.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editSource(${source.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteSource(${source.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                    <a href="/api/sources/${source.id}/rss" target="_blank" class="btn btn-sm btn-outline-info">
                        <i class="fas fa-rss"></i>
                    </a>
                </td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = sourcesHtml;
        
    } catch (error) {
        console.error('Error loading sources:', error);
        document.getElementById('sourcesTable').innerHTML = 
            '<tr><td colspan="5" class="text-center text-danger">خطا در بارگذاری منابع</td></tr>';
    }
}

async function addSource() {
    const form = document.getElementById('addSourceForm');
    const formData = new FormData(form);
    
    // جمع‌آوری سلکتورهای چندگانه
    const titleSelectors = collectSelectors('title');
    const contentSelectors = collectSelectors('content');
    const leadSelectors = collectSelectors('lead');
    const routerSelectors = collectSelectors('router');
    
    const sourceData = {
        name: document.getElementById('sourceName').value,
        base_url: document.getElementById('sourceUrl').value,
        list_selector: document.getElementById('listSelector').value,
        title_selector: titleSelectors.length > 0 ? titleSelectors[0] : '',
        link_selector: document.getElementById('linkSelector').value,
        content_selector: contentSelectors.length > 0 ? contentSelectors[0] : '',
        lead_selector: leadSelectors.length > 0 ? leadSelectors[0] : '',
        router_selector: routerSelectors.length > 0 ? routerSelectors[0] : '',
        title_selectors: JSON.stringify(titleSelectors),
        content_selectors: JSON.stringify(contentSelectors),
        lead_selectors: JSON.stringify(leadSelectors),
        router_selectors: JSON.stringify(routerSelectors),
        driver_type: document.getElementById('driverType').value
    };
    
    try {
        await apiCall('/api/sources', {
            method: 'POST',
            body: JSON.stringify(sourceData)
        });
        
        showSuccess('منبع با موفقیت اضافه شد');
        bootstrap.Modal.getInstance(document.getElementById('addSourceModal')).hide();
        form.reset();
        clearAllSelectorFields();
        loadSources();
        
    } catch (error) {
        alert('خطا در افزودن منبع: ' + error.message);
    }
}

async function editSource(sourceId) {
    try {
        // دریافت اطلاعات منبع فعلی
        const data = await apiCall(`/api/sources/${sourceId}`);
        const source = data.source;
        
        if (!source) {
            alert('منبع یافت نشد');
            return;
        }
        
        // پاک کردن فیلدهای قبلی
        clearAllEditSelectorFields();
        
        // پر کردن فرم با اطلاعات فعلی
        document.getElementById('editSourceId').value = source.id;
        document.getElementById('editSourceName').value = source.name;
        document.getElementById('editSourceUrl').value = source.base_url;
        document.getElementById('editListSelector').value = source.list_selector || '';
        document.getElementById('editLinkSelector').value = source.link_selector || '';
        document.getElementById('editLeadSelector').value = source.lead_selector || '';
        document.getElementById('editRouterSelector').value = source.router_selector || '';
        document.getElementById('editDriverType').value = source.driver_type || 'puppeteer';
        document.getElementById('editSourceActive').checked = source.active;
        
        // پر کردن سلکتورهای چندگانه
        populateEditSelectors('title', source.title_selectors || source.title_selector);
        populateEditSelectors('content', source.content_selectors || source.content_selector);
        populateEditSelectors('lead', source.lead_selectors || source.lead_selector);
        populateEditSelectors('router', source.router_selectors || source.router_selector);
        
        // نمایش مودال
        const modal = new bootstrap.Modal(document.getElementById('editSourceModal'));
        modal.show();
        
    } catch (error) {
        alert('خطا در بارگذاری اطلاعات منبع: ' + error.message);
    }
}

async function updateSource() {
    const sourceId = document.getElementById('editSourceId').value;
    const modalElement = document.getElementById('editSourceModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);

    // جمع‌آوری سلکتورهای چندگانه از فرم ویرایش
    const titleSelectors = collectSelectors('title', true);
    const contentSelectors = collectSelectors('content', true);
    const leadSelectors = collectSelectors('lead', true);
    const routerSelectors = collectSelectors('router', true);

    const sourceData = {
        name: document.getElementById('editSourceName').value,
        base_url: document.getElementById('editSourceUrl').value,
        list_selector: document.getElementById('editListSelector').value,
        title_selector: titleSelectors.length > 0 ? titleSelectors[0] : '',
        link_selector: document.getElementById('editLinkSelector').value,
        content_selector: contentSelectors.length > 0 ? contentSelectors[0] : '',
        lead_selector: document.getElementById('editLeadSelector').value,
        router_selector: document.getElementById('editRouterSelector').value,
        title_selectors: JSON.stringify(titleSelectors),
        content_selectors: JSON.stringify(contentSelectors),
        lead_selectors: JSON.stringify(leadSelectors),
        router_selectors: JSON.stringify(routerSelectors),
        driver_type: document.getElementById('editDriverType').value,
        active: document.getElementById('editSourceActive').checked ? 1 : 0
    };

    console.log('Updating source with data:', sourceData);

    try {
        await apiCall(`/api/sources/${sourceId}`, {
            method: 'PUT',
            body: JSON.stringify(sourceData)
        });

        showSuccess('منبع با موفقیت به‌روزرسانی شد');
        
        if (modalInstance) {
            modalInstance.hide();
        }
        
        // Reset form fields after successful update
        document.getElementById('editSourceForm').reset();
        clearAllEditSelectorFields();
        
        loadSources();

    } catch (error) {
        console.error('Error updating source:', error);
        alert('خطا در به‌روزرسانی منبع: ' + error.message);
    }
}

async function deleteSource(sourceId) {
    if (!confirm('آیا از حذف این منبع اطمینان دارید؟')) {
        return;
    }
    
    try {
        await apiCall(`/api/sources/${sourceId}`, {
            method: 'DELETE'
        });
        
        showSuccess('منبع حذف شد');
        loadSources();
        
    } catch (error) {
        alert('خطا در حذف منبع: ' + error.message);
    }
}

// Crawler functions
async function loadCrawlerSources() {
    try {
        const data = await apiCall('/api/sources');
        const sources = data.sources || [];
        const select = document.getElementById('crawlSource');
        
        select.innerHTML = '<option value="">انتخاب منبع...</option>';
        sources.filter(s => s.active).forEach(source => {
            select.innerHTML += `<option value="${source.id}">${source.name}</option>`;
        });
        
    } catch (error) {
        console.error('Error loading crawler sources:', error);
        const select = document.getElementById('crawlSource');
        if (select) {
            select.innerHTML = '<option value="">خطا در بارگذاری منابع</option>';
        }
    }
}

async function handleCrawl(e) {
    e.preventDefault();
    
    const sourceId = document.getElementById('crawlSource').value;
    const limit = parseInt(document.getElementById('crawlLimit').value);
    const depth = parseInt(document.getElementById('crawlDepth').value);
    const fullContent = document.getElementById('fullContent').checked;
    
    if (!sourceId) {
        alert('لطفاً منبع خبری را انتخاب کنید');
        return;
    }
    
    const resultDiv = document.getElementById('crawlResult');
    resultDiv.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> در حال کرال...</div>';
    
    try {
        const result = await apiCall('/api/crawler/crawl', {
            method: 'POST',
            body: JSON.stringify({
                source_id: sourceId,
                limit,
                depth,
                full_content: fullContent
            })
        });
        
        resultDiv.innerHTML = `
            <div class="alert alert-success">
                <h6>کرال با موفقیت انجام شد!</h6>
                <p><strong>اخبار پردازش شده:</strong> ${result.processed}</p>
                <p><strong>اخبار جدید:</strong> ${result.new_articles}</p>
                <p><strong>اخبار تکراری:</strong> ${result.duplicates}</p>
                ${result.errors > 0 ? `<p><strong>خطاها:</strong> ${result.errors}</p>` : ''}
            </div>
        `;
        
        showSuccess('کرال با موفقیت انجام شد');
        
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                <h6>خطا در کرال</h6>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Articles functions
async function loadArticleSources() {
    try {
        const data = await apiCall('/api/sources');
        const sources = data.sources || [];
        const select = document.getElementById('articleSource');
        
        select.innerHTML = '<option value="">همه منابع</option>';
        sources.forEach(source => {
            select.innerHTML += `<option value="${source.id}">${source.name}</option>`;
        });
        
    } catch (error) {
        console.error('Error loading article sources:', error);
        const select = document.getElementById('articleSource');
        if (select) {
            select.innerHTML = '<option value="">خطا در بارگذاری منابع</option>';
        }
    }
}

// متغیرهای pagination
let currentArticlesPage = 1;
const articlesPerPage = 10;

async function loadArticles(page = 1) {
    try {
        const sourceId = document.getElementById('articleSource').value;
        const pageSize = parseInt(document.getElementById('pageSize')?.value || articlesPerPage);
        const offset = (page - 1) * pageSize;
        
        let url = `/api/articles?limit=${pageSize}&offset=${offset}`;
        if (sourceId) {
            url += `&source_id=${sourceId}`;
        }
        
        // اضافه کردن فیلترهای پیشرفته
        const titleSearch = document.getElementById('titleSearch')?.value;
        const statusFilter = document.getElementById('statusFilter')?.value;
        const dateFrom = document.getElementById('dateFrom')?.value;
        const dateTo = document.getElementById('dateTo')?.value;
        const depthFilter = document.getElementById('depthFilter')?.value;
        const sortBy = document.getElementById('sortBy')?.value;
        
        if (titleSearch) {
            url += `&title=${encodeURIComponent(titleSearch)}`;
        }
        if (statusFilter) {
            url += `&status=${statusFilter}`;
        }
        if (dateFrom) {
            url += `&date_from=${dateFrom}`;
        }
        if (dateTo) {
            url += `&date_to=${dateTo}`;
        }
        if (depthFilter !== '') {
            url += `&depth=${depthFilter}`;
        }
        if (sortBy) {
            url += `&sort=${sortBy}`;
        }
        
        const data = await apiCall(url);
        const articles = data.articles || [];
        const pagination = data.pagination || {};
        const tableBody = document.getElementById('articlesTable');
        
        currentArticlesPage = page;
        
        if (articles.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">هیچ مقاله‌ای یافت نشد</td></tr>';
            updateArticlesPagination(pagination);
            return;
        }
        
        const articlesHtml = articles.map(article => `
            <tr>
                <td>
                    <a href="article.html?id=${article.id}" class="text-decoration-none">
                        ${article.title}
                    </a>
                </td>
                <td>${article.source_name}</td>
                <td><span class="badge bg-info">${article.depth}</span></td>
                <td>
                    <span class="badge ${article.is_read ? 'bg-secondary' : 'bg-primary'}">
                        ${article.is_read ? 'خوانده شده' : 'جدید'}
                    </span>
                </td>
                <td>${formatDate(article.created_at)}</td>
                <td>
                    <a href="${article.link}" target="_blank" class="btn btn-sm btn-outline-success" title="مشاهده در سایت اصلی">
                        <i class="fas fa-external-link-alt"></i>
                        منبع
                    </a>
                </td>
                <td>
                    <div class="btn-group" role="group">
                        ${!article.is_read ? 
                            `<button class="btn btn-sm btn-outline-primary" onclick="markAsRead(${article.id})" title="علامت‌گذاری به عنوان خوانده‌شده">
                                <i class="fas fa-check"></i>
                            </button>` : 
                            '<span class="text-muted">-</span>'
                        }
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteArticle(${article.id}, '${article.title.replace(/'/g, "\\'")}')" title="حذف مقاله">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = articlesHtml;
        updateArticlesPagination(pagination);
        
    } catch (error) {
        console.error('Error loading articles:', error);
        document.getElementById('articlesTable').innerHTML = 
            '<tr><td colspan="7" class="text-center text-danger">خطا در بارگذاری اخبار</td></tr>';
        updateArticlesPagination({});
    }
}

function updateArticlesPagination(pagination) {
    const paginationContainer = document.getElementById('articlesPagination');
    const infoContainer = document.getElementById('articlesInfo');
    
    if (!pagination.totalCount || pagination.totalCount === 0) {
        paginationContainer.innerHTML = '';
        infoContainer.textContent = 'هیچ مقاله‌ای یافت نشد';
        return;
    }
    
    const { currentPage, totalPages, totalCount, limit, offset } = pagination;
    const startItem = offset + 1;
    const endItem = Math.min(offset + limit, totalCount);
    
    // Update info text
    infoContainer.textContent = `نمایش ${startItem} تا ${endItem} از ${totalCount} مقاله`;
    
    // Generate pagination buttons
    let paginationHtml = '';
    
    // Previous button
    if (currentPage > 1) {
        paginationHtml += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="loadArticles(${currentPage - 1}); return false;">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;
    } else {
        paginationHtml += `
            <li class="page-item disabled">
                <span class="page-link"><i class="fas fa-chevron-right"></i></span>
            </li>
        `;
    }
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        paginationHtml += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="loadArticles(1); return false;">1</a>
            </li>
        `;
        if (startPage > 2) {
            paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHtml += `
                <li class="page-item active">
                    <span class="page-link">${i}</span>
                </li>
            `;
        } else {
            paginationHtml += `
                <li class="page-item">
                    <a class="page-link" href="#" onclick="loadArticles(${i}); return false;">${i}</a>
                </li>
            `;
        }
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
        paginationHtml += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="loadArticles(${totalPages}); return false;">${totalPages}</a>
            </li>
        `;
    }
    
    // Next button
    if (currentPage < totalPages) {
        paginationHtml += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="loadArticles(${currentPage + 1}); return false;">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;
    } else {
        paginationHtml += `
            <li class="page-item disabled">
                <span class="page-link"><i class="fas fa-chevron-left"></i></span>
            </li>
        `;
    }
    
    paginationContainer.innerHTML = paginationHtml;
}

async function markAsRead(articleId) {
    try {
        await apiCall(`/api/articles/${articleId}/read`, {
            method: 'PUT'
        });
        
        loadArticles(currentArticlesPage);
        showSuccess('مقاله به عنوان خوانده شده علامت‌گذاری شد');
        
    } catch (error) {
        alert('خطا در علامت‌گذاری مقاله: ' + error.message);
    }
}

async function deleteArticle(articleId, articleTitle) {
    try {
        // تأیید حذف از کاربر
        const confirmed = confirm(`آیا مطمئن هستید که می‌خواهید مقاله زیر را حذف کنید؟\n\n"${articleTitle}"\n\nاین عملیات قابل برگشت نیست!`);
        
        if (!confirmed) {
            return;
        }
        
        // نمایش loading
        const deleteBtn = event.target.closest('button');
        const originalContent = deleteBtn.innerHTML;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        deleteBtn.disabled = true;
        
        await apiCall(`/api/articles/${articleId}`, {
            method: 'DELETE'
        });
        
        // بازگردانی دکمه
        deleteBtn.innerHTML = originalContent;
        deleteBtn.disabled = false;
        
        // بارگذاری مجدد مقالات
        loadArticles(currentArticlesPage);
        showSuccess('مقاله با موفقیت حذف شد');
        
    } catch (error) {
        // بازگردانی دکمه در صورت خطا
        const deleteBtn = event.target.closest('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.disabled = false;
        
        alert('خطا در حذف مقاله: ' + error.message);
    }
}

// توابع مربوط به فیلترهای پیشرفته
function toggleAdvancedFilters() {
    const filtersDiv = document.getElementById('advancedFilters');
    const toggleBtn = event.target.closest('button');
    
    if (filtersDiv.style.display === 'none') {
        filtersDiv.style.display = 'block';
        toggleBtn.innerHTML = '<i class="fas fa-filter"></i> مخفی کردن فیلترها';
        toggleBtn.classList.remove('btn-outline-info');
        toggleBtn.classList.add('btn-info');
    } else {
        filtersDiv.style.display = 'none';
        toggleBtn.innerHTML = '<i class="fas fa-filter"></i> فیلترهای پیشرفته';
        toggleBtn.classList.remove('btn-info');
        toggleBtn.classList.add('btn-outline-info');
    }
}

function applyFilters() {
    loadArticles(1);
}

function clearFilters() {
    // پاک کردن تمام فیلترها
    document.getElementById('titleSearch').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    document.getElementById('depthFilter').value = '';
    document.getElementById('sortBy').value = 'created_at_desc';
    document.getElementById('pageSize').value = '25';
    
    // بارگذاری مجدد مقالات
    loadArticles(1);
    
    showSuccess('فیلترها پاک شدند');
}

// Stats functions
async function loadStats() {
    try {
        const data = await apiCall('/api/stats');
        const stats = data.stats;
        
        // Update stats cards
        if (document.getElementById('totalArticles')) {
            document.getElementById('totalArticles').textContent = stats.totalArticles || 0;
        }
        if (document.getElementById('newArticles')) {
            document.getElementById('newArticles').textContent = stats.newArticles || 0;
        }
        if (document.getElementById('totalSources')) {
            document.getElementById('totalSources').textContent = stats.totalSources || 0;
        }
        if (document.getElementById('recentCrawls')) {
            document.getElementById('recentCrawls').textContent = stats.recentCrawls || 0;
        }
        
        // Update top sources
        const topSourcesList = document.getElementById('topSources');
        if (topSourcesList && stats.topSources) {
            topSourcesList.innerHTML = stats.topSources.map(source => 
                `<li class="list-group-item d-flex justify-content-between align-items-center">
                    ${source.name}
                    <span class="badge bg-primary rounded-pill">${source.article_count}</span>
                </li>`
            ).join('');
        }
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Logs functions
async function loadLogs() {
    try {
        const data = await apiCall('/api/logs');
        const logs = data.logs || data || [];
        const tableBody = document.getElementById('logsTable');
        
        if (logs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">هیچ لاگی یافت نشد</td></tr>';
            return;
        }
        
        const logsHtml = logs.map(log => `
            <tr>
                <td>${formatDate(log.created_at)}</td>
                <td>${log.source_name || 'نامشخص'}</td>
                <td><span class="badge bg-info">${log.action}</span></td>
                <td>
                    <span class="badge ${getStatusBadgeClass(log.status)}">
                        ${log.status}
                    </span>
                </td>
                <td>
                    <small>
                        یافت شده: ${log.articles_found || 0} | 
                        پردازش شده: ${log.articles_processed || 0}
                    </small>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-info" 
                            onclick='showLogDetails(${JSON.stringify(log).replace(/'/g, "&#39;").replace(/"/g, "&quot;")})'>
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = logsHtml;
        
    } catch (error) {
        console.error('Error loading logs:', error);
        document.getElementById('logsTable').innerHTML = 
            '<tr><td colspan="6" class="text-center text-danger">خطا در بارگذاری لاگ‌ها</td></tr>';
    }
}

// Test functions
async function handleTest(e) {
    e.preventDefault();
    
    const url = document.getElementById('testUrl').value;
    const selector = document.getElementById('testSelector').value;
    const type = document.getElementById('testType').value;
    const driverType = document.getElementById('testDriverType').value;
    const realtimeLogs = document.getElementById('realtimeLogs').checked;
    
    const resultDiv = document.getElementById('testResult');
    const startTime = Date.now();
    
    // نمایش/مخفی کردن بخش لاگ‌ها
    const logsCard = document.getElementById('realtimeLogsCard');
    if (realtimeLogs) {
        logsCard.style.display = 'block';
        clearLogs();
        addLog('🚀 شروع تست سلکتور...', 'info');
        addLog(`📋 تنظیمات: درایور=${driverType}, نوع=${type}`, 'info');
        addLog(`🌐 URL: ${url}`, 'info');
        addLog(`🎯 سلکتور: ${selector}`, 'info');
    } else {
        logsCard.style.display = 'none';
    }
    
    // نمایش نشانگر بارگذاری پیشرفته
    resultDiv.innerHTML = `
        <div class="text-center p-4">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">در حال بارگذاری...</span>
            </div>
            <div class="h6 text-muted">در حال تست سلکتور...</div>
            <div class="small text-muted">لطفاً صبر کنید، این عملیات ممکن است تا 60 ثانیه طول بکشد</div>
            <div class="progress mt-3" style="height: 6px;">
                <div class="progress-bar progress-bar-striped progress-bar-animated" 
                     role="progressbar" style="width: 100%"></div>
            </div>
            <div class="mt-3">
                <small class="text-warning">
                    <i class="fas fa-info-circle me-1"></i>
                    اگر صفحه سنگین باشد، ممکن است زمان بیشتری نیاز باشد
                </small>
            </div>
        </div>
    `;
    
    try {
        // تنظیم timeout طولانی‌تر برای درخواست
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 65000); // 65 ثانیه
        
        if (realtimeLogs) {
            addLog('🔄 ارسال درخواست به سرور...', 'info');
        }
        
        const response = await fetch('/api/test-selector', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                selector: selector,
                type: type,
                driverType: driverType
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const result = await response.json();
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        if (realtimeLogs) {
            addLog('✅ پاسخ از سرور دریافت شد', 'success');
        }
        
        if (result.success) {
            // اضافه کردن آمار موفق
            addTestStat(true);
            
            if (realtimeLogs) {
                addLog(`🎉 تست موفقیت‌آمیز! ${result.data.count || 0} عنصر یافت شد`, 'success');
                addLog(`⏱️ زمان اجرا: ${duration} ثانیه`, 'info');
            }
            
            const { data, metadata, performance, suggestions } = result;
            
            // نمایش نتایج موفقیت‌آمیز
            let resultHtml = `
                <div class="alert alert-success border-0 shadow-sm">
                    <div class="d-flex align-items-center mb-3">
                        <i class="fas fa-check-circle text-success me-2 fs-5"></i>
                        <h6 class="mb-0 text-success">تست موفقیت‌آمیز</h6>
                    </div>
                    
                    <div class="row mb-3">
                        <div class="col-md-3">
                            <div class="text-center p-2 bg-light rounded">
                                <div class="h4 text-primary mb-1">${data.count || 0}</div>
                                <small class="text-muted">عنصر یافت شده</small>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="text-center p-2 bg-light rounded">
                                <div class="h4 text-info mb-1">${duration}s</div>
                                <small class="text-muted">زمان اجرا</small>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="text-center p-2 bg-light rounded">
                                <div class="h4 text-warning mb-1">${performance?.loadTime || 'N/A'}</div>
                                <small class="text-muted">زمان بارگذاری</small>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="text-center p-2 bg-light rounded">
                                <div class="h4 text-secondary mb-1">${metadata?.pageSize || 'N/A'}</div>
                                <small class="text-muted">حجم صفحه</small>
                            </div>
                        </div>
                    </div>
            `;
            
            // نمایش نمونه‌های یافت شده
            if (data.samples && data.samples.length > 0) {
                if (type === 'list') {
                    const linksHtml = data.samples.map((item, index) => {
                        const displayText = item.text ? item.text.substring(0, 100) + (item.text.length > 100 ? '...' : '') : 'بدون متن';
                        const displayUrl = item.href ? (item.href.length > 60 ? item.href.substring(0, 60) + '...' : item.href) : 'بدون لینک';
                        
                        return `
                            <div class="border rounded p-3 mb-2 bg-white">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <span class="badge bg-primary">#${index + 1}</span>
                                    <small class="text-muted">${item.tagName || 'unknown'}</small>
                                </div>
                                <div class="mb-2">
                                    <strong class="text-dark">${displayText}</strong>
                                </div>
                                ${item.href ? `
                                    <div class="mb-2">
                                        <a href="${item.href}" target="_blank" class="text-decoration-none small">
                                            <i class="fas fa-external-link-alt me-1"></i>${displayUrl}
                                        </a>
                                    </div>
                                ` : ''}
                                ${item.className ? `<div class="small text-muted">کلاس: <code>${item.className}</code></div>` : ''}
                                ${item.id ? `<div class="small text-muted">شناسه: <code>${item.id}</code></div>` : ''}
                            </div>
                        `;
                    }).join('');
                    
                    resultHtml += `
                        <div class="mt-3">
                            <h6 class="text-dark mb-3">نمونه‌های یافت شده:</h6>
                            <div style="max-height: 400px; overflow-y: auto;">
                                ${linksHtml}
                            </div>
                        </div>
                    `;
                } else {
                    const contentHtml = data.samples.map((item, index) => `
                        <div class="border rounded p-3 mb-2 bg-white">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="badge bg-primary">#${index + 1}</span>
                                <small class="text-muted">${item.tagName || 'unknown'}</small>
                            </div>
                            <div class="text-dark" style="white-space: pre-wrap; word-break: break-word;">
                                ${item.text ? item.text.substring(0, 500) + (item.text.length > 500 ? '...' : '') : 'محتوای خالی'}
                            </div>
                            ${item.className ? `<div class="small text-muted mt-2">کلاس: <code>${item.className}</code></div>` : ''}
                            ${item.id ? `<div class="small text-muted">شناسه: <code>${item.id}</code></div>` : ''}
                        </div>
                    `).join('');
                    
                    resultHtml += `
                        <div class="mt-3">
                            <h6 class="text-dark mb-3">محتوای یافت شده:</h6>
                            <div style="max-height: 400px; overflow-y: auto;">
                                ${contentHtml}
                            </div>
                        </div>
                    `;
                }
            }
            
            // نمایش اطلاعات صفحه
            if (metadata) {
                resultHtml += `
                    <div class="mt-3 p-3 bg-light rounded">
                        <h6 class="text-dark mb-2">اطلاعات صفحه:</h6>
                        <div class="row small">
                            ${metadata.title ? `<div class="col-md-6 mb-1"><strong>عنوان:</strong> ${metadata.title.substring(0, 50)}${metadata.title.length > 50 ? '...' : ''}</div>` : ''}
                            ${metadata.description ? `<div class="col-md-6 mb-1"><strong>توضیحات:</strong> ${metadata.description.substring(0, 50)}${metadata.description.length > 50 ? '...' : ''}</div>` : ''}
                            ${metadata.language ? `<div class="col-md-6 mb-1"><strong>زبان:</strong> ${metadata.language}</div>` : ''}
                            ${metadata.charset ? `<div class="col-md-6 mb-1"><strong>کدگذاری:</strong> ${metadata.charset}</div>` : ''}
                        </div>
                    </div>
                `;
            }
            
            // نمایش پیشنهادات بهبود
            if (suggestions && suggestions.length > 0) {
                const suggestionsHtml = suggestions.map(suggestion => `
                    <li class="mb-1">
                        <code class="text-primary">${suggestion}</code>
                        <button class="btn btn-sm btn-outline-primary ms-2" onclick="applySuggestion('${suggestion.replace(/'/g, "\\'")}')">اعمال</button>
                    </li>
                `).join('');
                
                resultHtml += `
                    <div class="mt-3 p-3 bg-warning bg-opacity-10 border border-warning rounded">
                        <h6 class="text-warning-emphasis mb-2">
                            <i class="fas fa-lightbulb me-1"></i>پیشنهادات بهبود:
                        </h6>
                        <ul class="mb-0 small">
                            ${suggestionsHtml}
                        </ul>
                    </div>
                `;
            }
            
            resultHtml += '</div>';
            resultDiv.innerHTML = resultHtml;
            
        } else {
            // اضافه کردن آمار خطا
            addTestStat(false);
            
            if (realtimeLogs) {
                addLog(`❌ تست ناموفق: ${result.message}`, 'error');
                if (result.suggestions && result.suggestions.length > 0) {
                    addLog(`💡 پیشنهادات: ${result.suggestions.join(', ')}`, 'warning');
                }
            }
            
            // نمایش خطاهای مختلف
            let errorClass = 'alert-danger';
            let errorIcon = 'fas fa-exclamation-triangle';
            let errorTitle = 'خطا در تست';
            
            if (result.error?.type === 'timeout') {
                errorClass = 'alert-warning';
                errorIcon = 'fas fa-clock';
                errorTitle = 'زمان انتظار تمام شد';
            } else if (result.error?.type === 'network') {
                errorClass = 'alert-info';
                errorIcon = 'fas fa-wifi';
                errorTitle = 'خطای شبکه';
            }
            
            let errorHtml = `
                <div class="alert ${errorClass} border-0 shadow-sm">
                    <div class="d-flex align-items-center mb-3">
                        <i class="${errorIcon} me-2 fs-5"></i>
                        <h6 class="mb-0">${errorTitle}</h6>
                    </div>
                    <p class="mb-3">${result.message}</p>
            `;
            
            // نمایش جزئیات خطا
            if (result.error?.details) {
                errorHtml += `
                    <div class="p-3 bg-light rounded mb-3">
                        <h6 class="small mb-2">جزئیات خطا:</h6>
                        <code class="small">${result.error.details}</code>
                    </div>
                `;
            }
            
            // نمایش پیشنهادات رفع خطا
            if (result.suggestions && result.suggestions.length > 0) {
                const suggestionsHtml = result.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('');
                errorHtml += `
                    <div class="mt-3">
                        <h6 class="small mb-2">پیشنهادات رفع مشکل:</h6>
                        <ul class="small mb-0">${suggestionsHtml}</ul>
                    </div>
                `;
            }
            
            // نمایش اطلاعات صفحه در صورت وجود
            if (result.pageInfo) {
                errorHtml += `
                    <div class="mt-3 p-3 bg-light rounded">
                        <h6 class="small mb-2">اطلاعات صفحه:</h6>
                        <div class="small">
                            ${result.pageInfo.accessible ? '<span class="text-success">✓ صفحه قابل دسترسی است</span>' : '<span class="text-danger">✗ صفحه قابل دسترسی نیست</span>'}<br>
                            ${result.pageInfo.title ? `عنوان: ${result.pageInfo.title}<br>` : ''}
                            ${result.pageInfo.status ? `وضعیت HTTP: ${result.pageInfo.status}<br>` : ''}
                            ${result.pageInfo.loadTime ? `زمان بارگذاری: ${result.pageInfo.loadTime}` : ''}
                        </div>
                    </div>
                `;
            }
            
            errorHtml += '</div>';
            resultDiv.innerHTML = errorHtml;
        }
        
    } catch (error) {
        console.error('خطا در تست سلکتور:', error);
        
        if (realtimeLogs) {
            addLog(`💥 خطای اتصال: ${error.message}`, 'error');
        }
        
        // اضافه کردن آمار خطا
        addTestStat(false);
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        let errorMessage = 'خطای اتصال';
        let errorDetail = 'امکان اتصال به سرور وجود ندارد.';
        let suggestions = [
            'اتصال اینترنت خود را بررسی کنید',
            'مطمئن شوید که URL صحیح است',
            'چند دقیقه صبر کرده و دوباره تلاش کنید'
        ];
        
        if (error.name === 'AbortError') {
            errorMessage = 'خطای Timeout';
            errorDetail = 'درخواست بیش از 65 ثانیه طول کشید و لغو شد.';
            suggestions = [
                'از URL ساده‌تر استفاده کنید',
                'صفحه ممکن است بسیار سنگین باشد',
                'سرور هدف ممکن است کند باشد',
                'چند دقیقه بعد دوباره تلاش کنید'
            ];
        } else if (error.message.includes('fetch')) {
            errorDetail = 'مشکل در ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.';
        }
        
        const suggestionsHtml = suggestions.map(s => `<li>${s}</li>`).join('');
        
        resultDiv.innerHTML = `
            <div class="alert alert-danger border-0 shadow-sm">
                <div class="d-flex align-items-center mb-3">
                    <i class="fas fa-times-circle text-danger me-2 fs-5"></i>
                    <h6 class="mb-0 text-danger">${errorMessage}</h6>
                </div>
                <p class="mb-3">${errorDetail}</p>
                <div class="p-3 bg-light rounded mb-3">
                    <h6 class="small mb-2">پیام خطا:</h6>
                    <code class="small text-danger">${error.message}</code>
                </div>
                <div class="small text-muted">
                    <strong>زمان اجرا:</strong> ${duration} ثانیه
                </div>
                <div class="mt-3">
                    <h6 class="small mb-2">راه‌حل‌های پیشنهادی:</h6>
                    <ul class="small mb-0">
                        ${suggestionsHtml}
                        <li>در صورت تکرار مشکل، با پشتیبانی تماس بگیرید</li>
                    </ul>
                </div>
            </div>
        `;
    }
}

// تابع کمکی برای اعمال پیشنهادات
function applySuggestion(suggestion) {
    document.getElementById('testSelector').value = suggestion;
    showSuccess('سلکتور پیشنهادی اعمال شد');
}

// توابع مدیریت لاگ real-time
function addLog(message, type = 'info') {
    const logsContainer = document.getElementById('realtimeLogs');
    if (!logsContainer) return;
    
    const timestamp = new Date().toLocaleTimeString('fa-IR');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    
    let icon = '📝';
    switch(type) {
        case 'success': icon = '✅'; break;
        case 'error': icon = '❌'; break;
        case 'warning': icon = '⚠️'; break;
        case 'info': icon = 'ℹ️'; break;
    }
    
    logEntry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-icon">${icon}</span>
        <span class="log-message">${message}</span>
    `;
    
    logsContainer.appendChild(logEntry);
    
    // Auto scroll اگر فعال باشد
    const autoScrollCheckbox = document.getElementById('autoScrollLogs');
    if (autoScrollCheckbox && autoScrollCheckbox.checked) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }
}

function clearLogs() {
    const logsContainer = document.getElementById('realtimeLogs');
    if (logsContainer) {
        logsContainer.innerHTML = '';
    }
}

function toggleAutoScroll() {
    const checkbox = document.getElementById('autoScrollLogs');
    const logsContainer = document.getElementById('realtimeLogs');
    
    if (checkbox && checkbox.checked && logsContainer) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }
}

// توابع کمکی برای بخش تست سلکتور
function setSelectorExample(selector) {
    document.getElementById('testSelector').value = selector;
    showSuccess('نمونه سلکتور اعمال شد');
}

function clearTestForm() {
    document.getElementById('testForm').reset();
    showSuccess('فرم تست پاک شد');
}

function clearTestResult() {
    const resultDiv = document.getElementById('testResult');
    resultDiv.innerHTML = `
        <div class="h-100 d-flex align-items-center justify-content-center text-muted">
            <div class="text-center">
                <i class="fas fa-flask fa-3x mb-3 text-muted"></i>
                <h5>آماده برای تست</h5>
                <p class="mb-0">URL و سلکتور را وارد کرده و دکمه "اجرای تست" را بزنید</p>
            </div>
        </div>
    `;
    document.getElementById('exportBtn').style.display = 'none';
    showSuccess('نتایج تست پاک شد');
}

function showSelectorHelp() {
    const helpContent = `
        <div class="modal fade" id="selectorHelpModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-info text-white">
                        <h5 class="modal-title"><i class="fas fa-question-circle me-2"></i>راهنمای سلکتور CSS</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6 class="text-primary">سلکتورهای پایه:</h6>
                                <table class="table table-sm">
                                    <tbody>
                                        <tr><td><code>a</code></td><td>تمام لینک‌ها</td></tr>
                                        <tr><td><code>p</code></td><td>تمام پاراگراف‌ها</td></tr>
                                        <tr><td><code>h1</code></td><td>تیترهای سطح 1</td></tr>
                                        <tr><td><code>div</code></td><td>تمام div ها</td></tr>
                                        <tr><td><code>.class</code></td><td>عناصر با کلاس مشخص</td></tr>
                                        <tr><td><code>#id</code></td><td>عنصر با شناسه مشخص</td></tr>
                                    </tbody>
                                </table>
                                
                                <h6 class="text-primary mt-3">سلکتورهای ویژگی:</h6>
                                <table class="table table-sm">
                                    <tbody>
                                        <tr><td><code>a[href]</code></td><td>لینک‌های دارای href</td></tr>
                                        <tr><td><code>a[href*="news"]</code></td><td>لینک‌های حاوی "news"</td></tr>
                                        <tr><td><code>a[href^="http"]</code></td><td>لینک‌های شروع شده با "http"</td></tr>
                                        <tr><td><code>a[href$=".html"]</code></td><td>لینک‌های ختم شده به ".html"</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-primary">ترکیب سلکتورها:</h6>
                                <table class="table table-sm">
                                    <tbody>
                                        <tr><td><code>div p</code></td><td>پاراگراف‌های داخل div</td></tr>
                                        <tr><td><code>div > p</code></td><td>پاراگراف‌های فرزند مستقیم div</td></tr>
                                        <tr><td><code>h1, h2, h3</code></td><td>تیترهای سطح 1، 2 و 3</td></tr>
                                        <tr><td><code>a.title</code></td><td>لینک‌های با کلاس title</td></tr>
                                    </tbody>
                                </table>
                                
                                <h6 class="text-primary mt-3">نمونه‌های عملی:</h6>
                                <div class="bg-light p-3 rounded">
                                    <div class="mb-2">
                                        <strong>برای سایت خبری:</strong><br>
                                        <code>a[href*="/news/"]</code>
                                    </div>
                                    <div class="mb-2">
                                        <strong>برای عناوین اخبار:</strong><br>
                                        <code>.title, .headline, h1, h2</code>
                                    </div>
                                    <div class="mb-2">
                                        <strong>برای محتوای مقاله:</strong><br>
                                        <code>.content p, .article-body p</code>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-info mt-3">
                            <h6><i class="fas fa-lightbulb me-1"></i>نکات مهم:</h6>
                            <ul class="mb-0">
                                <li>برای یافتن سلکتور مناسب، از Developer Tools مرورگر استفاده کنید (F12)</li>
                                <li>سلکتورهای ساده معمولاً پایدارتر هستند</li>
                                <li>قبل از استفاده، سلکتور را در Console مرورگر تست کنید</li>
                                <li>از <code>document.querySelectorAll('selector')</code> برای تست استفاده کنید</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">بستن</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // حذف مودال قبلی اگر وجود داشته باشد
    const existingModal = document.getElementById('selectorHelpModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // اضافه کردن مودال جدید
    document.body.insertAdjacentHTML('beforeend', helpContent);
    
    // نمایش مودال
    const modal = new bootstrap.Modal(document.getElementById('selectorHelpModal'));
    modal.show();
}

function exportTestResult() {
    const resultDiv = document.getElementById('testResult');
    const resultText = resultDiv.innerText || resultDiv.textContent;
    
    if (!resultText || resultText.includes('آماده برای تست')) {
        showError(null, 'هیچ نتیجه‌ای برای خروجی وجود ندارد');
        return;
    }
    
    const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-result-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showSuccess('نتایج تست ذخیره شد');
}

// متغیرهای آمار تست
let testStats = {
    success: 0,
    error: 0,
    total: 0
};

// بارگذاری آمار از localStorage
function loadTestStats() {
    const saved = localStorage.getItem('testStats');
    if (saved) {
        testStats = JSON.parse(saved);
        updateTestStatsDisplay();
    }
}

// ذخیره آمار در localStorage
function saveTestStats() {
    localStorage.setItem('testStats', JSON.stringify(testStats));
}

// به‌روزرسانی نمایش آمار
function updateTestStatsDisplay() {
    document.getElementById('successCount').textContent = testStats.success;
    document.getElementById('errorCount').textContent = testStats.error;
    document.getElementById('totalCount').textContent = testStats.total;
}

// اضافه کردن آمار تست
function addTestStat(success) {
    testStats.total++;
    if (success) {
        testStats.success++;
    } else {
        testStats.error++;
    }
    updateTestStatsDisplay();
    saveTestStats();
}

// بارگذاری آمار هنگام شروع
document.addEventListener('DOMContentLoaded', function() {
    loadTestStats();
});

// Utility functions
function formatDate(dateString) {
    // بررسی اعتبار تاریخ
    if (!dateString || dateString === 'null' || dateString === 'undefined') {
        return 'نامشخص';
    }
    
    // تبدیل تاریخ به منطقه زمانی تهران
    const date = new Date(dateString);
    
    // بررسی اعتبار تاریخ
    if (isNaN(date.getTime())) {
        return 'نامشخص';
    }
    
    const tehranTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
    
    // فرمت‌بندی تاریخ و زمان به فارسی
    const options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    
    return new Intl.DateTimeFormat('fa-IR', options).format(tehranTime);
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'success':
            return 'bg-success';
        case 'error':
            return 'bg-danger';
        case 'warning':
            return 'bg-warning';
        default:
            return 'bg-secondary';
    }
}

function showLogDetails(logData) {
    try {
        // اگر logData یک رشته است، سعی کن آن را به JSON تبدیل کنی
        let log;
        if (typeof logData === 'string') {
            try {
                log = JSON.parse(logData);
            } catch (e) {
                // اگر JSON نیست، به عنوان پیام ساده در نظر بگیر
                log = { message: logData };
            }
        } else {
            log = logData;
        }

        // پر کردن اطلاعات مودال
        document.getElementById('logDetailTime').textContent = log.created_at || log.timestamp || 'نامشخص';
        document.getElementById('logDetailSource').textContent = log.source_name || 'نامشخص';
        document.getElementById('logDetailAction').textContent = log.action || 'نامشخص';
        
        const statusElement = document.getElementById('logDetailStatus');
        statusElement.textContent = log.status || 'نامشخص';
        statusElement.className = `badge ${getStatusBadgeClass(log.status)}`;
        
        document.getElementById('logDetailFound').textContent = log.articles_found || '0';
        document.getElementById('logDetailProcessed').textContent = log.articles_processed || '0';
        
        // نمایش پیام کامل
        const messageElement = document.getElementById('logDetailMessage');
        let displayMessage = log.message || 'پیامی موجود نیست';
        
        // اگر پیام JSON است، آن را فرمت کن
        try {
            if (typeof displayMessage === 'string' && (displayMessage.startsWith('{') || displayMessage.startsWith('['))) {
                const parsed = JSON.parse(displayMessage);
                displayMessage = JSON.stringify(parsed, null, 2);
            }
        } catch (e) {
            // اگر JSON نیست، همان رشته اصلی را نگه دار
        }
        
        messageElement.textContent = displayMessage;
        
        // نمایش جزئیات خطا اگر وضعیت error است
        const errorDiv = document.getElementById('logDetailError');
        if (log.status === 'error' || log.status === 'failed') {
            errorDiv.style.display = 'block';
            const errorMessageElement = document.getElementById('logDetailErrorMessage');
            
            let errorDetails = '';
            if (log.error_details) {
                errorDetails = log.error_details;
            } else if (log.message && log.message.includes('خطا')) {
                errorDetails = log.message;
            } else {
                errorDetails = 'جزئیات خطا در دسترس نیست';
            }
            
            errorMessageElement.textContent = errorDetails;
        } else {
            errorDiv.style.display = 'none';
        }
        
        // نمایش مودال
        const modal = new bootstrap.Modal(document.getElementById('logDetailsModal'));
        modal.show();
        
    } catch (error) {
        console.error('خطا در نمایش جزئیات لاگ:', error);
        alert('خطا در نمایش جزئیات لاگ');
    }
}

// توابع مدیریت نشانگر بارگذاری صفحه
function startPageLoading() {
    const pageLoading = document.getElementById('pageLoading');
    if (pageLoading) {
        pageLoading.style.display = 'block';
    }
    
    // اگر بارگذاری بیش از 5 ثانیه طول بکشد، نشانگر را مخفی کن
    pageLoadingTimeout = setTimeout(() => {
        stopPageLoading();
    }, 5000);
}

function stopPageLoading() {
    const pageLoading = document.getElementById('pageLoading');
    if (pageLoading) {
        pageLoading.style.opacity = '0';
        setTimeout(() => {
            pageLoading.style.display = 'none';
            pageLoading.style.opacity = '1';
        }, 300);
    }
    
    if (pageLoadingTimeout) {
        clearTimeout(pageLoadingTimeout);
    }
}

// Schedules functions
async function loadSchedules() {
    try {
        const data = await apiCall('/api/schedules');
        const schedules = data.schedules || data || [];
        const tableBody = document.getElementById('schedulesTable');
        
        if (schedules.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">هیچ زمان‌بندی یافت نشد</td></tr>';
            return;
        }
        
        const schedulesHtml = schedules.map(schedule => `
            <tr>
                <td>${schedule.source_name || 'نامشخص'}</td>
                <td><code>${schedule.cron_expression}</code></td>
                <td>
                    <span class="badge ${schedule.is_active ? 'bg-success' : 'bg-secondary'}">
                        ${schedule.is_active ? 'فعال' : 'غیرفعال'}
                    </span>
                </td>
                <td>${schedule.last_run ? formatDate(schedule.last_run) : 'هرگز'}</td>
                <td>${schedule.next_run ? formatDate(schedule.next_run) : 'نامشخص'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" 
                            onclick="editSchedule(${schedule.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" 
                            onclick="deleteSchedule(${schedule.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = schedulesHtml;
        
    } catch (error) {
        console.error('Error loading schedules:', error);
        document.getElementById('schedulesTable').innerHTML = 
            '<tr><td colspan="6" class="text-center text-danger">خطا در بارگذاری زمان‌بندی‌ها</td></tr>';
    }
}

async function loadScheduleSources() {
    try {
        const data = await apiCall('/api/sources');
        const sources = data.sources || data || [];
        const select = document.getElementById('scheduleSource');
        
        select.innerHTML = '<option value="">انتخاب منبع...</option>';
        
        sources.forEach(source => {
            if (source.active) {
                const option = document.createElement('option');
                option.value = source.id;
                option.textContent = source.name;
                select.appendChild(option);
            }
        });
        
    } catch (error) {
        console.error('Error loading sources for schedules:', error);
    }
}

function showAddScheduleForm() {
    document.getElementById('scheduleFormTitle').textContent = 'افزودن زمان‌بندی جدید';
    document.getElementById('scheduleForm').reset();
    document.getElementById('scheduleId').value = '';
    document.getElementById('isActive').checked = true;
    
    // تنظیم مقادیر پیش‌فرض برای تنظیمات کرال
    document.getElementById('crawlDepth').value = 0;
    document.getElementById('articleLimit').value = 10;
    document.getElementById('timeoutMs').value = 300000;
    document.getElementById('fullContent').checked = true;
    document.getElementById('followLinks').checked = true;
    
    document.getElementById('scheduleFormContainer').style.display = 'block';
}

function hideScheduleForm() {
    document.getElementById('scheduleFormContainer').style.display = 'none';
}

async function editSchedule(id) {
    try {
        const data = await apiCall(`/api/schedules/${id}`);
        const schedule = data.schedule || data;
        
        document.getElementById('scheduleFormTitle').textContent = 'ویرایش زمان‌بندی';
        document.getElementById('scheduleId').value = schedule.id;
        document.getElementById('scheduleSource').value = schedule.source_id;
        document.getElementById('cronExpression').value = schedule.cron_expression;
        document.getElementById('isActive').checked = schedule.is_active;
        
        // پر کردن فیلدهای تنظیمات کرال
        document.getElementById('crawlDepth').value = schedule.crawl_depth || 0;
        document.getElementById('articleLimit').value = schedule.article_limit || 10;
        document.getElementById('timeoutMs').value = schedule.timeout_ms || 300000;
        document.getElementById('fullContent').checked = schedule.full_content !== false;
        document.getElementById('followLinks').checked = schedule.follow_links !== false;
        
        document.getElementById('scheduleFormContainer').style.display = 'block';
        
    } catch (error) {
        showError(null, 'خطا در بارگذاری اطلاعات زمان‌بندی: ' + error.message);
    }
}

async function deleteSchedule(id) {
    if (!confirm('آیا از حذف این زمان‌بندی اطمینان دارید؟')) {
        return;
    }
    
    try {
        await apiCall(`/api/schedules/${id}`, {
            method: 'DELETE'
        });
        
        showSuccess('زمان‌بندی با موفقیت حذف شد');
        loadSchedules();
        
    } catch (error) {
        showError(null, 'خطا در حذف زمان‌بندی: ' + error.message);
    }
}

// Setup schedule form submission
document.addEventListener('DOMContentLoaded', function() {
    const scheduleForm = document.getElementById('scheduleForm');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const scheduleId = document.getElementById('scheduleId').value;
            const sourceId = document.getElementById('scheduleSource').value;
            const cronExpression = document.getElementById('cronExpression').value;
            const isActive = document.getElementById('isActive').checked;
            
            // دریافت تنظیمات کرال
            const crawlSettings = {
                crawl_depth: parseInt(document.getElementById('crawlDepth').value) || 0,
                article_limit: parseInt(document.getElementById('articleLimit').value) || 10,
                timeout_ms: parseInt(document.getElementById('timeoutMs').value) || 300000,
                full_content: document.getElementById('fullContent').checked,
                follow_links: document.getElementById('followLinks').checked
            };
            
            try {
                const url = scheduleId ? `/api/schedules/${scheduleId}` : '/api/schedules';
                const method = scheduleId ? 'PUT' : 'POST';
                
                await apiCall(url, {
                    method: method,
                    body: JSON.stringify({
                        source_id: sourceId,
                        cron_expression: cronExpression,
                        is_active: isActive,
                        crawl_settings: crawlSettings
                    })
                });
                
                showSuccess(scheduleId ? 'زمان‌بندی با موفقیت به‌روزرسانی شد' : 'زمان‌بندی با موفقیت اضافه شد');
                hideScheduleForm();
                loadSchedules();
                
            } catch (error) {
                showError(null, 'خطا در ذخیره زمان‌بندی: ' + error.message);
            }
        });
    }
});

// ==================== CLEANUP MANAGEMENT ====================

function showAddCleanupForm() {
    document.getElementById('cleanupFormTitle').textContent = 'افزودن زمانبندی پاک‌سازی';
    document.getElementById('cleanupForm').reset();
    document.getElementById('cleanupId').value = '';
    
    // تنظیم مقادیر پیش‌فرض
    document.getElementById('cleanupName').value = '';
    document.getElementById('cleanupCron').value = '0 2 * * *';
    document.getElementById('keepArticlesCount').value = 1000;
    document.getElementById('cleanupActive').checked = true;
    
    document.getElementById('cleanupFormContainer').style.display = 'block';
}

function hideCleanupForm() {
    document.getElementById('cleanupFormContainer').style.display = 'none';
}

async function loadCleanupSchedules() {
    try {
        const data = await apiCall('/api/cleanup-schedules');
        const schedules = data.schedules || [];
        
        const container = document.getElementById('cleanupSchedulesContainer');
        
        if (schedules.length === 0) {
            container.innerHTML = `
                <div class="text-center p-4">
                    <i class="fas fa-broom fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">هیچ زمانبندی پاک‌سازی یافت نشد</h5>
                    <button class="btn btn-primary mt-2" onclick="showAddCleanupForm()">
                        <i class="fas fa-plus me-1"></i>افزودن اولین زمانبندی
                    </button>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>نام</th>
                            <th>عبارت Cron</th>
                            <th>تعداد باقی‌مانده</th>
                            <th>وضعیت</th>
                            <th>تاریخ ایجاد</th>
                            <th>عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        schedules.forEach(schedule => {
            html += `
                <tr>
                    <td><strong>${schedule.name}</strong></td>
                    <td><code>${schedule.cron_expression}</code></td>
                    <td>${schedule.keep_articles_count.toLocaleString()} مقاله</td>
                    <td>
                        <span class="badge ${schedule.is_active ? 'bg-success' : 'bg-secondary'}">
                            ${schedule.is_active ? 'فعال' : 'غیرفعال'}
                        </span>
                    </td>
                    <td>${schedule.created_at || 'نامشخص'}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-warning" onclick="runCleanupSchedule(${schedule.id})">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="btn btn-outline-primary" onclick="editCleanupSchedule(${schedule.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="deleteCleanupSchedule(${schedule.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        document.getElementById('cleanupSchedulesContainer').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                خطا در بارگذاری زمانبندی‌های پاک‌سازی: ${error.message}
            </div>
        `;
    }
}

async function editCleanupSchedule(id) {
    try {
        const data = await apiCall(`/api/cleanup-schedules/${id}`);
        const schedule = data.schedule || data;
        
        document.getElementById('cleanupFormTitle').textContent = 'ویرایش زمانبندی پاک‌سازی';
        document.getElementById('cleanupId').value = schedule.id;
        document.getElementById('cleanupName').value = schedule.name;
        document.getElementById('cleanupCron').value = schedule.cron_expression;
        document.getElementById('keepArticlesCount').value = schedule.keep_articles_count;
        document.getElementById('cleanupActive').checked = schedule.is_active;
        
        document.getElementById('cleanupFormContainer').style.display = 'block';
        
    } catch (error) {
        showError(null, 'خطا در بارگذاری اطلاعات زمانبندی: ' + error.message);
    }
}

async function deleteCleanupSchedule(id) {
    if (!confirm('آیا از حذف این زمانبندی پاک‌سازی اطمینان دارید؟')) {
        return;
    }
    
    try {
        await apiCall(`/api/cleanup-schedules/${id}`, {
            method: 'DELETE'
        });
        
        showSuccess('زمانبندی پاک‌سازی با موفقیت حذف شد');
        loadCleanupSchedules();
        
    } catch (error) {
        showError(null, 'خطا در حذف زمانبندی: ' + error.message);
    }
}

async function runCleanupSchedule(id) {
    if (!confirm('آیا می‌خواهید این زمانبندی پاک‌سازی را اکنون اجرا کنید؟')) {
        return;
    }
    
    try {
        const data = await apiCall(`/api/cleanup-schedules/${id}/run`, {
            method: 'POST'
        });
        
        showSuccess(data.message);
        
    } catch (error) {
        showError(null, 'خطا در اجرای پاک‌سازی: ' + error.message);
    }
}

function showManualCleanupModal() {
    const modal = new bootstrap.Modal(document.getElementById('manualCleanupModal'));
    modal.show();
}

async function performManualCleanup() {
    const keepCount = parseInt(document.getElementById('manualKeepCount').value);
    
    if (!keepCount || keepCount < 100) {
        alert('تعداد مقالات باقی‌مانده باید حداقل 100 باشد');
        return;
    }
    
    if (!confirm(`آیا از پاک‌سازی اطمینان دارید؟ فقط ${keepCount.toLocaleString()} مقاله جدید باقی خواهد ماند.`)) {
        return;
    }
    
    try {
        document.getElementById('cleanupProgress').style.display = 'block';
        
        const data = await apiCall('/api/cleanup/manual', {
            method: 'POST',
            body: JSON.stringify({
                keep_articles_count: keepCount
            })
        });
        
        document.getElementById('cleanupProgress').style.display = 'none';
        
        showSuccess(data.message);
        
        // بستن modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('manualCleanupModal'));
        modal.hide();
        
        // به‌روزرسانی dashboard
        loadDashboard();
        
    } catch (error) {
        document.getElementById('cleanupProgress').style.display = 'none';
        showError(null, 'خطا در پاک‌سازی: ' + error.message);
    }
}

// Setup cleanup form submission
document.addEventListener('DOMContentLoaded', function() {
    const cleanupForm = document.getElementById('cleanupForm');
    if (cleanupForm) {
        cleanupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const cleanupId = document.getElementById('cleanupId').value;
            const name = document.getElementById('cleanupName').value;
            const cronExpression = document.getElementById('cleanupCron').value;
            const keepCount = parseInt(document.getElementById('keepArticlesCount').value);
            const isActive = document.getElementById('cleanupActive').checked;
            
            try {
                const url = cleanupId ? `/api/cleanup-schedules/${cleanupId}` : '/api/cleanup-schedules';
                const method = cleanupId ? 'PUT' : 'POST';
                
                await apiCall(url, {
                    method: method,
                    body: JSON.stringify({
                        name: name,
                        cron_expression: cronExpression,
                        keep_articles_count: keepCount,
                        is_active: isActive
                    })
                });
                
                showSuccess(cleanupId ? 'زمانبندی پاک‌سازی با موفقیت به‌روزرسانی شد' : 'زمانبندی پاک‌سازی با موفقیت اضافه شد');
                hideCleanupForm();
                loadCleanupSchedules();
                
            } catch (error) {
                showError(null, 'خطا در ذخیره زمانبندی پاک‌سازی: ' + error.message);
            }
        });
    }
});

// WebDriver Management Functions
async function loadWebDriverStatus() {
    try {
        const data = await apiCall('/api/webdriver/current');
        
        document.getElementById('currentDriverType').textContent = data.data.currentType;
        document.getElementById('driverStatus').textContent = data.data.isConnected ? 'متصل' : 'قطع';
        document.getElementById('driverStatus').className = `badge ${data.data.isConnected ? 'bg-success' : 'bg-danger'}`;
        
        // Update driver selector
        const driverSelect = document.getElementById('driverTypeSelect');
        const switchBtn = document.getElementById('switchDriverBtn');
        
        driverSelect.innerHTML = '';
        if (data.data.availableDrivers && Array.isArray(data.data.availableDrivers)) {
            data.data.availableDrivers.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver;
                option.textContent = driver === 'puppeteer' ? 'Puppeteer' : 
                                        driver === 'selenium' ? 'Selenium' : 
                                        driver === 'playwright' ? 'Playwright' : 
                                        driver === 'cheerio' ? 'Cheerio' : driver;
                option.selected = driver === data.data.currentType;
                driverSelect.appendChild(option);
            });
            
            // فعال کردن دکمه تغییر درایور
            if (switchBtn) {
                switchBtn.disabled = false;
            }
            
            // اضافه کردن event listener برای تغییر انتخاب
            driverSelect.addEventListener('change', function() {
                if (switchBtn) {
                    switchBtn.disabled = this.value === data.data.currentType;
                }
            });
        }
        
        // Load performance stats
        loadWebDriverStats();
        
    } catch (error) {
        showError(null, 'خطا در بارگذاری وضعیت درایور: ' + error.message);
    }
}

async function loadWebDriverStats() {
    try {
        const data = await apiCall('/api/webdriver/status');
        
        if (data.data && data.data.memoryUsage) {
            document.getElementById('memoryUsage').textContent = data.data.memoryUsage.rss || '-';
            document.getElementById('heapUsage').textContent = data.data.memoryUsage.heapUsed || '-';
        }
        
        if (data.data && typeof data.data.uptime === 'number') {
            document.getElementById('uptime').textContent = formatUptime(data.data.uptime);
        } else {
            document.getElementById('uptime').textContent = '-';
        }
        
    } catch (error) {
        console.error('خطا در بارگذاری آمار درایور:', error);
        document.getElementById('memoryUsage').textContent = 'خطا';
        document.getElementById('heapUsage').textContent = 'خطا';
        document.getElementById('uptime').textContent = 'خطا';
    }
}

async function switchWebDriver() {
    const newDriverType = document.getElementById('driverTypeSelect').value;
    
    if (!newDriverType) {
        showError(null, 'لطفاً نوع درایور را انتخاب کنید');
        return;
    }
    
    try {
        showLoading('در حال تغییر درایور...');
        
        const data = await apiCall('/api/webdriver/switch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ driverType: newDriverType })
        });
        
        hideLoading();
        showSuccess('درایور با موفقیت تغییر یافت');
        loadWebDriverStatus();
        
    } catch (error) {
        hideLoading();
        showError(null, 'خطا در تغییر درایور: ' + error.message);
    }
}

async function cleanupWebDriver() {
    try {
        showLoading('در حال پاک‌سازی منابع...');
        
        await apiCall('/api/webdriver/cleanup', {
            method: 'POST'
        });
        
        hideLoading();
        showSuccess('پاک‌سازی منابع با موفقیت انجام شد');
        loadWebDriverStats();
        
    } catch (error) {
        hideLoading();
        showError(null, 'خطا در پاک‌سازی منابع: ' + error.message);
    }
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Add event listeners for WebDriver management
document.addEventListener('DOMContentLoaded', function() {
    // WebDriver switch button
    const switchBtn = document.getElementById('switchDriverBtn');
    if (switchBtn) {
        switchBtn.addEventListener('click', switchWebDriver);
    }
    
    // WebDriver cleanup button
    const cleanupBtn = document.getElementById('cleanupDriverBtn');
    if (cleanupBtn) {
        cleanupBtn.addEventListener('click', cleanupWebDriver);
    }
    
    // WebDriver refresh button
    const refreshBtn = document.getElementById('refreshDriverBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadWebDriverStatus);
    }
});

// Functions for onclick handlers
function refreshWebDriverStatus() {
    loadWebDriverStatus();
}

function performWebDriverCleanup() {
    cleanupWebDriver();
}

// Auto-refresh WebDriver stats every 30 seconds
let webDriverStatsInterval;

function startWebDriverAutoRefresh() {
    // Clear existing interval
    if (webDriverStatsInterval) {
        clearInterval(webDriverStatsInterval);
    }
    
    // Start new interval
    webDriverStatsInterval = setInterval(() => {
        // Only refresh if webdriver section is visible
        const webdriverSection = document.getElementById('webdriver');
        if (webdriverSection && webdriverSection.style.display !== 'none') {
            loadWebDriverStats();
        }
    }, 30000); // 30 seconds
}

function stopWebDriverAutoRefresh() {
    if (webDriverStatsInterval) {
        clearInterval(webDriverStatsInterval);
        webDriverStatsInterval = null;
    }
}

// ==================== MULTIPLE SELECTOR MANAGEMENT ====================

// متغیرهای سراسری برای مدیریت سلکتورهای چندگانه
let selectorCounters = {
    title: 0,
    content: 0,
    lead: 0,
    router: 0
};

let editSelectorCounters = {
    title: 0,
    content: 0,
    lead: 0,
    router: 0
};

// اضافه کردن فیلد سلکتور جدید در فرم اضافه کردن
function addSelectorField(type) {
    const container = document.getElementById(`${type}SelectorsContainer`);
    const counter = ++selectorCounters[type];
    
    const fieldHtml = `
        <div class="input-group mt-2" id="${type}Selector${counter}">
            <input type="text" class="form-control" placeholder="سلکتور ${type} ${counter}">
            <button type="button" class="btn btn-outline-danger" onclick="removeSelectorField('${type}', ${counter})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', fieldHtml);
}

// حذف فیلد سلکتور در فرم اضافه کردن
function removeSelectorField(type, counter) {
    const field = document.getElementById(`${type}Selector${counter}`);
    if (field) {
        field.remove();
    }
}

// اضافه کردن فیلد سلکتور جدید در فرم ویرایش
function addEditSelectorField(type) {
    const container = document.getElementById(`edit${type.charAt(0).toUpperCase() + type.slice(1)}SelectorsContainer`);
    const counter = ++editSelectorCounters[type];
    
    const fieldHtml = `
        <div class="input-group mt-2" id="edit${type.charAt(0).toUpperCase() + type.slice(1)}Selector${counter}">
            <input type="text" class="form-control" placeholder="سلکتور ${type} ${counter}">
            <button type="button" class="btn btn-outline-danger" onclick="removeEditSelectorField('${type}', ${counter})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', fieldHtml);
}

// حذف فیلد سلکتور در فرم ویرایش
function removeEditSelectorField(type, counter) {
    const field = document.getElementById(`edit${type.charAt(0).toUpperCase() + type.slice(1)}Selector${counter}`);
    if (field) {
        field.remove();
    }
}

// جمع‌آوری تمام سلکتورها از فرم
function collectSelectors(type, isEdit = false) {
    const prefix = isEdit ? 'edit' : '';
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    const selectorId = `${prefix}${capitalizedType}Selector`;
    const containerId = `${prefix}${capitalizedType}SelectorsContainer`;
    
    const mainElement = document.getElementById(selectorId);
    if (!mainElement) {
        console.warn(`Element with ID '${selectorId}' not found`);
        return [];
    }
    
    const mainSelector = mainElement.value.trim();
    const selectors = [];
    
    // همیشه مقدار اصلی را اضافه کن، حتی اگر خالی باشد
    selectors.push(mainSelector);
    
    const container = document.getElementById(containerId);
    if (container) {
        const additionalInputs = container.querySelectorAll('input');
        
        additionalInputs.forEach(input => {
            if (input.value.trim()) {
                selectors.push(input.value.trim());
            }
        });
    }
    
    return selectors;
}

// پر کردن فیلدهای سلکتور در فرم ویرایش
function populateEditSelectors(type, selectors) {
    if (!selectors) return;
    
    let selectorArray;
    
    // تبدیل به آرایه
    if (typeof selectors === 'string') {
        try {
            // اگر JSON است
            selectorArray = JSON.parse(selectors);
        } catch (e) {
            // اگر رشته ساده است
            selectorArray = selectors.trim() ? [selectors] : [];
        }
    } else if (Array.isArray(selectors)) {
        selectorArray = selectors;
    } else {
        return;
    }
    
    const mainInput = document.getElementById(`edit${type.charAt(0).toUpperCase() + type.slice(1)}Selector`);
    const container = document.getElementById(`edit${type.charAt(0).toUpperCase() + type.slice(1)}SelectorsContainer`);
    
    if (!mainInput || !container) return;
    
    // پاک کردن فیلدهای قبلی
    container.innerHTML = '';
    editSelectorCounters[type] = 0;
    
    // پر کردن فیلد اصلی
    if (selectorArray.length > 0) {
        mainInput.value = selectorArray[0];
    }
    
    // اضافه کردن فیلدهای اضافی
    for (let i = 1; i < selectorArray.length; i++) {
        addEditSelectorField(type);
        const newInput = container.querySelector('input:last-child');
        if (newInput) {
            newInput.value = selectorArray[i];
        }
    }
}

// پاک کردن تمام فیلدهای اضافی
function clearAllSelectorFields() {
    ['title', 'content', 'lead', 'router'].forEach(type => {
        const container = document.getElementById(`${type}SelectorsContainer`);
        if (container) {
            container.innerHTML = '';
        }
        selectorCounters[type] = 0;
    });
}

function clearAllEditSelectorFields() {
    ['title', 'content', 'lead', 'router'].forEach(type => {
        const container = document.getElementById(`edit${type.charAt(0).toUpperCase() + type.slice(1)}SelectorsContainer`);
        if (container) {
            container.innerHTML = '';
        }
        editSelectorCounters[type] = 0;
    });
}

// Event listener for article source filter
document.addEventListener('DOMContentLoaded', function() {
    const articleSourceSelect = document.getElementById('articleSource');
    if (articleSourceSelect) {
        articleSourceSelect.addEventListener('change', function() {
            loadArticles(1); // Reset to first page when filter changes
        });
    }
});

// ==================== SELECTOR BUILDER FUNCTIONS ====================

// باز کردن صفحه selector builder در تب جدید
function openSelectorBuilder() {
    window.open('/admin/selector-builder.html', '_blank');
}

// شروع selector builder در همین صفحه
function startSelectorBuilder() {
    const url = document.getElementById('targetUrl').value;
    if (!url) {
        showError(null, 'لطفاً آدرس صفحه وب را وارد کنید');
        return;
    }
    
    // اعتبارسنجی URL
    try {
        new URL(url);
    } catch (error) {
        showError(null, 'آدرس وارد شده معتبر نیست');
        return;
    }
    
    // باز کردن selector builder با URL مشخص شده
    const selectorBuilderUrl = `/admin/selector-builder.html?url=${encodeURIComponent(url)}`;
    window.open(selectorBuilderUrl, '_blank');
}

// بارگذاری پیکربندی‌های ذخیره شده
async function loadSavedConfigs() {
    try {
        const response = await fetch('/api/selector-builder/configs', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            displaySelectorConfigs(data.configs);
        } else {
            throw new Error(data.message || 'خطا در دریافت پیکربندی‌ها');
        }
        
    } catch (error) {
        console.error('Error loading selector configs:', error);
        showError(null, 'خطا در بارگذاری پیکربندی‌ها: ' + error.message);
    }
}

// نمایش پیکربندی‌های selector
function displaySelectorConfigs(configs) {
    const tableBody = document.getElementById('selectorConfigsTable');
    
    if (!configs || configs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">هیچ پیکربندی یافت نشد</td></tr>';
        return;
    }
    
    tableBody.innerHTML = configs.map(config => {
        const createdAt = new Date(config.created_at).toLocaleDateString('fa-IR');
        const shortUrl = config.url.length > 50 ? config.url.substring(0, 50) + '...' : config.url;
        const shortDescription = config.description && config.description.length > 30 
            ? config.description.substring(0, 30) + '...' 
            : config.description || '-';
        
        return `
            <tr>
                <td><strong>${escapeHtml(config.name)}</strong></td>
                <td><a href="${escapeHtml(config.url)}" target="_blank" title="${escapeHtml(config.url)}">${escapeHtml(shortUrl)}</a></td>
                <td>${escapeHtml(shortDescription)}</td>
                <td>${createdAt}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="viewSelectorConfig(${config.id})" title="مشاهده">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-success" onclick="editSelectorConfig(${config.id})" title="ویرایش">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteSelectorConfig(${config.id})" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// مشاهده جزئیات پیکربندی
async function viewSelectorConfig(id) {
    try {
        const response = await fetch(`/api/selector-builder/configs/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showSelectorConfigDetails(data.config);
        } else {
            throw new Error(data.message || 'خطا در دریافت جزئیات پیکربندی');
        }
        
    } catch (error) {
        console.error('Error viewing selector config:', error);
        showError(null, 'خطا در مشاهده پیکربندی: ' + error.message);
    }
}

// نمایش جزئیات پیکربندی در modal
function showSelectorConfigDetails(config) {
    const modalHtml = `
        <div class="modal fade" id="selectorConfigModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">جزئیات پیکربندی: ${escapeHtml(config.name)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row mb-3">
                            <div class="col-md-3"><strong>نام:</strong></div>
                            <div class="col-md-9">${escapeHtml(config.name)}</div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-3"><strong>URL:</strong></div>
                            <div class="col-md-9"><a href="${escapeHtml(config.url)}" target="_blank">${escapeHtml(config.url)}</a></div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-3"><strong>توضیحات:</strong></div>
                            <div class="col-md-9">${escapeHtml(config.description || '-')}</div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-3"><strong>انتخابگرها:</strong></div>
                            <div class="col-md-9">
                                <pre class="bg-light p-3 rounded" style="max-height: 300px; overflow-y: auto;">${JSON.stringify(config.selectors, null, 2)}</pre>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-3"><strong>تاریخ ایجاد:</strong></div>
                            <div class="col-md-9">${new Date(config.created_at).toLocaleDateString('fa-IR')}</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="editSelectorConfig(${config.id})">
                            <i class="fas fa-edit me-2"></i>ویرایش
                        </button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">بستن</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // حذف modal قبلی اگر وجود دارد
    const existingModal = document.getElementById('selectorConfigModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // اضافه کردن modal جدید
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // نمایش modal
    const modal = new bootstrap.Modal(document.getElementById('selectorConfigModal'));
    modal.show();
}

// ویرایش پیکربندی
function editSelectorConfig(id) {
    // باز کردن selector builder با پیکربندی موجود
    const editUrl = `/admin/selector-builder.html?edit=${id}`;
    window.open(editUrl, '_blank');
}

// حذف پیکربندی
async function deleteSelectorConfig(id) {
    if (!confirm('آیا از حذف این پیکربندی مطمئن هستید؟')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/selector-builder/configs/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('پیکربندی با موفقیت حذف شد');
            loadSavedConfigs(); // بارگذاری مجدد لیست
        } else {
            throw new Error(data.message || 'خطا در حذف پیکربندی');
        }
        
    } catch (error) {
        console.error('Error deleting selector config:', error);
        showError(null, 'خطا در حذف پیکربندی: ' + error.message);
    }
}

// بارگذاری خودکار پیکربندی‌ها هنگام نمایش بخش selector-builder
document.addEventListener('DOMContentLoaded', function() {
    // اضافه کردن event listener برای تغییر section
    const originalShowSection = window.showSection;
    window.showSection = function(sectionName) {
        if (originalShowSection) {
            originalShowSection(sectionName);
        }
        
        // اگر بخش selector-builder نمایش داده شد، پیکربندی‌ها را بارگذاری کن
        if (sectionName === 'selector-builder') {
            loadSavedConfigs();
        }
    };
});
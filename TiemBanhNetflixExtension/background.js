// ========================================
// Netflix Guest Helper - Background Service Worker
// Manifest V3 compatible - v1.6.1 with Auto F5
// Features: Auto cleanup + Auto F5 when stuck (900ms detection)
// ========================================

// DISABLE CONSOLE IN PRODUCTION
(function() {
    const noop = () => {};
    console.log = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    console.error = noop;
})();

// console.log('🔧 Netflix Guest Extension - Background Script Loaded');

// ========================================
// MESSAGE LISTENERS
// ========================================

chrome.runtime.onMessageExternal.addListener(
    (request, sender, sendResponse) => {
        console.log('📨 Received external message:', request);
        
        if (request.action === 'ping') {
            const version = chrome.runtime.getManifest().version;
            console.log('📤 Ping response - Extension version:', version);
            sendResponse({ status: 'ok', version: version });
            return true;
        }
        
        if (request.action === 'testCookieAPI') {
            (async () => {
                try {
                    const cookies = await chrome.cookies.getAll({ domain: '.netflix.com' });
                    sendResponse({ success: true, count: cookies.length });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        }
        
        if (request.action === 'testTabsAPI') {
            (async () => {
                try {
                    const allTabs = await chrome.tabs.query({});
                    const netflixTabs = await chrome.tabs.query({ url: '*://*.netflix.com/*' });
                    sendResponse({ 
                        success: true, 
                        totalTabs: allTabs.length,
                        netflixTabs: netflixTabs.length
                    });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        }
        
        if (request.action === 'echo') {
            sendResponse({ 
                success: true, 
                echo: request.data,
                timestamp: Date.now()
            });
            return true;
        }
        
        // IMPROVED: Inject cookie - chức năng chính
        if (request.action === 'injectCookie') {
            (async () => {
                try {
                    console.log('🚀 Starting cookie injection process...');
                    
                    const netflixTab = await findNetflixTab(request.tabName);
                    
                    if (!netflixTab) {
                        console.error('❌ Netflix tab not found');
                        sendResponse({ 
                            success: false, 
                            error: 'Netflix tab not found. Please open Netflix first.' 
                        });
                        return;
                    }
                    
                    console.log(`✅ Found Netflix tab: ${netflixTab.id}`, netflixTab);
                    console.log(`📍 Current URL: ${netflixTab.url}`);
                    
                    // Bước 1: Xóa toàn bộ cookies Netflix cũ
                    await clearNetflixCookies();
                    console.log('🗑️ Cleared existing Netflix cookies');
                    
                    // Bước 2: Inject cookie mới NGAY (không navigate trước)
                    await injectCookiesImproved(request.cookieData, 'https://www.netflix.com/');
                    console.log('✅ Injected new cookies');
                    
                    // Bước 3: Đợi một chút để cookies được set
                    await sleep(500);
                    
                    // Bước 4: Navigate với AUTO F5 
                    console.log('🏠 Navigating to Netflix homepage with auto F5 support...');
                    const navSuccess = await navigateTabWithAutoRetry(
                        netflixTab.id, 
                        'https://www.netflix.com/',
                        10000
                    );
                    
                    if (!navSuccess) {
                        console.warn('⚠️ Navigation timeout after auto retry');
                    }
                    
                    // Bước 5: Monitor tab để phát hiện /browse
                    monitorNetflixTab(netflixTab.id);
                    
                    sendResponse({ success: true });
                    
                } catch (error) {
                    console.error('❌ Cookie injection error:', error);
                    sendResponse({ 
                        success: false, 
                        error: error.message 
                    });
                }
            })();
            return true;
        }
        
        if (request.action === 'refreshNetflixTab') {
            (async () => {
                try {
                    const tabs = await chrome.tabs.query({
                        url: 'https://www.netflix.com/*'
                    });
                    
                    if (tabs.length === 0) {
                        sendResponse({ 
                            success: false, 
                            error: 'No Netflix tab found' 
                        });
                        return;
                    }
                    
                    const netflixTab = tabs[0];
                    await chrome.tabs.reload(netflixTab.id);
                    console.log('🔄 Netflix tab refreshed');
                    
                    sendResponse({ success: true });
                    
                } catch (error) {
                    console.error('❌ Refresh Netflix tab error:', error);
                    sendResponse({ 
                        success: false, 
                        error: error.message 
                    });
                }
            })();
            
            return true;
        }
        
        if (request.action === 'checkNetflixStatus') {
            (async () => {
                try {
                    const tabs = await chrome.tabs.query({
                        url: 'https://www.netflix.com/*'
                    });
                    
                    if (tabs.length === 0) {
                        sendResponse({ 
                            success: false, 
                            error: 'No Netflix tab found' 
                        });
                        return;
                    }
                    
                    const netflixTab = tabs[0];
                    const response = await chrome.tabs.sendMessage(netflixTab.id, {
                        action: 'checkLoginStatus'
                    });
                    
                    if (response && response.success) {
                        sendResponse({
                            success: true,
                            loginStatus: 'success',
                            url: response.url
                        });
                    } else if (response && response.errorCode) {
                        sendResponse({
                            success: true,
                            loginStatus: 'error',
                            errorCode: response.errorCode
                        });
                    } else {
                        sendResponse({
                            success: true,
                            loginStatus: 'unknown'
                        });
                    }
                    
                } catch (error) {
                    console.error('❌ Check Netflix status error:', error);
                    sendResponse({ 
                        success: false, 
                        error: error.message 
                    });
                }
            })();
            
            return true;
        }
        
        if (request.action === 'focusNetflixTab') {
            (async () => {
                try {
                    console.log('🔍 Searching for Netflix tab to focus...');
                    
                    const tabs = await chrome.tabs.query({
                        url: 'https://www.netflix.com/*'
                    });
                    
                    if (tabs.length === 0) {
                        console.warn('⚠️ No Netflix tab found');
                        sendResponse({ 
                            success: false, 
                            error: 'No Netflix tab found' 
                        });
                        return;
                    }
                    
                    const netflixTab = tabs[0];
                    console.log('✅ Found Netflix tab:', netflixTab.id);
                    
                    await chrome.tabs.update(netflixTab.id, { active: true });
                    console.log('✅ Tab activated');
                    
                    await chrome.windows.update(netflixTab.windowId, { focused: true });
                    console.log('✅ Window focused');
                    
                    sendResponse({ 
                        success: true,
                        tabId: netflixTab.id,
                        windowId: netflixTab.windowId
                    });
                    
                } catch (error) {
                    console.error('❌ Focus Netflix tab error:', error);
                    sendResponse({ 
                        success: false, 
                        error: error.message 
                    });
                }
            })();
            
            return true;
        }
        
        // NEW: Get Netflix Cookies - Lấy CẢ HAI: NetflixId + SecureNetflixId
        // Gọi sau khi đã verify login thành công (đã vào /browse và chọn profile)
        if (request.action === 'getSecureNetflixId' || request.action === 'getNetflixCookies') {
            (async () => {
                try {
                    console.log('🔐 Reading Netflix cookies from browser...');
                    
                    // Lấy tất cả cookies của Netflix
                    const allNetflixCookies = await chrome.cookies.getAll({
                        domain: '.netflix.com'
                    });
                    
                    // Tìm NetflixId và SecureNetflixId
                    const netflixIdCookie = allNetflixCookies.find(c => c.name === 'NetflixId');
                    const secureCookie = allNetflixCookies.find(c => c.name === 'SecureNetflixId');
                    
                    const result = {
                        success: false,
                        netflixId: null,
                        secureNetflixId: null,
                        availableCookies: allNetflixCookies.map(c => c.name)
                    };
                    
                    if (netflixIdCookie && netflixIdCookie.value) {
                        result.netflixId = netflixIdCookie.value;
                        console.log('✅ NetflixId found:', netflixIdCookie.value.substring(0, 50) + '...');
                    }
                    
                    if (secureCookie && secureCookie.value) {
                        result.secureNetflixId = secureCookie.value;
                        console.log('✅ SecureNetflixId found:', secureCookie.value.substring(0, 50) + '...');
                    }
                    
                    // Success nếu có CẢ HAI cookies
                    if (result.netflixId && result.secureNetflixId) {
                        result.success = true;
                        console.log('✅ Both cookies found!');
                    } else {
                        console.warn('⚠️ Missing cookies:', 
                            !result.netflixId ? 'NetflixId' : '',
                            !result.secureNetflixId ? 'SecureNetflixId' : ''
                        );
                    }
                    
                    sendResponse(result);
                    
                } catch (error) {
                    console.error('❌ Get Netflix cookies error:', error);
                    sendResponse({
                        success: false,
                        error: error.message
                    });
                }
            })();
            
            return true;
        }
        
        // NEW: Clear all Netflix cookies
        if (request.action === 'clearNetflixCookies') {
            (async () => {
                try {
                    console.log('🗑️ Clearing all Netflix cookies...');
                    await clearNetflixCookies();
                    console.log('✅ All Netflix cookies cleared');
                    
                    sendResponse({ 
                        success: true,
                        message: 'All Netflix cookies have been cleared'
                    });
                    
                } catch (error) {
                    console.error('❌ Clear Netflix cookies error:', error);
                    sendResponse({ 
                        success: false, 
                        error: error.message 
                    });
                }
            })();
            
            return true;
        }
        
        return false;
    }
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Received message from content script:', request);
    
    if (request.action === 'loginSuccess') {
        console.log('🎉 Netflix login successful!');
        
        notifyWebApp({
            status: 'success',
            message: 'Netflix login successful'
        });
        
        chrome.tabs.sendMessage(sender.tab.id, {
            action: 'showSuccessNotification'
        });
    }
    
    return false;
});

// ========================================
// CORE FUNCTIONS - IMPROVED
// ========================================

async function findNetflixTab(tabName = 'NETFLIX_TAB') {
    try {
        const tabs = await chrome.tabs.query({
            url: '*://*.netflix.com/*'
        });
        
        console.log(`🔍 Found ${tabs.length} Netflix tabs`);
        
        if (tabs.length === 0) {
            return null;
        }
        
        return tabs[0];
        
    } catch (error) {
        console.error('Error finding Netflix tab:', error);
        return null;
    }
}

async function clearNetflixCookies() {
    const netflixDomains = [
        '.netflix.com',
        'www.netflix.com',
        'netflix.com'
    ];
    
    for (const domain of netflixDomains) {
        try {
            const cookies = await chrome.cookies.getAll({
                domain: domain
            });
            
            console.log(`🗑️ Removing ${cookies.length} cookies for ${domain}`);
            
            for (const cookie of cookies) {
                const url = `https://${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}${cookie.path}`;
                await chrome.cookies.remove({
                    url: url,
                    name: cookie.name
                });
            }
            
        } catch (error) {
            console.warn(`Warning: Could not clear cookies for ${domain}:`, error);
        }
    }
}

/**
 * IMPROVED: Inject cookies giống Cookie-Editor
 * @param {Object|Array|String} cookieData - Cookie data
 * @param {String} tabUrl - URL của Netflix tab
 */
async function injectCookiesImproved(cookieData, tabUrl = 'https://www.netflix.com/') {
    // Chuyển thành array
    let cookies = [];
    
    if (typeof cookieData === 'string') {
        // Parse từ string format
        cookies = parseCookieString(cookieData);
    } else if (Array.isArray(cookieData)) {
        cookies = cookieData;
    } else {
        cookies = [cookieData];
    }
    
    console.log(`📝 Injecting ${cookies.length} cookie(s)...`);
    
    const results = {
        success: [],
        failed: []
    };
    
    for (const cookie of cookies) {
        try {
            const parsedCookie = typeof cookie === 'string' 
                ? parseSingleCookie(cookie) 
                : cookie;
            
            // Generic approach: Chuẩn bị cookie details giống Cookie-Editor
            const details = {
                url: tabUrl,  // Dùng URL của Netflix tab hiện tại
                name: parsedCookie.name || '',
                value: parsedCookie.value || ''
            };
            
            // Chỉ set các field nếu có trong parsed cookie
            // Nếu không có, để null hoặc undefined để browser tự động điền
            if (parsedCookie.domain !== undefined) {
                details.domain = parsedCookie.domain;
            } else {
                details.domain = null;  // Browser tự lấy từ URL
            }
            
            if (parsedCookie.path !== undefined) {
                details.path = parsedCookie.path;
            } else {
                details.path = null;  // Browser tự set = '/'
            }
            
            if (parsedCookie.secure !== undefined) {
                details.secure = parsedCookie.secure;
            } else {
                details.secure = null;  // Browser tự set based on protocol
            }
            
            if (parsedCookie.httpOnly !== undefined) {
                details.httpOnly = parsedCookie.httpOnly;
            } else {
                details.httpOnly = null;  // Browser tự set = false
            }
            
            if (parsedCookie.sameSite !== undefined) {
                details.sameSite = parsedCookie.sameSite;
            } else {
                details.sameSite = undefined;  // Browser tự set = 'lax'
            }
            
            // Chỉ set expirationDate nếu có
            if (parsedCookie.expirationDate) {
                details.expirationDate = parsedCookie.expirationDate;
            }
            
            console.log('🔧 Setting cookie (generic approach):', {
                name: details.name,
                value: details.value.substring(0, 20) + '...',
                domain: details.domain || 'auto',
                path: details.path || 'auto',
                secure: details.secure === null ? 'auto' : details.secure,
                httpOnly: details.httpOnly === null ? 'auto' : details.httpOnly,
                sameSite: details.sameSite === undefined ? 'auto' : details.sameSite
            });
            
            await chrome.cookies.set(details);
            results.success.push(parsedCookie.name);
            console.log(`✅ Set cookie: ${parsedCookie.name}`);
            
        } catch (error) {
            console.error(`❌ Failed to set cookie:`, error);
            results.failed.push({
                cookie: cookie,
                error: error.message
            });
        }
    }
    
    console.log('📊 Injection results:', results);
    return results;
}

/**
 * IMPROVED: Tính toán URL cho cookie giống Cookie-Editor
 */
function getCookieUrl(domain, path, secure) {
    const protocol = secure ? 'https://' : 'http://';
    const cleanDomain = domain.startsWith('.') ? domain.substring(1) : domain;
    const cleanPath = path || '/';
    return protocol + cleanDomain + cleanPath;
}

/**
 * IMPROVED: Parse cookie string (hỗ trợ nhiều format)
 */
function parseCookieString(cookieStr) {
    // Nếu là multiple cookies (phân cách bằng ;)
    if (cookieStr.includes(';') && cookieStr.split(';').length > 1) {
        return cookieStr.split(';')
            .map(s => s.trim())
            .filter(s => s.includes('='))
            .map(s => parseSingleCookie(s));
    }
    
    // Single cookie
    return [parseSingleCookie(cookieStr)];
}

/**
 * Parse single cookie - Generic approach (giống Cookie-Editor)
 * Chỉ parse name và value, để browser tự động điền các field còn lại
 */
function parseSingleCookie(cookieStr) {
    // Split bằng dấu = đầu tiên
    const firstEqualIndex = cookieStr.indexOf('=');
    
    if (firstEqualIndex === -1) {
        throw new Error('Invalid cookie string format: missing "="');
    }
    
    const name = cookieStr.substring(0, firstEqualIndex).trim();
    const value = cookieStr.substring(firstEqualIndex + 1).trim();
    
    // Decode URL-encoded value nếu cần
    let decodedValue = value;
    try {
        // Chỉ decode nếu có % trong value
        if (value.includes('%')) {
            decodedValue = decodeURIComponent(value);
        }
    } catch (e) {
        // Nếu decode fail, giữ nguyên
        console.warn('Could not decode cookie value:', e);
        decodedValue = value;
    }
    
    // CHỈ trả về name và value - để browser tự động điền các field khác
    return {
        name: name,
        value: decodedValue
        // KHÔNG set domain, path, secure, httpOnly, sameSite
        // Browser sẽ tự động điền dựa trên URL và context
    };
}

/**
 * Monitor tab Netflix để phát hiện khi vào /browse
 */
function monitorNetflixTab(tabId) {
    console.log(`👀 Monitoring tab ${tabId} for /browse...`);
    
    const updateListener = (updatedTabId, changeInfo, tab) => {
        if (updatedTabId !== tabId) return;
        
        if (changeInfo.url && changeInfo.url.includes('/browse')) {
            console.log('🎉 Successfully navigated to /browse!');
            
            chrome.tabs.onUpdated.removeListener(updateListener);
            
            chrome.tabs.sendMessage(tabId, {
                action: 'showSuccessNotification'
            }).catch(err => {
                console.log('Note: Could not send message to content script:', err);
            });
        }
    };
    
    chrome.tabs.onUpdated.addListener(updateListener);
    
    setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(updateListener);
        console.log('⏱️ Monitoring timeout');
    }, 30000);
}

function notifyWebApp(data) {
    chrome.storage.local.set({
        lastInjectionStatus: {
            ...data,
            timestamp: Date.now()
        }
    });
}

/**
 * Helper: Sleep function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Navigate tab với Auto F5 khi stuck (tương tự Netflix_v1.py)
 * @param {number} tabId - ID của tab cần reload
 * @param {string} url - URL cần navigate
 * @param {number} timeout - Timeout (ms), default 10000ms
 * @returns {Promise<boolean>} - True nếu success, False nếu timeout
 */
async function navigateTabWithAutoRetry(tabId, url, timeout = 10000) {
    console.log(`🚀 Navigate tab ${tabId} to ${url} with auto F5...`);
    
    try {
        // Navigate to URL
        await chrome.tabs.update(tabId, { url });
        
        // Poll tab status với auto F5
        const startTime = Date.now();
        const checkInterval = 300;  // Check mỗi 300ms
        const MAX_F5_RETRIES = 3;   // Cho phép F5 tối đa 3 lần trong loop
        let lastStatus = null;
        let stuckCount = 0;
        let f5Count = 0;
        
        while (Date.now() - startTime < timeout) {
            try {
                // Get tab info
                const tab = await chrome.tabs.get(tabId);
                const elapsed = Date.now() - startTime;
                
                console.log(`  [${elapsed}ms] status=${tab.status}, URL=${tab.url?.substring(0, 50)}...`);
                
                // Detect STUCK (status không đổi trong 3 lần check = 900ms)
                if (tab.status === lastStatus && tab.status === 'loading') {
                    stuckCount++;

                    if (stuckCount >= 3 && f5Count < MAX_F5_RETRIES) {  // Stuck 900ms, cho phép F5 3 lần
                        console.log(`⚠️ Tab STUCK detected at ${elapsed}ms! Triggering auto F5 (attempt ${f5Count + 1}/${MAX_F5_RETRIES})...`);

                        // Send F5 command to content script
                        try {
                            await chrome.tabs.sendMessage(tabId, { action: 'forceReload' });
                            console.log('🔄 F5 command sent');
                        } catch (e) {
                            console.warn('⚠️ Cannot send F5 command:', e);
                            // Fallback: Use chrome.tabs.reload
                            await chrome.tabs.reload(tabId, { bypassCache: true });
                        }

                        // Tăng counter và reset stuck count
                        f5Count++;
                        stuckCount = 0;
                        console.log(`⏱️ F5 attempt ${f5Count}/${MAX_F5_RETRIES} completed`);

                        await sleep(500);  // Chờ F5 bắt đầu
                        continue;
                    }
                } else {
                    stuckCount = 0;
                }
                
                lastStatus = tab.status;
                
                // SUCCESS
                if (tab.status === 'complete') {
                    console.log(`✅ Tab ready (complete) after ${elapsed}ms`);
                    return true;
                }
                
                await sleep(checkInterval);
                
            } catch (pollError) {
                console.warn('⚠️ Poll error:', pollError);
                await sleep(checkInterval);
            }
        }
        
        // TIMEOUT - thử F5 lần cuối
        console.log(`⏰ Timeout ${timeout}ms! Final F5 attempt...`);
        try {
            await chrome.tabs.sendMessage(tabId, { action: 'forceReload' });
        } catch (e) {
            // Fallback
            await chrome.tabs.reload(tabId, { bypassCache: true });
        }
        
        await sleep(2000);
        
        // Check lần cuối
        try {
            const finalTab = await chrome.tabs.get(tabId);
            if (finalTab.status === 'complete') {
                console.log('✅ Success after final F5!');
                return true;
            }
        } catch (e) {
            console.error('❌ Final check error:', e);
        }
        
        return false;
        
    } catch (error) {
        console.error('❌ Navigate error:', error);
        return false;
    }
}

/**
 * Helper: Wait for tab to finish loading
 */
function waitForTabLoad(tabId, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkStatus = () => {
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (tab.status === 'complete') {
                    resolve(tab);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Tab load timeout'));
                } else {
                    setTimeout(checkStatus, 100);
                }
            });
        };
        
        checkStatus();
    });
}

// ========================================
// AUTO COOKIE CLEANUP - NEW FEATURE
// ========================================

/**
 * Kiểm tra xem web Tiembanh4k có đang mở không
 */
async function isTiembanhWebOpen() {
    const tiembanhDomains = [
        '*://localhost:*/*',
        '*://127.0.0.1:*/*',
        '*://tiembanh4k.com/*',
        '*://*.tiembanh4k.com/*',
    ];
    
    for (const domain of tiembanhDomains) {
        const tabs = await chrome.tabs.query({ url: domain });
        if (tabs.length > 0) {
            return true;
        }
    }
    
    return false;
}

/**
 * Kiểm tra xem Netflix có đang mở không
 */
async function isNetflixOpen() {
    const tabs = await chrome.tabs.query({ url: '*://*.netflix.com/*' });
    return tabs.length > 0;
}

/**
 * Auto cleanup: Xóa Netflix cookies nếu không có Tiembanh web
 */
async function autoCleanupCheck() {
    try {
        const netflixOpen = await isNetflixOpen();
        const tiembanhOpen = await isTiembanhWebOpen();
        
        console.log('🔍 Auto cleanup check:', {
            netflixOpen,
            tiembanhOpen
        });
        
        // Chỉ xóa khi Netflix đang mở NHƯNG Tiembanh không mở
        if (netflixOpen && !tiembanhOpen) {
            console.log('⚠️ Detected Netflix open without Tiembanh web - Clearing cookies...');
            
            await clearNetflixCookies();
            
            console.log('✅ Auto cleanup completed - Netflix cookies cleared');
            
            // Optional: Reload Netflix tabs
            const netflixTabs = await chrome.tabs.query({ url: '*://*.netflix.com/*' });
            for (const tab of netflixTabs) {
                await chrome.tabs.reload(tab.id);
            }
            
            console.log('🔄 Netflix tabs reloaded');
        } else {
            console.log('✓ Auto cleanup check passed - No action needed');
        }
        
    } catch (error) {
        console.error('❌ Auto cleanup error:', error);
    }
}

/**
 * Start auto cleanup monitoring
 */
function startAutoCleanupMonitoring() {
    console.log('🚀 Starting auto cleanup monitoring (every 10 seconds)...');
    
    // Chạy lần đầu
    autoCleanupCheck();
    
    // Chạy mỗi 10 giây
    setInterval(autoCleanupCheck, 10000);
}

// Start monitoring
startAutoCleanupMonitoring();

// ========================================
// INSTALLATION HANDLER
// ========================================

chrome.runtime.onInstalled.addListener((details) => {
    const version = chrome.runtime.getManifest().version;
    if (details.reason === 'install') {
        console.log(`🎉 Netflix Guest Helper installed! Version ${version}`);
    } else if (details.reason === 'update') {
        console.log(`🔄 Netflix Guest Helper updated to version ${version}`);
    }
});

// ========================================
// HELPER FUNCTIONS
// ========================================

function broadcastPresence() {
    const version = chrome.runtime.getManifest().version;
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.url && (tab.url.includes('localhost') || tab.url.includes('127.0.0.1'))) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'extensionReady',
                    version: version
                }).catch(() => {});
            }
        });
    });
}

broadcastPresence();

const manifestVersion = chrome.runtime.getManifest().version;
console.log(`✅ Background script ready (v${manifestVersion} - Generic Cookie Parsing like Cookie-Editor)`);
// ========================================
// Netflix Guest Helper - Background Service Worker
// Manifest V3 compatible - IMPROVED VERSION with Auto Cleanup
// ========================================

console.log('🔧 Netflix Guest Extension - Background Script Loaded');

// ========================================
// MESSAGE LISTENERS
// ========================================

chrome.runtime.onMessageExternal.addListener(
    async (request, sender, sendResponse) => {
        console.log('📨 Received external message:', request);
        
        if (request.action === 'ping') {
            sendResponse({ status: 'ok', version: '1.2.0' });
            return true;
        }
        
        if (request.action === 'testCookieAPI') {
            try {
                const cookies = await chrome.cookies.getAll({ domain: '.netflix.com' });
                sendResponse({ success: true, count: cookies.length });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
            return true;
        }
        
        if (request.action === 'testTabsAPI') {
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
            try {
                console.log('🚀 Starting cookie injection process...');
                
                const netflixTab = await findNetflixTab(request.tabName);
                
                if (!netflixTab) {
                    console.error('❌ Netflix tab not found');
                    sendResponse({ 
                        success: false, 
                        error: 'Netflix tab not found. Please open Netflix first.' 
                    });
                    return true;
                }
                
                console.log(`✅ Found Netflix tab: ${netflixTab.id}`, netflixTab);
                
                // Bước 1: Xóa toàn bộ cookies Netflix cũ
                await clearNetflixCookies();
                console.log('🗑️ Cleared existing Netflix cookies');
                
                // Bước 2: Inject cookie mới (IMPROVED)
                await injectCookiesImproved(request.cookieData, netflixTab.url);
                console.log('✅ Injected new cookies');
                
                // Bước 3: Đợi một chút để cookies được set
                await sleep(500);
                
                // Bước 4: Reload tab Netflix
                await chrome.tabs.reload(netflixTab.id);
                console.log('🔄 Reloaded Netflix tab');
                
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
            
            // IMPORTANT: Tính toán URL chính xác
            const cookieUrl = getCookieUrl(
                parsedCookie.domain || '.netflix.com',
                parsedCookie.path || '/',
                parsedCookie.secure !== false
            );
            
            // Chuẩn bị cookie details
            const details = {
                url: cookieUrl,
                name: parsedCookie.name,
                value: parsedCookie.value,
                domain: parsedCookie.domain || '.netflix.com',
                path: parsedCookie.path || '/',
                secure: parsedCookie.secure !== false,
                httpOnly: parsedCookie.httpOnly || false,
                sameSite: parsedCookie.sameSite || 'no_restriction'
            };
            
            // IMPORTANT: Chỉ set expirationDate nếu có
            // Không set thì browser tự quản lý session cookie
            if (parsedCookie.expirationDate) {
                details.expirationDate = parsedCookie.expirationDate;
            }
            
            console.log('🔧 Setting cookie:', {
                name: details.name,
                domain: details.domain,
                url: cookieUrl
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
 * IMPROVED: Parse single cookie với đầy đủ attributes
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
    
    return {
        name: name,
        value: decodedValue,
        domain: '.netflix.com',
        path: '/',
        secure: true,
        httpOnly: false
        // Không set expirationDate - để browser tự quản lý
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
        '*://dvqbao.github.io/*'
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
    if (details.reason === 'install') {
        console.log('🎉 Netflix Guest Helper installed!');
    } else if (details.reason === 'update') {
        console.log('🔄 Netflix Guest Helper updated to version', chrome.runtime.getManifest().version);
    }
});

// ========================================
// HELPER FUNCTIONS
// ========================================

function broadcastPresence() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.url && (tab.url.includes('localhost') || tab.url.includes('127.0.0.1'))) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'extensionReady',
                    version: '1.2.0'
                }).catch(() => {});
            }
        });
    });
}

broadcastPresence();

console.log('✅ Background script ready (v1.2.0 - Improved with Auto Cleanup)');
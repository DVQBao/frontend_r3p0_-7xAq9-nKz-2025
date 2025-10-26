// ========================================
// Netflix Guest Helper - Content Script
// Chạy trên tất cả trang Netflix
// ========================================

console.log('🎬 Netflix Guest Helper - Content Script Loaded');

// ========================================
// EXTENSION PRESENCE DETECTION
// ========================================

/**
 * Broadcast extension presence to web page
 * Web app có thể lắng nghe event này để biết extension đã cài
 */
function broadcastExtensionPresence() {
    window.dispatchEvent(new CustomEvent('NetflixGuestExtensionReady', {
        detail: {
            version: '1.0.0',
            extensionId: chrome.runtime.id
        }
    }));
    
    console.log('📢 Broadcasted extension presence');
}

// Broadcast ngay khi load
broadcastExtensionPresence();

// Broadcast lại sau 1s (đảm bảo web app đã sẵn sàng)
setTimeout(broadcastExtensionPresence, 1000);

// ========================================
// MONITOR NETFLIX LOGIN STATUS
// ========================================

/**
 * Kiểm tra xem đã đăng nhập Netflix chưa
 * Dựa vào URL pathname và detect lỗi
 */
function checkLoginStatus() {
    const currentPath = window.location.pathname;
    
    // Nếu vào /browse → login thành công
    if (currentPath === '/browse' || currentPath.startsWith('/browse/')) {
        console.log('✅ Detected Netflix /browse - Login successful!');
        
        // Notify background script
        chrome.runtime.sendMessage({
            action: 'loginSuccess',
            url: window.location.href,
            status: 'success'
        }).catch(err => {
            console.log('Note: Could not send message to background:', err);
        });
        
        return { success: true, status: 'success' };
    }
    
    // Check for error page (NSES-500, etc.)
    const errorCode = detectNetflixError();
    if (errorCode) {
        console.log('❌ Detected Netflix error:', errorCode);
        
        // Notify background script about error
        chrome.runtime.sendMessage({
            action: 'loginError',
            errorCode: errorCode,
            url: window.location.href,
            status: 'error'
        }).catch(err => {
            console.log('Note: Could not send message to background:', err);
        });
        
        return { success: false, status: 'error', errorCode };
    }
    
    return { success: false, status: 'unknown' };
}

/**
 * Detect Netflix error codes (NSES-500, etc.)
 */
function detectNetflixError() {
    // Check for error code in page content
    const bodyText = document.body.innerText;
    
    // Common Netflix error patterns
    const errorPatterns = [
        /NSES-\d+/,
        /Error Code:\s*NSES-\d+/i,
        /Something went wrong/i
    ];
    
    for (const pattern of errorPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
            return match[0];
        }
    }
    
    // Check for error elements
    const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
    for (const el of errorElements) {
        const text = el.innerText;
        if (text.includes('NSES-') || text.includes('Error Code')) {
            const match = text.match(/NSES-\d+/);
            if (match) return match[0];
        }
    }
    
    return null;
}

// Check ngay khi load
if (checkLoginStatus()) {
    // Đã login rồi, có thể hiển thị welcome message
}

// ========================================
// URL CHANGE DETECTION
// ========================================

/**
 * Monitor URL changes (SPA navigation)
 * Netflix sử dụng History API nên cần listen
 */
let lastUrl = location.href;

const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    
    if (currentUrl !== lastUrl) {
        console.log('🔄 URL changed:', lastUrl, '→', currentUrl);
        lastUrl = currentUrl;
        
        // Check login status khi URL thay đổi
        checkLoginStatus();
    }
});

// Start observing
urlObserver.observe(document, {
    subtree: true,
    childList: true
});

// ========================================
// MESSAGE LISTENERS
// ========================================

/**
 * Lắng nghe message từ background script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Content script received message:', request);
    
    // Hiển thị success notification
    if (request.action === 'showSuccessNotification') {
        showSuccessNotification();
        sendResponse({ success: true });
    }
    
    // Check login status
    if (request.action === 'checkLoginStatus') {
        const loginResult = checkLoginStatus();
        sendResponse({ 
            success: loginResult.success,
            status: loginResult.status,
            errorCode: loginResult.errorCode,
            url: window.location.href 
        });
    }
    
    return false;
});

// ========================================
// UI NOTIFICATIONS
// ========================================

/**
 * Hiển thị notification thành công trên Netflix page
 */
function showSuccessNotification() {
    // Kiểm tra xem đã có notification chưa
    const existingNotif = document.getElementById('netflix-guest-notification');
    if (existingNotif) {
        existingNotif.remove();
    }
    
    // Tạo notification element
    const notification = document.createElement('div');
    notification.id = 'netflix-guest-notification';
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 9999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: slideInRight 0.5s ease, fadeOut 0.5s ease 3.5s;
            max-width: 350px;
        ">
            <div style="font-size: 24px; margin-bottom: 8px;">🎉</div>
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 5px;">
                Đăng nhập thành công!
            </div>
            <div style="font-size: 14px; opacity: 0.9;">
                Enjoy your viewing! Chúc bạn xem phim vui vẻ 🍿
            </div>
        </div>
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes fadeOut {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
                transform: translateX(400px);
            }
        }
    `;
    document.head.appendChild(style);
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        notification.remove();
    }, 4000);
    
    console.log('✅ Success notification displayed');
}

// ========================================
// WINDOW NAME DETECTION (for tab identification)
// ========================================

/**
 * Lưu window.name vào storage
 * Giúp background script nhận diện tab
 */
function saveWindowName() {
    if (window.name) {
        chrome.storage.local.set({
            netflixWindowName: window.name,
            netflixTabUrl: window.location.href,
            timestamp: Date.now()
        });
        
        console.log('📝 Saved window.name:', window.name);
    }
}

saveWindowName();

// ========================================
// DEBUG HELPERS
// ========================================

// Expose helper function cho debugging
window.netflixGuestHelper = {
    version: '1.0.0',
    checkLogin: checkLoginStatus,
    showNotification: showSuccessNotification,
    getExtensionId: () => chrome.runtime.id
};

console.log('✅ Content script ready. Access via window.netflixGuestHelper');


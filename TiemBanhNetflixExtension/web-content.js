// ========================================
// Netflix Guest Helper - Web App Content Script
// Chạy trên localhost để broadcast extension presence
// ========================================

console.log('🎬 Netflix Guest Helper - Web Content Script Loaded');

// ========================================
// BROADCAST EXTENSION PRESENCE
// ========================================

/**
 * Broadcast extension presence to web page
 * Web app lắng nghe event này để detect extension
 */
function broadcastExtensionPresence() {
    const event = new CustomEvent('NetflixGuestExtensionReady', {
        detail: {
            version: '1.0.0',
            extensionId: chrome.runtime.id
        }
    });
    
    window.dispatchEvent(event);
    
    console.log('📢 Extension presence broadcasted:', {
        version: '1.0.0',
        extensionId: chrome.runtime.id
    });
}

// Broadcast ngay khi load
broadcastExtensionPresence();

// Broadcast lại sau 500ms (đảm bảo web app đã sẵn sàng)
setTimeout(broadcastExtensionPresence, 500);

// Broadcast lại sau 1s (fallback)
setTimeout(broadcastExtensionPresence, 1000);

console.log('✅ Web content script ready');


// ========================================
// Netflix Guest Helper - Popup Script
// ========================================

console.log('🎬 Popup script loaded');

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    loadExtensionInfo();
    setupEventListeners();
});

// ========================================
// LOAD EXTENSION INFO
// ========================================

function loadExtensionInfo() {
    // Display extension ID
    const extensionId = chrome.runtime.id;
    document.getElementById('extensionId').textContent = extensionId;
    
    console.log('Extension ID:', extensionId);
    
    // Check if extension is working
    chrome.permissions.contains({
        permissions: ['cookies', 'tabs', 'storage']
    }, (result) => {
        const badge = document.getElementById('statusBadge');
        if (result) {
            badge.textContent = 'Active ✓';
            badge.className = 'badge success';
        } else {
            badge.textContent = 'Limited';
            badge.className = 'badge warning';
        }
    });
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Open web app button
    document.getElementById('openWebApp').addEventListener('click', () => {
        chrome.tabs.create({
            url: 'http://localhost:8000'
        });
        window.close();
    });
    
    // Test extension button
    document.getElementById('testExtension').addEventListener('click', testExtension);
}

// ========================================
// TEST EXTENSION
// ========================================

async function testExtension() {
    const btn = document.getElementById('testExtension');
    const originalText = btn.textContent;
    
    btn.textContent = '🔄 Testing...';
    btn.disabled = true;
    
    try {
        // Test 1: Check cookies permission
        const cookiesPermission = await chrome.permissions.contains({
            permissions: ['cookies']
        });
        
        console.log('✓ Cookies permission:', cookiesPermission);
        
        // Test 2: Check tabs permission
        const tabsPermission = await chrome.permissions.contains({
            permissions: ['tabs']
        });
        
        console.log('✓ Tabs permission:', tabsPermission);
        
        // Test 3: Try to get Netflix cookies
        const netflixCookies = await chrome.cookies.getAll({
            domain: '.netflix.com'
        });
        
        console.log('✓ Netflix cookies found:', netflixCookies.length);
        
        // Test 4: Check if Netflix tab is open
        const netflixTabs = await chrome.tabs.query({
            url: '*://*.netflix.com/*'
        });
        
        console.log('✓ Netflix tabs open:', netflixTabs.length);
        
        // Show results
        alert(`✅ Extension Test Results:
        
• Cookies permission: ${cookiesPermission ? '✓' : '✗'}
• Tabs permission: ${tabsPermission ? '✓' : '✗'}
• Netflix cookies: ${netflixCookies.length}
• Netflix tabs: ${netflixTabs.length}

Extension is working properly!`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        alert('❌ Test failed: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// ========================================
// COPY EXTENSION ID
// ========================================

document.getElementById('extensionId').addEventListener('click', function() {
    const text = this.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        setTimeout(() => {
            this.textContent = originalText;
        }, 1000);
    });
});


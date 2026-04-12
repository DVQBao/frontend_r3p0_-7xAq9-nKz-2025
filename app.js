// ========================================
// Netflix Guest Sharing - Main Application
// Luồng 2 nút + Chrome Extension Integration + Backend API
// ========================================

// ========================================
// BACKEND CONFIGURATION
// ========================================

// Use dynamic configuration from config.js
const BACKEND_URL = window.APP_CONFIG && window.APP_CONFIG.BACKEND_URL ? window.APP_CONFIG.BACKEND_URL : '';

// ========================================
// CONFIGURATION
// ========================================

const CONFIG = {
    AD_DURATION: 15, // seconds - Thời gian quảng cáo và tâm sự từ team
    NETFLIX_URL: 'https://www.netflix.com',
    NETFLIX_TAB_NAME: 'NETFLIX_TAB',
    COOKIE_FILE: 'cookie.txt',
    // Extension ID sẽ được cập nhật tự động khi detect
    EXTENSION_ID: null,
    // Extension version requirement
    REQUIRED_EXTENSION_VERSION: '1.6.1',
    EXTENSION_DOWNLOAD_LINK: 'https://drive.google.com/drive/folders/1eozcbA4q54f8Ox46d2HlptSD92tDFHCl?usp=sharing'
};

const PC_LOGIN_COST = 3;

// ========================================
// DOM ELEMENTS
// ========================================

function ensurePcLoginControlsPresent() {
    const pcMethodCard = document.querySelector('.method-card.pc');
    const stackedActions = pcMethodCard ? pcMethodCard.querySelector('.stacked-actions') : null;
    if (!pcMethodCard || !stackedActions || pcMethodCard.querySelector('#pcLoginLinkBtn')) {
        return;
    }

    const altActionWrap = document.createElement('div');
    altActionWrap.className = 'pc-login-alt';

    const separator = document.createElement('div');
    separator.className = 'pc-login-alt-separator';
    separator.textContent = 'Ho\u1eb7c';

    const pcLoginBtn = document.createElement('button');
    pcLoginBtn.id = 'pcLoginLinkBtn';
    pcLoginBtn.className = 'btn btn-premium';
    pcLoginBtn.disabled = true;
    pcLoginBtn.innerHTML = '<svg class="icon"><rect width="20" height="14" x="2" y="3" rx="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path></svg> Tạo link login Netflix PC';

    const noteEl = document.createElement('div');
    noteEl.className = 'pc-login-note';
    noteEl.innerHTML = 'T\u1ea1o link nhanh, h\u1ea1n ch\u1ebf t\u00e0i kho\u1ea3n l\u1ed7i, d\u00f9ng \u0111\u01b0\u1ee3c tr\u00ean m\u1ecdi tr\u00ecnh duy\u1ec7t, kh\u00f4ng ri\u00eang Chrome v\u00e0 Edge. Ch\u1ec9 \u00e1p d\u1ee5ng cho Pro Plan.';

    const statusEl = document.createElement('div');
    statusEl.id = 'pcLoginLinkStatus';

    altActionWrap.appendChild(separator);
    altActionWrap.appendChild(pcLoginBtn);
    altActionWrap.appendChild(noteEl);
    altActionWrap.appendChild(statusEl);
    stackedActions.insertAdjacentElement('afterend', altActionWrap);
}

ensurePcLoginControlsPresent();

const elements = {
    // Extension banner
    extensionBanner: document.getElementById('extensionBanner'),
    bannerTitle: document.getElementById('bannerTitle'),
    bannerText: document.getElementById('bannerText'),
    extensionIdDisplay: document.getElementById('extensionIdDisplay'),
    setupLink: document.getElementById('setupLink'),

    // Step buttons
    openNetflixBtn: document.querySelector('.method-card.pc #openNetflixBtn') || document.getElementById('openNetflixBtn'),
    watchAsGuestBtn: document.querySelector('.method-card.pc #watchAsGuestBtn') || document.getElementById('watchAsGuestBtn'),
    pcLoginLinkBtn: document.querySelector('.method-card.pc #pcLoginLinkBtn') || document.getElementById('pcLoginLinkBtn'),

    // Step status
    statusIcon: document.getElementById('statusIcon'),
    statusMessage: document.getElementById('statusMessage'),

    // Plan modal
    planModal: document.getElementById('planModal'),

    // Team message modal (tránh ad blocker chặn)
    teamModal: document.getElementById('teamModal'),
    messageSection: document.getElementById('messageSection'),
    watchingSection: document.getElementById('watchingSection'),
    watchingProgress: document.getElementById('watchingProgress'),
    watchingIcon: document.getElementById('watchingIcon'),
    // adContent: document.getElementById('adContent'), // Removed - no longer needed
    // adMessage: document.getElementById('adMessage'), // Removed - no longer needed
    // adTimer: document.getElementById('adTimer'), // Removed - no longer needed
    // timeLeft: document.getElementById('timeLeft'), // Removed - no longer needed
    // progressFill: document.getElementById('progressFill'), // Removed - no longer needed
    cancelBtn: document.getElementById('cancelBtn'),
    startWatchingBtn: document.getElementById('startWatchingBtn')
};

function getStatusIconSvg(type) {
    switch (type) {
        case 'success':
            return '<svg class="icon" style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="m9 12 2 2 4-4"></path></svg>';
        case 'error':
            return '<svg class="icon" style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>';
        case 'warning':
            return '<svg class="icon" style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>';
        case 'info':
        default:
            return '<svg class="icon" style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>';
    }
}

// ========================================
// STATE
// ========================================

const state = {
    hasExtension: false,
    extensionId: null,
    extensionVersion: null,
    extensionOutdated: false,
    netflixTabRef: null,
    netflixTabId: null,
    adCountdown: CONFIG.AD_DURATION,
    adInterval: null
};

function getExtensionSignalHeaderValue() {
    const payload = {
        extensionId: state.extensionId || CONFIG.EXTENSION_ID || 'unknown',
        version: state.extensionVersion || 'unknown',
        source: 'webapp'
    };
    return JSON.stringify(payload);
}

// ========================================
// INITIALIZATION
// ========================================

// Listen for extension ready event BEFORE DOMContentLoaded
// to catch early events from inline script
window.addEventListener('NetflixGuestExtensionReady', (event) => {
    console.log('✅ Extension ready event received:', event.detail);
    state.extensionId = event.detail.extensionId;
    CONFIG.EXTENSION_ID = event.detail.extensionId;
    onExtensionDetected(event.detail);
});

// Listen for extension NOT found event
window.addEventListener('NetflixGuestExtensionNotFound', () => {
    console.log('⚠️ Extension not found event received');
    onExtensionNotDetected();
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 Netflix Guest Sharing initialized');

    // Kiểm tra extension
    checkExtension();

    // Setup event listeners
    setupEventListeners();

    // Kiểm tra referral notification khi trang load (nếu đã đăng nhập)
    checkReferralNotificationOnLoad();
});

// ========================================
// CHECK REFERRAL NOTIFICATION ON PAGE LOAD
// ========================================

/**
 * Kiểm tra và hiển thị referral notification khi user reload trang
 * Chỉ chạy nếu user đã đăng nhập
 */
async function checkReferralNotificationOnLoad() {
    const authToken = localStorage.getItem('auth_token');

    if (!authToken) {
        console.log('ℹ️ User chưa đăng nhập, bỏ qua kiểm tra referral notification');
        return;
    }

    console.log('🔍 Kiểm tra referral notification khi load trang...');

    try {
        // Gọi API trực tiếp thay vì phụ thuộc vào auth.js
        const response = await fetch(`${BACKEND_URL}/api/referral/unread`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (data.success && data.hasUnread && data.unreadCount > 0) {
            console.log(`🎉 Có ${data.unreadCount} thông báo referral chưa đọc`);

            // Lấy thông tin lượt mời còn lại
            const infoResponse = await fetch(`${BACKEND_URL}/api/referral/info`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }
            });
            const infoData = await infoResponse.json();

            // Hiển thị modal
            showReferralNotificationModalOnLoad(data, infoData, authToken);
        } else {
            console.log('ℹ️ Không có referral notification mới');
        }
    } catch (error) {
        console.error('❌ Lỗi kiểm tra referral notification:', error);
    }
}

/**
 * Hiển thị modal thông báo referral khi load trang
 */
function showReferralNotificationModalOnLoad(data, infoData, token) {
    const overlay = document.getElementById('referralNotificationOverlay');
    const body = document.getElementById('referralNotificationBody');

    if (!overlay || !body) {
        console.error('❌ Không tìm thấy modal referral notification');
        return;
    }

    // Tạo nội dung modal
    let itemsHTML = '';

    // Hiển thị từng referral chưa đọc
    data.unreadReferrals.forEach(ref => {
        const time = new Date(ref.timestamp).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Hiển thị email đầy đủ
        const email = ref.referredEmail || 'Người dùng mới';

        itemsHTML += `
            <div class="referral-notification-item">
                <div class="referral-notification-item-header">
                    <span class="referral-notification-email">${email}</span>
                    <span class="referral-notification-credits">+${ref.creditsEarned || 5} credits</span>
                </div>
                <div class="referral-notification-time">🕐 ${time}</div>
            </div>
        `;
    });

    // Tính lượt mời còn lại
    const referralsRemaining = infoData.success ? infoData.referralsRemaining : 0;

    // Tổng credits nhận được
    const totalCredits = data.totalCreditsEarned || 0;

    // Tạo CTA phù hợp với số lượt mời còn lại
    const ctaMessage = referralsRemaining > 0
        ? '💡 Tiếp tục mời bạn bè để nhận thêm credits miễn phí!'
        : '🎉 Bạn đã dùng hết lượt mời tháng này. Lượt mời sẽ được reset vào ngày 1 tháng sau!';

    // Tạo summary
    const summaryHTML = `
        <div class="referral-notification-summary">
            <div class="referral-notification-total">+${totalCredits} credits</div>
            <div class="referral-notification-total-label">Tổng credits nhận được</div>
            <div class="referral-notification-remaining">
                Lượt mời còn lại tháng này: <strong>${referralsRemaining}/2</strong>
            </div>
        </div>
        <div class="referral-notification-cta">
            ${ctaMessage}
        </div>
    `;

    body.innerHTML = itemsHTML + summaryHTML;

    // Lưu token để đánh dấu đã đọc khi đóng modal
    overlay.dataset.token = token;

    // Hiển thị modal
    overlay.classList.add('active');
}

/**
 * Ẩn một phần email để bảo mật
 */
function maskEmailOnLoad(email) {
    if (!email || !email.includes('@')) return email;

    const [localPart, domain] = email.split('@');
    if (localPart.length <= 3) {
        return localPart[0] + '***@' + domain;
    }

    const visibleStart = localPart.substring(0, 2);
    const visibleEnd = localPart.substring(localPart.length - 1);
    return visibleStart + '***' + visibleEnd + '@' + domain;
}

/**
 * Đóng modal referral notification (gọi từ onclick)
 */
async function closeReferralNotificationOnLoad() {
    const overlay = document.getElementById('referralNotificationOverlay');

    if (!overlay) return;

    const token = overlay.dataset.token;

    // Đóng modal
    overlay.classList.remove('active');

    // Đánh dấu đã đọc
    if (token) {
        try {
            await fetch(`${BACKEND_URL}/api/referral/mark-read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('✅ Đã đánh dấu referral notifications là đã đọc');
        } catch (error) {
            console.error('❌ Lỗi đánh dấu đã đọc:', error);
        }
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Safe addEventListener với null check
    if (elements.openNetflixBtn) {
        elements.openNetflixBtn.addEventListener('click', handleOpenNetflix);
    }
    if (elements.watchAsGuestBtn) {
        elements.watchAsGuestBtn.addEventListener('click', handleWatchAsGuest);
    }
    if (elements.pcLoginLinkBtn) {
        elements.pcLoginLinkBtn.addEventListener('click', () => handlePcLoginLink());
    }
    if (elements.cancelBtn) {
        elements.cancelBtn.addEventListener('click', closeTeamModal);
    }
    if (elements.startWatchingBtn) {
        elements.startWatchingBtn.addEventListener('click', handleStartWatching);
    }
    if (elements.setupLink) {
        elements.setupLink.addEventListener('click', showSetupInstructions);
    }
}

// ========================================
// EXTENSION DETECTION
// ========================================

/**
 * Kiểm tra xem Chrome Extension đã được cài đặt chưa
 */
async function checkExtension() {
    // Extension detection handled by inline script
    console.log('🔍 Extension detection active (handled by inline script)');
}

/**
 * Khi extension được phát hiện
 */
function onExtensionDetected(details) {
    // Prevent multiple calls - NHƯNG cho phép update nếu version khác
    if (state.hasExtension && state.extensionVersion === details.version) {
        console.log('ℹ️ Extension already detected with same version, skipping duplicate call');
        return;
    }

    console.log('🔄 Updating extension info:', details);
    state.hasExtension = true;
    state.extensionId = details.extensionId;
    state.extensionVersion = details.version;
    CONFIG.EXTENSION_ID = details.extensionId;

    // Check version - Đơn giản: Chỉ check KHÁC hay GIỐNG
    const currentVersion = String(details.version || '0.0.0').trim();
    const requiredVersion = String(CONFIG.REQUIRED_EXTENSION_VERSION).trim();

    if (currentVersion !== requiredVersion) {
        // Version KHÁC với yêu cầu → CỘI NHƯ CHƯA CÀI
        state.extensionOutdated = true;
        console.warn(`⚠️ Extension version mismatch: ${currentVersion} !== ${requiredVersion}`);

        // Update UI - Warning banner (giống như chưa cài)
        if (elements.extensionBanner && elements.bannerTitle && elements.bannerText) {
            elements.extensionBanner.className = 'extension-banner show error';
            elements.bannerTitle.innerHTML = 'Extension cần cập nhật';
            elements.bannerText.innerHTML = `Phiên bản hiện tại đã cũ. Vui lòng <a href="${CONFIG.EXTENSION_DOWNLOAD_LINK}" target="_blank" style="color: #fff; text-decoration: underline; font-weight: 600;">tải phiên bản mới tại đây</a> để tiếp tục sử dụng.`;
        }
    } else {
        // Version KHỚP → OK
        state.extensionOutdated = false;
        console.log(`✅ Extension version match: ${currentVersion} === ${requiredVersion}`);

        // Update UI - Success banner
        if (elements.extensionBanner && elements.bannerTitle && elements.bannerText) {
            elements.extensionBanner.className = 'extension-banner show success';
            elements.bannerTitle.innerHTML = 'Extension: đã kết nối';
            elements.bannerText.innerHTML = 'Bạn có thể tiếp tục sử dụng các dịch vụ của Tiệm Bánh.';
        }
    }

    console.log('✅ Extension detected and UI updated successfully');
}

/**
 * Khi không phát hiện extension
 */
function onExtensionNotDetected() {
    // Don't override if already detected!
    if (state.hasExtension) {
        console.log('ℹ️ Extension already detected, skip not-detected handler');
        return;
    }

    state.hasExtension = false;

    // Update UI - Simple banner with install guide link
    if (elements.extensionBanner && elements.bannerTitle && elements.bannerText) {
        elements.extensionBanner.className = 'extension-banner show error';
        elements.bannerTitle.innerHTML = 'Chưa cài Extension';
        elements.bannerText.innerHTML = `
            Vui lòng cài đặt Extension Tiệm Bánh Netflix để sử dụng.<br>
            <a href="/install-guide/" style="color: #fff; text-decoration: underline; font-weight: 600;">
                Xem hướng dẫn cài đặt
            </a>
        `;
    }

    console.warn('⚠️ Extension not detected, UI updated');
}

// ========================================
// STEP 1: MỞ NETFLIX TAB
// ========================================

/**
 * Xử lý nút "Mở Netflix.com"
 * Kiểm tra và mở tab Netflix nếu chưa có
 */
async function handleOpenNetflix() {
    console.log('📍 Step 1: Opening Netflix tab...');

    // Reset status
    hideStepStatus(1);

    try {
        // ✨ NEW: Xóa toàn bộ cookie Netflix cũ trước khi mở tab
        if (state.hasExtension && !state.extensionOutdated && CONFIG.EXTENSION_ID) {
            console.log('🗑️ Clearing all Netflix cookies...');
            showStepStatus(1, 'info', '🗑️ Đang xóa cookie cũ...');

            try {
                const clearResult = await chrome.runtime.sendMessage(
                    CONFIG.EXTENSION_ID,
                    { action: 'clearNetflixCookies' }
                );

                if (clearResult && clearResult.success) {
                    console.log('✅ Netflix cookies cleared successfully');
                } else {
                    console.warn('⚠️ Could not clear cookies:', clearResult?.error);
                }
            } catch (error) {
                console.warn('⚠️ Cookie clear error (non-critical):', error);
                // Không fail vì đây không phải critical step
            }
        }

        // Kiểm tra xem đã có tab Netflix chưa
        if (state.netflixTabRef && !state.netflixTabRef.closed) {
            // Tab đã tồn tại, focus vào tab đó
            state.netflixTabRef.focus();
            showStepStatus(1, 'success', '✅ Tab Netflix đã mở sẵn! Đã focus vào tab.');
            console.log('✅ Netflix tab already open, focused');
            return;
        }

        // Mở tab mới
        try {
            state.netflixTabRef = window.open(
                CONFIG.NETFLIX_URL,
                CONFIG.NETFLIX_TAB_NAME
            );

            // Check if popup was blocked
            if (!state.netflixTabRef || state.netflixTabRef.closed) {
                showStepStatus(1, 'error', '❌ Không thể mở tab. Vui lòng cho phép popup!');
                showToast('Vui lòng cho phép popup cho trang này', 'error');
                console.error('❌ Popup blocked');
                return;
            }
        } catch (error) {
            showStepStatus(1, 'error', '❌ Lỗi khi mở tab: ' + error.message);
            console.error('❌ Error:', error);
            return;
        }

        // Gán window.name để dễ nhận diện
        try {
            state.netflixTabRef.name = CONFIG.NETFLIX_TAB_NAME;
        } catch (error) {
            console.warn('Cannot set window.name (cross-origin):', error);
        }

        // Lưu timestamp
        localStorage.setItem('netflixTabOpened', Date.now().toString());

        // Đợi tab load xong
        setTimeout(() => {
            showStepStatus(1, 'success', '✅ Đã mở Netflix tab thành công! Sẵn sàng cho bước 2.');
            showToast('Đã mở Netflix xong!', 'success');
            console.log('✅ Netflix tab opened successfully with clean cookies');
        }, 1000);

    } catch (error) {
        console.error('❌ Error opening Netflix:', error);
        showStepStatus(1, 'error', `❌ Lỗi: ${error.message}`);
        showToast('Lỗi khi mở Netflix', 'error');
    }
}

// ========================================
// REFRESH USER DATA FROM DATABASE
// ========================================

/**
 * Refresh current user data from backend database
 * Returns fresh user object with latest quota, plan, etc.
 */
async function refreshUserFromDatabase() {
    try {
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
            console.warn('⚠️ No auth token found');
            return null;
        }

        console.log('🔄 Refreshing user data from database...');
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            console.error('❌ Failed to refresh user data:', response.status);
            return null;
        }

        const data = await response.json();
        if (data.success && data.user) {
            // Update localStorage with fresh data
            localStorage.setItem('current_user', JSON.stringify(data.user));
            console.log('✅ User data refreshed from database:', {
                plan: data.user.plan,
                monthlyReportLimit: data.user.monthlyReportLimit,
                credits: data.user.credits
            });
            return data.user;
        }

        return null;

    } catch (error) {
        console.error('❌ Refresh user data error:', error);
        return null;
    }
}

// ========================================
// STEP 2: WATCH AS GUEST / PC LOGIN LINK
// ========================================

function getPcLoginStatusElement() {
    return document.getElementById('pcLoginLinkStatus');
}

function setPcLoginStatus(message = '', type = 'info') {
    const statusEl = getPcLoginStatusElement();
    if (statusEl) {
        statusEl.innerHTML = '';
        statusEl.style.display = 'none';
        statusEl.dataset.state = '';
    }

    if (!message) return;

    if (typeof window.updateDesktopGuestStatusPanel === 'function' && document.body.classList.contains('desktop-home-v2')) {
        window.updateDesktopGuestStatusPanel(message, type, { allowHtml: /<a\b/i.test(message) });
        return;
    }

    if (typeof showStepStatus === 'function') {
        showStepStatus(2, type, message);
    }
}

function getPcLoginInsufficientCreditsMessage(required, current) {
    return `B\u1ea1n c\u1ea7n ${required} credits \u0111\u1ec3 t\u1ea1o link login Netflix PC. Hi\u1ec7n t\u1ea1i b\u1ea1n c\u00f3 ${current} credits.`;
}

function isExtensionReadyForDesktopAction() {
    return state.hasExtension && !state.extensionOutdated && !!CONFIG.EXTENSION_ID;
}

async function requestGuestActionNonce(authToken) {
    const response = await fetch(`${BACKEND_URL}/api/cookies/nonce`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'x-ext-infor': getExtensionSignalHeaderValue()
        }
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Không thể tạo nonce bảo mật');
    }

    const data = await response.json().catch(() => ({}));
    if (!data.nonce) {
        throw new Error('Phản hồi nonce không hợp lệ');
    }

    return data.nonce;
}

async function handlePcLoginLink(options = {}) {
    const { skipQuotaCheck = false, skipConfirm = false } = options;
    const isReportBypassFlow = !!skipQuotaCheck;
    const btn = elements.pcLoginLinkBtn;
    const originalBtnHtml = btn ? btn.innerHTML : '';

    try {
        setPcLoginStatus('', 'info');

        if (!isExtensionReadyForDesktopAction()) {
            const message = state.extensionOutdated
                ? '⚠️ Extension đã cũ. Vui lòng cập nhật phiên bản mới trước khi tạo link login Netflix PC.'
                : '⚠️ Cần cài đặt Extension Tiệm Bánh Netflix trước khi tạo link login Netflix PC.';

            setPcLoginStatus(message, 'warning');
            showToast('Cần Extension để tạo link login Netflix PC', 'warning');
            return;
        }

        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
            setPcLoginStatus('Vui lòng đăng nhập lại để tiếp tục.', 'error');
            showToast('Vui lòng đăng nhập lại', 'warning');
            return;
        }

        const freshUser = await refreshUserFromDatabase();
        if (!freshUser) {
            setPcLoginStatus('Không thể tải thông tin tài khoản. Vui lòng thử lại.', 'error');
            return;
        }

        if (freshUser.plan !== 'pro') {
            if (typeof window.showFreePlanBlockedModal === 'function') {
                window.showFreePlanBlockedModal({ feature: 'pc-login' });
            }
            return;
        }

        if (!skipQuotaCheck && freshUser.monthlyReportLimit !== undefined && freshUser.monthlyReportLimit <= 0) {
            if (typeof window.showLimitExceededProModal === 'function') {
                window.showLimitExceededProModal();
            }
            return;
        }

        if (!isReportBypassFlow && freshUser.credits !== undefined && freshUser.credits < PC_LOGIN_COST) {
            let insufficientMessage = typeof window.getInsufficientCreditsMessage === 'function'
                ? window.getInsufficientCreditsMessage(5, freshUser.credits || 0)
                : `Bạn cần 5 credits. Hiện tại bạn có ${freshUser.credits || 0} credits.`;

            insufficientMessage = getPcLoginInsufficientCreditsMessage(PC_LOGIN_COST, freshUser.credits || 0);
            setPcLoginStatus(insufficientMessage, 'error');
            if (typeof window.showCustomModal === 'function') {
                window.showCustomModal({
                    icon: 'card',
                    title: 'Không đủ credits',
                    message: insufficientMessage,
                    buttons: [{ text: 'Đã hiểu', type: 'primary', onClick: null }]
                });
            }
            return;
        }

        if (!skipConfirm && typeof window.showConfirmCustomModal === 'function') {
            const confirmed = await window.showConfirmCustomModal({
                icon: 'card',
                title: 'T\u1ea1o link login Netflix PC',
                message: isReportBypassFlow
                    ? 'H\u1ec7 th\u1ed1ng s\u1ebd t\u1ea1o link login Netflix PC cho b\u1ea1n.\n\nB\u1ea1n \u0111ang trong lu\u1ed3ng \u0111\u1ed5i t\u00e0i kho\u1ea3n, n\u00ean s\u1ebd kh\u00f4ng b\u1ecb tr\u1eeb th\u00eam credits.\n\nB\u1ea1n c\u00f3 mu\u1ed1n ti\u1ebfp t\u1ee5c?'
                    : `H\u1ec7 th\u1ed1ng s\u1ebd t\u1ea1o link login Netflix PC cho b\u1ea1n.\n\nChi ph\u00ed: ${PC_LOGIN_COST} credits.\n\nB\u1ea1n c\u00f3 mu\u1ed1n ti\u1ebfp t\u1ee5c?`,
                confirmText: isReportBypassFlow ? 'T\u1ea1o link ngay' : `T\u1ea1o link (-${PC_LOGIN_COST} credits)`,
                cancelText: 'H\u1ee7y'
            });

            if (!confirmed) {
                return;
            }
        }

        if (false && !skipConfirm && typeof window.showConfirmCustomModal === 'function') {
            const confirmMessage = isReportBypassFlow
                ? 'H\u1ec7 th\u1ed1ng s\u1ebd t\u1ea1o link \u0111\u0103ng nh\u1eadp Netflix cho PC/Laptop c\u1ee7a b\u1ea1n.\n\nB\u1ea1n \u0111ang trong lu\u1ed3ng \u0111\u1ed5i t\u00e0i kho\u1ea3n, n\u00ean s\u1ebd kh\u00f4ng b\u1ecb tr\u1eeb th\u00eam credits.\n\nB\u1ea1n c\u00f3 mu\u1ed1n ti\u1ebfp t\u1ee5c?'
                : `H\u1ec7 th\u1ed1ng s\u1ebd t\u1ea1o link \u0111\u0103ng nh\u1eadp Netflix cho PC/Laptop c\u1ee7a b\u1ea1n.\n\nChi ph\u00ed: ${PC_LOGIN_COST} credits.\n\nB\u1ea1n c\u00f3 mu\u1ed1n ti\u1ebfp t\u1ee5c?`;
            const confirmText = isReportBypassFlow
                ? 'T\u1ea1o link ngay'
                : `T\u1ea1o link (-${PC_LOGIN_COST} credits)`;
            const confirmed = await window.showConfirmCustomModal({
                icon: 'card',
                title: 'Tạo link login Netflix PC',
                message: `Hệ thống sẽ tạo link login Netflix PC cho bạn.\n\nChi phí: ${PC_LOGIN_COST} credits.\n\nBạn có muốn tiếp tục?`,
                confirmText: `Tạo link (-${PC_LOGIN_COST} credits)`,
                cancelText: 'Hủy'
            });

            if (!confirmed) {
                return;
            }
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></span> Đang tạo link...';
        }

        setPcLoginStatus('Đang tạo link login Netflix PC...', 'info');

        const nonce = await requestGuestActionNonce(authToken);
        const response = await fetch(`${BACKEND_URL}/api/cookies/pc-login-link`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'x-ext-infor': getExtensionSignalHeaderValue(),
                'x-once-nonce': nonce
            },
            body: JSON.stringify({})
        });

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('current_user');
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('logged_in');
            setPcLoginStatus('Phiên đăng nhập đã hết hạn. Đang tải lại trang...', 'error');
            setTimeout(() => window.location.reload(), 1500);
            return;
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            if (data.code === 'PRO_REQUIRED') {
                if (typeof window.showFreePlanBlockedModal === 'function') {
                    window.showFreePlanBlockedModal({ feature: 'pc-login' });
                }
                return;
            }

            if (data.code === 'NO_REPORT_LIMIT') {
                if (typeof window.showLimitExceededProModal === 'function') {
                    window.showLimitExceededProModal();
                }
                setPcLoginStatus(data.error || 'Bạn đã hết lượt đổi tài khoản trong tháng này.', 'warning');
                return;
            }

            if (data.code === 'INSUFFICIENT_CREDITS') {
                const insufficientMessage = getPcLoginInsufficientCreditsMessage(data.required || PC_LOGIN_COST, data.current || 0);
                setPcLoginStatus(insufficientMessage, 'error');
                return;
            }

            if (false && data.code === 'INSUFFICIENT_CREDITS') {
                const insufficientMessage = typeof window.getInsufficientCreditsMessage === 'function'
                    ? window.getInsufficientCreditsMessage(data.required || 5, data.current || 0)
                    : (data.error || 'Không đủ credits.');
                setPcLoginStatus(insufficientMessage, 'error');
                return;
            }

            const errorMessage = data.error || 'Không thể tạo link login Netflix PC.';
            setPcLoginStatus(errorMessage, 'error');
            return;
        }

        const timeText = data.timeRemaining
            ? (() => {
                const hours = Math.floor(data.timeRemaining / 3600);
                const minutes = Math.max(1, Math.floor((data.timeRemaining % 3600) / 60));
                if (hours > 0) return ` (hết hạn sau ${hours}h${minutes > 0 ? ` ${minutes}m` : ''})`;
                return ` (hết hạn sau ${minutes}m)`;
            })()
            : '';

        const successHtml = `Thành công! Mở link login <a href="${data.link}" target="_blank" rel="noopener">tại đây</a>${timeText}`;
        setPcLoginStatus(successHtml, 'success');

        if (typeof window.updateCreditsDisplay === 'function' && data.creditsRemaining !== undefined) {
            window.updateCreditsDisplay(data.creditsRemaining);
        }

        if (typeof window.loadCookieInfo === 'function') {
            await window.loadCookieInfo();
        }

        let creditsLine = data.creditsDeducted > 0
            ? `\n\n-${data.creditsDeducted} credits (còn lại: ${data.creditsRemaining})`
            : '';
        if (data.usedReportBypass) {
            creditsLine = '\n\nKh\u00f4ng tr\u1eeb th\u00eam credits v\u00ec b\u1ea1n v\u1eeba \u0111\u1ed5i t\u00e0i kho\u1ea3n.';
        }

        if (typeof window.showCustomModal === 'function') {
            window.showCustomModal({
                icon: 'success',
                title: 'Tạo link thành công!',
                message: `Link login Netflix PC đã sẵn sàng.${timeText}${creditsLine}`,
                buttons: [
                    {
                        text: 'Đóng',
                        type: 'secondary',
                        onClick: null
                    },
                    {
                        text: 'Mở link',
                        type: 'primary',
                        onClick: () => window.open(data.link, '_blank', 'noopener')
                    }
                ]
            });
        }
    } catch (error) {
        console.error('❌ PC login link error:', error);
        setPcLoginStatus('Lỗi kết nối server. Vui lòng thử lại.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
    }
}

/**
 * Internal function - Xử lý Watch as Guest logic (dùng chung)
 * @param {boolean} skipQuotaCheck - Bỏ qua kiểm tra quota (sau khi báo hỏng)
 * @param {boolean} skipAdAndPlanModal - Bỏ qua ad và plan modal (sau khi báo hỏng, đã xem ad 2s rồi)
 */
async function _watchAsGuestInternal(skipQuotaCheck = false, skipAdAndPlanModal = false) {
    console.log('📍 Step 2: Starting guest flow...', skipQuotaCheck ? '(skip quota check)' : '', skipAdAndPlanModal ? '(skip ad/plan modal)' : '');

    // Reset status
    hideStepStatus(2);

    // Kiểm tra xem đã mở Netflix chưa
    if (!state.netflixTabRef || state.netflixTabRef.closed) {
        showStepStatus(2, 'error', '❌ Chưa mở Netflix! Vui lòng bấm bước 1 trước.');
        showToast('Vui lòng mở Netflix tab trước (Bước 1)', 'warning');
        console.error('❌ Netflix tab not found');

        // Highlight bước 1
        elements.openNetflixBtn.style.animation = 'pulse 1s ease 3';
        setTimeout(() => {
            elements.openNetflixBtn.style.animation = '';
        }, 3000);

        return;
    }

    // Kiểm tra extension (bao gồm cả version cũ)
    if (!state.hasExtension || state.extensionOutdated) {
        const message = state.extensionOutdated
            ? '⚠️ Extension đã cũ. Vui lòng cập nhật phiên bản mới!'
            : '⚠️ Extension chưa được cài. Vui lòng xem hướng dẫn!';
        showStepStatus(2, 'warning', message);
        showToast(state.extensionOutdated ? 'Cần cập nhật extension' : 'Cần cài extension để bắt đầu', 'warning');
    }

    let freshUser = null;

    // CHỈ KIỂM TRA QUOTA NẾU KHÔNG PHẢI SAU KHI BÁO HỎNG
    if (!skipQuotaCheck) {
        console.log('🔍 Checking quota from database...');
        showSmartLoading('Đang kiểm tra...', 500);
        freshUser = await refreshUserFromDatabase();
        hideSmartLoading();

        if (freshUser) {
            // Kiểm tra hết lượt đổi tài khoản (monthlyReportLimit <= 0)
            if (freshUser.monthlyReportLimit !== undefined && freshUser.monthlyReportLimit <= 0) {
                console.log('⛔ User has reached monthly report limit (checked from DB)');

                if (freshUser.plan === 'free') {
                    // Free user: Show upgrade modal
                    showLimitExceededFreeModal();
                } else if (freshUser.plan === 'pro') {
                    // Pro user: Show support contact modal
                    showLimitExceededProModal();
                }

                return; // Stop execution
            }

            // Kiểm tra hết credits
            if (freshUser.credits !== undefined && freshUser.credits <= 0) {
                console.log('💳 User has no credits (checked from DB)');

                // Show no credits modal
                if (typeof showNoCreditsModal === 'function') {
                    showNoCreditsModal();
                } else {
                    alert('Bạn đã hết credits. Vui lòng mua thêm để tiếp tục sử dụng!');
                }

                return; // Stop execution
            }

            console.log(`✅ User has ${freshUser.monthlyReportLimit} quota and ${freshUser.credits} credits remaining`);
        }
    } else {
        console.log('⚠️ Skipping quota check - User just reported issue');
        // Vẫn cần lấy user để biết plan
        freshUser = await refreshUserFromDatabase();
    }

    // NẾU SAU KHI BÁO HỎNG → BỎ QUA AD VÀ PLAN MODAL, INJECT COOKIE NGAY
    if (skipAdAndPlanModal) {
        console.log('🚀 After report issue - Skip ad/plan modal, inject cookie directly');
        showToast('🎬 Đang tự động inject tài khoản Netflix mới...', 'success');

        // Mở modal và chỉ hiện watching section
        elements.teamModal.classList.add('active');

        // Ẩn message section, hiện watching section
        if (elements.messageSection) elements.messageSection.style.display = 'none';
        if (elements.watchingSection) elements.watchingSection.style.display = 'block';

        // RESET loading bar về trạng thái ban đầu
        const loadingBarContainer = document.getElementById('loadingBarContainer');
        if (loadingBarContainer) {
            loadingBarContainer.style.display = 'block'; // Hiện lại loading bar
        }

        // Hiện thông báo đang xử lý
        showStepStatus(2, 'success', '⏳ Đang inject tài khoản Netflix mới...');
        if (elements.watchingProgress) {
            elements.watchingProgress.textContent = '⏳ Đang inject tài khoản Netflix mới...';
            elements.watchingProgress.style.color = '#fff'; // Reset về màu trắng
        }

        // Tự động bắt đầu
        setTimeout(() => {
            handleStartWatching();
        }, 500);
        return;
    }

    // FLOW THÔNG THƯỜNG: KIỂM TRA PLAN
    if (freshUser) {
        if (freshUser.plan === 'pro') {
            // User Pro: Skip ad, bắt đầu xem ngay
            console.log('⭐ Pro user - skipping ad, starting directly');
            showToast('⭐ Pro user - Bắt đầu xem ngay!', 'success');

            // Mở modal và chỉ hiện watching section
            elements.teamModal.classList.add('active');

            // Ẩn message section, hiện watching section
            if (elements.messageSection) elements.messageSection.style.display = 'none';
            if (elements.watchingSection) elements.watchingSection.style.display = 'block';

            // RESET loading bar về trạng thái ban đầu
            const loadingBarContainer = document.getElementById('loadingBarContainer');
            if (loadingBarContainer) {
                loadingBarContainer.style.display = 'block'; // Hiện lại loading bar
            }

            // Hiện thông báo đang xử lý
            showStepStatus(2, 'success', '⏳ Pro user - Đang kết nối Netflix...');
            if (elements.watchingProgress) {
                elements.watchingProgress.textContent = '⏳ Pro user - Đang kết nối Netflix...';
                elements.watchingProgress.style.color = '#fff'; // Reset về màu trắng
            }

            // Tự động bắt đầu
            setTimeout(() => {
                handleStartWatching();
            }, 500);
            return;
        }
    }

    // User Free: Hiển thị modal chọn gói
    showPlanModal();
    console.log('📋 Plan selection modal opened');
}

/**
 * Public function - Xử lý nút "Watch as Guest" (có kiểm tra quota)
 */
async function handleWatchAsGuest() {
    await _watchAsGuestInternal(false, false); // Check quota, show ad/plan modal
}

/**
 * Internal function - Tự động chạy sau khi báo hỏng (không check quota, không xem ad/plan)
 * User đã bị trừ lượt và xem quảng cáo 2s rồi, phải cho inject cookie ngay để công bằng
 */
async function handleWatchAsGuestAfterReport() {
    console.log('🔄 Auto-triggering Watch as Guest after report issue...');
    await _watchAsGuestInternal(true, true); // Skip quota check + Skip ad/plan modal
}

async function handlePcLoginLinkAfterReport() {
    console.log('🔗 Triggering PC login link after report issue...');
    await handlePcLoginLink({ skipQuotaCheck: true, skipConfirm: true });
}

/**
 * Hiển thị modal chọn gói
 */
function showPlanModal() {
    elements.planModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Đóng modal chọn gói
 */
function closePlanModal() {
    elements.planModal.classList.remove('active');
    document.body.style.overflow = '';
}

/**
 * User chọn Free Plan - Xem quảng cáo
 */
function selectFreePlan() {
    console.log('📺 User selected Free Plan - Watch ad');
    closePlanModal();

    // Hiển thị modal thông điệp team
    showTeamModal();
    showStepStatus(2, 'success', '⏳ Đang xem thông điệp...');
}

/**
 * User chọn Pro Plan - 20k/tháng
 */
function selectProPlan() {
    console.log('⭐ User selected Pro Plan');

    // Show confirmation
    const confirm = window.confirm(`🚀 Nâng cấp lên Pro Plan?

💰 Giá: 30.000 VNĐ/tháng

Bạn sẽ được chuyển đến Zalo để liên hệ chủ trang và thanh toán.

Sau khi thanh toán, tài khoản sẽ được nâng cấp và bạn có thể xem phim không quảng cáo!

Tiếp tục?`);

    if (confirm) {
        // Redirect to Zalo
        window.open('https://zalo.me/0393434851', '_blank');
        showToast('Đang mở Zalo... Liên hệ chủ trang để nâng cấp!', 'success');
        closePlanModal();
    }
}

// ========================================
// TEAM MESSAGE MODAL LOGIC (tránh ad blocker)
// ========================================

/**
 * Hiển thị modal thông điệp team
 */
function showTeamModal() {
    elements.teamModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    resetModalState();
    startModalCountdown();
    animateAdContent();
}

/**
 * Đóng modal thông điệp team
 */
function closeTeamModal() {
    elements.teamModal.classList.remove('active');
    document.body.style.overflow = '';
    resetModalState();
}

/**
 * Reset trạng thái modal
 */
function resetModalState() {
    clearInterval(state.adInterval);
    state.adCountdown = CONFIG.AD_DURATION;
    elements.startWatchingBtn.disabled = true;
    elements.startWatchingBtn.textContent = `Bắt đầu xem sau ${CONFIG.AD_DURATION}s`;
}

/**
 * Bắt đầu đếm ngược modal
 */
function startModalCountdown() {
    state.adCountdown = CONFIG.AD_DURATION;

    // Update button text with countdown
    elements.startWatchingBtn.textContent = `Bắt đầu xem sau ${state.adCountdown}s`;

    state.adInterval = setInterval(() => {
        state.adCountdown--;

        // Update button text with countdown
        if (state.adCountdown > 0) {
            elements.startWatchingBtn.textContent = `Bắt đầu xem sau ${state.adCountdown}s`;
        } else {
            clearInterval(state.adInterval);
            enableStartButton();
        }
    }, 1000);
}

/**
 * Enable nút "Bắt đầu xem"
 */
function enableStartButton() {
    elements.startWatchingBtn.disabled = false;
    elements.startWatchingBtn.textContent = 'Bắt đầu xem';
    console.log('✅ Ad completed');
}

/**
 * Animate ad content (deprecated - no longer needed)
 */
function animateAdContent() {
    // No longer needed - countdown is now on button
}

// ========================================
// HANDLE START WATCHING
// ========================================

/**
 * Xử lý khi user bấm "Bắt đầu xem"
 * Đọc cookie và gửi tới extension để inject
 */
async function handleStartWatching() {
    console.log('🚀 Starting Netflix session with auto-retry...');

    try {
        // Kiểm tra Netflix tab đã mở chưa (phải mở ở bước 1)
        if (!state.netflixTabRef || state.netflixTabRef.closed) {
            showStepStatus(2, 'error', '❌ Netflix tab đã bị đóng! Vui lòng mở lại ở bước 1.');
            showToast('Netflix tab đã đóng, vui lòng mở lại', 'error');
            closeTeamModal();
            return;
        }

        // Kiểm tra extension (bao gồm cả version cũ)
        if (!state.hasExtension || state.extensionOutdated) {
            const message = state.extensionOutdated
                ? '❌ Extension đã cũ. Vui lòng cập nhật phiên bản mới để tiếp tục.'
                : '❌ Cần extension để login. Vui lòng cài extension.';
            showStepStatus(2, 'error', message);
            showToast(state.extensionOutdated ? 'Cần cập nhật extension' : 'Cần cài extension để login', 'error');
            closeTeamModal();
            return;
        }

        // Chuyển sang watching section (ẩn message, hiện progress)
        if (elements.messageSection) elements.messageSection.style.display = 'none';
        if (elements.watchingSection) elements.watchingSection.style.display = 'block';

        // RESET loading bar về trạng thái ban đầu
        const loadingBarContainer = document.getElementById('loadingBarContainer');
        if (loadingBarContainer) {
            loadingBarContainer.style.display = 'block'; // Hiện lại loading bar
        }

        // Tạo retry handler
        const retryHandler = new CookieRetryHandler(
            BACKEND_URL,
            localStorage.getItem('auth_token')
        );

        // Bắt đầu quá trình login với auto-retry
        showStepStatus(2, 'success', '⏳ Đang kết nối...');
        if (elements.watchingProgress) {
            elements.watchingProgress.style.color = '#fff'; // Reset về màu trắng
            elements.watchingProgress.textContent = '⏳ Đang kết nối...';
        }

        const result = await retryHandler.attemptLogin((progress) => {
            // Cập nhật UI dựa trên tiến trình
            console.log('🔄 Progress:', progress);

            if (progress.status === 'trying') {
                if (elements.watchingIcon) elements.watchingIcon.textContent = '⏳';
                if (elements.watchingProgress) {
                    elements.watchingProgress.textContent = 'Đang đăng nhập...';
                }
            } else if (progress.status === 'retrying') {
                if (elements.watchingIcon) elements.watchingIcon.textContent = '🔄';
                if (elements.watchingProgress) {
                    elements.watchingProgress.textContent = 'Đang đăng nhập...';
                }
                if (progress.errorCode) {
                    console.log(`Tài khoản Netflix lỗi (${progress.errorCode}), đang thử tài khoản khác...`);
                }
            } else if (progress.status === 'success') {
                if (elements.watchingIcon) elements.watchingIcon.textContent = '✅';
                if (elements.watchingProgress) {
                    elements.watchingProgress.textContent = 'Đăng nhập thành công!';
                }
            } else if (progress.status === 'failed') {
                if (elements.watchingIcon) elements.watchingIcon.textContent = '❌';
                if (elements.watchingProgress) {
                    elements.watchingProgress.textContent = 'Đăng nhập thất bại. Vui lòng thử lại sau.';
                }
            }
        });

        if (result.success) {
            // Thành công!
            console.log('✅ Login successful, preparing to focus Netflix tab...');

            // Clear any warning messages first
            hideStepStatus(2);
            showStepStatus(2, 'success', '✅ Đăng nhập thành công!');

            // Cập nhật UI thành công
            if (elements.watchingIcon) elements.watchingIcon.textContent = '✅';
            if (elements.watchingProgress) {
                elements.watchingProgress.textContent = 'Đăng nhập thành công!';
                elements.watchingProgress.style.color = '#4ade80'; // Màu xanh lá sáng
            }

            // Ẩn loading bar khi đã thành công
            const loadingBarContainer = document.getElementById('loadingBarContainer');
            if (loadingBarContainer) {
                loadingBarContainer.style.display = 'none';
            }

            showToast('🎉 Đăng nhập thành công!', 'success');

            // Focus vào tab Netflix qua extension (cách chắc chắn nhất)
            console.log('🔄 Requesting extension to focus Netflix tab...');

            try {
                const focusResponse = await chrome.runtime.sendMessage(
                    CONFIG.EXTENSION_ID,
                    { action: 'focusNetflixTab' }
                );

                if (focusResponse && focusResponse.success) {
                    console.log('✅ Netflix tab focused successfully via extension!');
                    console.log('   Tab ID:', focusResponse.tabId);
                    console.log('   Window ID:', focusResponse.windowId);
                } else {
                    console.warn('⚠️ Extension could not focus tab:', focusResponse?.error);

                    // Fallback: Thử focus bằng window reference
                    console.log('🔄 Trying fallback focus method...');
                    if (state.netflixTabRef && !state.netflixTabRef.closed) {
                        window.blur();
                        state.netflixTabRef.focus();
                        console.log('✅ Fallback focus attempted');
                    }
                }
            } catch (error) {
                console.error('❌ Error requesting focus via extension:', error);

                // Fallback: Thử focus bằng window reference
                console.log('🔄 Trying fallback focus method...');
                if (state.netflixTabRef && !state.netflixTabRef.closed) {
                    try {
                        window.blur();
                        state.netflixTabRef.focus();
                        console.log('✅ Fallback focus attempted');
                    } catch (e) {
                        console.warn('⚠️ Fallback focus also failed:', e);
                    }
                }
            }

            // KHÔNG đóng modal tự động - giữ mở để user đọc cảnh báo về việc giữ tab
            // User sẽ tự đóng modal khi đã đọc xong cảnh báo
            console.log('✅ Modal giữ mở để user đọc cảnh báo về việc giữ tab');

        } else {
            // Thất bại sau khi đã retry
            const errorMsg = result.error || 'Không thể đăng nhập sau nhiều lần thử';

            // 🚫 NẾU BỊ RATE LIMIT - Đóng modal team/watching
            if (result.isRateLimited) {
                console.log('🚫 Rate limited - Closing modal');
                closeTeamModal();
                showStepStatus(2, 'error', `⚠️ ${errorMsg}`);
                // Modal cảnh báo đã được hiển thị trong CookieRetryHandler
            } else {
                showStepStatus(2, 'error', `❌ ${errorMsg}`);
                showToast(`❌ ${errorMsg}`, 'error');
            }
        }

    } catch (error) {
        console.error('❌ Start watching error:', error);
        showStepStatus(2, 'error', '❌ Lỗi hệ thống: ' + error.message);
        showToast('❌ Có lỗi xảy ra: ' + error.message, 'error');
    }
}

// ========================================
// COOKIE MANAGEMENT
// ========================================

/**
 * Đọc cookie từ file cookie.txt
 * PRODUCTION VERSION: Cookie được embed trực tiếp để tránh CORS issue
 */
async function readCookieFromFile() {
    try {
        console.log('🔄 Fetching cookie from backend...');
        const token = localStorage.getItem('auth_token');
        console.log('🔑 Auth token exists:', !!token);

        // Call backend API to get Netflix cookie
        const response = await fetch(`${BACKEND_URL}/api/cookies/guest`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-ext-infor': getExtensionSignalHeaderValue()
            }
        });

        console.log('📡 Backend response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Backend error:', response.status, errorData);

            // Xử lý BANNED - Tài khoản bị khóa
            if (errorData.code === 'BANNED' || response.status === 429) {
                const isPermanent = errorData.isPermanent;
                const remainingTime = errorData.remainingSeconds;

                let timeMessage = '';
                if (isPermanent) {
                    timeMessage = 'Tài khoản của bạn đã bị khóa vĩnh viễn.';
                } else if (remainingTime) {
                    const hours = Math.floor(remainingTime / 3600);
                    const minutes = Math.floor((remainingTime % 3600) / 60);
                    if (hours > 0) {
                        timeMessage = `Thời gian còn lại: ${hours} giờ ${minutes} phút`;
                    } else {
                        timeMessage = `Thời gian còn lại: ${minutes} phút`;
                    }
                }

                showModal({
                    icon: '🚫',
                    title: 'Tài khoản bị khóa',
                    message: `Lý do: ${errorData.error || 'Tài khoản của bạn đã bị khóa do các hoạt động bất thường.'}\n\n${timeMessage}\n\nNếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ Support.`,
                    buttons: [
                        {
                            text: 'Liên hệ Support',
                            type: 'primary',
                            onClick: () => {
                                window.open('https://www.facebook.com/tiembanh4k/', '_blank');
                            }
                        },
                        {
                            text: 'Đóng',
                            type: 'secondary'
                        }
                    ]
                });
                return null;
            }

            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('📦 Backend response data:', data);

        if (data.cookie) {
            // Backend returns cookie object, no need to parse
            console.log(`✅ Using assigned Cookie #${data.cookieNumber} (${data.sharedUsers} users)`);
            console.log('🍪 Cookie value preview:', data.cookie.value.substring(0, 50) + '...');
            return data.cookie;
        } else {
            console.log('⚠️ No cookie in response, using fallback');
            // Fallback to demo cookie if no cookie from backend
            const DEMO_COOKIE = 'NetflixId=v%3D3%26ct%3DBgjHlOvcAxL2Arigp8V5bErQqO0COTaSWib2zCUeC2qiNuXTYbv1SJ9nhrt-7hEakEDvt7HJVrkyGs09kIVt7M53Z8NzdbE75FOamF5q6XftereeruBU5v4pBNggbg97HNTqBxw2gE-UUt3hzyadHcNbdz8TQKYOtcyEmcBaxoXsAJR13QSyFT2-3RRQyYlM_H0O4BrTAczVvAc3SVKd2mkNtwf2CYjlaEVviS7JEDUFG2o4eMAE3db3aDn62DLw5AXK2C7YaKVfpv7nsfDitbTp1p0apNMByQEqNOq3dusmNVCIuHlH2HVhAiLO8_94BB2I0I49ebiC4XPX0fGYTqGDuU1gCkwYOxhMEQhysBmb8KKfbGdZhYn84_q0xRYcTUi_-DFI3nf8Jb8PogIWMh3o4vRH6oa2RzYwYvHr_RHH3Nifx_f5hKBX4L2u6DYSAcC2H2svlWGy2h-b-1AC4YhO821XH6zEWazzCs6poe0bo4jSuRBDny2Ql_xf0zbaGAYiDgoMzOor99BBEbYgNYcv%26pg%3DBCLYEPK2DJD2BDL7SZZ7JKLCRY%26ch%3DAQEAEAABABSiReww9rblxsEScDlWQSttVWEyFcNQGZc.';
            return parseCookie(DEMO_COOKIE.trim());
        }
    } catch (error) {
        console.error('❌ Error fetching cookie from backend:', error);

        // Fallback to demo cookie
        console.log('🔄 Using fallback DEMO cookie');
        const DEMO_COOKIE = 'NetflixId=v%3D3%26ct%3DBgjHlOvcAxL2Arigp8V5bErQqO0COTaSWib2zCUeC2qiNuXTYbv1SJ9nhrt-7hEakEDvt7HJVrkyGs09kIVt7M53Z8NzdbE75FOamF5q6XftereeruBU5v4pBNggbg97HNTqBxw2gE-UUt3hzyadHcNbdz8TQKYOtcyEmcBaxoXsAJR13QSyFT2-3RRQyYlM_H0O4BrTAczVvAc3SVKd2mkNtwf2CYjlaEVviS7JEDUFG2o4eMAE3db3aDn62DLw5AXK2C7YaKVfpv7nsfDitbTp1p0apNMByQEqNOq3dusmNVCIuHlH2HVhAiLO8_94BB2I0I49ebiC4XPX0fGYTqGDuU1gCkwYOxhMEQhysBmb8KKfbGdZhYn84_q0xRYcTUi_-DFI3nf8Jb8PogIWMh3o4vRH6oa2RzYwYvHr_RHH3Nifx_f5hKBX4L2u6DYSAcC2H2svlWGy2h-b-1AC4YhO821XH6zEWazzCs6poe0bo4jSuRBDny2Ql_xf0zbaGAYiDgoMzOor99BBEbYgNYcv%26pg%3DBCLYEPK2DJD2BDL7SZZ7JKLCRY%26ch%3DAQEAEAABABSiReww9rblxsEScDlWQSttVWEyFcNQGZc.';
        return parseCookie(DEMO_COOKIE.trim());
    }
}

/**
 * Parse cookie từ nhiều format khác nhau
 */
function parseCookie(text) {
    // Format 1: JSON object
    if (text.startsWith('{')) {
        return JSON.parse(text);
    }

    // Format 2: Cookie string (NetflixId=value...)
    if (text.includes('=')) {
        const match = text.match(/^([^=]+)=(.+)$/);
        if (match) {
            return {
                name: match[1].trim(),
                value: match[2].trim(),
                domain: '.netflix.com',
                path: '/',
                secure: true,
                httpOnly: false
            };
        }
    }

    // Format 3: Netscape format (tab-separated)
    if (text.includes('\t')) {
        const parts = text.split('\t');
        if (parts.length >= 7) {
            return {
                name: parts[5].trim(),
                value: parts[6].trim(),
                domain: parts[0].trim(),
                path: parts[2].trim(),
                secure: parts[3] === 'TRUE',
                httpOnly: false,
                expirationDate: parseInt(parts[4])
            };
        }
    }

    throw new Error('Unknown cookie format');
}

// ========================================
// EXTENSION COMMUNICATION
// ========================================

/**
 * Gửi cookie tới extension để inject (với timeout)
 */
async function injectCookieViaExtension(cookieData) {
    return new Promise((resolve, reject) => {
        console.log('📤 Sending cookie to extension...');

        if (!CONFIG.EXTENSION_ID) {
            reject(new Error('Extension ID not found'));
            return;
        }

        // ========================================
        // TIMEOUT: 15 giây cho extension response
        // ========================================
        const timeout = setTimeout(() => {
            console.error('⏱️ Extension timeout after 15s - No response');
            reject(new Error('EXTENSION_TIMEOUT: Extension did not respond within 15 seconds'));
        }, 15000);

        chrome.runtime.sendMessage(
            CONFIG.EXTENSION_ID,
            {
                action: 'injectCookie',
                cookieData: cookieData,
                tabName: CONFIG.NETFLIX_TAB_NAME
            },
            (response) => {
                // Clear timeout khi có response
                clearTimeout(timeout);

                if (chrome.runtime.lastError) {
                    console.error('Extension error:', chrome.runtime.lastError);
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                console.log('✅ Extension response:', response);
                resolve(response);
            }
        );
    });
}

/**
 * Refresh Netflix tab via extension
 */
async function refreshNetflixTabViaExtension() {
    return new Promise((resolve, reject) => {
        console.log('🔄 Requesting Netflix tab refresh from extension...');

        if (!CONFIG.EXTENSION_ID) {
            reject(new Error('Extension ID not found'));
            return;
        }

        const timeout = setTimeout(() => {
            console.error('⏱️ Extension timeout after 5s - No response for refresh');
            reject(new Error('Extension refresh timeout'));
        }, 5000);

        chrome.runtime.sendMessage(
            CONFIG.EXTENSION_ID,
            { action: 'refreshNetflixTab' },
            (response) => {
                clearTimeout(timeout);

                if (chrome.runtime.lastError) {
                    console.error('Extension refresh error:', chrome.runtime.lastError);
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                console.log('✅ Netflix tab refreshed:', response);
                resolve(response);
            }
        );
    });
}

// ========================================
// UI HELPERS
// ========================================

/**
 * Hiển thị status cho step
 */
function showStepStatus(stepNumber, type, message) {
    // Remove all emojis and icons from message
    const cleanMessage = message.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|❌|✅|🔄|⚠️|📊/gu, '').trim();
    const statusColor = type === 'error' ? '#ef4444' : type === 'success' ? '#4ade80' : type === 'warning' ? '#fbbf24' : '#a78bfa';

    // Update main status message
    if (elements.statusMessage) {
        elements.statusMessage.textContent = cleanMessage;
        elements.statusMessage.style.color = statusColor;
    }

    const statusCaption = document.querySelector('.status-panel .status-caption');
    if (statusCaption) {
        statusCaption.style.color = statusColor;
    }

    if (elements.statusIcon) {
        elements.statusIcon.innerHTML = getStatusIconSvg(type);
        elements.statusIcon.style.color = statusColor;
        elements.statusIcon.style.background = type === 'error'
            ? 'rgba(239, 68, 68, 0.12)'
            : type === 'success'
                ? 'rgba(34, 197, 94, 0.12)'
                : type === 'warning'
                    ? 'rgba(251, 191, 36, 0.12)'
                    : 'rgba(139, 92, 246, 0.12)';
        elements.statusIcon.style.borderColor = type === 'error'
            ? 'rgba(239, 68, 68, 0.2)'
            : type === 'success'
                ? 'rgba(34, 197, 94, 0.2)'
                : type === 'warning'
                    ? 'rgba(251, 191, 36, 0.2)'
                    : 'rgba(139, 92, 246, 0.2)';
    }
}

/**
 * Ẩn status cho step (no longer needed, kept for compatibility)
 */
function showStepStatus(stepNumber, type, message) {
    const cleanMessage = String(message || '')
        .replace(/[\p{Extended_Pictographic}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\uFE0F]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    const statusColor = type === 'error' ? '#ef4444' : type === 'success' ? '#4ade80' : type === 'warning' ? '#fbbf24' : '#a78bfa';

    if (elements.statusMessage) {
        elements.statusMessage.textContent = cleanMessage;
        elements.statusMessage.style.color = statusColor;
    }

    const statusCaption = document.querySelector('.status-panel .status-caption');
    if (statusCaption) {
        statusCaption.style.color = statusColor;
    }

    if (elements.statusIcon) {
        elements.statusIcon.innerHTML = getStatusIconSvg(type);
        elements.statusIcon.style.color = statusColor;
        elements.statusIcon.style.background = type === 'error'
            ? 'rgba(239, 68, 68, 0.12)'
            : type === 'success'
                ? 'rgba(34, 197, 94, 0.12)'
                : type === 'warning'
                    ? 'rgba(251, 191, 36, 0.12)'
                    : 'rgba(139, 92, 246, 0.12)';
        elements.statusIcon.style.borderColor = type === 'error'
            ? 'rgba(239, 68, 68, 0.2)'
            : type === 'success'
                ? 'rgba(34, 197, 94, 0.2)'
                : type === 'warning'
                    ? 'rgba(251, 191, 36, 0.2)'
                    : 'rgba(139, 92, 246, 0.2)';
    }
}

function hideStepStatus(stepNumber) {
    // Elements are now removed, function kept for compatibility
    // Status updates are now handled via showStepStatus() only
}

/**
 * Hiển thị toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Hiển thị hướng dẫn setup
 */
function showSetupInstructions(e) {
    e?.preventDefault();

    const instructions = `
📖 HƯỚNG DẪN CÀI ĐẶT EXTENSION

1. Mở Chrome, vào chrome://extensions/
2. Bật "Developer mode" (góc trên bên phải)
3. Click "Load unpacked"
4. Chọn folder: NetflixSharingProject/extension
5. Extension sẽ xuất hiện với icon 🎬
6. Reload trang web này

Extension ID sẽ hiện ở banner màu xanh khi cài thành công.

Đọc file SETUP.md để biết thêm chi tiết!
    `.trim();

    alert(instructions);
}

// ========================================
// DEBUG
// ========================================

// ========================================
// EXPOSE FUNCTIONS FOR COOKIE RETRY HANDLER
// ========================================

// Make functions available globally for CookieRetryHandler and index.html
window.injectCookieViaExtension = injectCookieViaExtension;
window.refreshNetflixTabViaExtension = refreshNetflixTabViaExtension;
window.handleWatchAsGuestAfterReport = handleWatchAsGuestAfterReport;
window.handlePcLoginLink = handlePcLoginLink;
window.handlePcLoginLinkAfterReport = handlePcLoginLinkAfterReport;
window.closeTeamModal = closeTeamModal;
window.state = state;
window.CONFIG = CONFIG;
window.showStepStatus = showStepStatus;
window.hideStepStatus = hideStepStatus;
window.getGuestExtensionSignalHeaderValue = getExtensionSignalHeaderValue;

console.log(`
Welcome to TiemBanhNetFlix
`);

// Expose for debugging
window.netflixGuestApp = {
    state,
    config: CONFIG,
    elements,
    checkExtension,
    handleOpenNetflix,
    handleWatchAsGuest,
    handlePcLoginLink
};

// ========================================
// Netflix Guest Sharing - Authentication
// Anti-Spam Features + Backend API Integration
// ========================================

// ========================================
// BACKEND CONFIGURATION
// ========================================

// Use dynamic configuration from config.js
const BACKEND_URL = window.APP_CONFIG && window.APP_CONFIG.BACKEND_URL ? window.APP_CONFIG.BACKEND_URL : '';

// ========================================
// reCAPTCHA CONFIGURATION
// ========================================

const RECAPTCHA_SITE_KEY = '6Ldjte8rAAAAADMBTnxvQtLBAmQq6zH6H-DLl82z';

// ========================================
// SMART LOADING INDICATOR WITH PROGRESSIVE MESSAGES
// ========================================

let loadingTimeout = null;
let progressiveMessageTimeouts = [];

/**
 * Show loading indicator after delay with progressive messages for server load
 * Progressive messages inform users about wait times during high load
 * @param {string} text - Initial loading text
 * @param {number} delayMs - Delay before showing loading (default 500ms)
 */
function showSmartLoading(text = 'Đang xử lý...', delayMs = 500) {
    // Clear any existing timeouts
    if (loadingTimeout) clearTimeout(loadingTimeout);
    clearProgressiveMessages();

    // Show loading after initial delay
    loadingTimeout = setTimeout(() => {
        const overlay = document.getElementById('smartLoadingOverlay');
        const textEl = document.getElementById('smartLoadingText');
        if (overlay && textEl) {
            textEl.textContent = text;
            overlay.style.display = 'flex';

            // Setup progressive messages for long waits
            setupProgressiveMessages(textEl);
        }
    }, delayMs);
}

/**
 * Setup progressive loading messages that update based on wait time
 * This helps manage user expectations during server overload (e.g., 1000 concurrent users)
 * @param {HTMLElement} textEl - Text element to update
 */
function setupProgressiveMessages(textEl) {
    if (!textEl) return;

    // Clear previous timeouts
    clearProgressiveMessages();

    // 2 seconds: Gentle reassurance
    progressiveMessageTimeouts.push(setTimeout(() => {
        if (textEl && textEl.parentElement && textEl.parentElement.style.display === 'flex') {
            textEl.textContent = 'Đang xử lý yêu cầu của bạn, chờ tí nhé...';
        }
    }, 2000));

    // 5 seconds: Inform about server load (Pool = 50 may be busy)
    progressiveMessageTimeouts.push(setTimeout(() => {
        if (textEl && textEl.parentElement && textEl.parentElement.style.display === 'flex') {
            textEl.textContent = 'Tiệm Bánh nay hơi đông khách, bọn mình đang cố gắng xử lý, sắp đến lượt bạn rồi...';
        }
    }, 5000));

    // 10 seconds: Connection message (likely queued in connection pool)
    progressiveMessageTimeouts.push(setTimeout(() => {
        if (textEl && textEl.parentElement && textEl.parentElement.style.display === 'flex') {
            textEl.textContent = 'Cảm ơn bạn đã kiên nhẫn, bọn mình đã order cho bạn rồi nè...';
        }
    }, 10000));

    // 15 seconds: Strong reassurance (definitely in queue)
    progressiveMessageTimeouts.push(setTimeout(() => {
        if (textEl && textEl.parentElement && textEl.parentElement.style.display === 'flex') {
            textEl.textContent = 'Bánh sắp xong rồi nè...';
        }
    }, 15000));
}

/**
 * Clear all progressive message timeouts
 */
function clearProgressiveMessages() {
    progressiveMessageTimeouts.forEach(timeout => clearTimeout(timeout));
    progressiveMessageTimeouts = [];
}

/**
 * Hide loading indicator immediately and clear all timers
 */
function hideSmartLoading() {
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }

    clearProgressiveMessages();

    const overlay = document.getElementById('smartLoadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ========================================
// reCAPTCHA
// ========================================

/**
 * Get reCAPTCHA token for action
 * @param {string} action - Action name (register, login, etc.)
 * @returns {Promise<string>} reCAPTCHA token
 */
async function getRecaptchaToken(action) {
    try {
        if (typeof grecaptcha === 'undefined') {
            console.warn('⚠️ reCAPTCHA not loaded');
            return null;
        }

        const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
        console.log(`✅ reCAPTCHA token generated for action: ${action}`);
        return token;
    } catch (error) {
        console.error('❌ reCAPTCHA error:', error);
        return null;
    }
}

// ========================================
// DEVICE FINGERPRINT
// ========================================

/**
 * Generate unique device fingerprint based on browser characteristics
 * @returns {Promise<string>} Device fingerprint hash
 */
async function generateDeviceFingerprint() {
    const components = [];

    try {
        // 1. Screen information
        components.push(`screen:${screen.width}x${screen.height}x${screen.colorDepth}`);
        components.push(`avail:${screen.availWidth}x${screen.availHeight}`);

        // 2. Timezone
        components.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
        components.push(`tzOffset:${new Date().getTimezoneOffset()}`);

        // 3. Language
        components.push(`lang:${navigator.language}`);
        components.push(`langs:${navigator.languages?.join(',') || ''}`);

        // 4. Platform & User Agent
        components.push(`platform:${navigator.platform}`);
        components.push(`ua:${navigator.userAgent}`);

        // 5. Hardware concurrency (CPU cores)
        components.push(`cores:${navigator.hardwareConcurrency || 'unknown'}`);

        // 6. Device memory (if available)
        components.push(`memory:${navigator.deviceMemory || 'unknown'}`);

        // 7. Touch support
        components.push(`touch:${navigator.maxTouchPoints || 0}`);

        // 8. Canvas fingerprint
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 50;
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(0, 0, 200, 50);
        ctx.fillStyle = '#069';
        ctx.fillText('Device Fingerprint 🎬', 2, 2);
        components.push(`canvas:${canvas.toDataURL().substring(0, 100)}`);

        // 9. WebGL fingerprint
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                components.push(`webgl:${gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)}`);
                components.push(`renderer:${gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)}`);
            }
        }

        // 10. Plugins (deprecated but still useful)
        if (navigator.plugins && navigator.plugins.length > 0) {
            const plugins = Array.from(navigator.plugins)
                .map(p => p.name)
                .sort()
                .join(',');
            components.push(`plugins:${plugins.substring(0, 100)}`);
        }

        // Combine all components
        const fingerprintString = components.join('|');

        // Generate hash using simple but effective algorithm
        const hash = await simpleHash(fingerprintString);

        console.log('🔐 Device fingerprint generated:', hash.substring(0, 16) + '...');
        return hash;

    } catch (error) {
        console.error('❌ Error generating fingerprint:', error);
        // Fallback to basic fingerprint
        return await simpleHash(navigator.userAgent + screen.width + screen.height);
    }
}

/**
 * Simple hash function for fingerprint
 * @param {string} str - String to hash
 * @returns {Promise<string>} Hash string
 */
async function simpleHash(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// ========================================
// ANTI-SPAM STATE
// ========================================

const antiSpam = {
    captchaVerified: false,
    lastRegisterTime: 0,
    registerAttempts: 0,
    COOLDOWN_MS: 60000, // 1 minute cooldown
    MAX_ATTEMPTS_PER_HOUR: 5
};

function isDesktopAuthV2() {
    return document.documentElement.classList.contains('auth-desktop-v2');
}

function syncDesktopAuthStageHeight() {
    if (!isDesktopAuthV2()) return;

    const stage = document.querySelector('.auth-form-stage');
    if (!stage) return;

    const sections = Array.from(stage.querySelectorAll('.form-section'));
    if (!sections.length) return;

    let maxHeight = 0;
    sections.forEach((section) => {
        maxHeight = Math.max(maxHeight, section.scrollHeight || 0);
    });

    if (maxHeight > 0) {
        stage.style.minHeight = `${Math.ceil(maxHeight + 12)}px`;
    }

}

function updateRegisterConfirmState() {
    const passwordInput = document.getElementById('registerPassword');
    const confirmInput = document.getElementById('registerConfirmPassword');
    if (!passwordInput || !confirmInput) return;

    const confirmGroup = confirmInput.closest('.form-group');
    if (!confirmGroup) return;

    confirmGroup.classList.remove('is-valid', 'is-invalid');

    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;
    if (!confirmPassword) return;

    if (password && password === confirmPassword) {
        confirmGroup.classList.add('is-valid');
    } else {
        confirmGroup.classList.add('is-invalid');
    }
}

function getCaptchaIconMarkup(state) {
    if (state === 'pending') {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path><path d="M21 3v6h-6"></path></svg>';
    }

    if (state === 'verified') {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-9"></path></svg>';
    }

    return '';
}

function setCaptchaVisualState(state) {
    const checkbox = document.getElementById('captchaCheckbox');
    const box = document.getElementById('captchaBox');
    if (!checkbox || !box) return;

    const statusMap = {
        idle: 'X\u00e1c minh nhanh',
        pending: '\u0110ang ki\u1ec3m tra',
        verified: '\u0110\u00e3 x\u00e1c minh'
    };
    box.dataset.status = statusMap[state] || statusMap.idle;

    if (!isDesktopAuthV2()) {
        checkbox.classList.remove('checked');
        box.classList.remove('verified', 'is-pending');

        if (state === 'pending') {
            box.classList.add('is-pending');
            checkbox.innerHTML = '⏳';
            return;
        }

        if (state === 'verified') {
            checkbox.classList.add('checked');
            box.classList.add('verified');
            checkbox.innerHTML = '✓';
            return;
        }

        checkbox.innerHTML = '';
        return;
    }

    checkbox.classList.remove('checked', 'is-loading');
    box.classList.remove('verified', 'is-pending');

    if (state === 'pending') {
        checkbox.classList.add('is-loading');
        box.classList.add('is-pending');
    } else if (state === 'verified') {
        checkbox.classList.add('checked');
        box.classList.add('verified');
    }

    checkbox.innerHTML = getCaptchaIconMarkup(state);
}

// ========================================
// TAB SWITCHING
// ========================================

function switchTab(tab) {
    // Update tab buttons
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach((btn, index) => {
        btn.classList.remove('active');
        // Add active to correct button based on tab parameter
        if ((tab === 'login' && index === 0) || (tab === 'register' && index === 1)) {
            btn.classList.add('active');
        }
    });

    // Update forms
    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });

    if (tab === 'login') {
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.getElementById('registerForm').classList.add('active');
    }

    // Clear messages
    clearMessages();
    requestAnimationFrame(syncDesktopAuthStageHeight);
}

// ========================================
// MESSAGE HELPERS
// ========================================

function showError(message) {
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = message;
    errorMsg.classList.add('show');

    setTimeout(() => {
        errorMsg.classList.remove('show');
    }, 5000);
}

function showSuccess(message) {
    const successMsg = document.getElementById('successMsg');
    successMsg.textContent = message;
    successMsg.classList.add('show');

    setTimeout(() => {
        successMsg.classList.remove('show');
    }, 3000);
}

function clearMessages() {
    document.getElementById('errorMsg').classList.remove('show');
    document.getElementById('successMsg').classList.remove('show');
}

// ========================================
// CUSTOM MODAL DIALOG SYSTEM
// ========================================

function resolveAuthModalIcon(icon) {
    if (typeof icon !== 'string') return '';
    const trimmed = icon.trim();
    if (!trimmed) return '';
    if (trimmed.includes('<svg')) return trimmed;

    const iconMap = {
        'ℹ️': 'info',
        'ℹ': 'info',
        '❓': 'help',
        '❔': 'help',
        '⚠️': 'warning',
        '⚠': 'warning',
        '❌': 'error',
        '✅': 'success',
        '🎁': 'gift',
        '📋': 'clipboard',
        '📧': 'mail',
        '🔒': 'lock',
        '🔑': 'key',
        '💳': 'card',
        '🚫': 'ban',
        '🚪': 'logout'
    };

    const paletteMap = {
        info: '#60a5fa',
        help: '#60a5fa',
        warning: '#fbbf24',
        error: '#f87171',
        success: '#4ade80',
        gift: '#fbbf24',
        clipboard: '#93c5fd',
        mail: '#fbbf24',
        lock: '#fbbf24',
        key: '#fbbf24',
        card: '#fbbf24',
        ban: '#f87171',
        logout: '#cbd5e1'
    };

    const name = iconMap[trimmed] || 'info';
    const stroke = paletteMap[name];
    const icons = {
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 10v5"></path><path d="M12 7h.01"></path></svg>`,
        help: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M9.5 9a2.5 2.5 0 1 1 4.42 1.63c-.7.8-1.92 1.43-1.92 2.87"></path><path d="M12 17h.01"></path></svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>`,
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="m8.8 12.5 2.2 2.2 4.7-5"></path></svg>`,
        gift: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="2"></rect><path d="M12 8v13"></path><path d="M19 8a2 2 0 0 0 0-4c-2.2 0-3.7 2.1-4.4 4"></path><path d="M5 8a2 2 0 1 1 0-4c2.2 0 3.7 2.1 4.4 4"></path></svg>`,
        clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="4" width="13" height="16" rx="2"></rect><path d="M16 4V2H8v2"></path><path d="M5 8H3a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h10"></path></svg>`,
        mail: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m4 7 8 5 8-5"></path></svg>`,
        lock: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 1 1 8 0v3"></path></svg>`,
        key: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="m13 10 8-8"></path><path d="m17 6 2 2"></path><path d="m15 8 2 2"></path></svg>`,
        card: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path><path d="M7 15h2"></path></svg>`,
        ban: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M8.5 8.5 15.5 15.5"></path><path d="M15.5 8.5 8.5 15.5"></path></svg>`,
        logout: `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path></svg>`
    };

    return icons[name] || icons.info;
}

function showCustomModal(options) {
    const {
        icon = 'ℹ️',
        title = 'Thông báo',
        message = '',
        buttons = [{ text: 'OK', type: 'primary', onClick: null }]
    } = options;

    const modalOverlay = document.getElementById('customModalOverlay');
    const modalIcon = document.getElementById('customModalIcon');
    const modalTitle = document.getElementById('customModalTitle');
    const modalBody = document.getElementById('customModalBody');
    const modalFooter = document.getElementById('customModalFooter');

    const iconMarkup = resolveAuthModalIcon(icon);
    modalIcon.innerHTML = iconMarkup;
    modalIcon.style.display = iconMarkup ? 'inline-flex' : 'none';
    modalTitle.textContent = title;

    // Support both plain text and pre-formatted text
    if (message.includes('\n')) {
        modalBody.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${message}</pre>`;
    } else {
        modalBody.textContent = message;
    }

    modalFooter.innerHTML = '';
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `custom-modal-btn custom-modal-btn-${btn.type || 'primary'}`;
        button.textContent = btn.text;
        button.onclick = () => {
            closeCustomModal();
            if (btn.onClick) btn.onClick();
        };
        modalFooter.appendChild(button);
    });

    modalOverlay.classList.add('active');
}

function closeCustomModal() {
    const modalOverlay = document.getElementById('customModalOverlay');
    modalOverlay.classList.remove('active');
}

// ========================================
// USER DATABASE (localStorage)
// ========================================

function getUsers() {
    const users = localStorage.getItem('netflix_users');
    return users ? JSON.parse(users) : [];
}

function saveUsers(users) {
    localStorage.setItem('netflix_users', JSON.stringify(users));
}

function findUserByEmail(email) {
    const users = getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

function createUser(userData) {
    const users = getUsers();
    users.push({
        id: Date.now().toString(),
        ...userData,
        createdAt: new Date().toISOString()
    });
    saveUsers(users);
}

function setCurrentUser(user) {
    // Remove password before storing
    const safeUser = { ...user };
    delete safeUser.password;

    localStorage.setItem('current_user', JSON.stringify(safeUser));
    sessionStorage.setItem('logged_in', 'true');
}

function getCurrentUser() {
    const user = localStorage.getItem('current_user');
    return user ? JSON.parse(user) : null;
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('logged_in');
    window.location.href = '/auth/';
}

// ========================================
// FORGOT PASSWORD HANDLER
// ========================================

// Global variables for forgot password flow
let forgotPasswordTimerInterval = null;
let forgotPasswordResendCooldownInterval = null;
let forgotPasswordResetToken = null;

function handleForgotPassword() {
    // Show email input modal
    document.getElementById('forgotPasswordEmailModal').style.display = 'flex';
    document.getElementById('forgotPasswordEmail').value = '';
    document.getElementById('forgotPasswordEmail').focus();
}

function closeForgotPasswordEmailModal() {
    document.getElementById('forgotPasswordEmailModal').style.display = 'none';
}

function closeForgotPasswordOTPModal() {
    document.getElementById('forgotPasswordOTPModal').style.display = 'none';
    if (forgotPasswordTimerInterval) {
        clearInterval(forgotPasswordTimerInterval);
        forgotPasswordTimerInterval = null;
    }
    if (forgotPasswordResendCooldownInterval) {
        clearInterval(forgotPasswordResendCooldownInterval);
        forgotPasswordResendCooldownInterval = null;
    }
}

function closeForgotPasswordNewPasswordModal() {
    document.getElementById('forgotPasswordNewPasswordModal').style.display = 'none';
    forgotPasswordResetToken = null;
}

async function sendForgotPasswordOTP() {
    const email = document.getElementById('forgotPasswordEmail').value.trim();

    if (!email) {
        showModal({
            icon: '⚠️',
            title: 'Lỗi',
            message: 'Vui lòng nhập email',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
        });
        return;
    }

    if (!email.toLowerCase().endsWith('@gmail.com')) {
        showModal({
            icon: '⚠️',
            title: 'Email không hợp lệ',
            message: 'Chỉ chấp nhận email @gmail.com',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
        });
        return;
    }

    try {
        showSmartLoading('Đang gửi OTP...');

        const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        hideSmartLoading();

        if (!response.ok) {
            // Check if quota exhausted
            if (data.error === 'QUOTA_EXHAUSTED') {
                showModal({
                    icon: '📧',
                    title: 'Server đang bận',
                    message: 'Hệ thống tạm thời không thể gửi OTP.\n\nVui lòng liên hệ nhóm Support để được hỗ trợ reset mật khẩu.',
                    buttons: [
                        {
                            text: 'Hủy',
                            type: 'secondary',
                            onClick: () => { }
                        },
                        {
                            text: 'Liên hệ Support',
                            type: 'primary',
                            onClick: () => {
                                window.open('https://www.facebook.com/tiembanh4k/', '_blank');
                            }
                        }
                    ]
                });
                closeForgotPasswordEmailModal();
                return;
            }

            showModal({
                icon: '❌',
                title: 'Lỗi',
                message: data.error || 'Có lỗi xảy ra. Vui lòng thử lại.',
                buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
            });
            return;
        }

        // Success - show OTP modal
        console.log('✅ Forgot password OTP sent to:', email);
        sessionStorage.setItem('forgot_password_email', email);

        closeForgotPasswordEmailModal();
        showForgotPasswordOTPModal(email);

        showModal({
            icon: '✅',
            title: 'OTP đã được gửi',
            message: `Mã OTP đã được gửi đến ${email}\n\nVui lòng kiểm tra email (bao gồm cả thư mục Spam).`,
            buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
        });

    } catch (error) {
        hideSmartLoading();
        console.error('❌ Send forgot password OTP error:', error);
        showModal({
            icon: '❌',
            title: 'Lỗi kết nối',
            message: 'Không thể kết nối đến server. Vui lòng thử lại sau.',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
        });
    }
}

function showForgotPasswordOTPModal(email) {
    document.getElementById('forgotPasswordEmailDisplay').textContent = email;
    document.getElementById('forgotPasswordOTPInput').value = '';
    document.getElementById('forgotPasswordOTPModal').style.display = 'flex';
    document.getElementById('forgotPasswordOTPInput').focus();

    // Start OTP timer (10 minutes)
    let timeLeft = 600;
    forgotPasswordTimerInterval = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        document.getElementById('forgotPasswordOTPTimer').textContent =
            `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(forgotPasswordTimerInterval);
            showModal({
                icon: '⏰',
                title: 'OTP đã hết hạn',
                message: 'Mã OTP đã hết hiệu lực. Vui lòng yêu cầu mã mới.',
                buttons: [{
                    text: 'OK', type: 'primary', onClick: () => {
                        closeForgotPasswordOTPModal();
                    }
                }]
            });
        }
    }, 1000);

    // Start resend cooldown (60 seconds)
    startForgotPasswordResendCooldown();
}

function startForgotPasswordResendCooldown() {
    const resendBtn = document.getElementById('forgotPasswordResendBtn');
    const resendText = document.getElementById('forgotPasswordResendText');
    const resendCooldown = document.getElementById('forgotPasswordResendCooldown');
    const cooldownTimer = document.getElementById('forgotPasswordCooldownTimer');

    resendBtn.disabled = true;
    resendText.style.display = 'none';
    resendCooldown.style.display = 'inline';

    let cooldown = 60;
    cooldownTimer.textContent = cooldown;

    forgotPasswordResendCooldownInterval = setInterval(() => {
        cooldown--;
        cooldownTimer.textContent = cooldown;

        if (cooldown <= 0) {
            clearInterval(forgotPasswordResendCooldownInterval);
            resendBtn.disabled = false;
            resendText.style.display = 'inline';
            resendCooldown.style.display = 'none';
        }
    }, 1000);
}

async function resendForgotPasswordOTP() {
    const email = sessionStorage.getItem('forgot_password_email');
    if (!email) {
        showModal({
            icon: '❌',
            title: 'Lỗi',
            message: 'Không tìm thấy email. Vui lòng thử lại.',
            buttons: [{
                text: 'OK', type: 'primary', onClick: () => {
                    closeForgotPasswordOTPModal();
                }
            }]
        });
        return;
    }

    try {
        showSmartLoading('Đang gửi lại OTP...');

        const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        hideSmartLoading();

        if (!response.ok) {
            if (data.error === 'QUOTA_EXHAUSTED') {
                showModal({
                    icon: '⚠️',
                    title: 'Không thể gửi OTP',
                    message: 'Hệ thống đã hết quota OTP. Vui lòng liên hệ Support.',
                    buttons: [
                        {
                            text: 'Liên hệ Support',
                            type: 'primary',
                            onClick: () => {
                                window.open('https://www.facebook.com/tiembanh4k/', '_blank');
                            }
                        }
                    ]
                });
                closeForgotPasswordOTPModal();
                return;
            }

            showModal({
                icon: '❌',
                title: 'Lỗi',
                message: data.error || 'Không thể gửi lại OTP',
                buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
            });
            return;
        }

        console.log('✅ Resent forgot password OTP to:', email);
        startForgotPasswordResendCooldown();

        // Reset main OTP timer
        if (forgotPasswordTimerInterval) {
            clearInterval(forgotPasswordTimerInterval);
        }
        let timeLeft = 600;
        forgotPasswordTimerInterval = setInterval(() => {
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            document.getElementById('forgotPasswordOTPTimer').textContent =
                `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (timeLeft <= 0) {
                clearInterval(forgotPasswordTimerInterval);
            }
        }, 1000);

        showModal({
            icon: '✅',
            title: 'OTP đã được gửi lại',
            message: `Mã OTP mới đã được gửi đến ${email}`,
            buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
        });

    } catch (error) {
        hideSmartLoading();
        console.error('❌ Resend forgot password OTP error:', error);
        showModal({
            icon: '❌',
            title: 'Lỗi kết nối',
            message: 'Không thể kết nối đến server',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
        });
    }
}

async function verifyForgotPasswordOTP() {
    const email = sessionStorage.getItem('forgot_password_email');
    const otp = document.getElementById('forgotPasswordOTPInput').value.trim();

    if (!otp || otp.length !== 6) {
        showModal({
            icon: '⚠️',
            title: 'OTP không hợp lệ',
            message: 'Vui lòng nhập đầy đủ 6 số OTP',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
        });
        return;
    }

    try {
        showSmartLoading('Đang xác thực OTP...');

        const response = await fetch(`${BACKEND_URL}/api/auth/verify-reset-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });

        const data = await response.json();
        hideSmartLoading();

        if (!response.ok) {
            showModal({
                icon: '❌',
                title: 'Xác thực thất bại',
                message: data.error || 'OTP không chính xác',
                buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
            });
            return;
        }

        // Success - save reset token and show new password modal
        console.log('✅ Forgot password OTP verified');
        forgotPasswordResetToken = data.resetToken;

        closeForgotPasswordOTPModal();
        document.getElementById('forgotPasswordNewPasswordModal').style.display = 'flex';
        document.getElementById('forgotPasswordNewPassword').value = '';
        document.getElementById('forgotPasswordConfirmPassword').value = '';
        document.getElementById('forgotPasswordNewPassword').focus();

    } catch (error) {
        hideSmartLoading();
        console.error('❌ Verify forgot password OTP error:', error);
        showModal({
            icon: '❌',
            title: 'Lỗi kết nối',
            message: 'Không thể kết nối đến server',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
        });
    }
}

async function resetPassword() {
    const newPassword = document.getElementById('forgotPasswordNewPassword').value;
    const confirmPassword = document.getElementById('forgotPasswordConfirmPassword').value;

    // Validate passwords
    if (!newPassword || !confirmPassword) {
        showModal({
            icon: '⚠️',
            title: 'Lỗi',
            message: 'Vui lòng nhập đầy đủ thông tin',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
        });
        return;
    }

    if (newPassword.length < 6) {
        showModal({
            icon: '⚠️',
            title: 'Mật khẩu yếu',
            message: 'Mật khẩu phải có ít nhất 6 ký tự',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
        });
        return;
    }

    if (newPassword !== confirmPassword) {
        showModal({
            icon: '⚠️',
            title: 'Mật khẩu không khớp',
            message: 'Xác nhận mật khẩu không trùng khớp',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
        });
        return;
    }

    if (!forgotPasswordResetToken) {
        showModal({
            icon: '❌',
            title: 'Lỗi',
            message: 'Token không hợp lệ. Vui lòng thử lại.',
            buttons: [{
                text: 'OK', type: 'primary', onClick: () => {
                    closeForgotPasswordNewPasswordModal();
                }
            }]
        });
        return;
    }

    try {
        showSmartLoading('Đang đổi mật khẩu...');

        const response = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resetToken: forgotPasswordResetToken,
                newPassword
            })
        });

        const data = await response.json();
        hideSmartLoading();

        if (!response.ok) {
            showModal({
                icon: '❌',
                title: 'Lỗi',
                message: data.error || 'Không thể đổi mật khẩu',
                buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
            });
            return;
        }

        // Success
        console.log('✅ Password reset successful');
        sessionStorage.removeItem('forgot_password_email');
        forgotPasswordResetToken = null;

        closeForgotPasswordNewPasswordModal();

        showModal({
            icon: '✅',
            title: 'Đổi mật khẩu thành công',
            message: 'Mật khẩu của bạn đã được đổi thành công!\n\nVui lòng đăng nhập lại với mật khẩu mới.',
            buttons: [{
                text: 'Đăng nhập', type: 'primary', onClick: () => {
                    // Switch to login form
                    document.getElementById('loginForm').style.display = 'block';
                    document.getElementById('registerForm').style.display = 'none';
                    document.getElementById('loginEmail').value = sessionStorage.getItem('forgot_password_email') || '';
                    document.getElementById('loginPassword').value = '';
                    document.getElementById('loginPassword').focus();
                }
            }]
        });

    } catch (error) {
        hideSmartLoading();
        console.error('❌ Reset password error:', error);
        showModal({
            icon: '❌',
            title: 'Lỗi kết nối',
            message: 'Không thể kết nối đến server',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => { } }]
        });
    }
}

// Toggle password visibility
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;

    if (input.type === 'password') {
        input.type = 'text';
        // Eye-off icon (hide password)
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';
    } else {
        input.type = 'password';
        // Eye icon (show password)
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    }
}

// ========================================
// LOGIN HANDLER
// ========================================

async function handleLogin(event) {
    event.preventDefault();
    clearMessages();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    console.log('🔐 Login attempt:', email);

    try {
        showSmartLoading('Đang đăng nhập...', 500);

        // Call backend API
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        hideSmartLoading();

        if (response.ok) {
            // Login successful
            console.log('✅ Login successful:', data.user.email);

            showSuccess('Đăng nhập thành công! Đang chuyển hướng...');

            // Lưu token tạm để dùng cho các modal
            sessionStorage.setItem('pending_tiembanh_token', data.token);
            sessionStorage.setItem('pending_tiembanh_user', JSON.stringify(data.user));

            // Flow: Referral Notification → Tiệm bánh Message → Redirect
            setTimeout(async () => {
                // Bước 1: Kiểm tra referral notification trước
                const hasReferralNotification = await checkReferralNotifications(data.token);

                if (hasReferralNotification) {
                    // Có referral notification → hiển thị modal
                    // Sau khi đóng modal, closeReferralNotification() sẽ tự động kiểm tra thông điệp Tiệm bánh
                    console.log('📢 Hiển thị referral notification modal');
                    return;
                }

                // Bước 2: Không có referral notification → kiểm tra thông điệp Tiệm bánh
                const hasMessage = await checkTiembanhMessage(data.token, data.user);

                if (!hasMessage) {
                    // Không có thông điệp → lưu token và redirect ngay
                    localStorage.setItem('auth_token', data.token);
                    localStorage.setItem('current_user', JSON.stringify(data.user));
                    sessionStorage.setItem('logged_in', 'true');
                    sessionStorage.removeItem('pending_tiembanh_token');
                    sessionStorage.removeItem('pending_tiembanh_user');
                    window.location.href = '/';
                }
                // Nếu có thông điệp, checkTiembanhMessage đã xử lý hiển thị modal
            }, 800);
        } else {
            // ✅ Handle EMAIL_NOT_VERIFIED - CÓ QUOTA → BLOCK, bắt buộc verify
            if (data.error === 'EMAIL_NOT_VERIFIED' && data.canSendOtp) {
                console.log('🔒 Email not verified, có quota → BLOCK login, bắt buộc verify');

                // Store temporary token
                sessionStorage.setItem('pending_verification_token', data.token);

                // Show modal BẮT BUỘC verify
                showCustomModal({
                    icon: '📧',
                    title: 'Xác thực email bắt buộc',
                    message: `Tài khoản của bạn chưa được xác thực.\n\nVui lòng xác thực email để đăng nhập.`,
                    buttons: [
                        {
                            text: 'Gửi OTP ngay',
                            type: 'primary',
                            onClick: async () => {
                                showSmartLoading('Đang gửi OTP...', 100);

                                try {
                                    const sendResponse = await fetch(`${BACKEND_URL}/api/auth/send-verification-for-existing-user`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${data.token}`
                                        }
                                    });

                                    const sendData = await sendResponse.json();
                                    hideSmartLoading();

                                    if (sendResponse.ok) {
                                        // Save to sessionStorage for verify flow
                                        sessionStorage.setItem('pending_registration', JSON.stringify({
                                            email: data.user.email,
                                            name: data.user.name,
                                            deviceFingerprint: data.user.deviceFingerprint
                                        }));

                                        showSuccess('Mã OTP đã được gửi!');
                                        setTimeout(() => {
                                            showVerificationModal(data.user.email);
                                        }, 1000);
                                    } else {
                                        showCustomModal({
                                            icon: '❌',
                                            title: 'Không thể gửi OTP',
                                            message: sendData.error || 'Có lỗi xảy ra.',
                                            buttons: [{ text: 'Đóng', type: 'primary' }]
                                        });
                                    }
                                } catch (error) {
                                    hideSmartLoading();
                                    showCustomModal({
                                        icon: '⚠️',
                                        title: 'Lỗi kết nối',
                                        message: 'Không thể kết nối server.',
                                        buttons: [{ text: 'Đóng', type: 'primary' }]
                                    });
                                }
                            }
                        },
                        {
                            text: 'Hủy',
                            type: 'secondary',
                            onClick: () => {
                                // Clear token, không cho login
                                sessionStorage.removeItem('pending_verification_token');
                            }
                        }
                    ]
                });
                return;
            }

            // ✅ Handle BANNED - Tài khoản/IP bị khóa
            if (data.code === 'BANNED') {
                const isPermanent = data.isPermanent;
                const remainingTime = data.remainingSeconds;

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

                showCustomModal({
                    icon: '🚫',
                    title: 'Tài khoản bị khóa',
                    message: `Lý do: ${data.error || 'Tài khoản của bạn đã bị khóa do các hoạt động bất thường.'}\n\n${timeMessage}\n\nNếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ Support để được hỗ trợ.`,
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
                return;
            }

            // ✅ Handle RATE_LIMIT_EXCEEDED - Bị rate limit tự động
            if (data.code === 'RATE_LIMIT_EXCEEDED') {
                const retryAfter = data.retryAfter || 60;
                const minutes = Math.ceil(retryAfter / 60);

                showCustomModal({
                    icon: '⏳',
                    title: 'Tạm khóa do hoạt động bất thường',
                    message: `Thiết bị của bạn đã bị tạm khóa do nghi ngờ hoạt động bất thường.\n\nVui lòng thử lại sau ${minutes} phút.\n\nNếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ Support.`,
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
                return;
            }

            // ✅ Handle other errors (wrong password, account locked, etc)
            showCustomModal({
                icon: '❌',
                title: 'Đăng nhập thất bại',
                message: data.error || 'Thông tin đăng nhập không chính xác.\n\nVui lòng kiểm tra lại email và mật khẩu.',
                buttons: [{ text: 'Thử lại', type: 'primary' }]
            });
        }
    } catch (error) {
        hideSmartLoading();
        console.error('❌ Login error:', error);
        showCustomModal({
            icon: '⚠️',
            title: 'Lỗi kết nối',
            message: 'Không thể kết nối đến server.\n\nVui lòng kiểm tra kết nối internet và thử lại.',
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
    }
}

// ========================================
// REGISTER HANDLER
// ========================================

async function handleRegister(event) {
    event.preventDefault();
    clearMessages();

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    console.log('📝 Register attempt:', email);

    // Anti-Spam Check 1: CAPTCHA
    if (!antiSpam.captchaVerified) {
        showCustomModal({
            icon: '🤖',
            title: 'Xác minh CAPTCHA',
            message: 'Vui lòng xác nhận bạn không phải robot trước khi đăng ký.',
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
        document.getElementById('captchaBox').style.animation = 'shake 0.5s';
        setTimeout(() => {
            document.getElementById('captchaBox').style.animation = '';
        }, 500);
        return;
    }

    // Anti-Spam Check 2: Rate Limiting (Cooldown)
    const now = Date.now();
    const timeSinceLastRegister = now - antiSpam.lastRegisterTime;

    if (timeSinceLastRegister < antiSpam.COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((antiSpam.COOLDOWN_MS - timeSinceLastRegister) / 1000);
        showCustomModal({
            icon: '⏳',
            title: 'Vui lòng đợi',
            message: `Bạn đang thao tác quá nhanh.\n\nVui lòng đợi ${remainingSeconds} giây trước khi đăng ký lại.`,
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
        return;
    }

    // Anti-Spam Check 3: Max Attempts per Hour
    const registerHistory = JSON.parse(localStorage.getItem('register_history') || '[]');
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentAttempts = registerHistory.filter(time => time > oneHourAgo);

    if (recentAttempts.length >= antiSpam.MAX_ATTEMPTS_PER_HOUR) {
        showCustomModal({
            icon: '🚫',
            title: 'Đã vượt quá giới hạn',
            message: `Bạn đã đăng ký quá nhiều lần trong 1 giờ qua.\n\nVui lòng thử lại sau ít nhất 1 giờ để đảm bảo an toàn hệ thống.`,
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
        return;
    }

    // Validate Name
    if (name.length < 3) {
        showCustomModal({
            icon: '✏️',
            title: 'Tên không hợp lệ',
            message: 'Họ tên phải có ít nhất 3 ký tự.\n\nVui lòng nhập họ tên đầy đủ của bạn.',
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
        return;
    }

    // Validate Password Match
    if (password !== confirmPassword) {
        showCustomModal({
            icon: '🔐',
            title: 'Mật khẩu không khớp',
            message: 'Mật khẩu xác nhận không khớp với mật khẩu đã nhập.\n\nVui lòng kiểm tra lại.',
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
        return;
    }

    // Validate Password Strength
    if (password.length < 8) {
        showCustomModal({
            icon: '🔒',
            title: 'Mật khẩu quá ngắn',
            message: 'Mật khẩu phải có ít nhất 8 ký tự để đảm bảo an toàn.\n\nVui lòng chọn mật khẩu dài hơn.',
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
        return;
    }

    const strength = calculatePasswordStrength(password);
    if (strength < 2) {
        showCustomModal({
            icon: '⚠️',
            title: 'Mật khẩu quá yếu',
            message: 'Mật khẩu của bạn quá đơn giản.\n\nVui lòng sử dụng mật khẩu mạnh hơn với:\n• Chữ hoa, chữ thường\n• Số và ký tự đặc biệt',
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
        return;
    }

    // Validate Email Format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showCustomModal({
            icon: '📧',
            title: 'Email không đúng định dạng',
            message: 'Email bạn nhập không đúng định dạng.\n\nVí dụ: example@gmail.com',
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
        return;
    }

    try {
        // Generate device fingerprint
        const deviceFingerprint = await generateDeviceFingerprint();
        console.log('🔐 Fingerprint for registration:', deviceFingerprint.substring(0, 16) + '...');

        // Get reCAPTCHA token
        const recaptchaToken = await getRecaptchaToken('register');

        // ✅ NEW FLOW: Lưu form data vào sessionStorage, CHƯA gửi lên server
        sessionStorage.setItem('pending_registration', JSON.stringify({
            name,
            email,
            password,
            deviceFingerprint
        }));

        showSmartLoading('Đang gửi mã xác thực...', 500);

        // ✅ Call backend API: CHỈ GỬI EMAIL + FINGERPRINT + RECAPTCHA
        const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                recaptchaToken,
                deviceFingerprint
            })
        });

        const data = await response.json();
        hideSmartLoading();

        if (response.ok) {
            // Update anti-spam tracking
            antiSpam.lastRegisterTime = now;
            registerHistory.push(now);
            localStorage.setItem('register_history', JSON.stringify(registerHistory));

            // Check if OTP was skipped due to quota exhaustion
            if (data.requiresEmailVerification === false && data.skipOtpReason === 'QUOTA_EXHAUSTED') {
                // ✅ Hết quota → Tạo User ngay (không cần OTP)
                console.warn('⚠️ SMS OTP quota exhausted. Registering without verification...');

                showSmartLoading('Đang tạo tài khoản...', 100);

                // Call register-without-otp API
                const { name, email, password, deviceFingerprint } = JSON.parse(sessionStorage.getItem('pending_registration'));

                const registerResponse = await fetch(`${BACKEND_URL}/api/auth/register-without-otp`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name, email, password, deviceFingerprint })
                });

                const registerData = await registerResponse.json();
                hideSmartLoading();

                if (registerResponse.ok) {
                    console.log('✅ User created without OTP verification');

                    // Clear pending registration
                    sessionStorage.removeItem('pending_registration');

                    // Login immediately
                    localStorage.setItem('auth_token', registerData.token);
                    localStorage.setItem('current_user', JSON.stringify(registerData.user));
                    sessionStorage.setItem('logged_in', 'true');

                    showSuccess('Đăng ký thành công!');

                    // ✅ Hiện modal nhập mã giới thiệu (giống như khi verify OTP thành công)
                    console.log('🎁 New user (no OTP) - showing referral modal');
                    showReferralModal();
                } else {
                    showCustomModal({
                        icon: '❌',
                        title: 'Đăng ký thất bại',
                        message: registerData.message || registerData.error || 'Có lỗi xảy ra. Vui lòng thử lại.',
                        buttons: [{ text: 'Thử lại', type: 'primary' }]
                    });
                }
                return;
            }

            // ✅ Có quota → Gửi OTP như bình thường
            console.log('✅ OTP sent to:', email);
            showSuccess('Mã OTP đã được gửi đến email của bạn!');

            // Show OTP verification modal
            setTimeout(() => {
                showVerificationModal(email);
            }, 1000);
        } else {
            // ✅ Handle BANNED - Tài khoản/IP bị khóa
            if (data.code === 'BANNED') {
                const isPermanent = data.isPermanent;
                const remainingTime = data.remainingSeconds;

                let timeMessage = '';
                if (isPermanent) {
                    timeMessage = 'Thiết bị của bạn đã bị khóa vĩnh viễn.';
                } else if (remainingTime) {
                    const hours = Math.floor(remainingTime / 3600);
                    const minutes = Math.floor((remainingTime % 3600) / 60);
                    if (hours > 0) {
                        timeMessage = `Thời gian còn lại: ${hours} giờ ${minutes} phút`;
                    } else {
                        timeMessage = `Thời gian còn lại: ${minutes} phút`;
                    }
                }

                showCustomModal({
                    icon: '🚫',
                    title: 'Không thể đăng ký',
                    message: `${data.error || 'Thiết bị của bạn đã bị khóa do các hoạt động bất thường.'}\n\n${timeMessage}\n\nNếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ Support để được hỗ trợ.`,
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
                return;
            }

            // ✅ Handle RATE_LIMIT_EXCEEDED - Bị rate limit tự động
            if (data.code === 'RATE_LIMIT_EXCEEDED') {
                const retryAfter = data.retryAfter || 60;
                const minutes = Math.ceil(retryAfter / 60);

                showCustomModal({
                    icon: '⏳',
                    title: 'Tạm khóa do hoạt động bất thường',
                    message: `Thiết bị của bạn đã bị tạm khóa do nghi ngờ hoạt động bất thường.\n\nVui lòng thử lại sau ${minutes} phút.\n\nNếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ Support.`,
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
                return;
            }

            // Handle invalid email domain
            if (data.error === 'INVALID_EMAIL_DOMAIN') {
                showCustomModal({
                    icon: '⚠️',
                    title: 'Email không hợp lệ',
                    message: 'Hiện tại hệ thống chỉ chấp nhận đăng ký bằng Gmail (@gmail.com).\n\nEmail của bạn không được hỗ trợ.',
                    buttons: [{
                        text: 'Đã hiểu',
                        type: 'primary'
                    }]
                });
                return;
            }

            // Handle missing device fingerprint
            if (data.error === 'NO_DEVICE_FINGERPRINT') {
                showCustomModal({
                    icon: '🔒',
                    title: 'Không thể xác định thiết bị',
                    message: 'Hệ thống không thể xác định thiết bị của bạn vì lý do bảo mật.\n\nVui lòng thử lại, nếu vẫn gặp lỗi, vui lòng liên hệ support.',
                    buttons: [{
                        text: 'Đã hiểu',
                        type: 'primary'
                    }]
                });
                return;
            }

            // Handle duplicate device/IP registration with detailed message
            if ((data.error === 'DUPLICATE_IP_REGISTRATION' || data.error === 'DUPLICATE_DEVICE_REGISTRATION') && data.existingAccount) {
                const account = data.existingAccount;
                const message = `
Thiết bị này đã được đăng ký trước đó:
📅 ${account.registrationDate}
━━━━━━
📋 THÔNG TIN TÀI KHOẢN ĐÃ TẠO:
━━━━━━
Họ tên: ${account.name}
Email: ${account.email}
━━━━━━
✅ VUI LÒNG:
• Dùng tài khoản này để đăng nhập
• Nếu quên mật khẩu, click "Quên mật khẩu?" để được hỗ trợ
                `.trim();

                showCustomModal({
                    icon: '🚫',
                    title: 'Thiết bị đã được đăng ký',
                    message: message,
                    buttons: [{
                        text: 'Đăng nhập ngay',
                        type: 'primary',
                        onClick: () => {
                            // Switch to login tab
                            switchTab('login');
                            // Pre-fill email and focus password
                            setTimeout(() => {
                                document.getElementById('loginEmail').value = account.email;
                                document.getElementById('loginPassword').focus();
                            }, 100);
                        }
                    }]
                });
                return;
            } else {
                showCustomModal({
                    icon: '❌',
                    title: 'Đăng ký thất bại',
                    message: data.message || data.error || 'Có lỗi xảy ra trong quá trình đăng ký.\n\nVui lòng thử lại hoặc liên hệ support nếu vấn đề vẫn tiếp diễn.',
                    buttons: [{ text: 'Thử lại', type: 'primary' }]
                });
            }
        }
    } catch (error) {
        hideSmartLoading();
        console.error('❌ Registration error:', error);
        showCustomModal({
            icon: '⚠️',
            title: 'Lỗi kết nối',
            message: 'Không thể kết nối đến server.\n\nVui lòng kiểm tra kết nối internet và thử lại.',
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
    }
}

// ========================================
// GOOGLE LOGIN (SIMULATED)
// ========================================

function handleGoogleLogin() {
    console.log('🔐 Google login clicked');

    // Simulate Google OAuth popup
    const confirmLogin = confirm('Demo: Đăng nhập với Google?\n\nTrong production, đây sẽ mở Google OAuth popup.');

    if (!confirmLogin) return;

    // Simulate Google user data
    const googleUser = {
        id: 'google_' + Date.now(),
        name: 'Google User Demo',
        email: 'demo@gmail.com',
        provider: 'google',
        picture: 'https://via.placeholder.com/150',
        createdAt: new Date().toISOString()
    };

    // Check if user exists
    let user = findUserByEmail(googleUser.email);

    if (!user) {
        // Create new user
        createUser(googleUser);
        user = googleUser;
        console.log('✅ New Google user created');
    } else {
        console.log('✅ Existing Google user found');
    }

    setCurrentUser(user);
    showSuccess('✅ Đăng nhập Google thành công! Đang chuyển hướng...');

    setTimeout(() => {
        window.location.href = '/';
    }, 1000);
}

function handleGoogleRegister() {
    // Same as login for Google
    handleGoogleLogin();
}

// ========================================
// PASSWORD VISIBILITY TOGGLE
// ========================================

function togglePassword(inputId, iconElement) {
    const input = document.getElementById(inputId);

    if (input.type === 'password') {
        input.type = 'text';
        // Eye-off icon (hide password)
        iconElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';
    } else {
        input.type = 'password';
        // Eye icon (show password)
        iconElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    }
}

// ========================================
// CAPTCHA HANDLER
// ========================================

function toggleCaptcha() {
    const checkbox = document.getElementById('captchaCheckbox');
    const box = document.getElementById('captchaBox');
    if (!checkbox || !box || box.classList.contains('is-pending')) return;

    if (antiSpam.captchaVerified) {
        // Uncheck
        antiSpam.captchaVerified = false;
        setCaptchaVisualState('idle');
    } else {
        // Check (simulate delay)
        setCaptchaVisualState('pending');
        setTimeout(() => {
            antiSpam.captchaVerified = true;
            setCaptchaVisualState('verified');
            console.log('✅ CAPTCHA verified');
        }, 800);
    }
}

// ========================================
// PASSWORD STRENGTH CHECKER
// ========================================

function calculatePasswordStrength(password) {
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    return Math.min(strength, 3); // 0=weak, 1=weak, 2=medium, 3=strong
}

function checkPasswordStrength() {
    const password = document.getElementById('registerPassword').value;
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    const strengthCard = strengthFill ? strengthFill.closest('.password-strength') : null;

    if (!password) {
        strengthFill.className = 'strength-fill';
        strengthText.textContent = '';
        if (strengthCard) strengthCard.dataset.state = 'empty';
        updateRegisterConfirmState();
        return;
    }

    const strength = calculatePasswordStrength(password);

    strengthFill.className = 'strength-fill';
    let strengthState = 'weak';

    if (strength <= 1) {
        strengthFill.classList.add('strength-weak');
        strengthText.textContent = 'Yếu';
        strengthText.style.color = '#dc3545';
        strengthState = 'weak';
    } else if (strength === 2) {
        strengthFill.classList.add('strength-medium');
        strengthText.textContent = 'Trung bình';
        strengthText.style.color = '#ffc107';
        strengthState = 'medium';
    } else {
        strengthFill.classList.add('strength-strong');
        strengthText.textContent = 'Mạnh';
        strengthText.style.color = '#28a745';
        strengthState = 'strong';
    }

    if (strengthCard) strengthCard.dataset.state = strengthState;
    updateRegisterConfirmState();
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔐 Auth page initialized');

    // Check if already logged in (auth_token is the source of truth)
    if (localStorage.getItem('auth_token')) {
        const currentUser = getCurrentUser();
        if (currentUser) {
            console.log('✅ Already logged in:', currentUser.email);
            showSuccess('Bạn đã đăng nhập! Đang chuyển hướng...');
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }
    }

    // Add shake animation CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
        }
    `;
    document.head.appendChild(style);

    const registerConfirmPassword = document.getElementById('registerConfirmPassword');
    if (registerConfirmPassword) {
        registerConfirmPassword.addEventListener('input', updateRegisterConfirmState);
    }

    setCaptchaVisualState(antiSpam.captchaVerified ? 'verified' : 'idle');
    updateRegisterConfirmState();

    if (isDesktopAuthV2()) {
        requestAnimationFrame(syncDesktopAuthStageHeight);
        window.addEventListener('resize', syncDesktopAuthStageHeight);

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                requestAnimationFrame(syncDesktopAuthStageHeight);
            }).catch(() => { });
        }
    }
});

// Expose logout for global access
window.netflixAuthLogout = logout;
window.netflixAuthGetCurrentUser = getCurrentUser;

// ========================================
// TIỆM BÁNH MESSAGE MODAL
// ========================================

let tiembanhCountdownInterval = null;

/**
 * Check for message from Tiệm bánh and show modal if exists
 * @param {string} token - Auth token to save after message
 * @param {Object} user - User data to save after message
 * @returns {Promise<boolean>} - True if message shown, false otherwise
 */
async function checkTiembanhMessage(token, user) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/message`);
        const data = await response.json();

        if (data.hasMessage) {
            console.log('📢 Tiệm bánh has a message');
            showTiembanhMessage(data, token, user);
            return true; // Message shown
        } else {
            console.log('ℹ️ No message from Tiệm bánh');
            return false; // No message
        }
    } catch (error) {
        console.error('❌ Error checking Tiệm bánh message:', error);
        return false; // Error, no message shown
    }
}

/**
 * Parse plain text message to formatted HTML with custom formatting syntax
 * Supports formatting like: "Text content *bold/yellow/underline"
 * @param {string} text - Plain text message
 * @returns {string} - Formatted HTML
 */
function parseMessageToHTML(text) {
    if (!text) return '';

    const lines = text.split('\n');
    let html = '';
    let inOrderedList = false;
    let listItems = [];

    /**
     * Parse formatting tags from end of line (e.g., *bold/yellow/underline)
     * @param {string} line - Line of text
     * @returns {Object} - {content: string, styles: string}
     */
    function parseLineFormatting(line) {
        // Check if line ends with *formatting
        const formatMatch = line.match(/^(.+?)\s*\*([a-z/]+)$/i);

        if (!formatMatch) {
            return { content: line, styles: '' };
        }

        const content = formatMatch[1].trim();
        const formats = formatMatch[2].toLowerCase().split('/');

        let styles = [];
        let fontWeight = 'normal';
        let fontStyle = 'normal';
        let textDecoration = 'none';
        let color = '#e5e7eb'; // default color

        formats.forEach(format => {
            switch (format) {
                case 'bold':
                case 'b':
                    fontWeight = '600';
                    break;
                case 'italic':
                case 'i':
                    fontStyle = 'italic';
                    break;
                case 'underline':
                case 'u':
                    textDecoration = 'underline';
                    break;
                // Màu vàng cam
                case 'yellow':
                    color = '#fbbf24';
                    break;
                case 'gold':
                    color = '#ffd700';
                    break;
                case 'orange':
                    color = '#f97316';
                    break;
                case 'amber':
                    color = '#f59e0b';
                    break;
                // Màu đỏ hồng
                case 'red':
                    color = '#ef4444';
                    break;
                case 'pink':
                    color = '#ec4899';
                    break;
                case 'rose':
                    color = '#f43f5e';
                    break;
                // Màu xanh lá
                case 'green':
                    color = '#10b981';
                    break;
                case 'lime':
                    color = '#84cc16';
                    break;
                case 'emerald':
                    color = '#10b981';
                    break;
                case 'teal':
                    color = '#14b8a6';
                    break;
                // Màu xanh dương
                case 'blue':
                    color = '#60a5fa';
                    break;
                case 'cyan':
                    color = '#06b6d4';
                    break;
                case 'sky':
                    color = '#0ea5e9';
                    break;
                case 'indigo':
                    color = '#6366f1';
                    break;
                // Màu tím
                case 'purple':
                    color = '#a855f7';
                    break;
                case 'violet':
                    color = '#8b5cf6';
                    break;
                case 'fuchsia':
                    color = '#d946ef';
                    break;
                case 'magenta':
                    color = '#db2777';
                    break;
                // Màu trung tính
                case 'white':
                    color = '#ffffff';
                    break;
                case 'gray':
                case 'grey':
                    color = '#9ca3af';
                    break;
                case 'slate':
                    color = '#94a3b8';
                    break;
                case 'zinc':
                    color = '#a1a1aa';
                    break;
                case 'stone':
                    color = '#a8a29e';
                    break;
            }
        });

        // Build style string
        if (fontWeight !== 'normal') styles.push(`font-weight: ${fontWeight}`);
        if (fontStyle !== 'normal') styles.push(`font-style: ${fontStyle}`);
        if (textDecoration !== 'none') styles.push(`text-decoration: ${textDecoration}`);
        styles.push(`color: ${color}`);

        return {
            content: content,
            styles: styles.join('; ')
        };
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Empty line - close list if open, add spacing
        if (line === '') {
            if (inOrderedList) {
                html += '<ol style="margin: 15px 0; padding-left: 25px; color: #e5e7eb; line-height: 1.8; text-align: justify;">';
                listItems.forEach(item => {
                    html += `<li style="margin: 8px 0; text-align: justify;">${item}</li>`;
                });
                html += '</ol>';
                inOrderedList = false;
                listItems = [];
            }
            html += '<br>';
            continue;
        }

        // Numbered list item (1., 2., 3., etc.)
        const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (numberedMatch) {
            const itemText = numberedMatch[2];

            // Parse formatting for list items too
            const parsed = parseLineFormatting(itemText);
            const styledItem = parsed.styles
                ? `<span style="${parsed.styles}">${parsed.content}</span>`
                : parsed.content;

            listItems.push(styledItem);
            inOrderedList = true;
            continue;
        }

        // Close list if we were in one
        if (inOrderedList) {
            html += '<ol style="margin: 15px 0; padding-left: 25px; color: #e5e7eb; line-height: 1.8; text-align: justify;">';
            listItems.forEach(item => {
                html += `<li style="margin: 8px 0; text-align: justify;">${item}</li>`;
            });
            html += '</ol>';
            inOrderedList = false;
            listItems = [];
        }

        // Parse formatting for this line
        const parsed = parseLineFormatting(line);
        let content = parsed.content;

        // Check if line is a URL
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(content)) {
            content = content.replace(urlRegex, (url) => {
                return `<a href="${url}" target="_blank" style="color: #60a5fa; text-decoration: underline; word-break: break-all;">${url}</a>`;
            });

            // Apply additional formatting if any
            const baseStyle = 'margin: 12px 0; line-height: 1.8; text-align: justify;';
            const fullStyle = parsed.styles ? `${baseStyle} ${parsed.styles}` : baseStyle;
            html += `<p style="${fullStyle}">${content}</p>`;
        } else {
            // Regular text - check for **bold** markdown syntax
            content = content.replace(/\*\*(.+?)\*\*/g, '<strong style="color: #fbbf24; font-weight: 600;">$1</strong>');

            // Determine paragraph style based on formatting
            let paragraphStyle = 'margin: 12px 0; line-height: 1.8; text-align: justify;';

            // If line ends with : (and no custom formatting), treat as heading
            if (parsed.content.endsWith(':') && !parsed.styles) {
                paragraphStyle = 'margin: 18px 0 8px 0; font-weight: 600; font-size: 1.05rem; line-height: 1.8; color: #fbbf24; text-align: left;';
            } else if (parsed.styles) {
                // Apply custom formatting
                paragraphStyle += ' ' + parsed.styles;
            } else {
                // Default color for regular text
                paragraphStyle += ' color: #e5e7eb;';
            }

            html += `<p style="${paragraphStyle}">${content}</p>`;
        }
    }

    // Close list if still open at end
    if (inOrderedList) {
        html += '<ol style="margin: 15px 0; padding-left: 25px; color: #e5e7eb; line-height: 1.8; text-align: justify;">';
        listItems.forEach(item => {
            html += `<li style="margin: 8px 0; text-align: justify;">${item}</li>`;
        });
        html += '</ol>';
    }

    return html;
}

/**
 * Show Tiệm bánh message modal with countdown
 * @param {Object} data - Message data (type: 'video'|'image'|'text', videoUrl|imageUrl|message)
 * @param {string} token - Auth token to save after countdown
 * @param {Object} user - User data to save after countdown
 */
function showTiembanhMessage(data, token, user) {
    // If video, show fullscreen video player
    if (data.type === 'video' && data.videoUrl) {
        showTiembanhVideo(data.videoUrl, token, user);
        return;
    }

    // 🎉 If celebration, show special celebration modal
    if (data.type === 'celebration' && data.celebrationData) {
        showCelebrationModal(data.celebrationData, token, user);
        return;
    }

    // Otherwise, show modal with image or text
    const overlay = document.getElementById('tiembanhMessageOverlay');
    const messageBody = document.getElementById('tiembanhMessageBody');
    const btn = document.getElementById('tiembanhMessageBtn');

    if (!overlay || !messageBody || !btn) {
        console.error('❌ Tiệm bánh message modal elements not found');
        return;
    }

    // Set message content (text or image)
    messageBody.innerHTML = ''; // Clear previous content

    if (data.type === 'image' && data.imageUrl) {
        // Display image
        const img = document.createElement('img');
        img.src = `${BACKEND_URL}${data.imageUrl}`;
        img.alt = 'Thông điệp từ Tiệm bánh';
        img.style.cssText = 'max-width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 8px;';
        messageBody.appendChild(img);
    } else if (data.type === 'text' && data.message) {
        // Display text with auto-formatting
        messageBody.innerHTML = parseMessageToHTML(data.message);
    }

    // Reset button
    btn.disabled = true;
    let countdown = 15;

    // Start countdown
    updateButtonText();
    tiembanhCountdownInterval = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            clearInterval(tiembanhCountdownInterval);
            btn.disabled = false;
            btn.textContent = 'Được rồi! Gọi món thôiii...';

            // ✅ Save token to localStorage after countdown finishes
            localStorage.setItem('auth_token', token);
            localStorage.setItem('current_user', JSON.stringify(user));
            sessionStorage.setItem('logged_in', 'true');

            // Clear temporary storage
            sessionStorage.removeItem('pending_tiembanh_token');
            sessionStorage.removeItem('pending_tiembanh_user');

            console.log('✅ Token saved after countdown finished');
        } else {
            updateButtonText();
        }
    }, 1000);

    function updateButtonText() {
        btn.textContent = `Đợi một chút, chúng ta sẽ tiếp tục sau ${countdown}s...`;
    }

    // Button click handler - Close modal and redirect
    btn.onclick = () => {
        if (!btn.disabled) {
            closeTiembanhMessage();
            // Redirect to homepage
            window.location.href = '/';
        }
    };

    // Prevent closing by clicking outside or ESC
    overlay.onclick = (e) => {
        // Do nothing - cannot close by clicking outside
        e.stopPropagation();
    };

    // Show modal
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Ẩn scroll body khi modal mở
}

/**
 * Show Celebration Modal for Big Updates
 * @param {Object} celebrationData - Data from backend
 * @param {string} token - Auth token
 * @param {Object} user - User data
 */
// Extension version hiển thị trên celebration modal (fallback nếu backend chưa trả)
const CELEBRATION_EXTENSION_VERSION = '1.6.1';

function showCelebrationModal(celebrationData, token, user) {
    console.log('Showing celebration modal');

    // SVG Icons
    const svgIcons = {
        smartphone: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="url(#phoneGradient)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <defs>
                <linearGradient id="phoneGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#e50914"/>
                    <stop offset="100%" style="stop-color:#ff6b6b"/>
                </linearGradient>
            </defs>
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
            <path d="M12 18h.01"/>
        </svg>`,
        tv: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="20" height="15" x="2" y="7" rx="2" ry="2"/>
            <polyline points="17 2 12 7 7 2"/>
        </svg>`,
        music: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
        </svg>`,
        play: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>`,
        briefcase: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            <path d="M2 13h20"/>
        </svg>`,
        puzzle: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/>
        </svg>`,
        bell: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>`,
        download: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        sparkles: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            <path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/>
        </svg>`,
        arrowRight: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
        keyRound: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
        partner: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8a3 3 0 1 0-3-3"/>
            <path d="M6 8a3 3 0 1 1 3-3"/>
            <path d="M8 21h8"/>
            <path d="M9 17l3 3 3-3"/>
            <path d="M4 14h4l2-3 2 3h4"/>
        </svg>`,
        shield: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10Z"/>
        </svg>`,
        badgeStar: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 17.27 18.18 21 16.54 13.97 22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27Z"/>
        </svg>`,
        studyBook: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 0 4 19.5z"/>
        </svg>`,
        studyTag: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.59 13.41 10 2.82a2 2 0 0 0-1.41-.59H3v5.59a2 2 0 0 0 .59 1.41l10.59 10.59a2 2 0 0 0 2.82 0l3.99-3.99a2 2 0 0 0 0-2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>`,
        studyChat: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
            <path d="M8 10h8"/>
            <path d="M8 14h5"/>
        </svg>`,
        externalLink: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h6v6"/>
            <path d="M10 14 21 3"/>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        </svg>`
    };

    // Remove the leading "Từ hôm nay..." sentence so the partner card sits closer to the hero subtitle.
    const mainDescriptionTextRaw = celebrationData?.mainDescription ?? '';
    const mainDescriptionText = typeof mainDescriptionTextRaw === 'string'
        ? mainDescriptionTextRaw.replace(/^Từ hôm nay,[\s\S]*?(?:\.|\!|\?|$)/i, '').trim()
        : '';

    // Create celebration modal HTML - Fullscreen, no container
    const modalHTML = `
        <div id="celebrationOverlay" class="celeb-overlay">
            <!-- Animated Background -->
            <div class="celeb-bg">
                <div class="celeb-gradient"></div>
                <div class="celeb-grid"></div>
                ${Array(30).fill().map((_, i) => `<div class="celeb-particle" style="--i: ${i}; --x: ${Math.random() * 100}%; --y: ${Math.random() * 100}%; --size: ${Math.random() * 4 + 2}px; --duration: ${Math.random() * 3 + 2}s; --delay: ${Math.random() * 2}s;"></div>`).join('')}
            </div>
            
            <!-- Content -->
            <div class="celeb-content">
                <!-- Hero Section -->
                <div class="celeb-hero">
                    <div class="celeb-hero-main">
                        <div class="celeb-icon-wrap">
                            <div class="celeb-icon-glow"></div>
                            ${svgIcons.smartphone}
                            <div class="celeb-sparkle celeb-sparkle-1">${svgIcons.sparkles}</div>
                            <div class="celeb-sparkle celeb-sparkle-2">${svgIcons.sparkles}</div>
                        </div>
                        <div class="celeb-hero-copy">
                            <div class="celeb-hero-badges" aria-hidden="true">
                                <span class="celeb-launch-pill">Mobile Access Live</span>
                                <span class="celeb-version-chip">Extension v${CELEBRATION_EXTENSION_VERSION}</span>
                            </div>
                            <h1 class="celeb-title">BIG UPDATE</h1>
                        </div>
                    </div>
                </div>
                
                <!-- Main Description -->
                ${mainDescriptionText ? `<p class="celeb-desc">${mainDescriptionText}</p>` : ''}

                <!-- Advertisement: Góc học tập landing page (top) -->
                <div class="celeb-top-cards">
                    <div class="celeb-grid-info celeb-study-card">
                        <div class="celeb-info-card celeb-info-card-study">
                            <div class="celeb-card-head celeb-desktop-only">
                                <div class="celeb-card-head-icon celeb-card-head-icon-study" aria-hidden="true">${svgIcons.studyBook}</div>
                                <div class="celeb-card-head-copy">
                                    <div class="celeb-card-head-title">Góc Học Tập</div>
                                    <div class="celeb-card-head-subtitle">Tiệm Bánh Netflix</div>
                                </div>
                            </div>
                            <div class="celeb-card-section-label celeb-desktop-only">Tài nguyên hỗ trợ</div>
                            <div class="celeb-info-summary-title celeb-info-summary-title-plain celeb-mobile-copy">
                                Góc học tập - Tiệm Bánh Netflix
                            </div>
                            <div class="celeb-info-summary-subtitle celeb-mobile-copy">Ra mắt dịch vụ hỗ trợ định dạng văn bản, tài liệu... để các bạn có thêm thời gian nghỉ ngơi, thư giãn, Netflix and chill</div>

                            <div class="celeb-info-summary-rows">
                                <div class="celeb-info-summary-row celeb-info-summary-row-link">
                                    <span class="celeb-info-icon celeb-info-icon-green" aria-hidden="true">${svgIcons.studyBook}</span>
                                    <div class="celeb-info-summary-text">
                                        <span class="celeb-info-summary-sub">Tại sao cần dịch vụ này?</span>
                                        <span class="celeb-info-summary-subtitle">Khi deadline ập đến cùng lúc</span>
                                    </div>
                                    <span class="celeb-item-arrow celeb-desktop-only" aria-hidden="true">${svgIcons.arrowRight}</span>
                                </div>

                                <div class="celeb-info-summary-row celeb-info-summary-row-link">
                                    <span class="celeb-info-icon celeb-info-icon-tv" aria-hidden="true">${svgIcons.studyTag}</span>
                                    <div class="celeb-info-summary-text">
                                        <span class="celeb-info-summary-sub">Gói dịch vụ &amp; bảng giá</span>
                                        <span class="celeb-info-summary-subtitle">Rõ ràng, không phát sinh</span>
                                    </div>
                                    <span class="celeb-item-arrow celeb-desktop-only" aria-hidden="true">${svgIcons.arrowRight}</span>
                                </div>

                                <div class="celeb-info-summary-row celeb-info-summary-row-link">
                                    <span class="celeb-info-icon celeb-info-icon-amber" aria-hidden="true">${svgIcons.studyChat}</span>
                                    <div class="celeb-info-summary-text">
                                        <span class="celeb-info-summary-sub">Quăng cái file qua đây</span>
                                        <span class="celeb-info-summary-subtitle">Rồi đứng dậy đi coi phim liền cho haiii</span>
                                    </div>
                                    <span class="celeb-item-arrow celeb-desktop-only" aria-hidden="true">${svgIcons.arrowRight}</span>
                                </div>
                            </div>

                            <div class="celeb-card-actions">
                                <a
                                    href="../study/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="celeb-download"
                                >
                                    <span class="celeb-download-icon celeb-desktop-only" aria-hidden="true">${svgIcons.check}</span>
                                    <span>Ghé qua góc học tập</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    <!-- Partner block (Lunakey / Lunasub) -->
                    <div class="celeb-partner-card" id="celebPartnerCard">
                    <div class="celeb-partner-header">
                        <div class="celeb-partner-left">
                            <div class="celeb-partner-icon-wrap">
                                <div class="celeb-partner-icon-bg"></div>
                                <div class="celeb-partner-icon">${svgIcons.partner}</div>
                            </div>
                            <div class="celeb-partner-heading">
                                <div class="celeb-partner-title-row">
                                    <span class="celeb-partner-title-main">LUNAKEY &amp; LUNASUB</span>
                                    <span class="celeb-partner-badge-dot"></span>
                                </div>
                                <div class="celeb-partner-subline">
                                    <span class="celeb-partner-title-sub">Đối tác tài khoản số &amp; tăng tương tác uy tín, được Tiệm Bánh tin dùng và giới thiệu.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="celeb-partner-body">
                        <div class="celeb-partner-col celeb-partner-col-left">
                            <button class="celeb-partner-col-header celeb-partner-btn" type="button" data-partner="lunakey" aria-label="Mở Lunakey.net (tab mới)">
                                <span class="celeb-partner-col-title-stack">
                                    <span class="celeb-partner-col-title">LunaKey.net</span>
                                    <span class="celeb-partner-col-subtitle">Tài khoản giá rẻ, chất lượng cao</span>
                                </span>
                                <span class="celeb-partner-btn-icon" aria-hidden="true">${svgIcons.externalLink}<span class="celeb-partner-btn-label celeb-desktop-only">Truy cập</span></span>
                            </button>
                            <div class="celeb-partner-tag-grid">
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.tv}</span>
                                    <span>Netflix</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.play}</span>
                                    <span>YouTube</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.briefcase}</span>
                                    <span>Gmail</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.puzzle}</span>
                                    <span>ChatGPT</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.music}</span>
                                    <span>Spotify</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.tv}</span>
                                    <span>HBO Max</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.puzzle}</span>
                                    <span>Canva</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.sparkles}</span>
                                    <span>+10 nữa</span>
                                </span>
                            </div>
                        </div>

                        <div class="celeb-partner-col celeb-partner-col-right">
                            <button class="celeb-partner-col-header celeb-partner-btn" type="button" data-partner="lunasub" aria-label="Mở Lunasub.com (tab mới)">
                                <span class="celeb-partner-col-title-stack">
                                    <span class="celeb-partner-col-title">LunaSub.com</span>
                                    <span class="celeb-partner-col-subtitle">Dịch vụ tăng tương tác chất lượng cao</span>
                                </span>
                                <span class="celeb-partner-btn-icon" aria-hidden="true">${svgIcons.externalLink}<span class="celeb-partner-btn-label celeb-desktop-only">Truy cập</span></span>
                            </button>
                            <div class="celeb-partner-tag-grid">
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.sparkles}</span>
                                    <span>Follow</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.bell}</span>
                                    <span>Comment</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.tv}</span>
                                    <span>View</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.arrowRight}</span>
                                    <span>Share</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.music}</span>
                                    <span>TikTok</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.sparkles}</span>
                                    <span>Instagram</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.play}</span>
                                    <span>YouTube</span>
                                </span>
                                <span class="celeb-partner-tag">
                                    <span class="celeb-partner-tag-icon">${svgIcons.briefcase}</span>
                                    <span>Facebook</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="celeb-partner-trust-row">
                        <div class="celeb-partner-trust-item">
                            <span class="celeb-partner-trust-icon">${svgIcons.check}</span>
                            <span>Uy tín</span>
                        </div>
                        <div class="celeb-partner-trust-item">
                            <span class="celeb-partner-trust-icon">${svgIcons.check}</span>
                            <span>An toàn</span>
                        </div>
                        <div class="celeb-partner-trust-item">
                            <span class="celeb-partner-trust-icon">${svgIcons.check}</span>
                            <span>Chất lượng</span>
                        </div>
                    </div>
                    </div>
                    <!-- Single feature card: App + TV + các cập nhật khác -->
                    <div class="celeb-grid-info celeb-message-card">
                    <div class="celeb-info-card celeb-info-card-summary">
                        <div class="celeb-card-head celeb-desktop-only">
                            <div class="celeb-card-head-icon" aria-hidden="true">${svgIcons.studyChat}</div>
                            <div class="celeb-card-head-copy">
                                <div class="celeb-card-head-title">Thông Điệp</div>
                                <div class="celeb-card-head-subtitle">Từ Tiệm Bánh</div>
                            </div>
                        </div>
                        <div class="celeb-card-section-label celeb-desktop-only">Tính năng mới</div>
                        <div class="celeb-info-summary-title celeb-info-summary-title-plain celeb-mobile-copy">THÔNG ĐIỆP TỪ TIỆM BÁNH</div>
                        <div class="celeb-info-summary-rows">
                            <div class="celeb-info-summary-row celeb-info-summary-row-link celeb-info-summary-row-message">
                                <span class="celeb-info-icon celeb-info-icon-message" aria-hidden="true">${svgIcons.smartphone}</span>
                                <div class="celeb-info-summary-text">
                                    <span class="celeb-info-summary-sub">Xem Netflix trên điện thoại</span>
                                    <span class="celeb-info-summary-subtitle">Với chức năng Tạo link đăng nhập.</span>
                                </div>
                                <span class="celeb-item-arrow celeb-desktop-only" aria-hidden="true">${svgIcons.arrowRight}</span>
                            </div>

                            <div class="celeb-info-summary-row celeb-info-summary-row-link celeb-info-summary-row-message">
                                <span class="celeb-info-icon celeb-info-icon-tv" aria-hidden="true">${svgIcons.tv}</span>
                                <div class="celeb-info-summary-text">
                                    <span class="celeb-info-summary-sub">Kích hoạt Netflix TV bằng điện thoại</span>
                                    <span class="celeb-info-summary-subtitle">Không cần dùng PC, nhanh chóng, tiện lợi.</span>
                                </div>
                                <span class="celeb-item-arrow celeb-desktop-only" aria-hidden="true">${svgIcons.arrowRight}</span>
                            </div>

                            <div class="celeb-info-summary-row celeb-info-summary-row-link celeb-info-summary-row-message">
                                <span class="celeb-info-icon celeb-info-icon-ctv" aria-hidden="true">${svgIcons.briefcase}</span>
                                <div class="celeb-info-summary-text">
                                    <span class="celeb-info-summary-sub">Chương trình CTV Tiệm Bánh Netflix</span>
                                    <span class="celeb-info-summary-subtitle">Resell dịch vụ Tiệm Bánh, có API để build web/bot.</span>
                                </div>
                                <span class="celeb-item-arrow celeb-desktop-only" aria-hidden="true">${svgIcons.arrowRight}</span>
                            </div>
                        </div>
                    </div>

                </div>
                
                <!-- Close desktop grid wrapper -->
                </div>
                
                <!-- CTA Button -->
                <div class="celeb-cta-panel">
                    <div class="celeb-cta-copy celeb-desktop-only">
                        <h2>Sẵn sàng trải nghiệm?</h2>
                        <p>Khám phá ngay phương thức giải trí chất lượng cao với chi phí tối ưu từ Tiệm Bánh Netflix.</p>
                    </div>
                    <button id="celebrationBtn" class="celeb-btn" disabled>
                        <span class="celeb-btn-text">Đợi một chút...</span>
                        <span class="celeb-btn-countdown"></span>
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            .celeb-overlay {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 40px 20px;
                -webkit-overflow-scrolling: touch;
            }
            
            /* Animated Background */
            .celeb-bg {
                position: fixed;
                inset: 0;
                background: #0a0a0f;
                overflow: hidden;
                pointer-events: none;
            }
            
            .celeb-gradient {
                position: absolute;
                inset: 0;
                background: 
                    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(229, 9, 20, 0.15) 0%, transparent 50%),
                    radial-gradient(ellipse 60% 40% at 80% 50%, rgba(138, 43, 226, 0.1) 0%, transparent 50%),
                    radial-gradient(ellipse 60% 40% at 20% 80%, rgba(0, 200, 255, 0.08) 0%, transparent 50%);
            }
            
            .celeb-grid {
                position: absolute;
                inset: 0;
                background-image: 
                    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
                background-size: 60px 60px;
                mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 70%);
            }

            /* Partner popup card */
            .celeb-partner-card {
                display: flex;
                flex-direction: column;
                gap: 14px;
                margin: 10px 0 6px;
                padding: 16px 16px 14px;
                border-radius: 18px;
                background:
                    linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.98)),
                    radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 55%),
                    radial-gradient(circle at bottom right, rgba(236,72,153,0.18), transparent 55%);
                border: 1px solid rgba(148,163,184,0.35);
                box-shadow:
                    0 18px 45px rgba(15,23,42,0.9),
                    0 0 0 1px rgba(15,23,42,0.9),
                    0 0 0 1px rgba(15,23,42,0.9) inset;
                position: relative;
                overflow: hidden;
            }

            .celeb-partner-card::before {
                content: "";
                position: absolute;
                inset: -40%;
                background:
                    radial-gradient(circle at 0% 0%, rgba(56,189,248,0.14), transparent 60%),
                    radial-gradient(circle at 100% 100%, rgba(249,115,22,0.18), transparent 60%);
                opacity: 0.9;
                pointer-events: none;
            }

            .celeb-partner-header {
                position: relative;
                z-index: 1;
                display: flex;
                justify-content: space-between;
                gap: 16px;
                align-items: center;
            }

            .celeb-partner-left {
                position: relative;
                z-index: 1;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .celeb-partner-icon-wrap {
                position: relative;
                width: 64px;
                height: 64px;
                border-radius: 18px;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 12px 30px rgba(15,23,42,0.95);
            }

            .celeb-partner-icon-bg {
                position: absolute;
                inset: 0;
                background:
                    radial-gradient(circle at 0% 0%, rgba(56,189,248,0.35), transparent 55%),
                    radial-gradient(circle at 100% 100%, rgba(236,72,153,0.45), transparent 55%);
                opacity: 0.9;
            }

            .celeb-partner-icon {
                position: relative;
                color: #e5e7eb;
                filter: drop-shadow(0 8px 24px rgba(15,23,42,0.9));
            }

            .celeb-partner-heading {
                position: relative;
                z-index: 1;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .celeb-partner-title-row {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 0.8rem;
            }

            .celeb-partner-title-main {
                font-weight: 800;
                letter-spacing: 0.08em;
                font-size: 0.85rem;
                color: #e5e7eb;
            }

            .celeb-partner-badge-dot {
                width: 8px;
                height: 8px;
                border-radius: 999px;
                background: #22c55e;
                box-shadow: 0 0 0 6px rgba(34,197,94,0.25);
            }

            .celeb-partner-subline {
                max-width: 360px;
            }

            .celeb-partner-title-sub {
                font-size: 0.78rem;
                font-weight: 500;
                color: rgba(209,213,219,0.9);
            }

            .celeb-partner-btn {
                cursor: pointer;
                border: 0;
                background: transparent;
                padding: 0;
                color: inherit;
                text-align: left;
            }

            .celeb-partner-btn:hover .celeb-partner-col-title {
                text-decoration: underline;
            }

            .celeb-partner-btn-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                opacity: 0.92;
                position: absolute;
                        /* Keep corner icon inside the card so it won't overlap/break layout */
                        top: 6px;
                        right: 6px;
                z-index: 10;
                pointer-events: none; /* keep button click behavior */
            }

            .celeb-partner-btn-icon svg {
                width: 16px;
                height: 16px;
            }

            .celeb-partner-body {
                position: relative;
                z-index: 1;
                display: grid;
                grid-template-columns: 1fr;
                gap: 10px;
            }

            .celeb-partner-col {
                border-radius: 14px;
                padding: 10px 10px 8px;
                background: radial-gradient(circle at top left, rgba(37,99,235,0.35), rgba(15,23,42,0.96));
                border: 1px solid rgba(96,165,250,0.6);
                position: relative; /* anchor absolutely-positioned icons */
            }

            .celeb-partner-col-right {
                background: radial-gradient(circle at top left, rgba(219,39,119,0.4), rgba(15,23,42,0.96));
                border-color: rgba(244,114,182,0.7);
            }

            .celeb-partner-col-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 6px;
                gap: 6px;
                width: 100%;
                        padding-right: 22px; /* leave room for the corner icon overlay */
            }

            .celeb-partner-col-title {
                font-size: 0.75rem;
                font-weight: 700;
                letter-spacing: 0.09em;
                text-transform: uppercase;
                color: #e5e7eb;
            }

            .celeb-partner-col-title-stack {
                display: inline-flex;
                flex-direction: column;
                gap: 2px;
                line-height: 1.15;
            }

            .celeb-partner-col-subtitle {
                font-size: 0.65rem;
                font-weight: 600;
                color: rgba(209,213,219,0.92);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                        max-width: 220px;
            }

            .celeb-partner-col-pill {
                padding: 2px 8px;
                border-radius: 999px;
                font-size: 0.6rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                background: #f97316;
                color: #111827;
                box-shadow: 0 0 0 1px rgba(15,23,42,0.9);
            }

            .celeb-partner-tag-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 6px;
                margin-bottom: 6px;
            }

            .celeb-partner-tag {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                padding: 4px 6px;
                border-radius: 999px;
                font-size: 0.7rem;
                font-weight: 600;
                background: rgba(15,23,42,0.86);
                color: rgba(249,250,251,0.94);
                border: 1px solid rgba(148,163,184,0.55);
                white-space: nowrap;
            }

            .celeb-partner-tag-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-right: 4px;
            }

            .celeb-partner-tag-icon svg {
                width: 14px;
                height: 14px;
            }

            .celeb-partner-trust-row {
                position: relative;
                z-index: 1;
                margin-top: 6px;
                padding-top: 0;
                border-top: 0;
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-size: 0.7rem;
                color: #22c55e;
            }

            .celeb-partner-trust-item {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 3px 8px;
                border-radius: 999px;
                background: rgba(34,197,94,0.12);
                border: 1px solid rgba(34,197,94,0.35);
            }

            .celeb-partner-trust-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                border-radius: 999px;
                background: linear-gradient(135deg, #22c55e, #16a34a);
                color: #ffffff;
                box-shadow: 0 10px 22px rgba(34,197,94,0.22);
            }

            .celeb-partner-trust-icon svg {
                width: 12px;
                height: 12px;
            }

            .celeb-partner-trust-separator {
                width: 8px;
                height: 1px;
                background: rgba(148,163,184,0.7);
                border-radius: 999px;
            }

            .celeb-partner-cta-row {
                position: relative;
                z-index: 1;
                margin-top: 2px;
            }

            .celeb-partner-cta-btn {
                width: 100%;
                border-radius: 999px;
                padding: 9px 14px;
                border: none;
                outline: none;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                background: linear-gradient(90deg, #6366f1, #ec4899);
                box-shadow:
                    0 14px 35px rgba(79,70,229,0.7),
                    0 0 0 1px rgba(15,23,42,0.95);
                color: #f9fafb;
                font-weight: 800;
                font-size: 0.78rem;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
            }

            .celeb-partner-cta-btn:hover {
                transform: translateY(-1px);
                box-shadow:
                    0 18px 40px rgba(79,70,229,0.85),
                    0 0 0 1px rgba(15,23,42,0.95);
                filter: brightness(1.05);
            }

            .celeb-partner-cta-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .celeb-partner-cta-text {
                white-space: nowrap;
            }

            .celeb-partner-secondary-row {
                position: relative;
                z-index: 1;
            }

            .celeb-partner-secondary-btn {
                width: 100%;
                border-radius: 999px;
                padding: 7px 12px;
                border: 1px solid rgba(148,163,184,0.55);
                background: rgba(15,23,42,0.92);
                color: rgba(229,231,235,0.96);
                font-size: 0.72rem;
                font-weight: 600;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
            }

            .celeb-partner-secondary-btn:hover {
                background: rgba(15,23,42,1);
                border-color: rgba(209,213,219,0.9);
                transform: translateY(-0.5px);
            }

            .celeb-partner-secondary-text {
                white-space: nowrap;
            }

            .celeb-partner-footer {
                position: relative;
                z-index: 1;
                margin-top: 2px;
                font-size: 0.65rem;
                letter-spacing: 0.26em;
                text-transform: uppercase;
                color: rgba(148,163,184,0.9);
                text-align: center;
                opacity: 0.9;
            }

            .celeb-info-card-summary {
                margin-top: 8px;
            }

            .celeb-info-icon svg {
                width: 18px;
                height: 18px;
            }

            .celeb-info-icon-green {
                background: rgba(34, 197, 94, 0.12);
                color: #4ade80;
            }

            .celeb-info-icon-tv {
                background: rgba(59, 130, 246, 0.12);
                color: #60a5fa;
            }

            .celeb-info-summary-rows {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .celeb-info-summary-row {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }

            .celeb-info-summary-text {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 2px;
                min-width: 0;
                flex: 1 1 auto;
            }

            .celeb-info-summary-sub {
                font-size: 0.92rem;
                font-weight: 700;
                color: rgba(229, 231, 235, 0.95);
                line-height: 1.25;
                white-space: normal;
                overflow: visible;
                text-overflow: clip;
                flex: 0 0 auto;
                min-width: 0;
                overflow-wrap: anywhere;
                word-break: break-word;
            }

            .celeb-info-summary-subtitle {
                font-size: 0.78rem;
                color: rgba(209, 213, 219, 0.7);
                line-height: 1.35;
                white-space: normal;
                overflow: visible;
                text-overflow: clip;
                flex: 0 0 auto;
                min-width: 0;
                overflow-wrap: anywhere;
                word-break: break-word;
            }
            
            /* Only the card-level subtitle (div), not the row-level subtitle (span) */
            div.celeb-info-summary-subtitle {
                margin-bottom: 16px;
            }
            
            .celeb-particle {
                position: absolute;
                width: var(--size);
                height: var(--size);
                left: var(--x);
                top: var(--y);
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                animation: celeb-float var(--duration) ease-in-out infinite;
                animation-delay: var(--delay);
            }
            
            @keyframes celeb-float {
                0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
                50% { transform: translateY(-20px) scale(1.2); opacity: 0.6; }
            }
            
            /* Content */
            .celeb-content {
                position: relative;
                z-index: 1;
                max-width: 600px;
                width: 100%;
                margin: auto 0;
                animation: celeb-fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .celeb-top-cards {
                display: block; /* Mobile stays unchanged */
            }

            .celeb-hero-main {
                display: block;
            }

            .celeb-hero-copy {
                display: block;
            }

            .celeb-desktop-only,
            .celeb-hero-badges,
            .celeb-hero-signals,
            .celeb-card-kicker,
            .celeb-partner-chip-row {
                display: none;
            }

            .celeb-info-card-study {
                background: linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(59,130,246,0.08) 100%);
                border: 1px solid rgba(16,185,129,0.40);
            }

            .celeb-info-summary-title-plain {
                background: transparent;
                border: none;
                padding: 0;
                margin-bottom: 10px;
            }

            .celeb-card-actions {
                margin-top: 14px;
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                align-items: center;
            }

            @media (min-width: 601px) {
                .celeb-content {
                    max-width: 1160px;
                    padding: 42px 40px 34px;
                    border-radius: 34px;
                    background:
                        linear-gradient(180deg, rgba(8, 11, 18, 0.94) 0%, rgba(7, 10, 16, 0.88) 100%);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow:
                        0 38px 90px rgba(2, 6, 23, 0.62),
                        inset 0 1px 0 rgba(255, 255, 255, 0.04);
                    overflow: hidden;
                    backdrop-filter: blur(18px);
                }

                .celeb-content::before,
                .celeb-content::after {
                    content: "";
                    position: absolute;
                    pointer-events: none;
                }

                .celeb-content::before {
                    inset: 0;
                    background:
                        radial-gradient(circle at 0% 0%, rgba(239, 68, 68, 0.16), transparent 28%),
                        radial-gradient(circle at 100% 0%, rgba(59, 130, 246, 0.12), transparent 30%),
                        linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 20%);
                    opacity: 0.9;
                }

                .celeb-content::after {
                    top: 0;
                    left: 38px;
                    right: 38px;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(248, 250, 252, 0.45), transparent);
                }

                .celeb-content > * {
                    position: relative;
                    z-index: 1;
                }

                .celeb-top-cards {
                    display: grid;
                    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
                    grid-template-areas:
                        "study partner"
                        "message partner";
                    column-gap: 24px;
                    row-gap: 24px;
                    align-items: stretch;
                    margin-bottom: 32px;
                }

                .celeb-study-card {
                    grid-area: study;
                }

                .celeb-message-card {
                    grid-area: message;
                }

                .celeb-top-cards > .celeb-grid-info {
                    margin-bottom: 0;
                }

                .celeb-top-cards > .celeb-partner-card {
                    margin: 0;
                    grid-area: partner;
                }

                .celeb-hero {
                    text-align: left;
                    margin-bottom: 0;
                }

                .celeb-hero-main {
                    display: grid;
                    grid-template-columns: 144px minmax(0, 1fr);
                    gap: 26px;
                    align-items: center;
                }

                .celeb-hero-copy {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    min-width: 0;
                }

                .celeb-hero-badges {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 16px;
                }

                .celeb-launch-pill,
                .celeb-version-chip {
                    display: inline-flex;
                    align-items: center;
                    min-height: 34px;
                    padding: 0 14px;
                    border-radius: 999px;
                    font-size: 0.72rem;
                    font-weight: 800;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    backdrop-filter: blur(12px);
                }

                .celeb-launch-pill {
                    color: #ffe4e6;
                    background: rgba(225, 29, 72, 0.18);
                    border: 1px solid rgba(251, 113, 133, 0.32);
                    box-shadow: 0 12px 28px rgba(225, 29, 72, 0.18);
                }

                .celeb-version-chip {
                    color: rgba(226, 232, 240, 0.9);
                    background: rgba(15, 23, 42, 0.72);
                    border: 1px solid rgba(148, 163, 184, 0.22);
                }

                .celeb-icon-wrap {
                    width: 132px;
                    height: 132px;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 34px;
                    background:
                        radial-gradient(circle at 30% 20%, rgba(248, 113, 113, 0.25), transparent 40%),
                        linear-gradient(180deg, rgba(17, 24, 39, 0.96), rgba(10, 14, 22, 0.88));
                    border: 1px solid rgba(248, 113, 113, 0.18);
                    box-shadow:
                        0 28px 50px rgba(2, 6, 23, 0.5),
                        inset 0 1px 0 rgba(255, 255, 255, 0.05);
                }

                .celeb-icon-wrap > svg {
                    width: 94px;
                    height: 94px;
                }

                .celeb-icon-glow {
                    inset: -24px;
                }

                .celeb-sparkle-1 {
                    top: -12px;
                    right: -20px;
                }

                .celeb-sparkle-2 {
                    bottom: -4px;
                    left: -22px;
                }

                .celeb-title {
                    font-size: clamp(3.8rem, 6vw, 5.25rem);
                    line-height: 0.92;
                    margin: 0 0 12px 0;
                }

                .celeb-subtitle {
                    font-size: 1.32rem;
                    line-height: 1.45;
                    max-width: 42rem;
                }

                .celeb-desc {
                    text-align: left;
                    font-size: 0.98rem;
                    max-width: 48rem;
                    margin: 12px 0 24px 170px;
                    color: rgba(226, 232, 240, 0.66);
                }

                .celeb-hero-signals {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 14px;
                    margin: 0 0 28px 170px;
                }

                .celeb-hero-signal {
                    min-height: 124px;
                    padding: 16px 18px;
                    border-radius: 22px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background:
                        linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(9, 14, 24, 0.68));
                    box-shadow:
                        inset 0 1px 0 rgba(255, 255, 255, 0.04),
                        0 16px 36px rgba(2, 6, 23, 0.26);
                }

                .celeb-hero-signal-phone {
                    border-color: rgba(248, 113, 113, 0.2);
                }

                .celeb-hero-signal-tv {
                    border-color: rgba(96, 165, 250, 0.2);
                }

                .celeb-hero-signal-ecosystem {
                    border-color: rgba(52, 211, 153, 0.2);
                }

                .celeb-hero-signal-label {
                    display: inline-block;
                    margin-bottom: 10px;
                    font-size: 0.68rem;
                    font-weight: 800;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    color: rgba(248, 250, 252, 0.56);
                }

                .celeb-hero-signal-title {
                    display: block;
                    margin-bottom: 8px;
                    font-size: 1.02rem;
                    line-height: 1.35;
                    color: rgba(248, 250, 252, 0.98);
                }

                .celeb-hero-signal-copy {
                    display: block;
                    font-size: 0.83rem;
                    line-height: 1.55;
                    color: rgba(203, 213, 225, 0.72);
                }

                .celeb-info-card,
                .celeb-partner-card {
                    border-radius: 28px;
                }

                .celeb-info-card {
                    padding: 26px 24px 22px;
                    background: linear-gradient(180deg, rgba(11, 15, 23, 0.92), rgba(8, 12, 19, 0.86));
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow:
                        0 22px 54px rgba(2, 6, 23, 0.32),
                        inset 0 1px 0 rgba(255, 255, 255, 0.03);
                    position: relative;
                    overflow: hidden;
                }

                .celeb-info-card::before {
                    content: "";
                    position: absolute;
                    top: 0;
                    left: 22px;
                    right: 22px;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.24), transparent);
                }

                .celeb-info-card-study {
                    background:
                        radial-gradient(circle at 0% 0%, rgba(16, 185, 129, 0.16), transparent 42%),
                        linear-gradient(180deg, rgba(8, 19, 20, 0.96), rgba(11, 18, 28, 0.9));
                    border-color: rgba(52, 211, 153, 0.26);
                    box-shadow:
                        0 22px 54px rgba(6, 78, 59, 0.18),
                        inset 0 1px 0 rgba(255, 255, 255, 0.03);
                }

                .celeb-info-card.celeb-info-card-summary {
                    background:
                        radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.2), transparent 38%),
                        linear-gradient(180deg, rgba(17, 24, 39, 0.96), rgba(14, 18, 32, 0.9));
                    border-color: rgba(96, 165, 250, 0.22);
                    box-shadow:
                        0 22px 54px rgba(30, 64, 175, 0.18),
                        inset 0 1px 0 rgba(255, 255, 255, 0.03);
                    margin-top: 0;
                }

                .celeb-card-kicker {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 14px;
                    padding: 7px 12px;
                    border-radius: 999px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(255, 255, 255, 0.04);
                    color: rgba(226, 232, 240, 0.78);
                    font-size: 0.7rem;
                    font-weight: 800;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }

                .celeb-card-kicker-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 16px;
                    height: 16px;
                }

                .celeb-card-kicker-icon svg {
                    width: 14px;
                    height: 14px;
                }

                .celeb-info-summary-title {
                    display: block;
                    margin-bottom: 10px;
                    font-size: 1.04rem;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }

                div.celeb-info-summary-subtitle {
                    margin-bottom: 18px;
                    max-width: 34rem;
                    font-size: 0.9rem;
                    line-height: 1.65;
                    color: rgba(226, 232, 240, 0.72);
                }

                .celeb-info-summary-rows {
                    gap: 0;
                }

                .celeb-info-summary-row {
                    gap: 14px;
                    padding: 14px 0;
                    border-top: 1px solid rgba(255, 255, 255, 0.06);
                }

                .celeb-info-summary-row:first-child {
                    padding-top: 0;
                    border-top: none;
                }

                .celeb-info-icon {
                    width: 42px;
                    height: 42px;
                    border-radius: 14px;
                    flex: 0 0 42px;
                }

                .celeb-info-icon svg {
                    width: 20px;
                    height: 20px;
                }

                .celeb-info-summary-sub {
                    font-size: 1rem;
                    line-height: 1.3;
                }

                .celeb-info-summary-subtitle {
                    font-size: 0.83rem;
                    line-height: 1.55;
                }

                .celeb-card-actions {
                    margin-top: 18px;
                }

                .celeb-download {
                    min-height: 48px;
                    padding: 0 20px;
                    border-radius: 999px;
                    font-size: 0.84rem;
                    font-weight: 700;
                    box-shadow: 0 16px 34px rgba(16, 185, 129, 0.2);
                }

                .celeb-download:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 22px 42px rgba(16, 185, 129, 0.24);
                }

                .celeb-partner-card {
                    gap: 18px;
                    padding: 24px 24px 20px;
                    background:
                        linear-gradient(180deg, rgba(10, 14, 24, 0.96), rgba(11, 16, 29, 0.94)),
                        radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 55%),
                        radial-gradient(circle at bottom right, rgba(236,72,153,0.18), transparent 55%);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    box-shadow:
                        0 30px 70px rgba(2, 6, 23, 0.5),
                        inset 0 1px 0 rgba(255, 255, 255, 0.04);
                }

                .celeb-partner-card::before {
                    inset: 0;
                    background:
                        radial-gradient(circle at 0% 0%, rgba(56,189,248,0.15), transparent 44%),
                        radial-gradient(circle at 100% 100%, rgba(249,115,22,0.15), transparent 44%);
                    opacity: 1;
                }

                .celeb-partner-header {
                    align-items: flex-start;
                }

                .celeb-partner-left {
                    gap: 16px;
                }

                .celeb-partner-icon-wrap {
                    width: 72px;
                    height: 72px;
                    border-radius: 24px;
                }

                .celeb-partner-heading {
                    gap: 8px;
                }

                .celeb-partner-title-row {
                    gap: 10px;
                }

                .celeb-partner-title-main {
                    font-size: 0.96rem;
                    letter-spacing: 0.14em;
                }

                .celeb-partner-subline {
                    max-width: none;
                }

                .celeb-partner-title-sub {
                    font-size: 0.88rem;
                    line-height: 1.65;
                    color: rgba(226, 232, 240, 0.82);
                }

                .celeb-partner-chip-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 2px;
                }

                .celeb-partner-chip {
                    display: inline-flex;
                    align-items: center;
                    min-height: 30px;
                    padding: 0 12px;
                    border-radius: 999px;
                    border: 1px solid rgba(255, 255, 255, 0.09);
                    background: rgba(255, 255, 255, 0.04);
                    color: rgba(226, 232, 240, 0.76);
                    font-size: 0.73rem;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                }

                .celeb-partner-body {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 14px;
                }

                .celeb-partner-col {
                    padding: 14px 14px 12px;
                    border-radius: 22px;
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
                }

                .celeb-partner-col-header {
                    margin-bottom: 10px;
                    gap: 8px;
                    padding-right: 28px;
                }

                .celeb-partner-col-title {
                    font-size: 0.82rem;
                    letter-spacing: 0.12em;
                }

                .celeb-partner-col-subtitle {
                    max-width: none;
                    font-size: 0.7rem;
                    line-height: 1.45;
                }

                .celeb-partner-btn-icon {
                    top: 10px;
                    right: 10px;
                }

                .celeb-partner-tag-grid {
                    gap: 8px;
                    margin-bottom: 0;
                }

                .celeb-partner-tag {
                    min-height: 32px;
                    padding: 0 10px;
                    font-size: 0.76rem;
                    background: rgba(6, 11, 20, 0.72);
                    border-color: rgba(255, 255, 255, 0.12);
                }

                .celeb-partner-tag-icon {
                    margin-right: 6px;
                }

                .celeb-partner-trust-row {
                    justify-content: flex-start;
                    gap: 10px;
                    margin-top: 2px;
                }

                .celeb-partner-trust-item {
                    min-height: 34px;
                    padding: 0 12px;
                }

                .celeb-btn {
                    width: 100%;
                    max-width: none;
                    min-height: 62px;
                    margin: 0;
                    padding: 0 24px;
                    border-radius: 22px;
                    font-size: 0.98rem;
                    font-weight: 700;
                    color: rgba(236, 253, 245, 0.96);
                    background: linear-gradient(90deg, rgba(4, 120, 87, 0.9), rgba(22, 163, 74, 0.82));
                    border-color: rgba(74, 222, 128, 0.3);
                    box-shadow:
                        0 24px 50px rgba(6, 95, 70, 0.22),
                        inset 0 1px 0 rgba(255, 255, 255, 0.04);
                }

                .celeb-btn:disabled {
                    color: rgba(187, 247, 208, 0.86);
                    background: linear-gradient(90deg, rgba(4, 28, 21, 0.95), rgba(5, 46, 22, 0.9));
                    border-color: rgba(74, 222, 128, 0.2);
                    opacity: 1;
                }

                .celeb-btn:not(:disabled):hover {
                    transform: translateY(-2px);
                    background: linear-gradient(90deg, rgba(5, 150, 105, 0.96), rgba(22, 163, 74, 0.92));
                    box-shadow:
                        0 28px 56px rgba(6, 95, 70, 0.28),
                        inset 0 1px 0 rgba(255, 255, 255, 0.04);
                }

                .celeb-btn-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 30px;
                    height: 30px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.08);
                }

                .celeb-btn-countdown {
                    font-weight: 600;
                    opacity: 0.92;
                }
            }
            
            @keyframes celeb-fadeIn {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            /* Hero */
            .celeb-hero {
                text-align: center;
                margin-bottom: 32px;
            }
            
            .celeb-icon-wrap {
                position: relative;
                display: inline-block;
                margin-bottom: 24px;
            }
            
            .celeb-icon-glow {
                position: absolute;
                inset: -20px;
                background: radial-gradient(circle, rgba(229, 9, 20, 0.3) 0%, transparent 70%);
                animation: celeb-pulse 2s ease-in-out infinite;
            }
            
            @keyframes celeb-pulse {
                0%, 100% { transform: scale(1); opacity: 0.5; }
                50% { transform: scale(1.2); opacity: 0.8; }
            }
            
            .celeb-sparkle {
                position: absolute;
                color: #ffd700;
                animation: celeb-sparkle 2s ease-in-out infinite;
            }
            
            .celeb-sparkle-1 { top: -15px; right: -25px; animation-delay: 0s; }
            .celeb-sparkle-2 { bottom: 0; left: -30px; animation-delay: 1s; }
            
            @keyframes celeb-sparkle {
                0%, 100% { opacity: 0.3; transform: scale(0.8) rotate(0deg); }
                50% { opacity: 1; transform: scale(1.1) rotate(10deg); }
            }
            
            .celeb-title {
                font-size: clamp(2.5rem, 8vw, 4rem);
                font-weight: 900;
                letter-spacing: -0.02em;
                margin: 0 0 8px 0;
                background: linear-gradient(135deg, #fff 0%, #e50914 50%, #ff6b6b 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .celeb-subtitle {
                font-size: clamp(1.1rem, 3vw, 1.4rem);
                font-weight: 500;
                color: rgba(255, 255, 255, 0.9);
                margin: 0;
            }
            
            .celeb-desc {
                text-align: center;
                font-size: 1rem;
                color: rgba(255, 255, 255, 0.6);
                margin: 0 0 32px 0;
                line-height: 1.6;
            }
            
            /* App Login Hero Feature - nổi bật nhất */
            .celeb-app-login-hero {
                position: relative;
                text-align: center;
                padding: 28px 24px;
                margin-bottom: 24px;
                border-radius: 16px;
                background: linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(16, 185, 129, 0.06) 100%);
                border: 1px solid rgba(34, 197, 94, 0.35);
                overflow: hidden;
            }

            .celeb-app-login-hero::before {
                content: '';
                position: absolute;
                inset: 0;
                background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34, 197, 94, 0.15) 0%, transparent 60%);
                pointer-events: none;
            }

            .celeb-app-login-badge {
                display: inline-block;
                padding: 3px 12px;
                border-radius: 20px;
                font-size: 0.65rem;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #fff;
                background: linear-gradient(135deg, #22c55e, #16a34a);
                margin-bottom: 16px;
                animation: celeb-badge-pulse 2s ease-in-out infinite;
            }

            @keyframes celeb-badge-pulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
                50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
            }

            .celeb-app-login-icon {
                color: #22c55e;
                margin-bottom: 12px;
            }

            .celeb-app-login-title {
                font-size: 1.25rem;
                font-weight: 700;
                color: #4ade80;
                margin: 0 0 10px 0;
            }

            .celeb-app-login-desc {
                font-size: 0.88rem;
                color: rgba(255, 255, 255, 0.7);
                line-height: 1.6;
                margin: 0 0 20px 0;
                max-width: 420px;
                margin-left: auto;
                margin-right: auto;
            }

            .celeb-app-login-steps {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                flex-wrap: wrap;
            }

            .celeb-app-login-step {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 14px;
                border-radius: 20px;
                background: rgba(34, 197, 94, 0.1);
                border: 1px solid rgba(34, 197, 94, 0.25);
                font-size: 0.8rem;
                color: #d1d5db;
                font-weight: 500;
                white-space: nowrap;
            }

            .celeb-app-login-step span {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #22c55e;
                color: #fff;
                font-size: 0.7rem;
                font-weight: 700;
                flex-shrink: 0;
            }

            .celeb-app-login-arrow {
                color: rgba(255, 255, 255, 0.25);
                display: flex;
                flex-shrink: 0;
            }

            .celeb-app-login-arrow svg {
                width: 16px;
                height: 16px;
            }

            /* Feature Highlight */
            .celeb-feature {
                display: flex;
                align-items: flex-start;
                gap: 16px;
                padding: 24px;
                background: linear-gradient(135deg, rgba(0, 200, 255, 0.08) 0%, rgba(138, 43, 226, 0.08) 100%);
                border: 1px solid rgba(0, 200, 255, 0.2);
                border-radius: 16px;
                margin-bottom: 24px;
            }
            
            .celeb-feature-icon {
                flex-shrink: 0;
                width: 48px;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #00c8ff 0%, #8b5cf6 100%);
                border-radius: 12px;
                color: white;
            }
            
            .celeb-feature-content h3 {
                font-size: 1.1rem;
                font-weight: 600;
                color: #00d4ff;
                margin: 0 0 6px 0;
            }
            
            .celeb-feature-content p {
                font-size: 0.9rem;
                color: rgba(255, 255, 255, 0.7);
                margin: 0;
                line-height: 1.5;
            }
            
            /* Info Grid */
            .celeb-grid-info {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 16px;
                margin-bottom: 32px;
            }

            .celeb-grid-info > .celeb-info-card:only-child {
                grid-column: 1 / -1; /* Ensure single card spans full width */
            }
            
            .celeb-info-card {
                padding: 20px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 12px;
            }
            
            .celeb-info-card.celeb-info-card-summary {
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(168, 85, 247, 0.09) 100%);
                border: 1px solid rgba(59, 130, 246, 0.40);
                box-shadow: 0 18px 45px rgba(59, 130, 246, 0.10);
                position: relative;
                overflow: hidden;
            }
            
            .celeb-info-card.celeb-info-card-summary::before {
                content: "";
                position: absolute;
                top: -60%;
                left: -40%;
                width: 180%;
                height: 160%;
                background: radial-gradient(circle at 50% 40%, rgba(96, 165, 250, 0.18), transparent 60%);
                pointer-events: none;
                transform: rotate(-8deg);
            }
            
            .celeb-info-summary-title {
                position: relative;
                z-index: 1;
                display: inline-block;
                margin: 0 0 10px 0;
                padding: 10px 14px;
                border-radius: 0px;
                font-size: 0.95rem;
                font-weight: 900;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: rgba(255, 255, 255, 0.96);
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.17) 0%, rgba(168, 85, 247, 0.08) 100%);
                border: 1px solid rgba(59, 130, 246, 0.32);
                text-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
            }
            
            .celeb-info-header {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 0.95rem;
                font-weight: 600;
                color: #a5b4fc;
                margin-bottom: 14px;
            }
            
            .celeb-info-icon {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(165, 180, 252, 0.1);
                border-radius: 8px;
                color: #a5b4fc;
            }
            
            .celeb-info-icon-amber {
                background: rgba(251, 191, 36, 0.1);
                color: #fbbf24;
            }
            
            .celeb-info-icon-ctv {
                background: rgba(251, 191, 36, 0.1);
                color: #fbbf24;
            }
            
            .celeb-info-card-ctv {
                border-color: rgba(251, 191, 36, 0.15);
                background: rgba(251, 191, 36, 0.03);
            }
            
            .celeb-download-ctv {
                background: linear-gradient(135deg, #fbbf24, #f59e0b) !important;
                color: #000 !important;
                font-weight: 700;
            }
            
            .celeb-download-ctv:hover {
                box-shadow: 0 6px 20px rgba(251, 191, 36, 0.35) !important;
            }
            
            .celeb-list {
                list-style: none;
                padding: 0;
                margin: 0 0 14px 0;
            }
            
            .celeb-list li {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.85rem;
                color: rgba(255, 255, 255, 0.7);
                padding: 6px 0;
            }
            
            .celeb-list-compact li {
                font-size: 0.8rem;
                padding: 4px 0;
            }
            
            .celeb-check {
                flex-shrink: 0;
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(16, 185, 129, 0.15);
                border-radius: 50%;
                color: #10b981;
            }
            
            .celeb-download {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 10px 18px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-size: 0.85rem;
                font-weight: 500;
                line-height: 1; /* Stabilize inline content vertical metrics */
                overflow: hidden; /* Clip any SVG stroke that may visually exceed the box */
                transition: all 0.2s ease;
            }
            
            .celeb-download:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
            }

            .celeb-download svg {
                width: 16px;
                height: 16px;
                flex-shrink: 0;
            }

            .celeb-download-arrow {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 0; /* Prevent baseline from shifting the SVG vertically */
                width: 16px;
                height: 16px;
                flex: 0 0 16px;
                padding: 0;
                margin: 0;
                overflow: hidden; /* Extra safety: keep the arrow SVG fully within its 16x16 box */
            }

            .celeb-download > span:not(.celeb-download-arrow) {
                display: inline-flex; /* So we can center the text visually within a stable height */
                align-items: center;
                min-height: 16px; /* Match arrow box height so icon centers on text */
            }

            .celeb-download-arrow svg {
                display: block; /* Remove inline baseline alignment quirks */
                width: 100%;
                height: 100%;
            }
            
            /* CTA Button */
            .celeb-btn {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 11px 16px;
                font-size: 0.8rem;
                font-weight: 600;
                color: #22c55e;
                background: rgba(34, 197, 94, 0.1);
                border: 1px solid #22c55e;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            
            .celeb-btn:disabled {
                background: rgba(34, 197, 94, 0.06);
                cursor: not-allowed;
                opacity: 0.6;
            }
            
            .celeb-btn:not(:disabled):hover {
                transform: translateY(-1px);
                background: rgba(34, 197, 94, 0.2);
                box-shadow: 0 6px 20px rgba(16, 185, 129, 0.22);
            }
            
            .celeb-btn:not(:disabled)::before {
                display: none;
            }
            
            @keyframes celeb-shimmer {
                100% { left: 100%; }
            }
            
            .celeb-btn-countdown {
                font-weight: 400;
                opacity: 0.8;
            }

            .celeb-btn svg {
                width: 14px;
                height: 14px;
                flex-shrink: 0;
            }

            @media (min-width: 601px) {
                .celeb-desktop-only {
                    display: block;
                }

                .celeb-content {
                    max-width: 1100px;
                    padding: 0;
                    border-radius: 0;
                    background: transparent;
                    border: none;
                    box-shadow: none;
                    overflow: visible;
                    backdrop-filter: none;
                }

                .celeb-content::before {
                    display: none;
                }

                .celeb-content::after {
                    display: none;
                }

                .celeb-hero {
                    text-align: left;
                    margin-bottom: 0;
                }

                .celeb-hero-main {
                    display: grid;
                    grid-template-columns: 120px minmax(0, 1fr);
                    gap: 24px;
                    align-items: center;
                }

                .celeb-hero-copy {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    min-width: 0;
                }

                .celeb-hero-badges {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 14px;
                }

                .celeb-launch-pill,
                .celeb-version-chip {
                    display: inline-flex;
                    align-items: center;
                    min-height: 36px;
                    padding: 0 15px;
                    border-radius: 999px;
                    font-size: 0.72rem;
                    font-weight: 800;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    backdrop-filter: blur(14px);
                }

                .celeb-launch-pill {
                    color: #ffe5e8;
                    background: rgba(229, 9, 20, 0.15);
                    border: 1px solid rgba(255, 97, 110, 0.24);
                }

                .celeb-version-chip {
                    color: rgba(232, 238, 248, 0.88);
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }

                .celeb-icon-wrap {
                    width: 112px;
                    height: 112px;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 22px;
                    background:
                        radial-gradient(circle at 28% 24%, rgba(255, 112, 122, 0.16), transparent 38%),
                        linear-gradient(180deg, rgba(25, 19, 30, 0.94), rgba(17, 20, 28, 0.9));
                    border: 1px solid rgba(255, 116, 126, 0.16);
                    box-shadow:
                        0 22px 42px rgba(20, 7, 12, 0.32),
                        inset 0 1px 0 rgba(255, 255, 255, 0.04);
                }

                .celeb-icon-wrap > svg {
                    width: 82px;
                    height: 82px;
                }

                .celeb-icon-glow {
                    inset: -16px;
                }

                .celeb-title {
                    font-size: clamp(3.6rem, 6vw, 5rem);
                    line-height: 0.94;
                    margin: 0 0 10px 0;
                }

                .celeb-subtitle {
                    max-width: 44rem;
                    font-size: 1.18rem;
                    line-height: 1.45;
                }

                .celeb-desc {
                    text-align: left;
                    max-width: 44rem;
                    margin: 10px 0 28px 144px;
                    font-size: 0.96rem;
                    color: rgba(225, 232, 242, 0.62);
                }

                .celeb-top-cards {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    grid-template-areas:
                        "study message"
                        "partner partner";
                    gap: 16px;
                    margin-bottom: 16px;
                    align-items: stretch;
                }

                .celeb-study-card {
                    grid-area: study;
                }

                .celeb-message-card {
                    grid-area: message;
                }

                .celeb-top-cards > .celeb-partner-card {
                    grid-area: partner;
                    margin: 0;
                }

                .celeb-mobile-copy {
                    display: none;
                }

                .celeb-info-card,
                .celeb-partner-card {
                    padding: 26px;
                    border-radius: 22px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: linear-gradient(180deg, rgba(20, 23, 33, 0.97), rgba(14, 17, 26, 0.95));
                    box-shadow:
                        0 20px 44px rgba(2, 6, 23, 0.24),
                        inset 0 1px 0 rgba(255, 255, 255, 0.03);
                    overflow: hidden;
                }

                .celeb-info-card::before,
                .celeb-partner-card::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.02), transparent 58%);
                }

                .celeb-info-card-study {
                    border-color: rgba(48, 209, 88, 0.14);
                    background:
                        radial-gradient(circle at 0% 0%, rgba(48, 209, 88, 0.07), transparent 36%),
                        linear-gradient(180deg, rgba(18, 24, 22, 0.98), rgba(12, 18, 20, 0.96));
                }

                .celeb-info-card.celeb-info-card-summary {
                    border-color: rgba(255, 107, 118, 0.14);
                    background:
                        radial-gradient(circle at 100% 0%, rgba(229, 9, 20, 0.07), transparent 34%),
                        linear-gradient(180deg, rgba(19, 22, 32, 0.98), rgba(15, 18, 28, 0.96));
                    margin-top: 0;
                }

                .celeb-card-head {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 22px;
                }

                .celeb-card-head-icon {
                    width: 40px;
                    height: 40px;
                    flex: 0 0 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    background: rgba(229, 9, 20, 0.11);
                    border: 1px solid rgba(229, 9, 20, 0.18);
                    color: #ff4b55;
                }

                .celeb-card-head-icon-study {
                    background: rgba(48, 209, 88, 0.08);
                    border-color: rgba(48, 209, 88, 0.14);
                    color: #5ee67f;
                }

                .celeb-card-head-icon svg {
                    width: 18px;
                    height: 18px;
                }

                .celeb-card-head-title {
                    font-size: 0.92rem;
                    font-weight: 700;
                    letter-spacing: -0.01em;
                }

                .celeb-card-head-subtitle {
                    margin-top: 2px;
                    font-size: 0.74rem;
                    color: rgba(255, 255, 255, 0.42);
                }

                .celeb-card-section-label {
                    display: block;
                    margin-bottom: 14px;
                    font-size: 0.67rem;
                    font-weight: 700;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.2);
                }

                .celeb-info-summary-rows {
                    gap: 0;
                }

                .celeb-info-summary-row {
                    gap: 12px;
                }

                .celeb-info-summary-row-link {
                    align-items: center;
                    padding: 12px 0;
                    border-top: 1px solid rgba(255, 255, 255, 0.07);
                    cursor: pointer;
                    position: relative;
                    border-radius: 14px;
                    transition:
                        transform 0.18s ease,
                        background-color 0.18s ease,
                        border-color 0.18s ease,
                        box-shadow 0.18s ease;
                }

                .celeb-info-summary-row-link:first-child {
                    padding-top: 0;
                    border-top: none;
                }

                .celeb-info-summary-row-link:last-child {
                    padding-bottom: 0;
                }

                .celeb-info-summary-row-link:hover {
                    transform: translateX(4px);
                    background: rgba(255, 255, 255, 0.025);
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
                }

                .celeb-info-summary-row-link:hover .celeb-item-arrow {
                    color: rgba(255, 255, 255, 0.5);
                    transform: translateX(3px);
                }

                .celeb-info-summary-row-link:hover .celeb-info-icon {
                    transform: translateY(-1px) scale(1.04);
                    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.22);
                }

                .celeb-info-icon {
                    width: 36px;
                    height: 36px;
                    flex: 0 0 36px;
                    border-radius: 10px;
                    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
                }

                .celeb-info-icon svg {
                    width: 16px;
                    height: 16px;
                }

                .celeb-info-summary-sub {
                    font-size: 0.94rem;
                    line-height: 1.32;
                }

                .celeb-info-summary-subtitle {
                    font-size: 0.76rem;
                    line-height: 1.55;
                    color: rgba(255, 255, 255, 0.46);
                    transition: color 0.18s ease;
                }

                .celeb-info-summary-row-link:hover .celeb-info-summary-sub {
                    color: rgba(255, 255, 255, 0.98);
                }

                .celeb-info-summary-row-link:hover .celeb-info-summary-subtitle {
                    color: rgba(255, 255, 255, 0.68);
                }

                .celeb-item-arrow {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: auto;
                    color: rgba(255, 255, 255, 0.2);
                    flex: 0 0 auto;
                    transition: transform 0.18s ease, color 0.18s ease;
                }

                .celeb-item-arrow svg {
                    width: 13px;
                    height: 13px;
                }

                .celeb-info-summary-row-message {
                    padding: 14px 0;
                }

                .celeb-info-summary-row-message:hover {
                    background: rgba(255, 107, 118, 0.04);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 255, 255, 0.02),
                        0 12px 28px rgba(53, 23, 39, 0.16);
                }

                .celeb-info-icon-message {
                    background: rgba(255, 75, 85, 0.1);
                    color: #ff6772;
                }

                .celeb-card-actions {
                    margin-top: 22px;
                }

                .celeb-download {
                    min-height: 44px;
                    padding: 0 16px;
                    border-radius: 9px;
                    background: rgba(48, 209, 88, 0.11);
                    border: 1px solid rgba(48, 209, 88, 0.18);
                    box-shadow: none;
                    color: #47db70;
                    font-size: 0.84rem;
                    font-weight: 700;
                }

                .celeb-download:hover {
                    transform: translateY(-1px);
                    background: rgba(48, 209, 88, 0.16);
                    box-shadow: 0 12px 26px rgba(48, 209, 88, 0.09);
                }

                .celeb-download-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 14px;
                    height: 14px;
                }

                .celeb-download-icon svg {
                    width: 14px;
                    height: 14px;
                }

                .celeb-partner-card {
                    padding: 26px;
                    border-color: rgba(255, 255, 255, 0.1);
                    background:
                        radial-gradient(circle at 0% 0%, rgba(229, 9, 20, 0.09), transparent 34%),
                        radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.08), transparent 30%),
                        linear-gradient(180deg, rgba(22, 25, 37, 0.985), rgba(16, 19, 30, 0.97));
                    box-shadow:
                        0 24px 54px rgba(2, 6, 23, 0.28),
                        inset 0 1px 0 rgba(255, 255, 255, 0.04);
                }

                .celeb-partner-card::before {
                    background:
                        linear-gradient(135deg, rgba(255, 255, 255, 0.015), transparent 56%);
                    opacity: 1;
                }

                .celeb-partner-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 16px;
                    margin-bottom: 24px;
                }

                .celeb-partner-left {
                    gap: 14px;
                }

                .celeb-partner-icon-wrap {
                    width: 52px;
                    height: 52px;
                    border-radius: 14px;
                    box-shadow: 0 14px 30px rgba(65, 32, 54, 0.2);
                }

                .celeb-partner-title-main {
                    font-size: 1.14rem;
                    font-weight: 800;
                    letter-spacing: 0.05em;
                    color: rgba(255, 255, 255, 0.97);
                }

                .celeb-partner-subline {
                    max-width: 560px;
                }

                .celeb-partner-title-sub {
                    font-size: 0.86rem;
                    line-height: 1.65;
                    color: rgba(255, 255, 255, 0.74);
                }

                .celeb-partner-trust-row {
                    justify-content: flex-end;
                    gap: 8px;
                    margin-top: 0;
                }

                .celeb-partner-trust-item {
                    min-height: 30px;
                    padding: 0 12px;
                    border-radius: 999px;
                    background: rgba(48, 209, 88, 0.08);
                    border: 1px solid rgba(48, 209, 88, 0.18);
                    color: #48dc71;
                }

                .celeb-partner-trust-icon {
                    width: 14px;
                    height: 14px;
                    background: transparent;
                    box-shadow: none;
                    color: currentColor;
                }

                .celeb-partner-trust-icon svg {
                    width: 10px;
                    height: 10px;
                }

                .celeb-partner-body {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 18px;
                }

                .celeb-partner-col {
                    padding: 18px 18px 16px;
                    border-radius: 18px;
                    background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.02));
                    border: 1px solid rgba(255, 255, 255, 0.07);
                    box-shadow:
                        inset 0 1px 0 rgba(255, 255, 255, 0.03),
                        0 16px 34px rgba(4, 8, 16, 0.18);
                }

                .celeb-partner-col-left {
                    background:
                        radial-gradient(circle at 0% 0%, rgba(90, 130, 255, 0.11), transparent 38%),
                        linear-gradient(180deg, rgba(20, 28, 54, 0.34), rgba(18, 21, 34, 0.5));
                    border-color: rgba(108, 144, 255, 0.14);
                }

                .celeb-partner-col-right {
                    background:
                        radial-gradient(circle at 0% 0%, rgba(255, 90, 130, 0.1), transparent 38%),
                        linear-gradient(180deg, rgba(54, 20, 40, 0.34), rgba(22, 20, 33, 0.5));
                    border-color: rgba(255, 124, 165, 0.14);
                }

                .celeb-partner-col-header {
                    width: 100%;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    margin-bottom: 10px;
                    padding-right: 0;
                }

                .celeb-partner-col-title {
                    font-size: 1rem;
                    font-weight: 800;
                    letter-spacing: 0.12em;
                    color: rgba(255, 255, 255, 0.98);
                }

                .celeb-partner-col-subtitle {
                    max-width: none;
                    font-size: 0.86rem;
                    color: rgba(255, 255, 255, 0.7);
                    line-height: 1.5;
                }

                .celeb-partner-btn-icon {
                    position: static;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 8px 11px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    background: rgba(255, 255, 255, 0.07);
                    opacity: 1;
                    color: rgba(255, 255, 255, 0.94);
                    transition: transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
                }

                .celeb-partner-btn:hover .celeb-partner-btn-icon {
                    transform: translateY(-1px);
                    background: rgba(255, 255, 255, 0.11);
                    border-color: rgba(255, 255, 255, 0.18);
                }

                .celeb-partner-btn-icon svg {
                    width: 12px;
                    height: 12px;
                }

                .celeb-partner-btn-label {
                    font-size: 0.67rem;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                }

                .celeb-partner-tag-grid {
                    gap: 8px;
                    margin-bottom: 0;
                }

                .celeb-partner-tag {
                    min-height: 40px;
                    padding: 0 14px;
                    border-radius: 11px;
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(255, 255, 255, 0.1);
                    font-size: 0.8rem;
                    color: rgba(255, 255, 255, 0.92);
                    transition:
                        transform 0.18s ease,
                        background-color 0.18s ease,
                        border-color 0.18s ease,
                        box-shadow 0.18s ease;
                }

                .celeb-partner-tag:hover {
                    transform: translateY(-1px);
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(255, 255, 255, 0.15);
                    box-shadow: 0 12px 26px rgba(4, 8, 16, 0.16);
                }

                .celeb-partner-tag-icon {
                    margin-right: 7px;
                    color: rgba(255, 255, 255, 0.72);
                }

                .celeb-cta-panel {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 20px;
                    margin-top: 18px;
                    padding: 28px 34px;
                    border-radius: 24px;
                    border: 1px solid rgba(229, 9, 20, 0.16);
                    background:
                        radial-gradient(circle at 0% 0%, rgba(229, 9, 20, 0.16), transparent 34%),
                        linear-gradient(135deg, rgba(46, 14, 18, 0.92), rgba(24, 8, 12, 0.96));
                    box-shadow: 0 24px 60px rgba(48, 8, 12, 0.26);
                }

                .celeb-cta-copy {
                    display: block;
                }

                .celeb-cta-copy h2 {
                    font-size: 1.55rem;
                    font-weight: 800;
                    letter-spacing: -0.03em;
                }

                .celeb-cta-copy p {
                    margin-top: 6px;
                    font-size: 0.86rem;
                    color: rgba(255, 255, 255, 0.54);
                }

                .celeb-btn {
                    width: auto;
                    min-width: 210px;
                    min-height: 48px;
                    margin: 0;
                    padding: 0 22px;
                    border-radius: 12px;
                    justify-content: center;
                    font-size: 0.92rem;
                    font-weight: 700;
                    color: #ffffff;
                    background: linear-gradient(180deg, #ff3b30, #e50914);
                    border: none;
                    box-shadow: 0 14px 36px rgba(229, 9, 20, 0.26);
                }

                .celeb-btn:disabled {
                    color: rgba(255, 255, 255, 0.82);
                    background: linear-gradient(180deg, rgba(126, 32, 36, 0.8), rgba(95, 18, 22, 0.84));
                    opacity: 1;
                }

                .celeb-btn:not(:disabled):hover {
                    transform: translateY(-1px);
                    background: linear-gradient(180deg, #ff4b41, #f3111d);
                    box-shadow: 0 18px 40px rgba(229, 9, 20, 0.3);
                }

                .celeb-btn-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.12);
                }

                .celeb-btn-countdown {
                    font-weight: 600;
                    opacity: 0.76;
                }
            }

            @media (min-width: 601px) and (max-width: 900px) {
                .celeb-content {
                    padding: 0;
                }

                .celeb-top-cards {
                    grid-template-columns: 1fr;
                    grid-template-areas:
                        "study"
                        "message"
                        "partner";
                }

                .celeb-partner-body {
                    grid-template-columns: 1fr;
                }

                .celeb-hero-main {
                    grid-template-columns: 1fr;
                    gap: 18px;
                }

                .celeb-hero-copy {
                    align-items: center;
                    text-align: center;
                }

                .celeb-desc {
                    max-width: 36rem;
                    margin-left: 0;
                    text-align: center;
                }

                .celeb-cta-panel {
                    flex-direction: column;
                    align-items: flex-start;
                    padding: 24px;
                }

                .celeb-btn {
                    width: 100%;
                }
            }
             
            /* Mobile only text - hidden on desktop */
            .celeb-mobile-only {
                display: none;
            }
            
            /* Responsive */
            @media (max-width: 600px) {
                .celeb-overlay {
                    padding: 24px 16px;
                }

                /* Remove wrapper box on mobile so spacing matches the original layout exactly */
                .celeb-top-cards {
                    display: contents;
                }

                .celeb-study-card .celeb-info-summary-title-plain,
                .celeb-message-card .celeb-info-summary-title-plain {
                    padding: 0;
                    border: none;
                    border-radius: 0;
                    background: transparent;
                    box-shadow: none;
                    text-shadow: none;
                }
                 
                .celeb-feature {
                    flex-direction: column;
                    text-align: center;
                }
                
                .celeb-feature-icon {
                    margin: 0 auto;
                }
                
                .celeb-grid-info {
                    grid-template-columns: 1fr;
                }

                .celeb-download-arrow {
                    display: none;
                }
                 
                .celeb-mobile-only {
                    display: inline;
                }

                .celeb-app-login-hero {
                    padding: 22px 16px;
                }

                .celeb-app-login-title {
                    font-size: 1.1rem;
                }

                .celeb-app-login-desc {
                    font-size: 0.82rem;
                }

                .celeb-app-login-steps {
                    gap: 6px;
                }

                .celeb-app-login-step {
                    padding: 5px 10px;
                    font-size: 0.72rem;
                }

                .celeb-app-login-arrow svg {
                    width: 12px;
                    height: 12px;
                }
            }
        </style>
    `;

    // Insert modal into DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Partner buttons: open trực tiếp Lunakey / Lunasub
    document.querySelectorAll('.celeb-partner-btn').forEach(btnEl => {
        const partner = btnEl.getAttribute('data-partner');
        if (!partner) return;
        btnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            let url = null;
            if (partner === 'lunakey') {
                url = 'https://lunakey.net';
            } else if (partner === 'lunasub') {
                url = 'https://lunasub.com';
            }
            if (url) {
                window.open(url, '_blank');
            }
        });
    });

    const btn = document.getElementById('celebrationBtn');
    let countdown = 10;

    // Update button text
    function updateBtnText() {
        if (countdown > 0) {
            btn.innerHTML = `<span class="celeb-btn-icon" aria-hidden="true">${svgIcons.arrowRight}</span><span class="celeb-btn-text">Đợi một chút...</span><span class="celeb-btn-countdown">${countdown}s</span>`;
        } else {
            btn.innerHTML = `<span class="celeb-btn-icon" aria-hidden="true">${svgIcons.arrowRight}</span><span class="celeb-btn-text">Vào Tiệm Bánh ngay</span>`;
            btn.disabled = false;
        }
    }

    updateBtnText();

    // Countdown
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            clearInterval(countdownInterval);

            // Save token after countdown
            localStorage.setItem('auth_token', token);
            localStorage.setItem('current_user', JSON.stringify(user));
            sessionStorage.setItem('logged_in', 'true');

            sessionStorage.removeItem('pending_tiembanh_token');
            sessionStorage.removeItem('pending_tiembanh_user');

            console.log('Token saved after celebration countdown');
        }
        updateBtnText();
    }, 1000);

    // Button click
    btn.onclick = () => {
        if (!btn.disabled) {
            const overlay = document.getElementById('celebrationOverlay');
            if (overlay) overlay.remove();
            document.body.style.overflow = '';
            window.open('https://s.shopee.vn/6pvewnQbSk', '_blank');
            window.location.href = '/';
        }
    };

    document.body.style.overflow = 'hidden';
}

/**
 * Show Tiệm bánh video player (fullscreen, auto-play, auto-close when ended)
 * @param {string} videoUrl - URL to the video
 * @param {string} token - Auth token to save after video ends
 * @param {Object} user - User data to save after video ends
 */
function showTiembanhVideo(videoUrl, token, user) {
    const overlay = document.getElementById('tiembanhVideoOverlay');
    const video = document.getElementById('tiembanhVideo');
    const videoSource = document.getElementById('tiembanhVideoSource');

    if (!overlay || !video || !videoSource) {
        console.error('❌ Tiệm bánh video player elements not found');
        return;
    }

    // Set video source
    videoSource.src = `${BACKEND_URL}${videoUrl}`;
    video.load(); // Reload video with new source

    // Auto-play video
    video.play().catch(err => {
        console.error('❌ Video autoplay failed:', err);
    });

    // When video ends, save token and redirect to homepage
    video.onended = () => {
        // ✅ Save token to localStorage after video ends
        localStorage.setItem('auth_token', token);
        localStorage.setItem('current_user', JSON.stringify(user));
        sessionStorage.setItem('logged_in', 'true');

        // Clear temporary storage
        sessionStorage.removeItem('pending_tiembanh_token');
        sessionStorage.removeItem('pending_tiembanh_user');

        console.log('✅ Token saved after video finished');

        closeTiembanhVideo();
        window.location.href = '/';
    };

    // Prevent right-click on video
    video.oncontextmenu = (e) => {
        e.preventDefault();
        return false;
    };

    // Prevent keyboard shortcuts (space, arrow keys, etc.)
    video.onkeydown = (e) => {
        e.preventDefault();
        return false;
    };

    // Show video overlay
    overlay.classList.add('active');

    console.log('🎬 Playing video message from Tiệm bánh');
}

/**
 * Close Tiệm bánh video player
 */
function closeTiembanhVideo() {
    const overlay = document.getElementById('tiembanhVideoOverlay');
    const video = document.getElementById('tiembanhVideo');

    if (overlay) {
        overlay.classList.remove('active');
    }

    if (video) {
        video.pause();
        video.currentTime = 0;
    }

    console.log('✅ Video message closed');
}

/**
 * Close Tiệm bánh message modal
 */
function closeTiembanhMessage() {
    const overlay = document.getElementById('tiembanhMessageOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    document.body.style.overflow = ''; // Khôi phục scroll body khi đóng modal

    // Clear countdown interval
    if (tiembanhCountdownInterval) {
        clearInterval(tiembanhCountdownInterval);
        tiembanhCountdownInterval = null;
    }
}

// ========================================
// CUSTOM MODAL DIALOG SYSTEM
// ========================================

/**
 * Show custom modal dialog
 * @param {Object} options - Modal configuration
 * @param {string} options.icon - Icon emoji (default: 'ℹ️')
 * @param {string} options.title - Modal title
 * @param {string} options.message - Modal message/content
 * @param {Array} options.buttons - Array of button objects
 */
function showModal({ icon = 'ℹ️', title = 'Thông báo', message = '', buttons = [] }) {
    const overlay = document.getElementById('customModalOverlay');
    const modalIcon = document.getElementById('customModalIcon');
    const modalTitle = document.getElementById('customModalTitle');
    const modalBody = document.getElementById('customModalBody');
    const modalFooter = document.getElementById('customModalFooter');

    // Set icon and title
    const iconMarkup = resolveAuthModalIcon(icon);
    modalIcon.innerHTML = iconMarkup;
    modalIcon.style.display = iconMarkup ? 'inline-flex' : 'none';
    modalTitle.textContent = title;

    // Set body content
    modalBody.innerHTML = `<pre>${message}</pre>`;

    // Clear and add buttons
    modalFooter.innerHTML = '';

    if (buttons.length === 0) {
        // Default OK button
        const okBtn = document.createElement('button');
        okBtn.className = 'custom-modal-btn custom-modal-btn-primary';
        okBtn.textContent = 'OK';
        okBtn.onclick = () => closeModal();
        modalFooter.appendChild(okBtn);
    } else {
        buttons.forEach(btnConfig => {
            const btn = document.createElement('button');
            btn.className = `custom-modal-btn custom-modal-btn-${btnConfig.type || 'secondary'}`;
            btn.textContent = btnConfig.text;
            btn.onclick = () => {
                if (btnConfig.onClick) btnConfig.onClick();
                closeModal();
            };
            modalFooter.appendChild(btn);
        });
    }

    // Show modal
    overlay.classList.add('active');
}

/**
 * Show confirmation modal
 * @param {Object} options - Confirmation config
 * @returns {Promise<boolean>} - Resolves to true if confirmed
 */
function showConfirmModal({ icon = '❓', title = 'Xác nhận', message = '', confirmText = 'Đồng ý', cancelText = 'Hủy' }) {
    return new Promise((resolve) => {
        showModal({
            icon,
            title,
            message,
            buttons: [
                {
                    text: cancelText,
                    type: 'secondary',
                    onClick: () => resolve(false)
                },
                {
                    text: confirmText,
                    type: 'primary',
                    onClick: () => resolve(true)
                }
            ]
        });
    });
}

/**
 * Close custom modal
 */
function closeModal() {
    const overlay = document.getElementById('customModalOverlay');
    overlay.classList.remove('active');
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const overlay = document.getElementById('customModalOverlay');
    if (e.target === overlay) {
        closeModal();
    }
});

// ========================================
// EMAIL VERIFICATION FUNCTIONS
// ========================================

let otpTimerInterval = null;
let resendCooldownInterval = null;

/**
 * Show email verification modal
 * @param {string} email - User's email address
 */
function showVerificationModal(email) {
    const overlay = document.getElementById('verificationModalOverlay');
    const emailDisplay = document.getElementById('verificationEmail');
    const otpInput = document.getElementById('otpInput');

    if (!overlay || !emailDisplay || !otpInput) {
        console.error('❌ Verification modal elements not found');
        return;
    }

    // Set email
    emailDisplay.textContent = email;

    // Clear OTP input
    otpInput.value = '';
    otpInput.focus();

    // Show modal
    overlay.style.display = 'flex';

    // Start OTP timer (10 minutes)
    startOTPTimer(600); // 600 seconds = 10 minutes

    // Enable resend button after cooldown
    startResendCooldown(60); // 60 seconds cooldown

    console.log('📧 Email verification modal opened');
}

/**
 * Close email verification modal
 */
function closeVerificationModal() {
    const overlay = document.getElementById('verificationModalOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }

    // Clear timers
    if (otpTimerInterval) {
        clearInterval(otpTimerInterval);
        otpTimerInterval = null;
    }

    if (resendCooldownInterval) {
        clearInterval(resendCooldownInterval);
        resendCooldownInterval = null;
    }

    // ⚠️ If user closes modal without verifying, keep pending token
    // User can return later to verify (email already sent)
    const hasPendingVerification = sessionStorage.getItem('pending_verification_token');
    if (hasPendingVerification) {
        console.log('⚠️ User closed verification modal without verifying');
        console.log('   Pending token kept - User can verify later');
    }

    console.log('✅ Email verification modal closed');
}

/**
 * Start OTP countdown timer (10 minutes)
 * @param {number} seconds - Timer duration in seconds
 */
function startOTPTimer(seconds) {
    const timerDisplay = document.getElementById('otpTimer');
    if (!timerDisplay) return;

    let timeLeft = seconds;

    // Clear existing timer
    if (otpTimerInterval) {
        clearInterval(otpTimerInterval);
    }

    // Update display immediately
    updateTimerDisplay(timerDisplay, timeLeft);

    // Start countdown
    otpTimerInterval = setInterval(() => {
        timeLeft--;

        if (timeLeft <= 0) {
            clearInterval(otpTimerInterval);
            timerDisplay.textContent = 'Hết hạn';
            timerDisplay.style.color = '#ef4444';

            // Disable verify button
            const verifyBtn = document.getElementById('verifyBtn');
            if (verifyBtn) {
                verifyBtn.disabled = true;
            }

            showCustomModal({
                icon: '⏰',
                title: 'Mã OTP đã hết hạn',
                message: 'Mã xác thực đã hết hiệu lực.\n\nVui lòng click "Gửi lại mã" để nhận mã mới.',
                buttons: [{ text: 'Đã hiểu', type: 'primary' }]
            });
        } else {
            updateTimerDisplay(timerDisplay, timeLeft);
        }
    }, 1000);
}

/**
 * Update timer display (MM:SS format)
 * @param {HTMLElement} display - Timer display element
 * @param {number} seconds - Seconds remaining
 */
function updateTimerDisplay(display, seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    display.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;

    // Change color based on time left
    if (seconds <= 60) {
        display.style.color = '#ef4444'; // Red
    } else if (seconds <= 180) {
        display.style.color = '#f59e0b'; // Orange
    } else {
        display.style.color = '#fbbf24'; // Yellow
    }
}

/**
 * Start resend button cooldown
 * @param {number} seconds - Cooldown duration in seconds
 */
function startResendCooldown(seconds) {
    const resendBtn = document.getElementById('resendBtn');
    const resendText = document.getElementById('resendText');
    const resendCooldown = document.getElementById('resendCooldown');
    const cooldownTimer = document.getElementById('cooldownTimer');

    if (!resendBtn || !resendText || !resendCooldown || !cooldownTimer) return;

    let timeLeft = seconds;

    // Clear existing interval
    if (resendCooldownInterval) {
        clearInterval(resendCooldownInterval);
    }

    // Disable button and show cooldown
    resendBtn.disabled = true;
    resendText.style.display = 'none';
    resendCooldown.style.display = 'inline';
    cooldownTimer.textContent = timeLeft;

    // Start countdown
    resendCooldownInterval = setInterval(() => {
        timeLeft--;

        if (timeLeft <= 0) {
            clearInterval(resendCooldownInterval);
            resendCooldownInterval = null;

            // Enable button
            resendBtn.disabled = false;
            resendText.style.display = 'inline';
            resendCooldown.style.display = 'none';
        } else {
            cooldownTimer.textContent = timeLeft;
        }
    }, 1000);
}

/**
 * Handle verify email button click
 */
async function handleVerifyEmail() {
    const otpInput = document.getElementById('otpInput');
    const verifyBtn = document.getElementById('verifyBtn');

    if (!otpInput) return;

    const otp = otpInput.value.trim();

    // Validate OTP
    if (!otp || otp.length !== 6) {
        showCustomModal({
            icon: '⚠️',
            title: 'OTP không hợp lệ',
            message: 'Vui lòng nhập mã OTP 6 số.',
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
        otpInput.focus();
        return;
    }

    // Check if OTP contains only numbers
    if (!/^\d{6}$/.test(otp)) {
        showCustomModal({
            icon: '⚠️',
            title: 'OTP không hợp lệ',
            message: 'Mã OTP chỉ bao gồm 6 chữ số.',
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
        otpInput.focus();
        return;
    }

    try {
        // Disable button
        if (verifyBtn) verifyBtn.disabled = true;

        showSmartLoading('Đang xác thực...', 100);

        // ✅ Get registration data from sessionStorage
        const pendingRegistration = sessionStorage.getItem('pending_registration');

        if (!pendingRegistration) {
            hideSmartLoading();
            showCustomModal({
                icon: '❌',
                title: 'Lỗi xác thực',
                message: 'Không tìm thấy thông tin đăng ký.\n\nVui lòng đăng ký lại.',
                buttons: [{
                    text: 'Đăng ký lại',
                    type: 'primary',
                    onClick: () => window.location.reload()
                }]
            });
            return;
        }

        const regData = JSON.parse(pendingRegistration);
        const { name, email, password, deviceFingerprint } = regData;

        let response, apiUrl, requestBody;

        // Check if this is NEW user (has password) or EXISTING user (no password)
        if (password) {
            // ✅ NEW USER: Call verify-and-create to CREATE user
            console.log('🆕 Verifying NEW user registration');
            apiUrl = `${BACKEND_URL}/api/auth/verify-and-create`;
            requestBody = { email, name, password, otp, deviceFingerprint };
        } else {
            // ✅ EXISTING USER: Call verify-email to UPDATE emailVerified
            console.log('👤 Verifying EXISTING user');
            const authToken = sessionStorage.getItem('pending_verification_token');

            if (!authToken) {
                hideSmartLoading();
                showCustomModal({
                    icon: '❌',
                    title: 'Lỗi xác thực',
                    message: 'Phiên đăng nhập đã hết hạn.\n\nVui lòng đăng nhập lại.',
                    buttons: [{
                        text: 'Đăng nhập lại',
                        type: 'primary',
                        onClick: () => window.location.reload()
                    }]
                });
                return;
            }

            apiUrl = `${BACKEND_URL}/api/auth/verify-email`;
            requestBody = { otp };
        }

        // ✅ Call appropriate API
        response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(password ? {} : { 'Authorization': `Bearer ${sessionStorage.getItem('pending_verification_token')}` })
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        hideSmartLoading();

        if (response.ok && data.success) {
            // ✅ User created and verified successfully!
            console.log('✅ User created successfully:', email);

            // ✅ Login the user immediately
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('current_user', JSON.stringify(data.user));
            sessionStorage.setItem('logged_in', 'true');

            // ✅ Clear pending registration data
            sessionStorage.removeItem('pending_registration');

            console.log('✅ User logged in after registration');

            // Close verification modal
            closeVerificationModal();

            // ✅ Check nếu là user mới → hiện modal nhập mã giới thiệu
            if (data.isNewUser && data.showReferralModal) {
                console.log('🎁 New user - showing referral modal');
                showReferralModal();
            } else {
                // Show success modal (cho existing user verify email)
                showWelcomeModal();
            }

        } else {
            // ❌ Verification failed
            const errorCode = data.code;
            let errorTitle = 'Xác thực thất bại';
            let errorMessage = data.error || 'Có lỗi xảy ra. Vui lòng thử lại.';

            // Handle specific error codes
            if (errorCode === 'INVALID_OTP') {
                errorTitle = 'Mã OTP không đúng';
                errorMessage = data.error + '\n\nVui lòng kiểm tra lại mã trong email.';

                // Clear input and focus
                otpInput.value = '';
                otpInput.focus();

            } else if (errorCode === 'TOKEN_EXPIRED') {
                errorTitle = 'Mã OTP đã hết hạn';
                errorMessage = 'Mã xác thực đã hết hiệu lực (10 phút).\n\nVui lòng click "Gửi lại mã" để nhận mã mới.';

            } else if (errorCode === 'TOO_MANY_ATTEMPTS') {
                errorTitle = 'Quá nhiều lần thử';
                errorMessage = 'Bạn đã nhập sai quá nhiều lần.\n\nVui lòng yêu cầu gửi lại mã mới.';

            } else if (errorCode === 'ALREADY_VERIFIED') {
                // Already verified - redirect to home
                closeVerificationModal();
                showSuccess('Email đã được xác thực trước đó!');
                setTimeout(() => window.location.href = '/', 1500);
                return;
            }

            showCustomModal({
                icon: '❌',
                title: errorTitle,
                message: errorMessage,
                buttons: [{ text: 'Thử lại', type: 'primary' }]
            });
        }

    } catch (error) {
        hideSmartLoading();
        console.error('❌ Verify email error:', error);

        showCustomModal({
            icon: '⚠️',
            title: 'Lỗi kết nối',
            message: 'Không thể kết nối đến server.\n\nVui lòng kiểm tra internet và thử lại.',
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
    } finally {
        // Re-enable button
        if (verifyBtn) verifyBtn.disabled = false;
    }
}

/**
 * Handle resend OTP button click
 */
async function handleResendOTP() {
    try {
        showSmartLoading('Đang gửi lại mã...', 100);

        // ✅ Get email from pending registration
        const pendingRegistration = sessionStorage.getItem('pending_registration');

        if (!pendingRegistration) {
            hideSmartLoading();
            showCustomModal({
                icon: '❌',
                title: 'Lỗi xác thực',
                message: 'Không tìm thấy thông tin đăng ký.\n\nVui lòng đăng ký lại.',
                buttons: [{
                    text: 'Đăng ký lại',
                    type: 'primary',
                    onClick: () => window.location.reload()
                }]
            });
            return;
        }

        const { email } = JSON.parse(pendingRegistration);

        // ✅ Call resend-otp API (no auth token needed)
        const response = await fetch(`${BACKEND_URL}/api/auth/resend-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        hideSmartLoading();

        if (response.ok && data.success) {
            // ✅ Resend successful
            console.log('✅ OTP resent to:', email);

            // Clear OTP input
            const otpInput = document.getElementById('otpInput');
            if (otpInput) {
                otpInput.value = '';
                otpInput.focus();
            }

            // Restart timers
            startOTPTimer(600); // 10 minutes
            startResendCooldown(60); // 60 seconds

            // Re-enable verify button
            const verifyBtn = document.getElementById('verifyBtn');
            if (verifyBtn) {
                verifyBtn.disabled = false;
            }

            showCustomModal({
                icon: '✅',
                title: 'Đã gửi lại mã',
                message: 'Mã OTP mới đã được gửi đến email của bạn.\n\nVui lòng kiểm tra hộp thư (có thể ở Spam).',
                buttons: [{ text: 'Đã hiểu', type: 'primary' }]
            });

        } else {
            // ❌ Resend failed
            const errorCode = data.code;
            let errorTitle = 'Không thể gửi lại';
            let errorMessage = data.error || 'Có lỗi xảy ra. Vui lòng thử lại sau.';

            // Handle specific error codes
            if (errorCode === 'RESEND_COOLDOWN') {
                errorTitle = 'Vui lòng đợi';
                errorMessage = `Bạn cần đợi ${data.waitSeconds} giây nữa mới có thể gửi lại mã.`;

            } else if (errorCode === 'NO_PENDING_VERIFICATION') {
                errorTitle = 'Phiên đã hết hạn';
                errorMessage = 'Yêu cầu đăng ký đã hết hạn.\n\nVui lòng đăng ký lại từ đầu.';

                // Clear pending data and close modal
                sessionStorage.removeItem('pending_registration');
                setTimeout(() => {
                    closeVerificationModal();
                    window.location.reload();
                }, 2000);
            }

            showCustomModal({
                icon: '❌',
                title: errorTitle,
                message: errorMessage,
                buttons: [{ text: 'Đã hiểu', type: 'primary' }]
            });
        }

    } catch (error) {
        hideSmartLoading();
        console.error('❌ Resend OTP error:', error);

        showCustomModal({
            icon: '⚠️',
            title: 'Lỗi kết nối',
            message: 'Không thể kết nối đến server.\n\nVui lòng kiểm tra internet và thử lại.',
            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
        });
    }
}

// ========================================
// KEYBOARD SHORTCUTS
// ========================================

// Allow Enter key to submit OTP
document.addEventListener('DOMContentLoaded', () => {
    const otpInput = document.getElementById('otpInput');
    if (otpInput) {
        otpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleVerifyEmail();
            }
        });

        // Only allow numbers in OTP input
        otpInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }
});

// ========================================
// CREDITS SYSTEM FUNCTIONS
// ========================================

/**
 * Open Purchase Credits Modal
 */
window.openPurchaseCreditsModal = function () {
    const modal = document.getElementById('purchaseCreditsModal');
    if (modal) {
        modal.style.display = 'flex';
        // Reset form
        document.getElementById('purchaseAmount').value = '';
        document.getElementById('creditsPreview').style.display = 'none';
        document.getElementById('confirmPurchaseBtn').disabled = true;
    }
}

/**
 * Close Purchase Credits Modal
 */
window.closePurchaseCreditsModal = function () {
    const modal = document.getElementById('purchaseCreditsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Calculate credits from amount
 */
window.calculateCredits = function (amount) {
    const numAmount = parseInt(amount);
    const preview = document.getElementById('creditsPreview');
    const creditsAmount = document.getElementById('creditsAmount');
    const confirmBtn = document.getElementById('confirmPurchaseBtn');

    if (!amount || isNaN(numAmount)) {
        preview.style.display = 'none';
        confirmBtn.disabled = true;
        return;
    }

    // Check minimum
    if (numAmount < 30000) {
        preview.style.display = 'none';
        confirmBtn.disabled = true;
        return;
    }

    // Check if round number (multiple of 1000)
    if (numAmount % 1000 !== 0) {
        preview.style.display = 'none';
        confirmBtn.disabled = true;
        return;
    }

    // Calculate credits: 500 VNĐ = 1 credit (30.000 = 60 credits)
    const credits = Math.floor(numAmount / 500);

    creditsAmount.textContent = `${credits} Credits`;
    preview.style.display = 'block';
    confirmBtn.disabled = false;
}

/**
 * Confirm purchase credits
 */
window.confirmPurchaseCredits = async function () {
    const amount = parseInt(document.getElementById('purchaseAmount').value);

    if (!amount || amount < 30000 || amount % 1000 !== 0) {
        alert('⚠️ Vui lòng nhập số tiền hợp lệ (tối thiểu 30.000 VNĐ, số tròn nghìn)');
        return;
    }

    try {
        showSmartLoading('Đang xử lý yêu cầu mua credits...');

        const response = await fetch(`${BACKEND_URL}/api/credits/purchase`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ amount })
        });

        const data = await response.json();

        hideSmartLoading();

        if (response.ok && data.success) {
            // Success: đóng modal mua credits và mở thẳng modal thanh toán với QR động
            closePurchaseCreditsModal();

            try {
                // Mở payment modal chuyên dụng cho mua credits
                if (typeof openPaymentModal === 'function') {
                    openPaymentModal('credits', amount, 'credits');
                }
            } catch (e) {
                console.error('Không thể mở payment modal cho credits:', e);
                alert(`✅ ${data.message}\n\nVui lòng chuyển khoản ${amount.toLocaleString('vi-VN')} VNĐ cho Admin để kích hoạt credits!`);
            }

            // Refresh user info (credits có thể được cập nhật sau khi admin duyệt)
            if (typeof loadCookieInfo === 'function') {
                await loadCookieInfo();
            }

        } else {
            alert(`❌ Lỗi: ${data.message || data.error || 'Có lỗi xảy ra'}`);
        }

    } catch (error) {
        hideSmartLoading();
        console.error('Purchase credits error:', error);
        alert('❌ Không thể kết nối đến server. Vui lòng thử lại sau!');
    }
}

/**
 * Update credits display trong Account Overview
 */
window.updateCreditsDisplay = function (credits) {
    const creditsElement = document.getElementById('userCredits');
    if (creditsElement) {
        creditsElement.textContent = credits || 0;

        // Change color based on credits
        if (credits <= 0) {
            creditsElement.style.color = '#ef4444'; // Red
        } else if (credits <= 5) {
            creditsElement.style.color = '#fbbf24'; // Yellow
        } else {
            creditsElement.style.color = '#10b981'; // Green
        }
    }
}


// ========================================
// REFERRAL MODAL SYSTEM
// ========================================

let referralAttempts = 0;
const MAX_REFERRAL_ATTEMPTS = 5;

/**
 * Hiển thị modal nhập mã giới thiệu
 */
function showReferralModal() {
    // Tạo modal HTML nếu chưa có
    if (!document.getElementById('referralModalOverlay')) {
        createReferralModalHTML();
    }

    // Reset state
    referralAttempts = 0;
    const input = document.getElementById('referralCodeInput');
    if (input) input.value = '';

    // Update attempts display
    updateReferralAttemptsDisplay();

    // Show modal
    document.getElementById('referralModalOverlay').style.display = 'flex';
}

/**
 * Tạo HTML cho modal giới thiệu
 */
function createReferralModalHTML() {
    const modalHTML = `
    <div class="verification-modal-overlay" id="referralModalOverlay" style="display: none;">
        <div class="verification-modal-dialog">
            <div class="verification-modal-header">
                <span class="verification-modal-icon">${resolveAuthModalIcon('🎁')}</span>
                <div class="verification-modal-title">Mã Giới Thiệu</div>
            </div>
            <div class="verification-modal-body">
                <p style="color: #ddd; margin-bottom: 15px; text-align: center;">
                    Bạn có mã giới thiệu từ bạn bè không?<br>
                    <span style="color: #fbbf24;">Nhập mã để nhận ngay 5 credits miễn phí!</span>
                </p>
                
                <div style="margin-bottom: 15px;">
                    <input type="email" id="referralCodeInput" 
                           placeholder="Nhập email người giới thiệu" 
                           style="width: 100%; padding: 14px; background: rgba(255, 255, 255, 0.05); border: 2px solid rgba(251, 191, 36, 0.3); border-radius: 10px; color: #fff; font-size: 1rem; outline: none; transition: all 0.3s ease; box-sizing: border-box;">
                </div>
                
                <p id="referralAttemptsText" style="color: #aaa; font-size: 0.85rem; margin-bottom: 15px; text-align: center;">
                    Còn <strong style="color: #fbbf24;">5</strong> lần thử
                </p>
                
                <div id="referralErrorMsg" style="display: none; background: rgba(220, 53, 69, 0.2); border: 1px solid rgba(220, 53, 69, 0.5); color: #f87171; padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 0.9rem; text-align: center;"></div>
                
                <div class="verification-actions">
                    <button class="btn-verify" id="applyReferralBtn" onclick="handleApplyReferral()">
                        Áp dụng mã
                    </button>
                    
                    <button class="btn-resend" onclick="handleSkipReferral()">
                        Bỏ qua
                    </button>
                </div>
                
                <p style="color: #888; font-size: 0.8rem; margin-top: 15px; text-align: center;">
                    Mã giới thiệu là email của người đã giới thiệu bạn
                </p>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Cập nhật hiển thị số lần thử còn lại
 */
function updateReferralAttemptsDisplay() {
    const attemptsText = document.getElementById('referralAttemptsText');
    const remaining = MAX_REFERRAL_ATTEMPTS - referralAttempts;

    if (attemptsText) {
        attemptsText.innerHTML = `Còn <strong style="color: #fbbf24;">${remaining}</strong> lần thử`;
    }
}

/**
 * Hiển thị lỗi trong modal giới thiệu
 */
function showReferralError(message) {
    const errorDiv = document.getElementById('referralErrorMsg');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

/**
 * Ẩn lỗi trong modal giới thiệu
 */
function hideReferralError() {
    const errorDiv = document.getElementById('referralErrorMsg');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

/**
 * Xử lý áp dụng mã giới thiệu
 */
async function handleApplyReferral() {
    const input = document.getElementById('referralCodeInput');
    const applyBtn = document.getElementById('applyReferralBtn');
    const referralCode = input?.value?.trim();

    hideReferralError();

    if (!referralCode) {
        showReferralError('Vui lòng nhập mã giới thiệu');
        return;
    }

    try {
        if (applyBtn) applyBtn.disabled = true;
        showSmartLoading('Đang xác thực mã...', 100);

        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BACKEND_URL}/api/referral/apply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ referralCode })
        });

        const data = await response.json();
        hideSmartLoading();

        if (response.ok && data.success) {
            // ✅ Thành công!
            console.log('✅ Referral applied successfully!');

            // Cập nhật user trong localStorage
            const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
            currentUser.credits = data.totalCredits;
            currentUser.referralUsed = true;
            localStorage.setItem('current_user', JSON.stringify(currentUser));

            // Đóng modal giới thiệu
            closeReferralModal();

            // Hiện modal chào mừng với thông báo bonus
            showCustomModal({
                icon: '🎉',
                title: 'Chúc mừng!',
                message: `Áp dụng mã giới thiệu thành công!\n\nBạn nhận được +5 credits.\nTổng credits hiện tại: ${data.totalCredits} credits.\n\nChúc bạn xem phim vui vẻ!`,
                buttons: [{
                    text: 'Bắt đầu ngay',
                    type: 'primary',
                    onClick: () => {
                        window.location.href = '/';
                    }
                }]
            });

        } else {
            // ❌ Thất bại
            referralAttempts++;
            updateReferralAttemptsDisplay();

            // Check nếu hết lượt
            if (data.code === 'MAX_ATTEMPTS' || referralAttempts >= MAX_REFERRAL_ATTEMPTS) {
                closeReferralModal();
                showCustomModal({
                    icon: '⚠️',
                    title: 'Hết lượt nhập mã',
                    message: 'Bạn đã nhập sai quá nhiều lần.\n\nTài khoản này sẽ không thể áp dụng mã giới thiệu nữa.\n\nBạn vẫn có thể sử dụng dịch vụ bình thường với 5 credits ban đầu.',
                    buttons: [{
                        text: 'Tiếp tục',
                        type: 'primary',
                        onClick: () => {
                            showWelcomeModal();
                        }
                    }]
                });
                return;
            }

            // Hiện lỗi
            const errorMsg = data.error || 'Mã giới thiệu không hợp lệ';
            showReferralError(errorMsg);

            // Clear input
            if (input) {
                input.value = '';
                input.focus();
            }
        }

    } catch (error) {
        hideSmartLoading();
        console.error('❌ Apply referral error:', error);
        showReferralError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
        if (applyBtn) applyBtn.disabled = false;
    }
}

/**
 * Xử lý bỏ qua mã giới thiệu
 */
async function handleSkipReferral() {
    try {
        showSmartLoading('Đang xử lý...', 100);

        const token = localStorage.getItem('auth_token');
        await fetch(`${BACKEND_URL}/api/referral/skip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        hideSmartLoading();

    } catch (error) {
        hideSmartLoading();
        console.error('Skip referral error:', error);
    }

    // Đóng modal giới thiệu và hiện modal chào mừng
    closeReferralModal();
    showWelcomeModal();
}

/**
 * Đóng modal giới thiệu
 */
function closeReferralModal() {
    const modal = document.getElementById('referralModalOverlay');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Hiển thị modal chào mừng
 */
function showWelcomeModal() {
    showCustomModal({
        icon: '🎉',
        title: 'Đăng ký thành công!',
        message: 'Tài khoản của bạn đã được tạo và xác thực.\n\nBạn có thể bắt đầu sử dụng dịch vụ ngay bây giờ!',
        buttons: [{
            text: 'Bắt đầu ngay',
            type: 'primary',
            onClick: () => {
                window.location.href = '/';
            }
        }]
    });
}

// Export functions
window.showReferralModal = showReferralModal;
window.handleApplyReferral = handleApplyReferral;
window.handleSkipReferral = handleSkipReferral;
window.closeReferralModal = closeReferralModal;
window.showWelcomeModal = showWelcomeModal;

// ========================================
// REFERRAL NOTIFICATION MODAL
// Hiển thị khi có người nhập mã giới thiệu của user
// ========================================

/**
 * Kiểm tra và hiển thị thông báo referral chưa đọc
 * @param {string} token - Auth token
 * @returns {Promise<boolean>} - True nếu có thông báo và đã hiển thị
 */
async function checkReferralNotifications(token) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/referral/unread`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
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
                    'Authorization': `Bearer ${token}`
                }
            });
            const infoData = await infoResponse.json();

            showReferralNotificationModal(data, infoData, token);
            return true;
        }

        console.log('ℹ️ Không có thông báo referral mới');
        return false;

    } catch (error) {
        console.error('❌ Lỗi kiểm tra referral notifications:', error);
        return false;
    }
}

/**
 * Hiển thị modal thông báo referral
 * @param {Object} data - Dữ liệu referral chưa đọc
 * @param {Object} infoData - Thông tin referral của user
 * @param {string} token - Auth token
 */
function showReferralNotificationModal(data, infoData, token) {
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
        : '🎉 Bạn đã dùng hết lượt mời tháng này. Lượt mời sẽ được reset vào tháng sau!';

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
 * @param {string} email - Email gốc
 * @returns {string} - Email đã được mask
 */
function maskEmail(email) {
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
 * Đóng modal thông báo referral và đánh dấu đã đọc
 */
async function closeReferralNotification() {
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

    // Sau khi đóng referral notification, kiểm tra thông điệp Tiệm bánh
    const pendingToken = sessionStorage.getItem('pending_tiembanh_token');
    const pendingUser = sessionStorage.getItem('pending_tiembanh_user');

    if (pendingToken && pendingUser) {
        const user = JSON.parse(pendingUser);
        const hasMessage = await checkTiembanhMessage(pendingToken, user);

        if (!hasMessage) {
            // Không có thông điệp, lưu token và redirect
            localStorage.setItem('auth_token', pendingToken);
            localStorage.setItem('current_user', pendingUser);
            sessionStorage.setItem('logged_in', 'true');
            sessionStorage.removeItem('pending_tiembanh_token');
            sessionStorage.removeItem('pending_tiembanh_user');
            window.location.href = '/';
        }
    }
}

// Export referral notification functions
window.checkReferralNotifications = checkReferralNotifications;
window.showReferralNotificationModal = showReferralNotificationModal;
window.closeReferralNotification = closeReferralNotification;

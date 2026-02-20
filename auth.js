// ========================================
// Netflix Guest Sharing - Authentication
// Anti-Spam Features + Backend API Integration
// ========================================

// ========================================
// BACKEND CONFIGURATION
// ========================================

// Use dynamic configuration from config.js
const BACKEND_URL = window.APP_CONFIG ? window.APP_CONFIG.BACKEND_URL : 'https://backend-c0r3-7xpq9zn2025.onrender.com';

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

    modalIcon.textContent = icon;
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
    localStorage.removeItem('current_user');
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

    if (antiSpam.captchaVerified) {
        // Uncheck
        antiSpam.captchaVerified = false;
        checkbox.classList.remove('checked');
        checkbox.innerHTML = '';
        box.classList.remove('verified');
    } else {
        // Check (simulate delay)
        checkbox.innerHTML = '⏳';
        setTimeout(() => {
            antiSpam.captchaVerified = true;
            checkbox.classList.add('checked');
            checkbox.innerHTML = '✓';
            box.classList.add('verified');
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

    if (!password) {
        strengthFill.className = 'strength-fill';
        strengthText.textContent = '';
        return;
    }

    const strength = calculatePasswordStrength(password);

    strengthFill.className = 'strength-fill';

    if (strength <= 1) {
        strengthFill.classList.add('strength-weak');
        strengthText.textContent = 'Yếu';
        strengthText.style.color = '#dc3545';
    } else if (strength === 2) {
        strengthFill.classList.add('strength-medium');
        strengthText.textContent = 'Trung bình';
        strengthText.style.color = '#ffc107';
    } else {
        strengthFill.classList.add('strength-strong');
        strengthText.textContent = 'Mạnh';
        strengthText.style.color = '#28a745';
    }
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔐 Auth page initialized');

    // Check if already logged in
    if (sessionStorage.getItem('logged_in') === 'true') {
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
        arrowRight: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`
    };

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
                    <div class="celeb-icon-wrap">
                        <div class="celeb-icon-glow"></div>
                        ${svgIcons.smartphone}
                        <div class="celeb-sparkle celeb-sparkle-1">${svgIcons.sparkles}</div>
                        <div class="celeb-sparkle celeb-sparkle-2">${svgIcons.sparkles}</div>
                    </div>
                    <h1 class="celeb-title">BIG UPDATE</h1>
                    <p class="celeb-subtitle">Tiệm Bánh Netflix đã có trên điện thoại!</p>
                </div>
                
                <!-- Main Description -->
                <p class="celeb-desc">${celebrationData.mainDescription}</p>
                
                <!-- Feature Highlight -->
                <div class="celeb-feature">
                    <div class="celeb-feature-icon">${svgIcons.tv}</div>
                    <div class="celeb-feature-content">
                        <h3>${celebrationData.highlightFeature}</h3>
                        <p>${celebrationData.highlightDescription}</p>
                    </div>
                </div>
                
                <!-- Info Grid -->
                <div class="celeb-grid-info">
                    <!-- Extension -->
                    <div class="celeb-info-card">
                        <div class="celeb-info-header">
                            <span class="celeb-info-icon">${svgIcons.puzzle}</span>
                            <span>Extension v${celebrationData.extensionVersion || CELEBRATION_EXTENSION_VERSION}<span class="celeb-mobile-only"> (cho phiên bản PC)</span></span>
                        </div>
                        <ul class="celeb-list">
                            ${celebrationData.extensionChanges.map(c => `<li><span class="celeb-check">${svgIcons.check}</span>${c}</li>`).join('')}
                        </ul>
                        <a href="${celebrationData.extensionDownloadUrl}" target="_blank" class="celeb-download">
                            ${svgIcons.download}
                            <span>Tải Extension</span>
                        </a>
                    </div>
                    
                    <!-- Free Plan -->
                    <div class="celeb-info-card">
                        <div class="celeb-info-header">
                            <span class="celeb-info-icon celeb-info-icon-amber">${svgIcons.bell}</span>
                            <span>Thay đổi gói Free</span>
                        </div>
                        <ul class="celeb-list celeb-list-compact">
                            ${celebrationData.freePlanChanges.map(c => `<li><span class="celeb-check">${svgIcons.check}</span>${c}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                
                <!-- CTA Button -->
                <button id="celebrationBtn" class="celeb-btn" disabled>
                    <span class="celeb-btn-text">Đợi một chút...</span>
                    <span class="celeb-btn-countdown"></span>
                </button>
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
            
            .celeb-info-card {
                padding: 20px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 12px;
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
                transition: all 0.2s ease;
            }
            
            .celeb-download:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
            }
            
            /* CTA Button */
            .celeb-btn {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 18px 32px;
                font-size: 1.1rem;
                font-weight: 600;
                color: white;
                background: linear-gradient(135deg, #e50914 0%, #b20710 100%);
                border: none;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            
            .celeb-btn:disabled {
                background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%);
                cursor: not-allowed;
            }
            
            .celeb-btn:not(:disabled):hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 30px rgba(229, 9, 20, 0.4);
            }
            
            .celeb-btn:not(:disabled)::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                animation: celeb-shimmer 2s infinite;
            }
            
            @keyframes celeb-shimmer {
                100% { left: 100%; }
            }
            
            .celeb-btn-countdown {
                font-weight: 400;
                opacity: 0.8;
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
                
                .celeb-mobile-only {
                    display: inline;
                }
            }
        </style>
    `;

    // Insert modal into DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const btn = document.getElementById('celebrationBtn');
    let countdown = 10;

    // Update button text
    function updateBtnText() {
        if (countdown > 0) {
            btn.innerHTML = `<span class="celeb-btn-text">Đợi một chút...</span><span class="celeb-btn-countdown">${countdown}s</span>`;
        } else {
            btn.innerHTML = `<span class="celeb-btn-text">Vào Tiệm Bánh ngay</span>${svgIcons.arrowRight}`;
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
    modalIcon.textContent = icon;
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
            // Success!
            closePurchaseCreditsModal();

            // Show success message
            alert(`✅ ${data.message}\n\nSố credits hiện tại: ${data.credits}\n\n💡 Vui lòng chuyển khoản ${amount.toLocaleString('vi-VN')} VNĐ cho Admin để kích hoạt credits!`);

            // Refresh user info
            if (typeof loadCookieInfo === 'function') {
                await loadCookieInfo();
            }

            // Open Facebook contact
            window.open('https://www.facebook.com/tiembanh4k/', '_blank');

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
                <span class="verification-modal-icon">🎁</span>
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

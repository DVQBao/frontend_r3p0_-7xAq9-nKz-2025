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
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
        });
        return;
    }
    
    if (!email.toLowerCase().endsWith('@gmail.com')) {
        showModal({
            icon: '⚠️',
            title: 'Email không hợp lệ',
            message: 'Chỉ chấp nhận email @gmail.com',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
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
                            onClick: () => {}
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
                buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
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
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
        });
        
    } catch (error) {
        hideSmartLoading();
        console.error('❌ Send forgot password OTP error:', error);
        showModal({
            icon: '❌',
            title: 'Lỗi kết nối',
            message: 'Không thể kết nối đến server. Vui lòng thử lại sau.',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
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
                buttons: [{ text: 'OK', type: 'primary', onClick: () => {
                    closeForgotPasswordOTPModal();
                }}]
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
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {
                closeForgotPasswordOTPModal();
            }}]
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
                buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
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
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
        });
        
    } catch (error) {
        hideSmartLoading();
        console.error('❌ Resend forgot password OTP error:', error);
        showModal({
            icon: '❌',
            title: 'Lỗi kết nối',
            message: 'Không thể kết nối đến server',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
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
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
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
                buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
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
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
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
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
        });
        return;
    }
    
    if (newPassword.length < 6) {
        showModal({
            icon: '⚠️',
            title: 'Mật khẩu yếu',
            message: 'Mật khẩu phải có ít nhất 6 ký tự',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
        });
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showModal({
            icon: '⚠️',
            title: 'Mật khẩu không khớp',
            message: 'Xác nhận mật khẩu không trùng khớp',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
        });
        return;
    }
    
    if (!forgotPasswordResetToken) {
        showModal({
            icon: '❌',
            title: 'Lỗi',
            message: 'Token không hợp lệ. Vui lòng thử lại.',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {
                closeForgotPasswordNewPasswordModal();
            }}]
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
                buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
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
            buttons: [{ text: 'Đăng nhập', type: 'primary', onClick: () => {
                // Switch to login form
                document.getElementById('loginForm').style.display = 'block';
                document.getElementById('registerForm').style.display = 'none';
                document.getElementById('loginEmail').value = sessionStorage.getItem('forgot_password_email') || '';
                document.getElementById('loginPassword').value = '';
                document.getElementById('loginPassword').focus();
            }}]
        });
        
    } catch (error) {
        hideSmartLoading();
        console.error('❌ Reset password error:', error);
        showModal({
            icon: '❌',
            title: 'Lỗi kết nối',
            message: 'Không thể kết nối đến server',
            buttons: [{ text: 'OK', type: 'primary', onClick: () => {} }]
        });
    }
}

// Toggle password visibility
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
    } else {
        input.type = 'password';
        button.textContent = '👁️';
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
            
            // Check for Tiệm bánh message
            setTimeout(async () => {
                const hasMessage = await checkTiembanhMessage(data.token, data.user);
                if (!hasMessage) {
                    // No message, save token and redirect immediately
                    localStorage.setItem('auth_token', data.token);
                    localStorage.setItem('current_user', JSON.stringify(data.user));
                    sessionStorage.setItem('logged_in', 'true');
                    window.location.href = '/';
                } else {
                    // Has message, store token temporarily
                    sessionStorage.setItem('pending_tiembanh_token', data.token);
                    sessionStorage.setItem('pending_tiembanh_user', JSON.stringify(data.user));
                }
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
                    
                    // Redirect to homepage
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1000);
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
        iconElement.textContent = '🙈'; // Hide icon
    } else {
        input.type = 'password';
        iconElement.textContent = '👁️'; // Show icon
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
 * Parse plain text message to formatted HTML
 * @param {string} text - Plain text message
 * @returns {string} - Formatted HTML
 */
function parseMessageToHTML(text) {
    if (!text) return '';
    
    const lines = text.split('\n');
    let html = '';
    let inOrderedList = false;
    let listItems = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Empty line - close list if open, add spacing
        if (line === '') {
            if (inOrderedList) {
                html += '<ol style="margin: 15px 0; padding-left: 25px; color: #e5e7eb; line-height: 1.8;">';
                listItems.forEach(item => {
                    html += `<li style="margin: 8px 0;">${item}</li>`;
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
            listItems.push(itemText);
            inOrderedList = true;
            continue;
        }
        
        // Close list if we were in one
        if (inOrderedList) {
            html += '<ol style="margin: 15px 0; padding-left: 25px; color: #e5e7eb; line-height: 1.8;">';
            listItems.forEach(item => {
                html += `<li style="margin: 8px 0;">${item}</li>`;
            });
            html += '</ol>';
            inOrderedList = false;
            listItems = [];
        }
        
        // Check if line is a URL
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(line)) {
            const formattedLine = line.replace(urlRegex, (url) => {
                return `<a href="${url}" target="_blank" style="color: #60a5fa; text-decoration: underline; word-break: break-all;">${url}</a>`;
            });
            html += `<p style="margin: 12px 0; color: #e5e7eb; line-height: 1.8;">${formattedLine}</p>`;
        } else {
            // Regular text - check for bold patterns
            let formattedLine = line;
            
            // Bold text with **text**
            formattedLine = formattedLine.replace(/\*\*(.+?)\*\*/g, '<strong style="color: #fbbf24; font-weight: 600;">$1</strong>');
            
            // Check if it's a heading (ends with :)
            if (line.endsWith(':')) {
                html += `<p style="margin: 18px 0 8px 0; color: #fbbf24; font-weight: 600; font-size: 1.05rem; line-height: 1.8;">${formattedLine}</p>`;
            } else {
                html += `<p style="margin: 12px 0; color: #e5e7eb; line-height: 1.8;">${formattedLine}</p>`;
            }
        }
    }
    
    // Close list if still open at end
    if (inOrderedList) {
        html += '<ol style="margin: 15px 0; padding-left: 25px; color: #e5e7eb; line-height: 1.8;">';
        listItems.forEach(item => {
            html += `<li style="margin: 8px 0;">${item}</li>`;
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
            
            // Show success modal
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


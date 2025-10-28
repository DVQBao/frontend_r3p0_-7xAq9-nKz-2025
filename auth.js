// ========================================
// Netflix Guest Sharing - Authentication
// Anti-Spam Features + Backend API Integration
// ========================================

// ========================================
// BACKEND CONFIGURATION
// ========================================

const BACKEND_URL = 'https://backend-c0r3-7xpq9zn2025.onrender.com';

// ========================================
// reCAPTCHA CONFIGURATION
// ========================================

const RECAPTCHA_SITE_KEY = '6Ldjte8rAAAAADMBTnxvQtLBAmQq6zH6H-DLl82z';

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

function handleForgotPassword() {
    showModal({
        icon: '📧',
        title: 'RESET MẬT KHẨU',
        message: 'Do chi phí duy trì hiện còn hạn chế, nếu bạn muốn reset mật khẩu, hãy chọn "Đồng ý" để được chuyển link tới nhóm Support.\n\nBạn có muốn tiếp tục?',
        buttons: [
            {
                text: 'Hủy',
                type: 'secondary',
                onClick: () => {}
            },
            {
                text: 'Đồng ý',
                type: 'primary',
                onClick: () => {
                    window.open('https://www.facebook.com/tiembanh4k/', '_blank');
                }
            }
        ]
    });
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
            
            // Store token and user data
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('current_user', JSON.stringify(data.user));
            sessionStorage.setItem('logged_in', 'true');
            
            showSuccess('✅ Đăng nhập thành công! Đang chuyển hướng...');
            
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            showError(`❌ ${data.error || 'Đăng nhập thất bại!'}`);
        }
    } catch (error) {
        hideSmartLoading();
        console.error('❌ Login error:', error);
        showError('❌ Lỗi kết nối! Vui lòng thử lại sau.');
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
        showError('❌ Vui lòng xác nhận bạn không phải robot!');
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
        showError(`⏳ Vui lòng đợi ${remainingSeconds} giây trước khi đăng ký lại!`);
        return;
    }
    
    // Anti-Spam Check 3: Max Attempts per Hour
    const registerHistory = JSON.parse(localStorage.getItem('register_history') || '[]');
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentAttempts = registerHistory.filter(time => time > oneHourAgo);
    
    if (recentAttempts.length >= antiSpam.MAX_ATTEMPTS_PER_HOUR) {
        showError('❌ Bạn đã đăng ký quá nhiều lần! Vui lòng thử lại sau 1 giờ.');
        return;
    }
    
    // Validate Name
    if (name.length < 3) {
        showError('❌ Tên phải có ít nhất 3 ký tự!');
        return;
    }
    
    // Validate Password Match
    if (password !== confirmPassword) {
        showError('❌ Mật khẩu xác nhận không khớp!');
        return;
    }
    
    // Validate Password Strength
    if (password.length < 8) {
        showError('❌ Mật khẩu phải có ít nhất 8 ký tự!');
        return;
    }
    
    const strength = calculatePasswordStrength(password);
    if (strength < 2) {
        showError('❌ Mật khẩu quá yếu! Vui lòng dùng mật khẩu mạnh hơn.');
        return;
    }
    
    // Validate Email Format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('❌ Email không hợp lệ!');
        return;
    }
    
    try {
        // Generate device fingerprint
        const deviceFingerprint = await generateDeviceFingerprint();
        console.log('🔐 Fingerprint for registration:', deviceFingerprint.substring(0, 16) + '...');
        
        // Get reCAPTCHA token
        const recaptchaToken = await getRecaptchaToken('register');
        
        showSmartLoading('Đang đăng ký...', 500);
        
        // Call backend API
        const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                name, 
                email, 
                password,
                recaptchaToken,
                deviceFingerprint
            })
        });
        
        const data = await response.json();
        hideSmartLoading();
        
        if (response.ok) {
            // Registration successful
            console.log('✅ Registration successful:', data.user.email);
            
            // Store token and user data
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('current_user', JSON.stringify(data.user));
            sessionStorage.setItem('logged_in', 'true');
            
            // Update anti-spam tracking
            antiSpam.lastRegisterTime = now;
            registerHistory.push(now);
            localStorage.setItem('register_history', JSON.stringify(registerHistory));
            
            showSuccess('✅ Đăng ký thành công! Đang đăng nhập...');
            
            // Auto login
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
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
                showError(`${data.error || data.message || 'Đăng ký thất bại!'}`);
            }
        }
    } catch (error) {
        hideSmartLoading();
        console.error('❌ Registration error:', error);
        showError('❌ Lỗi kết nối! Vui lòng thử lại sau.');
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


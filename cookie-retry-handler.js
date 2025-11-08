// ========================================
// Cookie Retry Handler
// Xử lý retry khi cookie lỗi
// ========================================

class CookieRetryHandler {
    constructor(backendUrl, authToken) {
        this.backendUrl = backendUrl;
        this.authToken = authToken;
        this.maxRetries = 5;
        this.currentRetry = 0;
        this.usedCookies = new Set();
    }
    
    /**
     * Thử login với cookie, tự động retry nếu lỗi
     */
    async attemptLogin(onProgress) {
        this.currentRetry = 0;
        this.usedCookies.clear();
        
        while (this.currentRetry < this.maxRetries) {
            this.currentRetry++;
            
            try {
                // Update progress
                if (onProgress) {
                    onProgress({
                        status: 'trying',
                        attempt: this.currentRetry,
                        maxAttempts: this.maxRetries,
                        message: `Đang thử đăng nhập (lần ${this.currentRetry}/${this.maxRetries})...`
                    });
                }
                
                // Get cookie from backend
                const cookieData = await this.getCookieFromBackend();
                
                if (!cookieData) {
                    throw new Error('Không có tài khoản Netflix khả dụng');
                }
                
                // Try to inject cookie
                const result = await this.injectCookieAndCheck(cookieData);
                
                if (result.success) {
                    // Success! Confirm cookie assignment (tăng slot +1)
                    console.log('🎉 Login successful! Confirming cookie assignment...');
                    await this.confirmCookie(cookieData.cookieId);

                    if (onProgress) {
                        onProgress({
                            status: 'success',
                            message: 'Đăng nhập thành công!',
                            cookieNumber: cookieData.cookieNumber
                        });
                    }
                    return { success: true, cookieData };
                }

                // ========================================
                // PHÂN BIỆT: LỖI EXTENSION/NETWORK vs LỖI COOKIE
                // ========================================
                // TIMEOUT_SLOW_NETWORK removed - đây là lỗi COOKIE không phải extension!
                const extensionErrors = ['NO_RESPONSE', 'CHECK_FAILED', 'NO_EXTENSION', 'EXTENSION_OFFLINE'];

                if (extensionErrors.includes(result.errorCode)) {
                    // ❌ LỖI EXTENSION/NETWORK - KHÔNG MARK COOKIE DIE
                    console.error('🔌 Extension/Network error detected! Stopping process...');
                    console.error(`Error code: ${result.errorCode}`);

                    // Release cookie preview (không mark die)
                    await this.releaseCookieAssignment(cookieData.cookieId);

                    // Show error modal to user
                    if (onProgress) {
                        onProgress({
                            status: 'extension_error',
                            errorCode: result.errorCode,
                            message: 'Lỗi extension - Vui lòng kiểm tra lại!'
                        });
                    }

                    // Throw error to stop retry loop
                    const error = new Error('Extension Error');
                    error.code = result.errorCode;
                    error.isExtensionError = true;
                    throw error;
                }

                // ❌ LỖI COOKIE - Mark cookie as dead (bao gồm TIMEOUT)
                console.log(`❌ Cookie failed (${result.errorCode}), marking as dead...`);
                await this.markCookieAsDead(cookieData.cookieId, result.errorCode);

                // Add to used list
                this.usedCookies.add(cookieData.cookieId);

                // Update progress
                if (onProgress) {
                    onProgress({
                        status: 'retrying',
                        attempt: this.currentRetry,
                        maxAttempts: this.maxRetries,
                        message: `Tài khoản Netflix #${cookieData.cookieNumber} lỗi, đang thử tài khoản khác...`,
                        errorCode: result.errorCode
                    });
                }
                
                // Wait before retry
                await this.sleep(2000);
                
            } catch (error) {
                console.error(`❌ Attempt ${this.currentRetry} failed:`, error);

                // 🔌 EXTENSION/NETWORK ERROR - Dừng ngay, không retry, không mark cookie die
                if (error.isExtensionError) {
                    console.error('🔌 EXTENSION/NETWORK ERROR - Stopping all retries');

                    // ========================================
                    // ĐÓNG MODAL "ĐANG ĐĂNG NHẬP..." TRƯỚC
                    // ========================================
                    if (typeof window.closeAdModal === 'function') {
                        window.closeAdModal();
                        console.log('✅ Closed "Đang đăng nhập..." modal');
                    } else {
                        // Fallback: Tự tắt modal
                        const adModal = document.getElementById('adModal');
                        if (adModal) {
                            adModal.classList.remove('active');
                            console.log('✅ Manually closed adModal');
                        }
                    }

                    // Hiển thị modal hướng dẫn tùy theo loại lỗi
                    if (typeof window.showCustomModal === 'function') {
                        // Phân biệt lỗi timeout vs extension
                        const isTimeout = error.code === 'TIMEOUT_SLOW_NETWORK';

                        window.showCustomModal({
                            icon: isTimeout ? '🐌' : '🔌',
                            title: isTimeout ? 'Kết nối mạng chậm' : 'Lỗi Extension',
                            message: isTimeout
                                ? `Kết nối mạng của bạn quá chậm!\n\n` +
                                  `📋 Các bước khắc phục:\n\n` +
                                  `1️⃣ Kiểm tra kết nối internet\n` +
                                  `2️⃣ Đổi sang mạng WiFi nhanh hơn\n` +
                                  `3️⃣ Tắt các ứng dụng đang tải dữ liệu\n` +
                                  `4️⃣ Thử lại sau vài phút\n\n` +
                                  `Vui lòng thử lại khi mạng ổn định hơn!`
                                : `Không thể kết nối với Extension!\n\n` +
                                  `📋 Các bước khắc phục:\n\n` +
                                  `1️⃣ Kiểm tra Extension đã được cài đặt chưa\n` +
                                  `2️⃣ Refresh lại trang web này (Ctrl + F5)\n` +
                                  `3️⃣ Kiểm tra Extension có đang bật không\n` +
                                  `4️⃣ Thử tắt/bật lại Extension\n` +
                                  `5️⃣ Nếu vẫn lỗi, cài lại Extension\n\n` +
                                  `Vui lòng thử lại sau khi fix Extension!`,
                            buttons: isTimeout
                                ? [
                                    { text: 'Thử lại', type: 'primary', action: () => {
                                        window.location.reload();
                                    }}
                                ]
                                : [
                                    { text: 'Hướng dẫn cài Extension', type: 'secondary', action: () => {
                                        window.open('/install-guide', '_blank');
                                    }},
                                    { text: 'Refresh trang', type: 'primary', action: () => {
                                        window.location.reload();
                                    }}
                                ]
                        });
                    } else {
                        const msg = error.code === 'TIMEOUT_SLOW_NETWORK'
                            ? 'Mạng quá chậm! Vui lòng kiểm tra kết nối và thử lại.'
                            : 'Lỗi Extension! Vui lòng kiểm tra lại Extension và refresh trang.';
                        alert(msg);
                    }

                    return {
                        success: false,
                        error: 'Extension Error',
                        errorCode: error.code,
                        isExtensionError: true
                    };
                }

                // 🚫 RATE LIMIT ERROR - Dừng ngay, không retry, hiển thị modal cảnh báo
                if (error.isRateLimited || error.code === 'RATE_LIMIT_EXCEEDED') {
                    console.error('🚫 RATE LIMIT EXCEEDED - Stopping all retries');

                    if (onProgress) {
                        onProgress({
                            status: 'rate_limited',
                            message: error.message,
                            error: error.message
                        });
                    }

                    // Hiển thị modal cảnh báo (tương tự như đăng ký/đăng nhập)
                    // Phải dùng window.showCustomModal vì hàm này được define trong index.html
                    if (typeof window.showCustomModal === 'function') {
                        window.showCustomModal({
                            icon: '⚠️',
                            title: 'Tạm khóa tài khoản',
                            message: error.message,
                            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
                        });
                    } else {
                        console.error('❌ showCustomModal not available!');
                        alert(error.message); // Fallback to alert
                    }

                    return {
                        success: false,
                        error: error.message,
                        isRateLimited: true
                    };
                }
                
                if (this.currentRetry >= this.maxRetries) {
                    // Out of retries
                    console.log('❌ Reached max retries');
                    console.log('⚠️ No cookie was assigned (all failed)');
                    
                    if (onProgress) {
                        onProgress({
                            status: 'failed',
                            message: 'Hiện tại không có tài khoản Netflix khả dụng. Vui lòng liên hệ support để được hỗ trợ!',
                            error: error.message
                        });
                    }
                    return { success: false, error: error.message };
                }
            }
        }
        
        // Max retries reached
        console.log('❌ Max retries reached');
        console.log('⚠️ No cookie was assigned (all failed)');
        
        return {
            success: false,
            error: 'Hiện tại không có tài khoản Netflix khả dụng. Vui lòng liên hệ support để được hỗ trợ!'
        };
    }
    
    /**
     * Get cookie from backend (PREVIEW - không assign)
     */
    async getCookieFromBackend() {
        try {
            // Build URL with query params - dùng /preview thay vì /guest
            const url = new URL(`${this.backendUrl}/api/cookies/preview`);
            
            // Skip current cookie when retrying
            if (this.currentRetry > 1) {
                url.searchParams.set('skipCurrent', 'true');
                console.log('⏭️ Requesting to skip current cookie');
            }
            
            // Exclude cookies that already failed
            if (this.usedCookies.size > 0) {
                const excludeIds = JSON.stringify([...this.usedCookies]);
                url.searchParams.set('excludeIds', excludeIds);
                console.log(`🚫 Excluding ${this.usedCookies.size} failed cookie(s):`, [...this.usedCookies]);
            }
            
            console.log('📤 Fetching cookie PREVIEW from:', url.toString());
            console.log('⚠️ Cookie will NOT be assigned until confirmed');
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                // ⚠️ CHECK RATE LIMIT ERROR - Dừng ngay, không retry
                if (errorData.code === 'RATE_LIMIT_EXCEEDED') {
                    const rateLimitError = new Error(errorData.error || 'Tài khoản của bạn đã bị tạm khóa do nghi ngờ hoạt động bất thường. Vui lòng thử lại sau.');
                    rateLimitError.isRateLimited = true;
                    rateLimitError.code = 'RATE_LIMIT_EXCEEDED';
                    console.error('🚫 RATE LIMIT EXCEEDED - Stop retrying');
                    throw rateLimitError;
                }
                
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.cookie) {
                console.log(`👀 Received cookie PREVIEW #${data.cookieNumber} (ID: ${data.cookie._id})`);
                console.log(`📊 Current slots: ${data.sharedUsers}/4 (not incremented yet)`);
                return {
                    cookieId: data.cookie._id || 'unknown',
                    cookieNumber: data.cookieNumber,
                    name: data.cookie.name,
                    value: data.cookie.value,
                    domain: data.cookie.domain,
                    path: data.cookie.path,
                    secure: data.cookie.secure,
                    httpOnly: data.cookie.httpOnly
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Get cookie preview error:', error);
            throw error;
        }
    }
    
    /**
     * Inject cookie and check if login successful
     */
    async injectCookieAndCheck(cookieData) {
        try {
            console.log('🍪 Starting inject cookie process...');
            console.log('🍪 Cookie data:', {
                cookieNumber: cookieData.cookieNumber,
                name: cookieData.name,
                domain: cookieData.domain
            });
            
            // Use existing injectCookieViaExtension function from app.js
            if (typeof window.injectCookieViaExtension !== 'function') {
                console.error('❌ injectCookieViaExtension function not found!');
                throw new Error('injectCookieViaExtension function not available');
            }
            
            console.log('📤 Calling injectCookieViaExtension...');
            const response = await window.injectCookieViaExtension(cookieData);
            console.log('📥 Injection response:', response);
            
            if (!response || !response.success) {
                console.error('❌ Injection failed:', response);
                const error = new Error(response?.error || 'Extension injection failed');
                // Mark as extension error nếu là timeout
                if (response?.error && response.error.includes('EXTENSION_TIMEOUT')) {
                    error.isExtensionError = true;
                    error.code = 'EXTENSION_OFFLINE';
                }
                throw error;
            }

            console.log('✅ Cookie injected successfully!');
            console.log('🔄 Starting ADAPTIVE POLLING to check cookie status...');

            // ========================================
            // ADAPTIVE TIMEOUT + POLLING
            // Tự động điều chỉnh thời gian check dựa trên tốc độ mạng
            // ========================================
            const startTime = Date.now();
            const maxWaitTime = 20000; // Max 20 seconds
            let pollInterval = 3000;   // Start with 3s
            const maxInterval = 5000;  // Max 5s between checks
            let checkCount = 0;

            while ((Date.now() - startTime) < maxWaitTime) {
                checkCount++;
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

                // Wait before checking
                await this.sleep(pollInterval);

                console.log(`🔍 Check #${checkCount} after ${elapsed}s (interval: ${pollInterval/1000}s)...`);

                // Check login status
                const loginStatus = await this.checkNetflixLoginStatus();

                // ✅ SUCCESS - Cookie is live!
                if (loginStatus.success) {
                    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`✅ Cookie VERIFIED after ${totalTime}s (${checkCount} checks)`);
                    return { success: true };
                }

                // ❌ REAL ERROR - Not just "not ready yet"
                if (loginStatus.errorCode && loginStatus.errorCode !== 'NOT_BROWSING') {
                    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`❌ Real error detected after ${totalTime}s: ${loginStatus.errorCode}`);
                    return loginStatus;
                }

                // ⏳ NOT_BROWSING - Still loading, increase interval adaptively
                if (loginStatus.errorCode === 'NOT_BROWSING') {
                    console.log('⏳ Netflix still loading, will check again...');
                    // Gradually increase interval for slow networks
                    pollInterval = Math.min(pollInterval + 1000, maxInterval);
                }
            }

            // ⏱️ TIMEOUT - Exceeded max wait time
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`⏱️ Timeout after ${totalTime}s (${checkCount} checks) - Network too slow`);
            return {
                success: false,
                errorCode: 'TIMEOUT_SLOW_NETWORK',
                message: 'Network connection is too slow. Please check your internet and try again.'
            };
            
        } catch (error) {
            console.error('❌ Inject cookie error:', error);
            
            // Nếu là extension timeout → return như extension error
            if (error.message && error.message.includes('EXTENSION_TIMEOUT')) {
                return {
                    success: false,
                    errorCode: 'EXTENSION_OFFLINE',
                    error: error.message
                };
            }
            
            return {
                success: false,
                errorCode: 'INJECTION_FAILED',
                error: error.message
            };
        }
    }
    
    /**
     * Check Netflix login status via extension
     * Logic: 
     * 1. Nếu URL = /browse → Cookie LIVE ✅
     * 2. Nếu có error NSES-500 → Refresh → Check lại
     *    - Sau refresh vào /browse → Cookie LIVE ✅
     *    - Sau refresh không vào /browse → Cookie DIE ❌
     * 3. Nếu không phải /browse và không có error → Cookie DIE ❌
     */
    async checkNetflixLoginStatus() {
        try {
            // Use existing extension communication from app.js
            // Check both extension presence and version
            console.log('🔍 Extension state check:', {
                hasExtension: window.state?.hasExtension,
                extensionOutdated: window.state?.extensionOutdated,
                extensionId: window.CONFIG?.EXTENSION_ID ? 'Present' : 'Missing'
            });
            
            if (!window.state?.hasExtension || window.state?.extensionOutdated || !window.CONFIG?.EXTENSION_ID) {
                console.error('❌ Extension check failed:', {
                    hasExtension: window.state?.hasExtension,
                    extensionOutdated: window.state?.extensionOutdated,
                    hasExtensionId: !!window.CONFIG?.EXTENSION_ID
                });
                return { success: false, errorCode: 'NO_EXTENSION' };
            }
            
            console.log('🔍 Checking Netflix login status...');
            
            // Send message to extension to check Netflix tab status
            const response = await chrome.runtime.sendMessage(
                window.CONFIG.EXTENSION_ID,
                { action: 'checkNetflixStatus' }
            );
            
            if (response && response.success) {
                console.log('📊 Login status response:', response.loginStatus, response.url);
                
                // ✅ Case 1: Đã vào /browse → Cookie LIVE
                if (response.loginStatus === 'success') {
                    console.log('✅ URL is /browse → Cookie LIVE!');
                    return { success: true };
                }
                
                // ⚠️ Case 2: Có error NSES-500 → Cần refresh và check lại
                if (response.loginStatus === 'error') {
                    console.log(`⚠️ Detected error: ${response.errorCode}`);
                    console.log('🔄 Refreshing page to verify cookie...');
                    
                    // Update progress to show we're refreshing
                    if (window.showStepStatus) {
                        window.showStepStatus(2, 'warning', `🔄 Phát hiện lỗi ${response.errorCode}, đang refresh để kiểm tra...`);
                    }
                    
                    // Refresh và check lại
                    const refreshResult = await this.refreshAndRecheck();
                    
                    if (refreshResult.success) {
                        console.log('✅ Sau refresh vào /browse → Cookie LIVE!');
                        return { success: true };
                    } else {
                        console.log('❌ Sau refresh vẫn không vào /browse → Cookie DIE!');
                        return {
                            success: false,
                            errorCode: response.errorCode || 'NETFLIX_ERROR'
                        };
                    }
                }
                
                // ❌ Case 3: Không vào /browse và không có error → Cookie DIE
                console.log('❌ Not at /browse and no specific error → Cookie DIE!');
                return {
                    success: false,
                    errorCode: 'NOT_BROWSING'
                };
            }
            
            // Fallback: extension không trả lời hoặc lỗi
            console.warn('⚠️ No valid response from extension');
            return {
                success: false,
                errorCode: 'NO_RESPONSE'
            };
            
        } catch (error) {
            console.error('❌ Check login status error:', error);
            return {
                success: false,
                errorCode: 'CHECK_FAILED',
                error: error.message
            };
        }
    }
    
    /**
     * Refresh Netflix page and recheck status
     */
    async refreshAndRecheck() {
        try {
            console.log('🔄 Refreshing Netflix page...');
            
            // Send refresh command to extension
            const refreshResponse = await chrome.runtime.sendMessage(
                window.CONFIG.EXTENSION_ID,
                { action: 'refreshNetflixTab' }
            );
            
            if (!refreshResponse?.success) {
                console.warn('⚠️ Failed to refresh Netflix tab');
                return { success: false, errorCode: 'REFRESH_FAILED' };
            }
            
            // Wait for page to load
            console.log('⏳ Waiting for page to reload...');
            await this.sleep(10000); // Wait 10 seconds for page to fully load (increased for slow networks)
            
            // Check status again
            console.log('🔍 Checking status after refresh...');
            const response = await chrome.runtime.sendMessage(
                window.CONFIG.EXTENSION_ID,
                { action: 'checkNetflixStatus' }
            );
            
            if (response && response.success && response.loginStatus === 'success') {
                console.log('✅ Success after refresh!');
                
                // Clear warning message
                if (window.hideStepStatus) {
                    window.hideStepStatus(2);
                }
                if (window.showStepStatus) {
                    window.showStepStatus(2, 'success', '✅ Đăng nhập thành công sau khi refresh!');
                }
                
                return { success: true };
            }
            
            console.log('❌ Still failed after refresh');
            return { 
                success: false, 
                errorCode: response?.errorCode || 'STILL_FAILED_AFTER_REFRESH' 
            };
            
        } catch (error) {
            console.error('❌ Refresh and recheck error:', error);
            return { 
                success: false, 
                errorCode: 'REFRESH_ERROR',
                error: error.message 
            };
        }
    }
    
    /**
     * Confirm cookie assignment (gọi khi login success)
     * Chỉ khi gọi method này, cookie mới được gán user và tăng slot +1
     */
    async confirmCookie(cookieId) {
        try {
            console.log('✅ Confirming cookie assignment...');
            console.log('🍪 Cookie ID:', cookieId);
            
            const response = await fetch(`${this.backendUrl}/api/cookies/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ cookieId })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.warn('⚠️ Failed to confirm cookie:', errorData.error);
                return false;
            }
            
            const data = await response.json();
            console.log('✅ Cookie CONFIRMED successfully!');
            console.log(`📊 Cookie #${data.cookieNumber} - Slots: ${data.sharedUsers}/4`);
            return true;
            
        } catch (error) {
            console.error('❌ Confirm cookie error:', error);
            return false;
        }
    }
    
    /**
     * Mark cookie as dead in backend (user endpoint - không cần admin)
     */
    async markCookieAsDead(cookieId, errorCode) {
        try {
            console.log(`⚠️ Reporting failed cookie to backend...`);
            console.log(`🍪 Cookie ID: ${cookieId}`);
            console.log(`❌ Error code: ${errorCode}`);
            
            const response = await fetch(`${this.backendUrl}/api/cookies/${cookieId}/report-failed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    errorCode: errorCode || 'UNKNOWN'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Cookie #${data.cookieNumber} marked as failed (die, recheck)`);
                console.log(`⚠️ Cookie NOT assigned - slot unchanged`);
                console.log(`📝 Status: isActive=false`);
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.warn(`⚠️ Failed to mark cookie as dead:`, errorData.error || response.status);
            }
            
        } catch (error) {
            console.error('❌ Mark cookie as dead error:', error);
        }
    }
    
    /**
     * Release cookie assignment for a specific cookie (không mark die)
     * Dùng khi gặp lỗi extension - cookie vẫn tốt nhưng không thể verify
     */
    async releaseCookieAssignment(cookieId) {
        try {
            console.log('🔓 Releasing cookie preview (not marking as dead)...');
            console.log(`🍪 Cookie ID: ${cookieId}`);

            // Gọi backend để release cookie khỏi preview state
            // Không mark die, chỉ remove khỏi user's assignment
            const response = await fetch(`${this.backendUrl}/api/cookies/release`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.ok) {
                console.log('✅ Cookie preview released (cookie still active)');
            } else {
                console.warn('⚠️ Failed to release cookie:', response.status);
            }

        } catch (error) {
            console.error('❌ Release cookie assignment error:', error);
        }
    }

    /**
     * Release cookie from user (khi hết retries)
     */
    async releaseCookie() {
        try {
            console.log('🔓 Releasing failed cookie assignment from user...');
            const response = await fetch(`${this.backendUrl}/api/cookies/release`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.ok) {
                console.log('✅ Cookie released successfully');
            } else {
                console.warn('⚠️ Failed to release cookie:', response.status);
            }

        } catch (error) {
            console.error('❌ Release cookie error:', error);
        }
    }
    
    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in app.js
window.CookieRetryHandler = CookieRetryHandler;


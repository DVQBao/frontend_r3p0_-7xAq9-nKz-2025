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
                    throw new Error('Không có cookie khả dụng');
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
                
                // Failed - mark cookie as dead (KHÔNG tăng slot)
                console.log('❌ Login failed, marking cookie as dead...');
                await this.markCookieAsDead(cookieData.cookieId, result.errorCode);
                
                // Add to used list
                this.usedCookies.add(cookieData.cookieId);
                
                // Update progress
                if (onProgress) {
                    onProgress({
                        status: 'retrying',
                        attempt: this.currentRetry,
                        maxAttempts: this.maxRetries,
                        message: `Cookie #${cookieData.cookieNumber} lỗi, đang thử cookie khác...`,
                        errorCode: result.errorCode
                    });
                }
                
                // Wait before retry
                await this.sleep(2000);
                
            } catch (error) {
                console.error(`❌ Attempt ${this.currentRetry} failed:`, error);
                
                if (this.currentRetry >= this.maxRetries) {
                    // Out of retries
                    console.log('❌ Reached max retries');
                    console.log('⚠️ No cookie was assigned (all failed)');
                    
                    if (onProgress) {
                        onProgress({
                            status: 'failed',
                            message: 'Đăng nhập thất bại. Vui lòng thử lại sau.',
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
            error: 'Đã thử tất cả cookie nhưng không thành công'
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
                throw new Error(response?.error || 'Extension injection failed');
            }
            
            console.log('✅ Cookie injected successfully, waiting 3s...');
            // Wait for Netflix to process cookie
            await this.sleep(3000);
            
            console.log('🔍 Checking login status...');
            // Check login status via extension
            const loginStatus = await this.checkNetflixLoginStatus();
            console.log('📊 Login status:', loginStatus);
            
            return loginStatus;
            
        } catch (error) {
            console.error('❌ Inject cookie error:', error);
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
            if (!window.state?.hasExtension || !window.CONFIG?.EXTENSION_ID) {
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
            await this.sleep(5000); // Wait 5 seconds for page to fully load
            
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


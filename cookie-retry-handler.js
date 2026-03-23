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

    getExtensionSignalHeaderValue() {
        const payload = {
            extensionId: window.state?.extensionId || window.CONFIG?.EXTENSION_ID || 'unknown',
            version: window.state?.extensionVersion || 'unknown',
            source: 'webapp'
        };
        return JSON.stringify(payload);
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
                    const confirmResult = await this.confirmCookie(cookieData.cookieId);

                    // Kiểm tra xem cookie đã có SecureNetflixId chưa
                    // Nếu chưa có → bắt đầu polling background để lấy và sync
                    if (confirmResult && !confirmResult.hasSecureNetflixId) {
                        console.log('🔐 Cookie chưa có SecureNetflixId - Bắt đầu polling background...');
                        // Lấy cookieId từ confirmResult (backend trả về)
                        const cookieIdToSync = confirmResult.cookieId || cookieData.cookieId;
                        this.startSecureNetflixIdPolling(cookieIdToSync, confirmResult.cookieNumber);
                    } else {
                        console.log('✅ Cookie đã có SecureNetflixId - Không cần polling');
                    }

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
                const extensionErrors = ['NO_RESPONSE', 'CHECK_FAILED', 'NO_EXTENSION', 'EXTENSION_OFFLINE', 'INJECTION_FAILED'];

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
                    if (typeof window.closeTeamModal === 'function') {
                        window.closeTeamModal();
                        console.log('✅ Closed "Đang đăng nhập..." modal');
                    } else {
                        // Fallback: Tự tắt modal
                        const teamModal = document.getElementById('teamModal');
                        if (teamModal) {
                            teamModal.classList.remove('active');
                            console.log('✅ Manually closed teamModal');
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
                                `5️⃣ Nếu vẫn lỗi, chuyển sang trình duyệt khác (NÊN LÀM)\n\n` +
                                `Vui lòng thử lại sau khi fix Extension!`,
                            buttons: isTimeout
                                ? [
                                    {
                                        text: 'Thử lại', type: 'primary', action: () => {
                                            window.location.reload();
                                        }
                                    }
                                ]
                                : [
                                    {
                                        text: 'Hướng dẫn cài Extension', type: 'secondary', action: () => {
                                            window.open('/install-guide', '_blank');
                                        }
                                    },
                                    {
                                        text: 'Refresh trang', type: 'primary', action: () => {
                                            window.location.reload();
                                        }
                                    }
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

                // 🚫 NO CREDITS ERROR - Dừng ngay, hiển thị modal mua credits
                if (error.code === 'NO_CREDITS') {
                    console.error('💳 NO CREDITS - User needs to purchase more credits');

                    if (onProgress) {
                        onProgress({
                            status: 'no_credits',
                            message: 'Bạn đã hết credits',
                            error: error.message
                        });
                    }

                    // Hiển thị modal mua credits
                    if (typeof window.showNoCreditsModal === 'function') {
                        window.showNoCreditsModal();
                    } else if (typeof window.showCustomModal === 'function') {
                        window.showCustomModal({
                            icon: '💳',
                            title: 'Hết Credits',
                            message: error.message,
                            buttons: [{ text: 'OK', type: 'primary' }]
                        });
                    } else {
                        alert(error.message);
                    }

                    return {
                        success: false,
                        error: error.message,
                        isNoCredits: true
                    };
                }

                // 🚫 NO REPORT LIMIT ERROR - Dừng ngay, hiển thị modal hết lượt
                if (error.code === 'NO_REPORT_LIMIT' || error.code === 'LIMIT_EXCEEDED') {
                    console.error('⚠️ NO REPORT LIMIT - User out of monthly switches');

                    if (onProgress) {
                        onProgress({
                            status: 'no_report_limit',
                            message: 'Bạn đã hết lượt đổi tài khoản',
                            error: error.message
                        });
                    }

                    return {
                        success: false,
                        error: error.message,
                        isNoReportLimit: true
                    };
                }

                // 🚨 TOO MANY RETRIES ERROR - Abuse detected, dừng ngay
                if (error.isTooManyRetries || error.code === 'TOO_MANY_RETRIES') {
                    console.error('🚨 TOO MANY RETRIES - Abuse detected, stopping all retries');

                    if (onProgress) {
                        onProgress({
                            status: 'too_many_retries',
                            message: error.message,
                            error: error.message
                        });
                    }

                    // Hiển thị modal cảnh báo abuse
                    if (typeof window.showCustomModal === 'function') {
                        window.showCustomModal({
                            icon: '🚨',
                            title: 'Thử quá nhiều lần',
                            message: error.message + '\n\nNếu bạn gặp vấn đề liên tục, vui lòng liên hệ support qua Facebook.',
                            buttons: [
                                {
                                    text: 'Liên hệ Support', type: 'secondary', action: () => {
                                        window.open('https://www.facebook.com/tiembanh4k/', '_blank');
                                    }
                                },
                                { text: 'Đã hiểu', type: 'primary' }
                            ]
                        });
                    } else {
                        console.error('❌ showCustomModal not available!');
                        alert(error.message);
                    }

                    return {
                        success: false,
                        error: error.message,
                        isTooManyRetries: true
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

                // 🚨 ABUSE DETECTED (R1/R2/R4/R5) - Tài khoản bị khóa tự động
                if (error.isAbuse || error.code === 'ABUSE_DETECTED') {
                    console.error('🚨 ABUSE DETECTED - Account permanently banned');

                    if (onProgress) {
                        onProgress({
                            status: 'banned',
                            message: error.message,
                            error: error.message
                        });
                    }

                    if (typeof window.showCustomModal === 'function') {
                        window.showCustomModal({
                            icon: '🚫',
                            title: 'Tài khoản bị khóa',
                            message: error.message,
                            buttons: [{ text: 'Đã hiểu', type: 'primary' }]
                        });
                    } else {
                        alert(error.message);
                    }

                    return {
                        success: false,
                        error: error.message,
                        isAbuse: true
                    };
                }

                // 🔒 SKIP_CURRENT_FORBIDDEN - Không có proof, dừng retry
                if (error.isSkipForbidden || error.code === 'SKIP_CURRENT_FORBIDDEN') {
                    console.error('🔒 SKIP_CURRENT_FORBIDDEN - No valid proof, stopping');

                    if (onProgress) {
                        onProgress({
                            status: 'failed',
                            message: error.message,
                            error: error.message
                        });
                    }

                    return {
                        success: false,
                        error: error.message,
                        isSkipForbidden: true
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

            const nonce = await this.getOneTimeNonce();
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`,
                    'x-ext-infor': this.getExtensionSignalHeaderValue(),
                    'x-once-nonce': nonce
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const securitySignal = response.headers.get('x-security-signal') || errorData.code || '';
                const errorMsg = errorData.message || errorData.error || `HTTP ${response.status}`;

                // ⚠️ CHECK RATE LIMIT ERROR - Dừng ngay, không retry
                if (securitySignal === 'RATE_LIMIT_EXCEEDED') {
                    const rateLimitError = new Error(errorMsg || 'Tài khoản của bạn đã bị tạm khóa do nghi ngờ hoạt động bất thường. Vui lòng thử lại sau.');
                    rateLimitError.isRateLimited = true;
                    rateLimitError.code = 'RATE_LIMIT_EXCEEDED';
                    console.error('🚫 RATE LIMIT EXCEEDED - Stop retrying');
                    throw rateLimitError;
                }

                // 🚨 CHECK TOO MANY RETRIES - Abuse detected
                if (securitySignal === 'TOO_MANY_RETRIES') {
                    const abuseError = new Error(errorMsg || 'Bạn đã thử quá nhiều lần. Vui lòng liên hệ support.');
                    abuseError.isTooManyRetries = true;
                    abuseError.code = 'TOO_MANY_RETRIES';
                    console.error('🚨 TOO MANY RETRIES - Abuse detected, stop retrying');
                    throw abuseError;
                }

                // 🚨 ABUSE DETECTED (R1/R2/R4/R5) - Tài khoản đã bị khóa tự động
                if (securitySignal === 'ABUSE_DETECTED' || response.status === 429) {
                    const abuseError = new Error(errorMsg || 'Phát hiện hoạt động bất thường. Tài khoản đã bị khóa.');
                    abuseError.isAbuse = true;
                    abuseError.code = 'ABUSE_DETECTED';
                    console.error('🚨 ABUSE DETECTED - Account banned, stop retrying');
                    throw abuseError;
                }

                // 🔒 SKIP_CURRENT_FORBIDDEN - skipCurrent không có proof hợp lệ
                if (securitySignal === 'SKIP_CURRENT_FORBIDDEN') {
                    const skipError = new Error(errorMsg || 'Không thể đổi tài khoản. Vui lòng thử lại từ đầu.');
                    skipError.isSkipForbidden = true;
                    skipError.code = 'SKIP_CURRENT_FORBIDDEN';
                    console.error('🔒 SKIP_CURRENT_FORBIDDEN - Stop retrying');
                    throw skipError;
                }

                throw new Error(errorMsg);

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
            console.log('🔄 Starting OPTIMIZED POLLING to check cookie status...');

            // ========================================
            // OPTIMIZED POLLING WITH HARD F5 RECOVERY
            // Phase 1: 3 checks in 10s
            // Phase 2: Hard F5 #1 + 2s wait
            // Phase 3: Hard F5 #2 + 3s wait
            // Phase 4: Timeout
            // ========================================
            const startTime = Date.now();
            let checkCount = 0;
            let hardResetCount = 0;

            // ========================================
            // PHASE 1: Initial polling (3 checks, max 10s)
            // ========================================
            console.log('📋 PHASE 1: Initial polling (3 checks in 10s)...');
            const pollInterval = 3000; // 3s between checks
            const maxChecks = 3;

            for (let i = 0; i < maxChecks; i++) {
                checkCount++;
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

                // Wait before checking
                await this.sleep(pollInterval);

                console.log(`🔍 Check #${checkCount} after ${elapsed}s...`);

                // Check login status
                const loginStatus = await this.checkNetflixLoginStatus();

                // ✅ SUCCESS - Cookie is live!
                if (loginStatus.success) {
                    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`✅ Cookie VERIFIED after ${totalTime}s (${checkCount} checks, ${hardResetCount} hard resets)`);
                    return { success: true };
                }

                // ❌ REAL ERROR - Not just "not ready yet"
                if (loginStatus.errorCode && loginStatus.errorCode !== 'NOT_BROWSING') {
                    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`❌ Real error detected after ${totalTime}s: ${loginStatus.errorCode}`);
                    return loginStatus;
                }

                // ⏳ NOT_BROWSING - Still loading
                if (loginStatus.errorCode === 'NOT_BROWSING') {
                    console.log('⏳ Netflix still loading...');
                }
            }

            // ========================================
            // PHASE 2: Hard F5 #1 + 2s wait
            // ========================================
            console.log('🔄 PHASE 2: Still NOT_BROWSING after 10s → Triggering HARD RESET F5 #1...');
            hardResetCount++;

            try {
                if (typeof window.refreshNetflixTabViaExtension !== 'function') {
                    console.warn('⚠️ refreshNetflixTabViaExtension not available');
                } else {
                    const f5Result = await window.refreshNetflixTabViaExtension();
                    console.log(`✅ Hard F5 #${hardResetCount} triggered:`, f5Result);
                }
            } catch (error) {
                console.warn('⚠️ Failed to trigger Hard F5 #1:', error);
            }

            await this.sleep(2000); // Wait 2s
            checkCount++;
            let elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`🔍 Check #${checkCount} after ${elapsed}s (post Hard F5 #1)...`);

            let loginStatus = await this.checkNetflixLoginStatus();

            // ✅ SUCCESS after F5 #1
            if (loginStatus.success) {
                const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`✅ Cookie VERIFIED after ${totalTime}s (${checkCount} checks, ${hardResetCount} hard resets)`);
                return { success: true };
            }

            // ❌ REAL ERROR
            if (loginStatus.errorCode && loginStatus.errorCode !== 'NOT_BROWSING') {
                const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`❌ Real error detected after ${totalTime}s: ${loginStatus.errorCode}`);
                return loginStatus;
            }

            // ========================================
            // PHASE 3: Hard F5 #2 + 3s wait
            // ========================================
            console.log('🔄 PHASE 3: Still NOT_BROWSING → Triggering HARD RESET F5 #2...');
            hardResetCount++;

            try {
                if (typeof window.refreshNetflixTabViaExtension !== 'function') {
                    console.warn('⚠️ refreshNetflixTabViaExtension not available');
                } else {
                    const f5Result = await window.refreshNetflixTabViaExtension();
                    console.log(`✅ Hard F5 #${hardResetCount} triggered:`, f5Result);
                }
            } catch (error) {
                console.warn('⚠️ Failed to trigger Hard F5 #2:', error);
            }

            await this.sleep(3000); // Wait 3s
            checkCount++;
            elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`🔍 Check #${checkCount} after ${elapsed}s (post Hard F5 #2)...`);

            loginStatus = await this.checkNetflixLoginStatus();

            // ✅ SUCCESS after F5 #2
            if (loginStatus.success) {
                const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`✅ Cookie VERIFIED after ${totalTime}s (${checkCount} checks, ${hardResetCount} hard resets)`);
                return { success: true };
            }

            // ❌ REAL ERROR
            if (loginStatus.errorCode && loginStatus.errorCode !== 'NOT_BROWSING') {
                const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`❌ Real error detected after ${totalTime}s: ${loginStatus.errorCode}`);
                return loginStatus;
            }

            // ========================================
            // PHASE 4: TIMEOUT - Failed after all attempts
            // ========================================
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`⏱️ TIMEOUT after ${totalTime}s (${checkCount} checks, ${hardResetCount} hard resets) - Cookie failed`);
            return {
                success: false,
                errorCode: 'TIMEOUT_SLOW_NETWORK',
                message: 'Network connection is too slow or cookie is invalid. Please try again.'
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
                    'Authorization': `Bearer ${this.authToken}`,
                    'x-ext-infor': this.getExtensionSignalHeaderValue()
                },
                body: JSON.stringify({ cookieId })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.warn('⚠️ Failed to confirm cookie:', errorData.error);
                return null;
            }

            const data = await response.json();
            console.log('✅ Cookie CONFIRMED successfully!');
            console.log(`📊 Cookie #${data.cookieNumber} - Slots: ${data.sharedUsers}/4`);
            console.log(`🔐 hasSecureNetflixId: ${data.hasSecureNetflixId}`);

            // Return full data để caller biết cần polling không
            return data;

        } catch (error) {
            console.error('❌ Confirm cookie error:', error);
            return null;
        }
    }

    /**
     * Bắt đầu polling background để lấy SecureNetflixId
     * Chạy mỗi 20s, KHÔNG GIỚI HẠN - chỉ dừng khi tìm thấy SecureNetflixId
     */
    startSecureNetflixIdPolling(cookieId, cookieNumber) {
        console.log(`🔄 [Polling] Starting SecureNetflixId polling for cookie #${cookieNumber}...`);
        console.log(`ℹ️ [Polling] Will check every 20s until SecureNetflixId is found`);

        let attempts = 0;
        const intervalMs = 20000; // 20 giây

        const pollInterval = setInterval(async () => {
            attempts++;
            console.log(`🔄 [Polling] Check #${attempts} - Looking for Netflix cookies...`);

            try {
                // Gọi extension để lấy CẢ HAI cookies
                const cookiesResponse = await this.getSecureNetflixIdFromExtension();

                // Cần CẢ HAI: netflixId và secureNetflixId
                if (cookiesResponse.success && cookiesResponse.netflixId && cookiesResponse.secureNetflixId) {
                    console.log(`✅ [Polling] Both cookies found!`);
                    console.log(`   NetflixId: ${cookiesResponse.netflixId.substring(0, 50)}...`);
                    console.log(`   SecureNetflixId: ${cookiesResponse.secureNetflixId.substring(0, 50)}...`);

                    // Sync CẢ HAI về backend
                    try {
                        await this.syncSecureNetflixId(cookieId, cookiesResponse.secureNetflixId, cookiesResponse.netflixId);
                        console.log(`✅ [Polling] Cookies synced successfully for cookie #${cookieNumber}`);
                    } catch (syncError) {
                        console.warn(`⚠️ [Polling] Failed to sync:`, syncError);
                    }

                    // Dừng polling
                    clearInterval(pollInterval);
                    console.log(`🛑 [Polling] Stopped - Cookies synced after ${attempts} checks`);
                    return;
                }

                // Log mỗi 3 lần để không spam console
                if (attempts % 3 === 0) {
                    console.log(`⏳ [Polling] Cookies not ready yet (${attempts} checks). Waiting for user to select profile...`);
                    console.log(`   Has NetflixId: ${!!cookiesResponse.netflixId}`);
                    console.log(`   Has SecureNetflixId: ${!!cookiesResponse.secureNetflixId}`);
                }

            } catch (error) {
                console.warn(`⚠️ [Polling] Error:`, error);
            }

        }, intervalMs);

        // Chạy ngay lần đầu sau 5s (đợi user chọn profile)
        setTimeout(async () => {
            console.log(`🔄 [Polling] Initial check after 5s...`);
            try {
                const cookiesResponse = await this.getSecureNetflixIdFromExtension();

                if (cookiesResponse.success && cookiesResponse.netflixId && cookiesResponse.secureNetflixId) {
                    console.log(`✅ [Polling] Both cookies found on initial check!`);

                    try {
                        await this.syncSecureNetflixId(cookieId, cookiesResponse.secureNetflixId, cookiesResponse.netflixId);
                        console.log(`✅ [Polling] Cookies synced successfully`);
                    } catch (syncError) {
                        console.warn(`⚠️ [Polling] Failed to sync:`, syncError);
                    }

                    // Dừng polling
                    clearInterval(pollInterval);
                    console.log(`🛑 [Polling] Stopped - Cookies synced`);
                }
            } catch (error) {
                console.warn(`⚠️ [Polling] Initial check error:`, error);
            }
        }, 5000);
    }

    /**
     * Lấy SecureNetflixId từ extension
     * Gọi sau khi đã verify login thành công (đã vào /browse và chọn profile)
     */
    async getSecureNetflixIdFromExtension() {
        return new Promise((resolve, reject) => {
            console.log('🔐 Requesting SecureNetflixId from extension...');

            if (!window.CONFIG?.EXTENSION_ID) {
                reject(new Error('Extension ID not found'));
                return;
            }

            const timeout = setTimeout(() => {
                console.warn('⏱️ GetSecureNetflixId timeout after 5s');
                resolve({ success: false, error: 'Timeout' });
            }, 5000);

            chrome.runtime.sendMessage(
                window.CONFIG.EXTENSION_ID,
                { action: 'getSecureNetflixId' },
                (response) => {
                    clearTimeout(timeout);

                    if (chrome.runtime.lastError) {
                        console.error('Extension error:', chrome.runtime.lastError);
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                        return;
                    }

                    console.log('📥 GetSecureNetflixId response:', response);
                    resolve(response || { success: false, error: 'No response' });
                }
            );
        });
    }

    /**
     * Sync CẢ HAI cookies về backend (NetflixId + SecureNetflixId)
     * Cả hai cần thiết cho tính năng TV Activation (phải là cặp từ cùng session)
     * @param {string} cookieId - ID của cookie trong DB
     * @param {string} netflixId - Giá trị NetflixId từ browser
     * @param {string} secureNetflixId - Giá trị SecureNetflixId từ browser
     */
    async syncSecureNetflixId(cookieId, secureNetflixId, netflixId = null) {
        try {
            console.log('🔐 Syncing Netflix cookies to backend...');
            console.log(`🍪 Cookie ID: ${cookieId}`);
            if (netflixId) {
                console.log(`🔐 NetflixId preview: ${netflixId.substring(0, 50)}...`);
            }
            console.log(`🔐 SecureNetflixId preview: ${secureNetflixId.substring(0, 50)}...`);

            const response = await fetch(`${this.backendUrl}/api/cookies/sync-secure`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    cookieId,
                    netflixId,      // Thêm NetflixId mới
                    secureNetflixId
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.netflixIdUpdated || data.secureNetflixIdUpdated) {
                console.log(`✅ Cookies synced for cookie #${data.cookieNumber}:`,
                    data.netflixIdUpdated ? 'NetflixId' : '',
                    data.secureNetflixIdUpdated ? 'SecureNetflixId' : ''
                );
            } else {
                console.log(`ℹ️ Cookies already up-to-date for cookie #${data.cookieNumber}`);
            }

            return true;

        } catch (error) {
            console.error('❌ Sync cookies error:', error);
            throw error;
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

            const nonce = await this.getOneTimeNonce();
            const response = await fetch(`${this.backendUrl}/api/cookies/${cookieId}/report-failed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`,
                    'x-ext-infor': this.getExtensionSignalHeaderValue(),
                    'x-once-nonce': nonce
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
                const securitySignal = response.headers.get('x-security-signal') || errorData.code || '';
                const errorMsg = errorData.message || errorData.error || 'Request failed';

                // 🚨 ABUSE DETECTED (R5: report-failed quá nhanh → ban ngay)
                if (securitySignal === 'ABUSE_DETECTED' || response.status === 429) {
                    const abuseError = new Error(errorMsg || 'Phát hiện hoạt động bất thường. Tài khoản đã bị khóa.');
                    abuseError.isAbuse = true;
                    abuseError.code = 'ABUSE_DETECTED';
                    console.error('🚨 ABUSE_DETECTED from report-failed - Account banned, stopping');
                    throw abuseError;
                }

                // 🔒 INVALID_ORIGIN (R3 bypass attempt)
                if (securitySignal === 'INVALID_ORIGIN') {
                    const originError = new Error(errorMsg || 'Request không hợp lệ.');
                    originError.isAbuse = true;
                    originError.code = 'INVALID_ORIGIN';
                    console.error('🔒 INVALID_ORIGIN from report-failed, stopping');
                    throw originError;
                }

                // Lỗi khác (404, 500...) → log warn, không throw (không ảnh hưởng UX)
                console.warn(`⚠️ Failed to mark cookie as dead:`, errorData.error || response.status);
            }

        } catch (error) {
            // Re-throw lỗi abuse để attemptLogin bắt được và dừng retry
            if (error.isAbuse) throw error;
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

    async getOneTimeNonce() {
        const response = await fetch(`${this.backendUrl}/api/cookies/nonce`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`,
                'x-ext-infor': this.getExtensionSignalHeaderValue()
            }
        });

        if (!response.ok) {
            throw new Error('Không thể tạo nonce bảo mật');
        }

        const data = await response.json().catch(() => ({}));
        if (!data.nonce) {
            throw new Error('Phản hồi nonce không hợp lệ');
        }
        return data.nonce;
    }
}

// Export for use in app.js
window.CookieRetryHandler = CookieRetryHandler;


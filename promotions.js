(function () {
    'use strict';

    const API_BASE = window.APP_CONFIG?.BACKEND_URL || '';
    const originalOpenPaymentModal = window.openPaymentModal;
    const originalOpenPurchaseCreditsModal = window.openPurchaseCreditsModal;
    const originalCalculateCredits = window.calculateCredits;
    const originalClosePurchaseCreditsModal = window.closePurchaseCreditsModal;
    const INVALID_COUPON_MESSAGE = 'Mã ưu đãi không hợp lệ, vui lòng kiểm tra lại!';
    const COUPON_FORFEIT_CAUTION = 'Lưu ý: Nếu tiếp tục thanh toán mà không áp dụng mã ưu đãi, mã ưu đãi hiện có của bạn vẫn sẽ bị mất hiệu lực.';

    const state = {
        activeCoupon: null,
        payment: null,
        proPromptContext: null,
        creditCheckoutInProgress: false,
        pendingRequestKey: 0
    };

    function authHeaders(includeJson = true) {
        const headers = { Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}` };
        if (includeJson) headers['Content-Type'] = 'application/json';
        return headers;
    }

    function formatVnd(value) {
        return `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;
    }

    function parseMoney(value) {
        const digits = String(value || '').replace(/\D/g, '');
        return digits ? Number(digits) : 0;
    }

    function couponGiftMessage(discountAmountVnd) {
        return `Tài khoản của bạn đang được tặng 01 mã ưu đãi để giảm ${formatVnd(discountAmountVnd)}. Kiểm tra email nhé!`;
    }

    function couponGiftPlainText(discountAmountVnd) {
        return `${couponGiftMessage(discountAmountVnd)} ${COUPON_FORFEIT_CAUTION}`;
    }

    function renderCouponGiftNotice(element, discountAmountVnd) {
        if (!element) return;
        const message = document.createElement('span');
        message.className = 'coupon-gift-message';
        message.textContent = couponGiftMessage(discountAmountVnd);
        const caution = document.createElement('em');
        caution.className = 'coupon-forfeit-caution';
        caution.textContent = COUPON_FORFEIT_CAUTION;
        element.replaceChildren(message, caution);
        element.style.display = '';
    }

    function setMessage(prefix, message, type = '') {
        const element = document.getElementById(`${prefix}CouponMessage`);
        if (!element) return;
        element.textContent = message;
        element.className = `coupon-entry-message${type ? ` is-${type}` : ''}`;
    }

    function couponApplication() {
        return state.activeCoupon?.application || null;
    }

    function couponMatches(productType, originalAmountVnd) {
        const application = couponApplication();
        return Boolean(application && application.productType === productType &&
            Number(application.originalAmountVnd) === Number(originalAmountVnd));
    }

    function renderCouponControls(prefix, coupon, productType, originalAmountVnd) {
        const application = coupon?.application;
        const active = Boolean(application && application.productType === productType &&
            Number(application.originalAmountVnd) === Number(originalAmountVnd));
        const input = document.getElementById(`${prefix}CouponInput`);
        const applyButton = document.getElementById(`${prefix}CouponApplyBtn`);
        const removeButton = document.getElementById(`${prefix}CouponRemoveBtn`);
        const breakdown = document.getElementById(`${prefix}CouponBreakdown`);

        if (input && active) {
            input.value = coupon.code;
            input.disabled = true;
        } else if (input) {
            input.disabled = false;
        }
        if (applyButton) applyButton.style.display = active ? 'none' : 'inline-flex';
        if (removeButton) removeButton.style.display = active ? 'inline-flex' : 'none';
        if (breakdown) breakdown.classList.toggle('is-active', active);

        if (active) {
            document.getElementById(`${prefix}CouponOriginal`).textContent = formatVnd(application.originalAmountVnd);
            document.getElementById(`${prefix}CouponDiscount`).textContent = `-${formatVnd(application.discountAmountVnd)}`;
            const final = document.getElementById(`${prefix}CouponFinal`);
            if (final) final.textContent = formatVnd(application.finalAmountVnd);
            setMessage(prefix, 'Mã khuyến mãi hợp lệ, đã áp dụng thành công!', 'success');
        }
    }

    function clearCouponUi(prefix, message) {
        const input = document.getElementById(`${prefix}CouponInput`);
        const applyButton = document.getElementById(`${prefix}CouponApplyBtn`);
        const removeButton = document.getElementById(`${prefix}CouponRemoveBtn`);
        const breakdown = document.getElementById(`${prefix}CouponBreakdown`);
        if (input) {
            input.value = '';
            input.disabled = false;
        }
        if (applyButton) applyButton.style.display = 'inline-flex';
        if (removeButton) removeButton.style.display = 'none';
        if (breakdown) breakdown.classList.remove('is-active');
        setMessage(
            prefix,
            message === undefined ? 'Bạn có thể nhập mã ưu đãi dành riêng cho tài khoản này.' : message
        );
    }

    function updatePaymentQr(amount) {
        const qrImg = document.getElementById('paymentQrImage');
        if (!qrImg || !amount) return;
        const params = new URLSearchParams({
            amount: String(amount),
            addInfo: document.getElementById('paymentContent')?.textContent || 'Thanh toan Tiem Banh Netflix',
            accountName: 'DANG VAN QUOC BAO'
        });
        qrImg.src = `https://img.vietqr.io/image/vcb-1039015381-compact2.png?${params.toString()}`;
    }

    function renderCurrentPayment() {
        if (!state.payment) return;
        const { productType, originalAmountVnd } = state.payment;
        const application = couponMatches(productType, originalAmountVnd) ? couponApplication() : null;
        const finalAmount = application ? application.finalAmountVnd : originalAmountVnd;
        const amountElement = document.getElementById('paymentAmount');
        if (amountElement) amountElement.textContent = formatVnd(finalAmount);
        updatePaymentQr(finalAmount);
        renderCouponControls('payment', application ? state.activeCoupon : null, productType, originalAmountVnd);
        if (!application) clearCouponUi('payment', '');
    }

    function renderCreditsTotal(originalAmountVnd) {
        const application = couponMatches('credits', originalAmountVnd) ? couponApplication() : null;
        const total = document.getElementById('totalAmount');
        if (total && originalAmountVnd >= 40000 && originalAmountVnd % 1000 === 0) {
            total.textContent = formatVnd(application ? application.finalAmountVnd : originalAmountVnd);
        }
        renderCouponControls('credits', application ? state.activeCoupon : null, 'credits', originalAmountVnd);
    }

    async function applyCoupon(productType, prefix, originalAmountVnd) {
        const input = document.getElementById(`${prefix}CouponInput`);
        const button = document.getElementById(`${prefix}CouponApplyBtn`);
        const code = String(input?.value || '').trim().toUpperCase();
        if (!localStorage.getItem('auth_token')) {
            setMessage(prefix, 'Vui lòng đăng nhập để sử dụng mã ưu đãi.', 'error');
            return;
        }
        if (!code) {
            setMessage(prefix, 'Vui lòng nhập mã ưu đãi.', 'error');
            return;
        }
        if (!originalAmountVnd) {
            setMessage(prefix, 'Vui lòng chọn giá trị thanh toán trước.', 'error');
            return;
        }

        try {
            if (button) button.disabled = true;
            setMessage(prefix, 'Đang kiểm tra mã ưu đãi...');
            const response = await fetch(`${API_BASE}/api/promotions/apply`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ code, productType, originalAmountVnd })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                const message = [400, 409].includes(response.status)
                    ? INVALID_COUPON_MESSAGE
                    : (data.error || 'Không thể áp dụng mã');
                throw new Error(message);
            }
            const application = data.coupon?.application;
            if (!application || application.productType !== productType ||
                Number(application.originalAmountVnd) !== Number(originalAmountVnd)) {
                throw new Error('Mã khuyến mãi không hợp lệ cho giao dịch này.');
            }
            state.activeCoupon = data.coupon;
            renderCouponControls(prefix, data.coupon, productType, originalAmountVnd);
            if (productType === 'credits') renderCreditsTotal(originalAmountVnd);
            if (state.payment?.productType === productType) renderCurrentPayment();
            return data.coupon;
        } catch (error) {
            setMessage(prefix, error.message || 'Không thể áp dụng mã ưu đãi.', 'error');
            return null;
        } finally {
            if (button) button.disabled = false;
        }
    }

    async function loadPendingCoupon(productType, originalAmountVnd) {
        if (!localStorage.getItem('auth_token')) return null;
        const requestKey = ++state.pendingRequestKey;
        try {
            const response = await fetch(`${API_BASE}/api/promotions/pending?productType=${encodeURIComponent(productType)}`, {
                headers: authHeaders(false)
            });
            const data = await response.json();
            if (requestKey !== state.pendingRequestKey || !response.ok || !data.coupon) return null;
            if (Number(data.coupon.application?.originalAmountVnd) !== Number(originalAmountVnd)) return null;
            state.activeCoupon = data.coupon;
            if (state.payment?.productType === productType && state.payment.originalAmountVnd === originalAmountVnd) {
                renderCurrentPayment();
            }
            return data.coupon;
        } catch (_error) {
            // Payment remains usable without a coupon when restoring pending state fails.
            return null;
        }
    }

    async function getCheckoutCouponStatus(productType, originalAmountVnd) {
        if (!localStorage.getItem('auth_token')) return { hasCoupon: false, hasAppliedCoupon: false };
        const response = await fetch(`${API_BASE}/api/promotions/checkout/status`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ productType, originalAmountVnd })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Không thể kiểm tra ưu đãi');
        return data;
    }

    async function markCheckoutCouponForfeited(productType, originalAmountVnd) {
        const response = await fetch(`${API_BASE}/api/promotions/checkout/forfeit`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ productType, originalAmountVnd })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Không thể ghi nhận lựa chọn thanh toán');
        }
        state.activeCoupon = null;
        return data;
    }

    function showCouponForfeitWarning(discountAmountVnd) {
        let modal = document.getElementById('couponForfeitWarningModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'couponForfeitWarningModal';
            modal.className = 'modal';
            modal.style.zIndex = '10000100';
            modal.innerHTML = `
                <div class="modal-content premium-modal-shell" style="max-width:520px;">
                    <h2 style="margin:0 0 14px;text-align:center;">Bạn đang có ưu đãi</h2>
                    <p id="couponForfeitWarningNotice" style="margin:0;color:#e4e4e7;line-height:1.7;text-align:center;"></p>
                    <div style="display:flex;gap:10px;margin-top:20px;">
                        <button type="button" class="btn btn-secondary" data-coupon-warning-cancel style="flex:1">Quay lại nhập mã</button>
                        <button type="button" class="btn" data-coupon-warning-confirm style="flex:1">Tiếp tục thanh toán</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        }
        renderCouponGiftNotice(modal.querySelector('#couponForfeitWarningNotice'), discountAmountVnd);
        modal.classList.add('active');
        return new Promise(resolve => {
            const finish = accepted => {
                modal.classList.remove('active');
                resolve(accepted);
            };
            modal.querySelector('[data-coupon-warning-cancel]').onclick = () => finish(false);
            modal.querySelector('[data-coupon-warning-confirm]').onclick = () => finish(true);
            modal.onclick = event => {
                if (event.target === modal) finish(false);
            };
        });
    }

    window.applyCreditsCoupon = function () {
        const amount = parseMoney(document.getElementById('purchaseAmount')?.value);
        return applyCoupon('credits', 'credits', amount);
    };

    window.applyPaymentCoupon = function () {
        if (!state.payment) return;
        return applyCoupon(state.payment.productType, 'payment', state.payment.originalAmountVnd);
    };

    window.removeAppliedCoupon = async function (productType) {
        const type = productType || state.payment?.productType;
        if (!type) return;
        const removedDiscountAmountVnd = Number(couponApplication()?.discountAmountVnd || 0);
        try {
            const paymentModalOpen = document.getElementById('paymentModal')?.classList.contains('active') &&
                state.payment?.productType === type;
            if (paymentModalOpen) {
                await markCheckoutCouponForfeited(type, state.payment.originalAmountVnd);
            } else {
                const response = await fetch(`${API_BASE}/api/promotions/pending`, {
                    method: 'DELETE',
                    headers: authHeaders(),
                    body: JSON.stringify({ productType: type })
                });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'Không thể gỡ mã ưu đãi');
                state.activeCoupon = null;
            }
            clearCouponUi('credits', 'Mã đã được gỡ.');
            clearCouponUi(
                'payment',
                paymentModalOpen ? couponGiftPlainText(removedDiscountAmountVnd) : 'Mã đã được gỡ. Bạn có thể nhập mã khác.'
            );
            const creditsAmount = parseMoney(document.getElementById('purchaseAmount')?.value);
            if (creditsAmount) renderCreditsTotal(creditsAmount);
            renderCurrentPayment();
            if (paymentModalOpen) setMessage('payment', couponGiftPlainText(removedDiscountAmountVnd));
            return true;
        } catch (error) {
            setMessage(state.payment ? 'payment' : 'credits', error.message || 'Không thể gỡ mã ưu đãi.', 'error');
            return false;
        }
    };

    window.calculateCredits = function (value) {
        if (typeof originalCalculateCredits === 'function') originalCalculateCredits(value);
        const amount = parseMoney(document.getElementById('purchaseAmount')?.value);
        if (state.activeCoupon && !couponMatches('credits', amount)) {
            const wasCreditsCoupon = couponApplication()?.productType === 'credits';
            state.activeCoupon = null;
            clearCouponUi('credits', 'Số tiền đã thay đổi. Vui lòng áp dụng lại mã ưu đãi.');
            if (wasCreditsCoupon) {
                fetch(`${API_BASE}/api/promotions/pending`, {
                    method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ productType: 'credits' })
                }).catch(() => {});
            }
        }
        renderCreditsTotal(amount);
    };

    window.openPurchaseCreditsModal = function () {
        state.activeCoupon = null;
        if (typeof originalOpenPurchaseCreditsModal === 'function') originalOpenPurchaseCreditsModal();
        clearCouponUi('credits', 'Kiểm tra email xem bạn có đang được tặng mã ưu đãi nào không nhé!');
    };

    window.closePurchaseCreditsModal = function () {
        if (typeof originalClosePurchaseCreditsModal === 'function') originalClosePurchaseCreditsModal();
    };

    window.confirmPurchaseCredits = async function () {
        const originalAmountVnd = parseMoney(document.getElementById('purchaseAmount')?.value);
        if (!originalAmountVnd || originalAmountVnd < 40000 || originalAmountVnd % 1000 !== 0) {
            alert('Vui lòng nhập số tiền hợp lệ\n\nTối thiểu: 40.000 VNĐ\nChỉ chấp nhận số tròn nghìn');
            return;
        }
        if (state.creditCheckoutInProgress) return;
        state.creditCheckoutInProgress = true;
        const confirmButton = document.getElementById('confirmPurchaseBtn');
        if (confirmButton) confirmButton.disabled = true;
        try {
            let coupon = couponMatches('credits', originalAmountVnd) ? state.activeCoupon : null;
            if (!coupon) {
                const status = await getCheckoutCouponStatus('credits', originalAmountVnd);
                if (status.hasAppliedCoupon) {
                    coupon = await loadPendingCoupon('credits', originalAmountVnd);
                    if (!coupon) throw new Error('Không khôi phục được mã đang áp dụng. Vui lòng thử lại.');
                } else if (status.hasCoupon) {
                    const continueWithoutCoupon = await showCouponForfeitWarning(status.discountAmountVnd);
                    if (!continueWithoutCoupon) return;
                    await markCheckoutCouponForfeited('credits', originalAmountVnd);
                }
            }
            const finalAmountVnd = coupon ? coupon.application.finalAmountVnd : originalAmountVnd;
            window.closePurchaseCreditsModal();
            window.openPaymentModal('credits', finalAmountVnd, 'credits', { originalAmountVnd, coupon });
        } catch (error) {
            alert(error.message || 'Không thể kiểm tra ưu đãi. Vui lòng thử lại.');
        } finally {
            state.creditCheckoutInProgress = false;
            if (confirmButton) confirmButton.disabled = false;
        }
    };

    function ensureProCouponPrompt() {
        let modal = document.getElementById('proCouponPromptModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'proCouponPromptModal';
        modal.style.zIndex = '10000100';
        modal.innerHTML = `
            <div class="modal-content premium-modal-shell" style="max-width:520px;">
                <h2 class="pro-coupon-prompt-title" style="margin:0 0 10px;text-align:center;">Bạn có mã ưu đãi?</h2>
                <p id="proCouponPromptNotice" style="display:none;margin:0 0 18px;text-align:center;color:#a1a1aa;line-height:1.6;"></p>
                <div class="coupon-entry-card" id="proPromptCouponCard">
                    <div class="coupon-entry-row">
                        <input id="proPromptCouponInput" maxlength="32" autocomplete="off" placeholder="Nhập mã khuyến mãi">
                        <button type="button" class="coupon-apply-btn" id="proPromptCouponApplyBtn" onclick="applyProPromptCoupon()">Áp dụng</button>
                        <button type="button" class="coupon-remove-btn" id="proPromptCouponRemoveBtn" onclick="removeProPromptCoupon()" style="display:none">Gỡ mã</button>
                    </div>
                    <p class="coupon-entry-message" id="proPromptCouponMessage"></p>
                    <div class="coupon-price-breakdown" id="proPromptCouponBreakdown">
                        <div class="coupon-price-line"><span>Giá gốc</span><span id="proPromptCouponOriginal">40.000 VNĐ</span></div>
                        <div class="coupon-price-line"><span>Ưu đãi</span><strong id="proPromptCouponDiscount">-0 VNĐ</strong></div>
                        <div class="coupon-price-line"><span>Cần chuyển khoản</span><strong id="proPromptCouponFinal">40.000 VNĐ</strong></div>
                    </div>
                </div>
                <div class="pro-coupon-prompt-actions" style="display:flex;gap:10px;margin-top:18px;">
                    <button type="button" class="btn btn-secondary" style="flex:1" onclick="closeProCouponPrompt()">Hủy</button>
                    <button type="button" class="btn" id="proPromptContinueBtn" style="flex:1" onclick="continueProPaymentWithoutCoupon()" disabled>Tiếp tục thanh toán</button>
                </div>
            </div>`;
        modal.addEventListener('click', event => {
            if (event.target === modal) window.closeProCouponPrompt();
        });
        document.body.appendChild(modal);
        return modal;
    }

    function openPaymentScreen(plan, source, originalAmountVnd, coupon = null) {
        const productType = source === 'credits' ? 'credits' : 'pro';
        if (coupon) state.activeCoupon = coupon;
        else if (!couponMatches(productType, originalAmountVnd)) state.activeCoupon = null;
        state.payment = { plan, source, productType, originalAmountVnd };
        const application = couponMatches(productType, originalAmountVnd) ? couponApplication() : null;
        originalOpenPaymentModal(plan, application ? application.finalAmountVnd : originalAmountVnd, source);
        const card = document.getElementById('paymentCouponCard');
        if (card) card.style.display = 'block';
        renderCurrentPayment();
        if (!application) loadPendingCoupon(productType, originalAmountVnd);
    }

    async function showProCouponPrompt(plan, source, originalAmountVnd) {
        state.activeCoupon = null;
        state.payment = null;
        const context = { plan, source, originalAmountVnd, hasCoupon: null, hasAppliedCoupon: false, discountAmountVnd: 0 };
        state.proPromptContext = context;
        const modal = ensureProCouponPrompt();
        clearCouponUi('proPrompt', '');
        const notice = document.getElementById('proCouponPromptNotice');
        const continueButton = document.getElementById('proPromptContinueBtn');
        if (notice) {
            notice.style.display = 'none';
            notice.textContent = '';
        }
        if (continueButton) {
            continueButton.disabled = true;
            continueButton.textContent = 'Tiếp tục thanh toán';
        }
        try {
            const status = await getCheckoutCouponStatus('pro', originalAmountVnd);
            if (state.proPromptContext !== context) return;
            context.hasCoupon = status.hasCoupon;
            context.hasAppliedCoupon = status.hasAppliedCoupon;
            context.discountAmountVnd = Number(status.discountAmountVnd || 0);
            if (!status.hasCoupon) {
                state.proPromptContext = null;
                openPaymentScreen(plan, source, originalAmountVnd);
                return;
            }
            if (status.hasAppliedCoupon) {
                const restoredCoupon = await loadPendingCoupon('pro', originalAmountVnd);
                if (state.proPromptContext !== context) return;
                if (!restoredCoupon) throw new Error('Không khôi phục được mã đang áp dụng');
                renderCouponControls('proPrompt', restoredCoupon, 'pro', originalAmountVnd);
                if (notice) {
                    notice.style.display = '';
                    notice.textContent = 'Mã ưu đãi đã được áp dụng. Bạn có thể tiếp tục tới màn hình thanh toán.';
                }
                if (continueButton) continueButton.textContent = 'Thanh toán với ưu đãi';
            } else {
                if (notice) {
                    renderCouponGiftNotice(notice, context.discountAmountVnd);
                }
                if (continueButton) continueButton.textContent = 'Tiếp tục thanh toán';
            }
            if (continueButton) continueButton.disabled = false;
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            setTimeout(() => document.getElementById('proPromptCouponInput')?.focus(), 0);
        } catch (error) {
            if (state.proPromptContext !== context) return;
            if (notice) {
                notice.style.display = '';
                notice.textContent = `${error.message || 'Không thể kiểm tra ưu đãi'}. Vui lòng đóng và thử lại.`;
            }
            if (continueButton) continueButton.textContent = 'Không thể tiếp tục';
            setMessage('proPrompt', 'Bạn vẫn có thể nhập mã nếu đã nhận được mã qua email.', 'error');
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    window.closeProCouponPrompt = function () {
        document.getElementById('proCouponPromptModal')?.classList.remove('active');
        document.body.style.overflow = '';
        state.proPromptContext = null;
    };

    window.continueProPaymentWithoutCoupon = function () {
        const context = state.proPromptContext;
        if (!context) return;
        const continueButton = document.getElementById('proPromptContinueBtn');
        if (continueButton?.disabled) return;
        const continuePayment = async () => {
            try {
                if (continueButton) continueButton.disabled = true;
                if (context.hasAppliedCoupon && couponMatches('pro', context.originalAmountVnd)) {
                    document.getElementById('proCouponPromptModal')?.classList.remove('active');
                    state.proPromptContext = null;
                    openPaymentScreen(context.plan, context.source, context.originalAmountVnd, state.activeCoupon);
                    return;
                }
                if (context.hasCoupon) {
                    await markCheckoutCouponForfeited('pro', context.originalAmountVnd);
                }
                document.getElementById('proCouponPromptModal')?.classList.remove('active');
                state.proPromptContext = null;
                openPaymentScreen(context.plan, context.source, context.originalAmountVnd);
            } catch (error) {
                setMessage('proPrompt', error.message || 'Không thể ghi nhận lựa chọn thanh toán.', 'error');
                if (continueButton) continueButton.disabled = false;
            }
        };
        continuePayment();
    };

    window.removeProPromptCoupon = async function () {
        const context = state.proPromptContext;
        if (!context) return;
        const removed = await window.removeAppliedCoupon('pro');
        if (!removed) return;
        context.hasAppliedCoupon = false;
        context.hasCoupon = true;
        const notice = document.getElementById('proCouponPromptNotice');
        const continueButton = document.getElementById('proPromptContinueBtn');
        if (notice) {
            renderCouponGiftNotice(notice, context.discountAmountVnd);
        }
        if (continueButton) {
            continueButton.disabled = false;
            continueButton.textContent = 'Tiếp tục thanh toán';
        }
    };

    window.applyProPromptCoupon = async function () {
        const context = state.proPromptContext;
        if (!context) return;
        const coupon = await applyCoupon('pro', 'proPrompt', context.originalAmountVnd);
        if (!coupon) return;
        document.getElementById('proCouponPromptModal')?.classList.remove('active');
        state.proPromptContext = null;
        openPaymentScreen(context.plan, context.source, context.originalAmountVnd, coupon);
    };

    window.openPaymentModal = function (plan, amount, source = 'package', context = {}) {
        const productType = source === 'credits'
            ? 'credits'
            : (source === 'pro' || source === 'pro-from-plan' ? 'pro' : null);
        if (!productType || typeof originalOpenPaymentModal !== 'function') {
            return originalOpenPaymentModal?.(plan, amount, source);
        }

        const originalAmountVnd = Number(context.originalAmountVnd) || (productType === 'pro' ? 40000 : parseMoney(amount));
        if (productType === 'pro' && context.skipCouponPrompt !== true) {
            showProCouponPrompt(plan, source, originalAmountVnd);
            return;
        }
        openPaymentScreen(plan, source, originalAmountVnd, context.coupon || null);
    };
})();

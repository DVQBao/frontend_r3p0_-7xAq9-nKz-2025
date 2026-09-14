(function () {
    'use strict';

    const API_BASE = window.APP_CONFIG?.BACKEND_URL || '';
    const STORAGE_KEY = 'tiembanh_active_pro_payment_order';
    const COMPLETED_RESTORE_MS = 60 * 60 * 1000;
    const POLL_INTERVAL_MS = 7000;
    const STATUS_CLASSES = ['state-loading', 'state-waiting', 'state-attention', 'state-activating', 'state-success', 'state-error'];
    const LEGACY_PAYMENT_NOTE = '<strong>Lưu ý quan trọng:</strong><br>1. Vui lòng giữ nguyên nội dung chuyển khoản như hệ thống hiển thị để credits được cộng chính xác.<br>2. Khi mua credits thành công, tổng số credits trong tài khoản của bạn sẽ được gia hạn sử dụng thêm 30 ngày.';
    const PRO_PAYMENT_NOTE = '<strong>Lưu ý quan trọng:</strong><br>1. Chuyển đúng số tiền và giữ nguyên mã đơn hàng trong nội dung chuyển khoản.<br>2. Sau khi chuyển khoản, bấm “Tôi đã chuyển khoản” để gửi yêu cầu xác minh.';

    let currentOrder = null;
    let requestVersion = 0;
    let pollTimer = null;
    let statusCheckInFlight = false;
    let statusActionMode = 'check';
    let completedProfileRefreshed = false;
    let lastManualStatusCheckAt = null;

    function authHeaders(includeJson = true) {
        const headers = { Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}` };
        if (includeJson) headers['Content-Type'] = 'application/json';
        return headers;
    }

    function element(id) {
        return document.getElementById(id);
    }

    function setText(id, value) {
        const target = element(id);
        if (target) target.textContent = value;
    }

    function setVisible(id, visible, display = '') {
        const target = element(id);
        if (target) target.style.display = visible ? display : 'none';
    }

    function formatVnd(value) {
        return `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;
    }

    function formatDate(value) {
        if (!value) return 'Đang cập nhật';
        return new Date(value).toLocaleDateString('vi-VN');
    }

    function formatCheckTime(value) {
        return value ? value.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    }

    function saveOrderCode(orderCode) {
        if (orderCode) localStorage.setItem(STORAGE_KEY, orderCode);
        else localStorage.removeItem(STORAGE_KEY);
    }

    function paymentModalIsOpen() {
        return element('paymentModal')?.classList.contains('active') === true;
    }

    function statusModalIsOpen() {
        return element('proPaymentStatusModal')?.classList.contains('active') === true;
    }

    function setPaymentDetailsReady(ready) {
        const qr = element('paymentQrImage');
        if (qr) qr.style.visibility = ready ? 'visible' : 'hidden';
        if (!ready) setText('paymentContent', 'Đang tạo mã đơn hàng...');
    }

    function setProMode(enabled) {
        setVisible('legacyPaymentVerificationInfo', !enabled, 'block');
        setVisible('legacyPaymentVerificationButton', !enabled, 'block');
        setVisible('proPaymentClaimButton', enabled, 'block');
        setVisible('proPaymentCouponBackButton', false);
        const note = element('paymentImportantNote');
        if (note) note.innerHTML = enabled ? PRO_PAYMENT_NOTE : LEGACY_PAYMENT_NOTE;

        if (!enabled) {
            requestVersion += 1;
            setPaymentDetailsReady(true);
            stopPolling();
            currentOrder = null;
        }
    }

    function updateQr(order) {
        const qr = element('paymentQrImage');
        setText('paymentContent', order.orderCode);
        setText('paymentAmount', formatVnd(order.finalAmountVnd));
        if (qr) {
            const params = new URLSearchParams({
                amount: String(order.finalAmountVnd),
                addInfo: order.orderCode,
                accountName: 'DANG VAN QUOC BAO'
            });
            qr.src = `https://img.vietqr.io/image/vcb-1039015381-compact2.png?${params.toString()}`;
        }
    }

    function setPaymentButton(label, disabled) {
        const button = element('proPaymentClaimButton');
        if (!button) return;
        button.textContent = label;
        button.disabled = disabled;
        button.style.opacity = disabled ? '.6' : '1';
        button.style.cursor = disabled ? 'not-allowed' : 'pointer';
    }

    function renderCouponReturnState(order) {
        const button = element('proPaymentCouponBackButton');
        if (!button) return;

        const discountAmountVnd = Math.max(
            0,
            Number(order?.originalAmountVnd || 0) - Number(order?.finalAmountVnd || 0)
        );
        const hasAppliedCoupon = discountAmountVnd > 0;
        button.classList.toggle('is-applied', hasAppliedCoupon);
        button.disabled = hasAppliedCoupon;
        button.textContent = hasAppliedCoupon
            ? `Đã áp dụng mã ưu đãi, giảm ${formatVnd(discountAmountVnd)} thành công! Thanh toán nào!`
            : 'Chưa chuyển khoản? Nhập mã ưu đãi';
    }

    function setStatusState(state) {
        const modal = element('proPaymentStatusModal');
        if (!modal) return;
        STATUS_CLASSES.forEach(className => modal.classList.remove(className));
        modal.classList.add(`state-${state}`);
    }

    function setStatusButton(label, disabled, mode) {
        const button = element('proPaymentStatusActionButton');
        statusActionMode = mode;
        if (!button) return;
        button.textContent = label;
        button.disabled = disabled;
        button.style.opacity = disabled ? '.62' : '1';
        button.style.cursor = disabled ? 'not-allowed' : 'pointer';
    }

    function populateStatusSummary(order, stage) {
        setText('proPaymentStatusOrderCode', order?.orderCode || '—');
        setText('proPaymentStatusAmount', order ? formatVnd(order.finalAmountVnd) : '—');
        setText('proPaymentStatusStage', stage);
    }

    function openStatusModal() {
        element('paymentModal')?.classList.remove('active');
        element('proPaymentStatusModal')?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    window.closeProPaymentStatusModal = function () {
        element('proPaymentStatusModal')?.classList.remove('active');
        stopPolling();
        if (!paymentModalIsOpen()) document.body.style.overflow = '';
    };

    function renderTransientStatus({ state = 'loading', kicker, title, message, stage, actionLabel, actionMode = 'check', actionDisabled = false, showSupport = true }) {
        setStatusState(state);
        setText('proPaymentStatusKicker', kicker || 'Xác minh thanh toán');
        setText('proPaymentStatusTitle', title);
        setText('proPaymentStatusMessage', message);
        populateStatusSummary(currentOrder, stage || 'Đang kiểm tra');
        setVisible('proPaymentWelcomeBenefits', false);
        setVisible('proPaymentStatusTiming', state !== 'error', 'flex');
        setVisible('proPaymentStatusSupport', showSupport, 'inline-block');
        setText('proPaymentStatusCloseButton', state === 'error' ? 'Đóng' : 'Kiểm tra sau');
        setStatusButton(actionLabel || 'Đang kiểm tra...', actionDisabled, actionMode);
    }

    function renderStatusOrder(order) {
        const expiry = order.entitlementAfter?.proExpiresAt;
        const credits = Number(order.entitlementAfter?.credits || 40);
        setVisible('proPaymentWelcomeBenefits', false);
        setVisible('proPaymentStatusTiming', true, 'flex');
        setVisible('proPaymentStatusSupport', true, 'inline-block');
        setText('proPaymentStatusCloseButton', 'Kiểm tra sau');

        switch (order.status) {
            case 'awaiting_verification':
                setStatusState('waiting');
                setText('proPaymentStatusKicker', 'Yêu cầu đã được tiếp nhận');
                setText('proPaymentStatusTitle', 'Đang xác minh giao dịch');
                setText(
                    'proPaymentStatusMessage',
                    lastManualStatusCheckAt
                        ? `Hệ thống vừa kiểm tra lúc ${formatCheckTime(lastManualStatusCheckAt)}. Giao dịch vẫn đang được Ban Quản Lý Tiệm Bánh kiểm tra và xác minh. Vui lòng kiên nhẫn!`
                        : 'Tiệm Bánh đang xác minh giao dịch với thông tin đơn hàng của bạn. Bạn có thể đóng cửa sổ này và quay lại kiểm tra sau.'
                );
                populateStatusSummary(order, 'Chờ xác minh');
                setStatusButton('Kiểm tra trạng thái', false, 'check');
                startPolling();
                break;
            case 'needs_support':
                setStatusState('attention');
                setText('proPaymentStatusKicker', 'Cần hỗ trợ xác minh');
                setText('proPaymentStatusTitle', 'Cần bổ sung thông tin');
                setText('proPaymentStatusMessage', order.supportNote || 'Chưa tìm thấy giao dịch phù hợp. Vui lòng liên hệ Support và cung cấp mã đơn hàng để được hỗ trợ.');
                populateStatusSummary(order, 'Cần hỗ trợ');
                setStatusButton('Kiểm tra lại', false, 'check');
                startPolling();
                break;
            case 'processing':
                setStatusState('activating');
                setText('proPaymentStatusKicker', 'Thanh toán đã được xác nhận');
                setText('proPaymentStatusTitle', 'Đang kích hoạt quyền lợi PRO');
                setText('proPaymentStatusMessage', 'Hệ thống đang hoàn tất nâng cấp tài khoản. Quá trình này thường chỉ mất vài giây.');
                populateStatusSummary(order, 'Đang kích hoạt');
                setVisible('proPaymentStatusSupport', false);
                setStatusButton('Đang kích hoạt...', true, 'check');
                startPolling();
                break;
            case 'completed':
                setStatusState('success');
                setText('proPaymentStatusKicker', 'Nâng cấp thành công');
                setText('proPaymentStatusTitle', 'Welcome, PRO Member!');
                setText('proPaymentStatusMessage', 'Cảm ơn bạn đã tin tưởng và đồng hành cùng Tiệm Bánh Netflix. Chúc bạn có những phút giây giải trí thật trọn vẹn cùng nhiều trải nghiệm tuyệt vời.');
                populateStatusSummary(order, 'Đã hoàn tất');
                setText('proPaymentWelcomeCredits', `${credits.toLocaleString('vi-VN')} credits`);
                setText('proPaymentWelcomeExpiry', formatDate(expiry));
                setVisible('proPaymentWelcomeBenefits', true, 'grid');
                setVisible('proPaymentStatusTiming', false);
                setVisible('proPaymentStatusSupport', false);
                setText('proPaymentStatusCloseButton', 'Đóng');
                setStatusButton('Gọi món thôi!!!', false, 'complete');
                stopPolling();
                refreshCompletedProfile();
                break;
            case 'cancelled':
            case 'expired':
                setStatusState('error');
                setText('proPaymentStatusKicker', 'Đơn hàng không còn hiệu lực');
                setText('proPaymentStatusTitle', order.status === 'expired' ? 'Đơn hàng đã hết hạn' : 'Đơn hàng đã được hủy');
                setText('proPaymentStatusMessage', 'Không chuyển khoản theo mã đơn này. Vui lòng đóng cửa sổ và mở lại phần nâng cấp để tạo đơn mới.');
                populateStatusSummary(order, order.status === 'expired' ? 'Đã hết hạn' : 'Đã hủy');
                setVisible('proPaymentStatusTiming', false);
                setStatusButton('Đóng', false, 'close');
                stopPolling();
                saveOrderCode(null);
                break;
            default:
                renderTransientStatus({
                    title: 'Đang kiểm tra giao dịch',
                    message: 'Hệ thống đang đồng bộ trạng thái mới nhất của đơn hàng.',
                    stage: 'Đang kiểm tra',
                    actionDisabled: true
                });
        }
    }

    function renderOrder(order) {
        currentOrder = order;
        if (order?.orderCode) saveOrderCode(order.orderCode);

        if (order?.status === 'awaiting_payment') {
            updateQr(order);
            setPaymentDetailsReady(true);
            const couponCard = element('paymentCouponCard');
            if (couponCard) couponCard.style.display = 'none';
            setVisible('proPaymentCouponBackButton', true, 'block');
            renderCouponReturnState(order);
            setPaymentButton('Tôi đã chuyển khoản', false);
            stopPolling();
            return;
        }

        setVisible('proPaymentCouponBackButton', false);

        renderStatusOrder(order);
        if (paymentModalIsOpen() || statusModalIsOpen()) openStatusModal();
    }

    async function refreshCompletedProfile() {
        if (completedProfileRefreshed) return;
        completedProfileRefreshed = true;
        if (typeof window.refreshUserFromDatabase === 'function') {
            await window.refreshUserFromDatabase().catch(() => null);
        }
    }

    async function fetchOrder(orderCode) {
        const response = await fetch(`${API_BASE}/api/payments/orders/${encodeURIComponent(orderCode)}`, {
            headers: authHeaders(false)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Không thể kiểm tra đơn thanh toán.');
        return data.order;
    }

    async function createOrSyncOrder(version) {
        const response = await fetch(`${API_BASE}/api/payments/orders`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ productType: 'pro' })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Không thể tạo đơn thanh toán.');
        if (version !== requestVersion) return null;
        renderOrder(data.order);
        return data.order;
    }

    async function restoreOrCreateOrder(version) {
        const storedCode = localStorage.getItem(STORAGE_KEY);
        if (storedCode) {
            try {
                const restored = await fetchOrder(storedCode);
                if (version !== requestVersion) return;
                if (restored.status === 'completed') {
                    const completedAt = new Date(restored.completedAt || 0).getTime();
                    if (Date.now() - completedAt <= COMPLETED_RESTORE_MS) {
                        renderOrder(restored);
                        return;
                    }
                } else if (['awaiting_verification', 'needs_support', 'processing', 'awaiting_payment'].includes(restored.status)) {
                    renderOrder(restored);
                    return;
                }
                saveOrderCode(null);
            } catch (_error) {
                saveOrderCode(null);
            }
        }
        await createOrSyncOrder(version);
    }

    async function prepareOrder(event) {
        if (event.detail?.productType !== 'pro') {
            setProMode(false);
            return;
        }

        setProMode(true);
        setPaymentDetailsReady(false);
        completedProfileRefreshed = false;
        lastManualStatusCheckAt = null;
        const version = ++requestVersion;
        setPaymentButton('Đang chuẩn bị...', true);
        try {
            await restoreOrCreateOrder(version);
        } catch (error) {
            if (version !== requestVersion) return;
            setText('paymentContent', error.message);
            setPaymentButton('Thử lại', false);
            currentOrder = null;
        }
    }

    async function checkCurrentOrder({ manual = false } = {}) {
        if (!currentOrder?.orderCode || statusCheckInFlight) return;
        statusCheckInFlight = true;
        if (manual) {
            renderTransientStatus({
                state: 'loading',
                kicker: 'Đang đồng bộ trạng thái',
                title: 'Hệ thống đang kiểm tra',
                message: 'Đang kết nối và lấy trạng thái mới nhất của giao dịch. Vui lòng giữ cửa sổ này trong giây lát.',
                stage: 'Đang kiểm tra lại',
                actionLabel: 'Đang kiểm tra...',
                actionDisabled: true,
                showSupport: true
            });
        }
        try {
            const order = await fetchOrder(currentOrder.orderCode);
            if (manual && ['awaiting_verification', 'needs_support', 'processing'].includes(order.status)) {
                lastManualStatusCheckAt = new Date();
            }
            renderOrder(order);
        } catch (error) {
            setText('proPaymentStatusMessage', `${error.message} Vui lòng thử kiểm tra lại sau ít phút.`);
            if (statusModalIsOpen()) setStatusButton('Thử kiểm tra lại', false, 'check');
        } finally {
            statusCheckInFlight = false;
        }
    }

    function startPolling() {
        if (pollTimer) return;
        pollTimer = window.setInterval(() => {
            if (!statusModalIsOpen()) {
                stopPolling();
                return;
            }
            checkCurrentOrder();
        }, POLL_INTERVAL_MS);
    }

    function stopPolling() {
        if (!pollTimer) return;
        window.clearInterval(pollTimer);
        pollTimer = null;
    }

    window.handleProPaymentClaim = async function () {
        if (!currentOrder) {
            const version = ++requestVersion;
            setPaymentButton('Đang thử lại...', true);
            try {
                await createOrSyncOrder(version);
            } catch (error) {
                setText('paymentContent', error.message);
                setPaymentButton('Thử lại', false);
            }
            return;
        }

        if (currentOrder.status !== 'awaiting_payment') {
            renderStatusOrder(currentOrder);
            openStatusModal();
            if (['awaiting_verification', 'needs_support'].includes(currentOrder.status)) await checkCurrentOrder();
            return;
        }

        renderTransientStatus({
            state: 'loading',
            kicker: 'Đang gửi yêu cầu',
            title: 'Đang kiểm tra giao dịch',
            message: 'Hệ thống đang tiếp nhận thông tin và tạo yêu cầu xác minh cho đơn hàng của bạn.',
            stage: 'Đang gửi xác minh',
            actionLabel: 'Đang xử lý...',
            actionDisabled: true,
            showSupport: false
        });
        openStatusModal();

        try {
            const response = await fetch(`${API_BASE}/api/payments/orders/${encodeURIComponent(currentOrder.orderCode)}/claim`, {
                method: 'POST',
                headers: authHeaders()
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.order) throw new Error(data.error || 'Không thể gửi yêu cầu xác minh.');
            renderOrder(data.order);
        } catch (error) {
            renderTransientStatus({
                state: 'error',
                kicker: 'Chưa gửi được yêu cầu',
                title: 'Kết nối chưa thành công',
                message: `${error.message} Chưa có quyền lợi hoặc trạng thái thanh toán nào bị thay đổi.`,
                stage: 'Chưa gửi xác minh',
                actionLabel: 'Thử gửi lại',
                actionMode: 'retry-claim'
            });
        }
    };

    window.handleProPaymentCouponBack = async function () {
        if (!currentOrder?.orderCode || currentOrder.status !== 'awaiting_payment') return;

        const orderCode = currentOrder.orderCode;
        const button = element('proPaymentCouponBackButton');
        if (button?.disabled) return;
        if (typeof window.reopenProCouponPrompt !== 'function') {
            setText('paymentContent', 'Không thể mở lại phần nhập mã ưu đãi. Vui lòng đóng và mở lại mục nâng cấp Pro.');
            return;
        }
        if (button) {
            button.disabled = true;
            button.textContent = 'Đang quay lại...';
        }
        setPaymentButton('Vui lòng đợi...', true);

        try {
            const response = await fetch(`${API_BASE}/api/payments/orders/${encodeURIComponent(orderCode)}/restart`, {
                method: 'POST',
                headers: authHeaders()
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) {
                if (data.order) {
                    renderOrder(data.order);
                    openStatusModal();
                    return;
                }
                throw new Error(data.error || 'Không thể quay lại bước nhập mã ưu đãi.');
            }

            requestVersion += 1;
            currentOrder = null;
            saveOrderCode(null);
            setVisible('proPaymentCouponBackButton', false);
            element('paymentModal')?.classList.remove('active');
            window.reopenProCouponPrompt();
        } catch (error) {
            setText('paymentContent', error.message);
            setPaymentButton('Tôi đã chuyển khoản', false);
            if (button) {
                button.classList.remove('is-applied');
                button.disabled = false;
                button.textContent = 'Chưa chuyển khoản? Nhập mã ưu đãi';
            }
        }
    };

    window.handleProPaymentStatusAction = async function () {
        if (statusActionMode === 'complete') {
            window.location.reload();
            return;
        }
        if (statusActionMode === 'close') {
            window.closeProPaymentStatusModal();
            return;
        }
        if (statusActionMode === 'retry-claim') {
            await window.handleProPaymentClaim();
            return;
        }

        await checkCurrentOrder({ manual: true });
    };

    document.addEventListener('click', event => {
        if (event.target === element('proPaymentStatusModal')) window.closeProPaymentStatusModal();
    });

    window.addEventListener('tiembanh:payment-ready', prepareOrder);
})();

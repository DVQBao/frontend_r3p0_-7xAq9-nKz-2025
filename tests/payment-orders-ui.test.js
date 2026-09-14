const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const frontendRoot = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(frontendRoot, 'payment-orders.js'), 'utf8');
const publicHtml = fs.readFileSync(path.join(frontendRoot, 'index.html'), 'utf8');
const promotionsSource = fs.readFileSync(path.join(frontendRoot, 'promotions.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(frontendRoot, 'x7Kv9mPq3nRt2025', 'index.html'), 'utf8');

new Function(source);
assert.match(publicHtml, /id="proPaymentClaimButton"[\s\S]*?Tôi đã chuyển khoản/);
assert.ok(publicHtml.indexOf('src="promotions.js"') < publicHtml.indexOf('src="payment-orders.js"'));
assert.match(promotionsSource, /tiembanh:payment-ready/);
assert.match(adminHtml, /data-admin-nav="payments"/);
assert.match(adminHtml, /Xác nhận & nâng Pro/);
assert.match(adminHtml, /Có \$\{total\.toLocaleString\('vi-VN'\)\} đơn đang chờ anh/);
assert.match(adminHtml, /checkPendingPaymentOrdersOnEntry\(\)/);
assert.doesNotMatch(adminHtml, /id="paymentOrderBadge"/);
assert.match(adminHtml, /id="mobilePaymentNotice"/);
assert.match(adminHtml, /Tra cứu mã đơn hàng/);
assert.match(adminHtml, /orders\/lookup\/\$\{encodeURIComponent\(code\)\}/);
assert.match(adminHtml, /data-label="Tài khoản"/);
assert.doesNotMatch(adminHtml, /Xác nhận hàng loạt[^<]*thanh toán/i);
assert.doesNotMatch(source, /\.plan\s*=\s*['"]pro['"]/);
assert.doesNotMatch(source, /location\.reload\(/);
assert.match(publicHtml, /font-family: var\(--desktop-home-font-family\)/);
assert.match(publicHtml, /font-family: var\(--mobile-font-family\)/);

function makeElement(active = false) {
    const classes = new Set(active ? ['active'] : []);
    return {
        style: {},
        textContent: '',
        innerHTML: '',
        disabled: false,
        src: '',
        classList: {
            contains: className => classes.has(className),
            add: className => classes.add(className),
            remove: className => classes.delete(className)
        }
    };
}

const elements = new Map([
    'legacyPaymentVerificationInfo', 'legacyPaymentVerificationButton', 'proPaymentClaimButton',
    'paymentImportantNote', 'paymentContent', 'paymentAmount', 'paymentQrImage', 'paymentCouponCard',
    'proPaymentStatusModal', 'proPaymentStatusKicker', 'proPaymentStatusTitle',
    'proPaymentStatusMessage', 'proPaymentStatusOrderCode', 'proPaymentStatusAmount',
    'proPaymentStatusStage', 'proPaymentWelcomeBenefits', 'proPaymentWelcomeCredits',
    'proPaymentWelcomeExpiry', 'proPaymentStatusTiming', 'proPaymentStatusSupport',
    'proPaymentStatusCloseButton', 'proPaymentStatusActionButton', 'paymentModal'
].map(id => [id, makeElement()]));
elements.set('paymentModal', makeElement(true));

const storage = new Map([['auth_token', 'test-token']]);
const listeners = {};
let intervalCallback = null;
let profileRefreshes = 0;
let orderStatus = 'awaiting_payment';
const baseOrder = {
    orderCode: 'TB23456789',
    productType: 'pro',
    months: 1,
    originalAmountVnd: 40000,
    finalAmountVnd: 40000,
    status: 'awaiting_payment',
    expiresAt: new Date(Date.now() + 60000).toISOString()
};

const windowMock = {
    APP_CONFIG: { BACKEND_URL: 'http://localhost:3000' },
    addEventListener: (name, handler) => { listeners[name] = handler; },
    setInterval: callback => { intervalCallback = callback; return 1; },
    clearInterval: () => { intervalCallback = null; },
    refreshUserFromDatabase: async () => { profileRefreshes += 1; },
    location: { reload: () => {} }
};

const context = {
    window: windowMock,
    document: {
        body: { style: {} },
        getElementById: id => elements.get(id) || null,
        addEventListener: () => {}
    },
    localStorage: {
        getItem: key => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key)
    },
    fetch: async (url, options = {}) => {
        if (url.endsWith('/api/payments/orders') && options.method === 'POST') {
            return { ok: true, json: async () => ({ success: true, order: { ...baseOrder, status: orderStatus } }) };
        }
        if (url.endsWith('/claim')) {
            orderStatus = 'awaiting_verification';
            return { ok: true, json: async () => ({ success: true, order: { ...baseOrder, status: orderStatus, customerClaimedAt: new Date().toISOString() } }) };
        }
        if (url.includes('/api/payments/orders/TB23456789')) {
            const order = { ...baseOrder, status: orderStatus };
            if (orderStatus === 'completed') {
                order.completedAt = new Date().toISOString();
                order.entitlementAfter = { plan: 'pro', proExpiresAt: new Date(Date.now() + 86400000).toISOString(), credits: 40 };
            }
            return { ok: true, json: async () => ({ success: true, order }) };
        }
        throw new Error(`Unexpected fetch: ${url}`);
    },
    URLSearchParams,
    encodeURIComponent,
    console
};
windowMock.window = windowMock;
windowMock.document = context.document;
windowMock.localStorage = context.localStorage;
windowMock.fetch = context.fetch;
windowMock.URLSearchParams = URLSearchParams;

vm.runInNewContext(source, context);

(async () => {
    await listeners['tiembanh:payment-ready']({ detail: { productType: 'pro', originalAmountVnd: 40000, finalAmountVnd: 40000 } });
    assert.strictEqual(elements.get('paymentContent').textContent, 'TB23456789');
    assert.match(elements.get('paymentQrImage').src, /addInfo=TB23456789/);
    assert.strictEqual(elements.get('proPaymentClaimButton').textContent, 'Tôi đã chuyển khoản');
    assert.strictEqual(elements.get('paymentCouponCard').style.display, 'none', 'coupon controls must lock after order creation');

    await windowMock.handleProPaymentClaim();
    assert.strictEqual(elements.get('paymentModal').classList.contains('active'), false);
    assert.strictEqual(elements.get('proPaymentStatusModal').classList.contains('active'), true);
    assert.strictEqual(elements.get('proPaymentStatusTitle').textContent, 'Đang xác minh giao dịch');
    assert.strictEqual(elements.get('proPaymentStatusActionButton').textContent, 'Kiểm tra trạng thái');
    assert.ok(intervalCallback, 'waiting state should poll for an admin decision');

    orderStatus = 'completed';
    await windowMock.handleProPaymentClaim();
    await Promise.resolve();
    assert.strictEqual(elements.get('proPaymentStatusTitle').textContent, 'Chào mừng bạn đến với PRO!');
    assert.strictEqual(elements.get('proPaymentStatusActionButton').textContent, 'Bắt đầu trải nghiệm PRO');
    assert.strictEqual(profileRefreshes, 1);

    await listeners['tiembanh:payment-ready']({ detail: { productType: 'credits' } });
    assert.strictEqual(elements.get('proPaymentClaimButton').style.display, 'none');
    assert.strictEqual(elements.get('legacyPaymentVerificationButton').style.display, 'block');
    console.log('payment orders UI tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

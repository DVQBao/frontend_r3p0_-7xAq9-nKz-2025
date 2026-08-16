const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const promotionScript = fs.readFileSync(path.join(root, 'promotions.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(root, 'x7Kv9mPq3nRt2025', 'index.html'), 'utf8');

new Function(promotionScript);

function parseExecutableInlineScripts(fileName, html) {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    let parsed = 0;
    scripts.forEach((match, index) => {
        const attrs = match[1];
        if (/\bsrc\s*=/.test(attrs) || /type\s*=\s*["'](?:application\/ld\+json|text\/plain)["']/i.test(attrs)) return;
        if (!match[2].trim()) return;
        assert.doesNotThrow(() => new Function(match[2]), `${fileName} inline script ${index + 1}`);
        parsed += 1;
    });
    return parsed;
}

assert.ok(parseExecutableInlineScripts('index.html', publicHtml) > 0);
assert.ok(parseExecutableInlineScripts('admin index.html', adminHtml) > 0);

const publicIds = [
    'creditsCouponCard', 'creditsCouponInput', 'creditsCouponApplyBtn', 'creditsCouponRemoveBtn',
    'creditsCouponMessage', 'creditsCouponBreakdown', 'creditsCouponOriginal', 'creditsCouponDiscount',
    'paymentCouponCard', 'paymentCouponInput', 'paymentCouponApplyBtn', 'paymentCouponRemoveBtn',
    'paymentCouponMessage', 'paymentCouponBreakdown', 'paymentCouponOriginal', 'paymentCouponDiscount',
    'paymentCouponFinal', 'paymentAmount', 'paymentContent', 'paymentQrImage', 'purchaseAmount', 'totalAmount'
];

for (const id of publicIds) {
    const matches = publicHtml.match(new RegExp(`id=["']${id}["']`, 'g')) || [];
    assert.equal(matches.length, 1, `${id} must exist exactly once`);
}

assert.ok(publicHtml.indexOf('src="auth.js"') < publicHtml.indexOf('src="promotions.js"'));
assert.ok(publicHtml.indexOf('src="promotions.js"') < publicHtml.indexOf('src="cookie-retry-handler.js"'));
assert.match(promotionScript, /\/api\/promotions\/apply/);
assert.match(promotionScript, /\/api\/promotions\/pending/);
assert.match(promotionScript, /\/api\/promotions\/checkout\/status/);
assert.match(promotionScript, /\/api\/promotions\/checkout\/forfeit/);
assert.doesNotMatch(promotionScript, /Tài khoản của bạn đang có mã ưu đãi\. Vui lòng kiểm tra email để sử dụng/);
assert.match(promotionScript, /Tài khoản của bạn đang được tặng 01 mã ưu đãi để giảm \$\{formatVnd\(discountAmountVnd\)\}\. Kiểm tra email nhé!/);
assert.match(promotionScript, /Lưu ý: Nếu tiếp tục thanh toán mà không áp dụng mã ưu đãi, mã ưu đãi hiện có của bạn vẫn sẽ bị mất hiệu lực\./);
assert.match(promotionScript, /renderCouponGiftNotice\(notice, context\.discountAmountVnd\)/);
assert.match(promotionScript, /showCouponForfeitWarning\(status\.discountAmountVnd\)/);
assert.match(promotionScript, /originalAmountVnd/);
assert.match(promotionScript, /finalAmountVnd/);
assert.match(promotionScript, /window\.confirmPurchaseCredits/);
assert.match(promotionScript, /function showProCouponPrompt\(/);
assert.match(promotionScript, /window\.applyProPromptCoupon/);
assert.match(promotionScript, /Mã khuyến mãi hợp lệ, đã áp dụng thành công!/);
assert.match(promotionScript, /Mã ưu đãi không hợp lệ, vui lòng kiểm tra lại!/);
assert.match(promotionScript, /Kiểm tra email xem bạn có đang được tặng mã ưu đãi nào không nhé!/);
assert.match(promotionScript, /Tiếp tục thanh toán/);
assert.match(promotionScript, /10000100/);
assert.doesNotMatch(promotionScript, /Bạn có thể nhập mã ưu đãi trước khi tới màn hình thanh toán/);
assert.doesNotMatch(promotionScript, /Bạn có thể nhập mã trước hoặc sau khi mở trang thanh toán/);
assert.doesNotMatch(publicHtml, /Bạn có thể nhập mã trước hoặc sau khi mở trang thanh toán/);
assert.doesNotMatch(promotionScript, /Đang kiểm tra ưu đãi của tài khoản/);
assert.doesNotMatch(promotionScript, /Mã phải được cấp riêng cho đúng tài khoản của bạn\./);
const proPromptFlowStart = promotionScript.indexOf('async function showProCouponPrompt(');
const proPromptFlow = promotionScript.slice(
    proPromptFlowStart,
    promotionScript.indexOf('window.closeProCouponPrompt', proPromptFlowStart)
);
assert.ok(
    proPromptFlow.indexOf("await getCheckoutCouponStatus('pro'") < proPromptFlow.indexOf("modal.classList.add('active')"),
    'Pro coupon status must resolve before the modal is revealed'
);
assert.match(proPromptFlow, /if \(!status\.hasCoupon\)[\s\S]*?openPaymentScreen\(plan, source, originalAmountVnd\);[\s\S]*?return;/);
assert.doesNotMatch(promotionScript, /\/api\/credits\/purchase/);

assert.equal((adminHtml.match(/<button\b[^>]*data-admin-nav="promotions"/g) || []).length, 1);
assert.match(adminHtml, /class="promotion-pc-only"/);
assert.match(adminHtml, /@media \(max-width: 768px\)[\s\S]*?\.promotion-pc-only/);
assert.match(adminHtml, /function showPromotionManagement\(\)/);
assert.match(adminHtml, /function countPromotionAudience\(/);
assert.match(adminHtml, /function fulfillPendingCreditCoupon\(/);
assert.match(adminHtml, /couponForfeited/);
assert.match(adminHtml, /\/api\/admin\/promotions\/campaigns/);
assert.match(adminHtml, /if \(promotionContainer\) promotionContainer\.remove\(\)/);
assert.match(adminHtml, /function recallPromotionCampaign\(/);
assert.match(adminHtml, /method: 'DELETE'/);
assert.match(adminHtml, /quyền lợi Pro\/Credits đã cấp sẽ KHÔNG được hoàn tác/);
assert.match(adminHtml, /function loadPromotionCoupons\(/);
assert.match(adminHtml, /function showPromotionCouponListView\(/);
assert.match(adminHtml, /function showPromotionCampaignView\(/);
assert.match(adminHtml, /\/api\/admin\/promotions\/coupons/);
assert.match(adminHtml, /id="promotionCouponListNavBtn"/);
assert.match(adminHtml, /id="promoCampaignView"/);
assert.match(adminHtml, /id="promoCouponListView" style="display:none"/);
assert.match(adminHtml, /Quay lại quản lý chiến dịch/);
assert.match(adminHtml, /id="promoCouponTableBody"/);
assert.match(adminHtml, /id="promoCouponPagination"/);
assert.match(adminHtml, /limit: 50/);
assert.match(adminHtml, /Tìm người nhận theo email hoặc mã coupon/);
assert.match(adminHtml, /Chờ kích hoạt/);
assert.match(adminHtml, /Hết hạn .* ngày/);
assert.match(adminHtml, /data\.recipients \|\| \[\]/);
assert.match(adminHtml, /người đã nhận coupon/);
assert.match(adminHtml, /promo-history-count--available/);
assert.match(adminHtml, /promo-history-count--redeemed/);
assert.match(adminHtml, /Nâng cấp Pro Plan hoặc mua thêm Credits/);
assert.match(adminHtml, /function formatAdminVoucherValue\(/);
assert.match(adminHtml, /<th style="width: 110px;">Voucher<\/th>/);
assert.match(adminHtml, /formatAdminVoucherValue\(user\.activeCoupon\)/);
assert.match(adminHtml, /<span class="info-label">VOUCHER<\/span>/);
assert.match(adminHtml, /No voucher/);
assert.match(adminHtml, /function requestAdminVoucherDecision\(userId\)/);
assert.match(adminHtml, /Người dùng đang có voucher/);
assert.match(adminHtml, /Chọn “Giữ voucher” để vẫn lưu thay đổi nhưng không làm mất ưu đãi của người dùng/);
assert.match(adminHtml, /data-voucher-action="keep"/);
assert.match(adminHtml, /data-voucher-action="deactivate"/);
assert.match(adminHtml, /deactivateActiveVoucher: voucherDecision/);
assert.match(adminHtml, /async function confirmUpgrade\(\)/);
assert.doesNotMatch(adminHtml, /\$\{user\.pendingCoupon \? `<div class="view-mode"/);
assert.match(adminHtml, /<option value="both" selected>Nâng cấp Pro Plan hoặc mua thêm Credits<\/option>/);
assert.match(adminHtml, /TẶNG BẠN VOUCHER KHUYẾN MÃI NÈ ❤️/);
assert.match(adminHtml, /Cảm ơn bạn đã đồng hành cùng Tiệm Bánh Netflix thời gian vừa qua\. Chúng mình xin gửi bạn một voucher cá nhân để tiếp tục trải nghiệm dịch vụ nhé\./);
assert.match(publicHtml, /function updateDesktopPlanAction\(/);
assert.match(publicHtml, /Nâng cấp Pro Plan/);
assert.match(publicHtml, /grid-template-columns: minmax\(0, 1fr\) minmax\(82px, auto\)/);
assert.match(publicHtml, /#proCouponPromptModal \.modal-content[\s\S]*?max-width: 360px !important/);
assert.match(publicHtml, /#proCouponPromptModal \.pro-coupon-prompt-title[\s\S]*?font-size: 1rem !important/);
assert.match(publicHtml, /Kiểm tra email xem bạn có đang được tặng mã ưu đãi nào không nhé!/);
assert.match(publicHtml, /\.coupon-entry-message:empty \{ display: none; \}/);
assert.match(publicHtml, /\.coupon-forfeit-caution[\s\S]*?color: #fbbf24;[\s\S]*?font-style: italic;/);
assert.match(publicHtml, /#purchaseCreditsModal \.modal-content[\s\S]*?overflow-y: auto !important;[\s\S]*?scrollbar-width: none;/);
assert.match(publicHtml, /#purchaseCreditsModal \.modal-content::\-webkit-scrollbar[\s\S]*?display: none;/);
assert.match(publicHtml, /#paymentModal \.modal-content::\-webkit-scrollbar[\s\S]*?display: none;/);
assert.match(publicHtml, /class="badge-verified verified-icon-badge"/);
assert.match(publicHtml, /aria-label="Đã xác minh"/);
assert.doesNotMatch(publicHtml, /id="verifiedBadge"[^>]*>Đã xác minh</);

console.log('promotions UI contract tests passed');

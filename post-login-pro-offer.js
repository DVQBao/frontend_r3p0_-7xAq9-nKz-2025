(function initializePostLoginProOffer(global) {
    'use strict';

    const STYLE_ID = 'postLoginProOfferStyles';
    const OVERLAY_ID = 'postLoginProOfferOverlay';

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .pro-offer-overlay {
                position: fixed;
                z-index: 10000030;
                inset: 0;
                display: grid;
                place-items: center;
                overflow-y: auto;
                padding: 24px 18px;
                background: rgba(0, 0, 0, 0.76);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                -webkit-overflow-scrolling: touch;
                animation: pro-offer-backdrop-in 480ms ease-out both;
            }

            .pro-offer-modal {
                position: relative;
                width: min(100%, 520px);
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 24px;
                color: #fff;
                background:
                    radial-gradient(circle at 92% 3%, rgba(122, 79, 255, 0.22), transparent 32%),
                    radial-gradient(circle at 5% 7%, rgba(0, 196, 204, 0.15), transparent 30%),
                    linear-gradient(160deg, #17171c 0%, #0d0d10 66%);
                box-shadow: 0 28px 90px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(229, 9, 20, 0.04);
                font-family: "SF Pro Display", "SF Pro Text", "Segoe UI", system-ui, sans-serif;
                transform-origin: center 42%;
                will-change: opacity, transform, filter;
                animation: pro-offer-welcome-in 680ms cubic-bezier(.16, 1, .3, 1) both;
            }

            .pro-offer-modal::before {
                position: absolute;
                top: 0;
                right: 0;
                left: 0;
                height: 3px;
                content: "";
                background: linear-gradient(90deg, #e50914 0 38%, #12c2e9 58%, #9b5cff 100%);
            }

            @keyframes pro-offer-backdrop-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes pro-offer-welcome-in {
                0% {
                    opacity: 0;
                    filter: blur(5px);
                    transform: translateY(24px) scale(0.88);
                }
                62% {
                    opacity: 1;
                    filter: blur(0);
                    transform: translateY(-3px) scale(1.018);
                }
                82% {
                    transform: translateY(1px) scale(0.994);
                }
                100% {
                    opacity: 1;
                    filter: blur(0);
                    transform: translateY(0) scale(1);
                }
            }

            @keyframes pro-offer-item-in {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .pro-offer-content > * {
                animation: pro-offer-item-in 440ms cubic-bezier(.22, .8, .2, 1) backwards;
            }

            .pro-offer-topline { animation-delay: 100ms; }
            .pro-offer-title { animation-delay: 150ms; }
            .pro-offer-intro { animation-delay: 200ms; }
            .pro-offer-gift { animation-delay: 250ms; }
            .pro-offer-benefits { animation-delay: 300ms; }
            .pro-offer-note { animation-delay: 350ms; }
            .pro-offer-actions { animation-delay: 400ms; }

            .pro-offer-modal button {
                font-family: "SF Pro Display", "SF Pro Text", "Segoe UI", system-ui, sans-serif;
                font-style: normal;
            }

            .pro-offer-close {
                position: absolute;
                z-index: 2;
                top: 14px;
                right: 14px;
                display: grid;
                width: 34px;
                height: 34px;
                place-items: center;
                padding: 0;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                color: #c9c9cf;
                background: rgba(0, 0, 0, 0.24);
                font-size: 1.15rem;
                line-height: 1;
                cursor: pointer;
            }

            .pro-offer-content {
                padding: 30px 30px 26px;
            }

            .pro-offer-topline {
                display: flex;
                align-items: center;
                gap: 9px;
                margin-bottom: 18px;
            }

            .pro-offer-badge,
            .pro-offer-limited {
                display: inline-flex;
                align-items: center;
                min-height: 26px;
                padding: 5px 9px;
                border-radius: 999px;
                font-size: 0.67rem;
                font-weight: 800;
                letter-spacing: 0.055em;
            }

            .pro-offer-badge {
                color: #fff;
                background: #e50914;
                box-shadow: 0 7px 18px rgba(229, 9, 20, 0.24);
            }

            .pro-offer-limited {
                color: #ffdda0;
                border: 1px solid rgba(251, 191, 36, 0.25);
                background: rgba(251, 191, 36, 0.09);
            }

            .pro-offer-title {
                max-width: 435px;
                margin: 0;
                padding: 0;
                color: #fff;
                font-size: clamp(1.65rem, 4vw, 2.1rem);
                font-weight: 830;
                line-height: 1.12;
                letter-spacing: -0.035em;
                text-align: left;
            }

            .pro-offer-title-highlight {
                color: transparent;
                background: linear-gradient(90deg, #19cfd6, #55a8ff 43%, #a66cff 88%);
                background-clip: text;
                -webkit-background-clip: text;
            }

            .pro-offer-intro {
                margin: 11px 0 20px;
                color: #bdbdc7;
                font-size: 0.93rem;
                line-height: 1.55;
                text-align: left;
            }

            .pro-offer-gift {
                position: relative;
                display: flex;
                align-items: center;
                gap: 15px;
                overflow: hidden;
                margin-bottom: 15px;
                padding: 16px;
                border: 1px solid rgba(74, 213, 225, 0.32);
                border-radius: 17px;
                background:
                    radial-gradient(circle at 7% 50%, rgba(0, 196, 204, 0.2), transparent 40%),
                    linear-gradient(105deg, rgba(0, 196, 204, 0.13), rgba(125, 42, 231, 0.18));
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 10px 34px rgba(78, 55, 206, 0.09);
            }

            .pro-offer-canva {
                display: grid;
                flex: 0 0 auto;
                width: 94px;
                height: 54px;
                place-items: center;
                padding: 10px 11px;
                border: 1px solid rgba(255, 255, 255, 0.88);
                border-radius: 14px;
                background: #fff;
                box-shadow: 0 0 0 3px rgba(99, 91, 255, 0.1), 0 11px 28px rgba(0, 196, 204, 0.18);
            }

            .pro-offer-canva img {
                display: block;
                width: 100%;
                height: auto;
                filter: saturate(1.12) contrast(1.05);
            }

            .pro-offer-gift-copy {
                min-width: 0;
                text-align: left;
            }

            .pro-offer-gift-eyebrow,
            .pro-offer-gift-title,
            .pro-offer-gift-caption {
                display: block;
            }

            .pro-offer-gift-eyebrow {
                margin: 0 0 4px;
                color: #78ecf1;
                font-size: 0.61rem;
                font-weight: 850;
                letter-spacing: 0.085em;
                line-height: 1.2;
            }

            .pro-offer-gift-title {
                color: #fff;
                font-size: 1.01rem;
                font-weight: 750;
                line-height: 1.35;
            }

            .pro-offer-gift-caption {
                margin-top: 4px;
                color: #ceced7;
                font-size: 0.79rem;
                line-height: 1.4;
            }

            .pro-offer-benefits {
                display: grid;
                gap: 9px;
                margin: 0 0 16px;
                padding: 0;
                list-style: none;
            }

            .pro-offer-benefits li {
                display: flex;
                align-items: center;
                gap: 10px;
                color: #e7e7eb;
                font-size: 0.84rem;
                font-weight: 590;
                text-align: left;
            }

            .pro-offer-check {
                display: grid;
                flex: 0 0 auto;
                width: 20px;
                height: 20px;
                place-items: center;
                border-radius: 50%;
                color: #a7f3d0;
                background: rgba(16, 185, 129, 0.14);
                font-size: 0.72rem;
                font-weight: 900;
            }

            .pro-offer-note {
                margin: 0 0 20px;
                padding: 10px 12px;
                border-radius: 12px;
                color: #9797a1;
                background: rgba(255, 255, 255, 0.035);
                font-size: 0.7rem;
                line-height: 1.48;
                text-align: left;
            }

            .pro-offer-note strong {
                color: #c9c9d0;
            }

            .pro-offer-actions {
                display: grid;
                grid-template-columns: 1fr 1.75fr;
                gap: 10px;
            }

            .pro-offer-action {
                min-height: 48px;
                padding: 0 12px;
                border: 0;
                border-radius: 13px;
                font-size: 0.84rem;
                font-weight: 760;
                cursor: pointer;
                transition: transform 150ms ease, filter 150ms ease;
            }

            .pro-offer-action:hover {
                transform: translateY(-1px);
                filter: brightness(1.08);
            }

            .pro-offer-secondary {
                color: #c7c7cf;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.055);
            }

            .pro-offer-primary {
                color: #fff;
                background: linear-gradient(135deg, #f01420, #bd0710);
                box-shadow: 0 11px 28px rgba(229, 9, 20, 0.25);
            }

            @media (max-width: 620px) {
                .pro-offer-overlay {
                    padding: 18px 12px;
                }

                .pro-offer-modal {
                    width: min(100%, 348px);
                    border-radius: 19px;
                }

                .pro-offer-content {
                    padding: 22px 17px 17px;
                }

                .pro-offer-close {
                    top: 12px;
                    right: 12px;
                    width: 30px;
                    height: 30px;
                }

                .pro-offer-topline {
                    gap: 7px;
                    margin-bottom: 14px;
                }

                .pro-offer-badge,
                .pro-offer-limited {
                    min-height: 23px;
                    padding: 4px 7px;
                    font-size: 0.59rem;
                }

                .pro-offer-title {
                    max-width: 286px;
                    padding-right: 14px;
                    font-size: clamp(1.18rem, 5.4vw, 1.3rem);
                    line-height: 1.1;
                    white-space: nowrap;
                }

                .pro-offer-title-highlight {
                    display: inline-block;
                    white-space: nowrap;
                }

                .pro-offer-intro {
                    margin: 8px 0 13px;
                    font-size: 0.77rem;
                    line-height: 1.48;
                }

                .pro-offer-gift {
                    gap: 11px;
                    margin-bottom: 12px;
                    padding: 11px;
                }

                .pro-offer-canva {
                    width: 76px;
                    height: 44px;
                    padding: 8px;
                    border-radius: 11px;
                }

                .pro-offer-gift-eyebrow {
                    margin-bottom: 3px;
                    font-size: 0.54rem;
                }

                .pro-offer-gift-title {
                    font-size: 0.81rem;
                }

                .pro-offer-gift-caption {
                    margin-top: 2px;
                    font-size: 0.69rem;
                }

                .pro-offer-benefits {
                    gap: 7px;
                    margin-bottom: 12px;
                }

                .pro-offer-benefits li {
                    gap: 8px;
                    font-size: 0.76rem;
                }

                .pro-offer-check {
                    width: 18px;
                    height: 18px;
                    font-size: 0.66rem;
                }

                .pro-offer-note {
                    margin-bottom: 14px;
                    padding: 8px 10px;
                    font-size: 0.64rem;
                }

                .pro-offer-actions {
                    grid-template-columns: 0.9fr 1.65fr;
                    gap: 8px;
                }

                .pro-offer-action {
                    min-height: 43px;
                    border-radius: 11px;
                    font-size: 0.76rem;
                }
            }

            @media (max-height: 560px) {
                .pro-offer-overlay {
                    align-items: start;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .pro-offer-overlay,
                .pro-offer-modal {
                    animation: none;
                }

                .pro-offer-content > * {
                    animation: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function setText(root, selector, value) {
        const element = root.querySelector(selector);
        if (element) element.textContent = String(value || '');
    }

    function showPostLoginProOffer(options = {}) {
        ensureStyles();
        document.getElementById(OVERLAY_ID)?.remove();

        const data = options.data || {};
        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'pro-offer-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'postLoginProOfferTitle');
        overlay.innerHTML = `
            <section class="pro-offer-modal">
                <button class="pro-offer-close" type="button" data-pro-offer-dismiss aria-label="Đóng thông báo">×</button>
                <div class="pro-offer-content">
                    <div class="pro-offer-topline">
                        <span class="pro-offer-badge">PRO</span>
                        <span class="pro-offer-limited" data-pro-offer-limited></span>
                    </div>
                    <h1 id="postLoginProOfferTitle" class="pro-offer-title">
                        <span data-pro-offer-title></span><br>
                        <span class="pro-offer-title-highlight" data-pro-offer-highlight></span>
                    </h1>
                    <p class="pro-offer-intro" data-pro-offer-intro></p>
                    <div class="pro-offer-gift">
                        <div class="pro-offer-canva">
                            <img src="/brand-canva.svg" alt="" width="80" height="30">
                        </div>
                        <div class="pro-offer-gift-copy">
                            <span class="pro-offer-gift-eyebrow" data-pro-offer-gift-eyebrow></span>
                            <strong class="pro-offer-gift-title" data-pro-offer-gift-title></strong>
                            <span class="pro-offer-gift-caption" data-pro-offer-gift-caption></span>
                        </div>
                    </div>
                    <ul class="pro-offer-benefits" data-pro-offer-benefits></ul>
                    <p class="pro-offer-note"><strong>Lưu ý:</strong> <span data-pro-offer-note></span></p>
                    <div class="pro-offer-actions">
                        <button class="pro-offer-action pro-offer-secondary" type="button" data-pro-offer-dismiss></button>
                        <button class="pro-offer-action pro-offer-primary" type="button" data-pro-offer-upgrade></button>
                    </div>
                </div>
            </section>
        `;

        setText(overlay, '[data-pro-offer-limited]', data.limitedLabel);
        setText(overlay, '[data-pro-offer-title]', data.title);
        setText(overlay, '[data-pro-offer-highlight]', data.highlightTitle);
        setText(overlay, '[data-pro-offer-intro]', data.intro);
        setText(overlay, '[data-pro-offer-gift-eyebrow]', data.giftEyebrow);
        setText(overlay, '[data-pro-offer-gift-title]', data.giftTitle);
        setText(overlay, '[data-pro-offer-gift-caption]', data.giftCaption);
        setText(overlay, '[data-pro-offer-note]', data.note);
        setText(overlay, '.pro-offer-secondary', data.secondaryAction || 'Để sau');
        setText(overlay, '.pro-offer-primary', data.primaryAction || 'Nâng cấp PRO ngay');

        const benefits = overlay.querySelector('[data-pro-offer-benefits]');
        const benefitItems = Array.isArray(data.benefits) ? data.benefits : [];
        benefitItems.forEach((benefit) => {
            const item = document.createElement('li');
            const check = document.createElement('span');
            const copy = document.createElement('span');
            check.className = 'pro-offer-check';
            check.textContent = '✓';
            check.setAttribute('aria-hidden', 'true');
            copy.textContent = String(benefit || '');
            item.append(check, copy);
            benefits.appendChild(item);
        });

        const previousOverflow = document.body.style.overflow;
        const previouslyFocused = document.activeElement;
        let completed = false;

        function finish(callback) {
            if (completed) return;
            completed = true;
            document.removeEventListener('keydown', handleKeydown);
            overlay.remove();
            document.body.style.overflow = previousOverflow;
            if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
            if (typeof callback === 'function') callback();
        }

        function handleKeydown(event) {
            if (event.key === 'Escape') finish(options.onDismiss);
        }

        overlay.querySelectorAll('[data-pro-offer-dismiss]').forEach((button) => {
            button.addEventListener('click', () => finish(options.onDismiss));
        });
        overlay.querySelector('[data-pro-offer-upgrade]')?.addEventListener('click', () => finish(options.onUpgrade));

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeydown);
        requestAnimationFrame(() => overlay.querySelector('.pro-offer-close')?.focus());

        return { close: () => finish(options.onDismiss) };
    }

    global.showPostLoginProOffer = showPostLoginProOffer;
})(window);

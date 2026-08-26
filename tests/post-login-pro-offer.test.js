const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const authSource = fs.readFileSync(path.join(frontendRoot, 'auth.js'), 'utf8');
const authHtml = fs.readFileSync(path.join(frontendRoot, 'auth', 'index.html'), 'utf8');
const homeHtml = fs.readFileSync(path.join(frontendRoot, 'index.html'), 'utf8');
const componentSource = fs.readFileSync(path.join(frontendRoot, 'post-login-pro-offer.js'), 'utf8');
const canvaLogo = fs.readFileSync(path.join(frontendRoot, 'brand-canva.svg'), 'utf8');

function assertInlineScriptsParse(filename, html) {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
        .filter((match) => !/type\s*=\s*["'](?:text\/plain|application\/ld\+json)["']/i.test(match[1]))
        .map((match) => match[2])
        .filter((source) => source.trim());
    scripts.forEach((source) => new Function(source));
    assert.ok(scripts.length > 0, `${filename} should contain executable inline scripts`);
}

assert.match(authSource, /data\.type === 'pro-canva-offer'/);
assert.match(authSource, /renewalAction \|\| 'Gia hạn PRO ngay'/);
assert.match(authSource, /upgradeAction \|\| 'Nâng cấp PRO ngay'/);
assert.doesNotMatch(authSource, /eligiblePlans/);

const componentIndex = authHtml.indexOf('../post-login-pro-offer.js');
const authIndex = authHtml.indexOf('../auth.js');
assert.ok(componentIndex >= 0, 'Auth page must load the PRO offer component');
assert.ok(componentIndex < authIndex, 'PRO offer component must load before auth.js');

assert.match(componentSource, /global\.showPostLoginProOffer = showPostLoginProOffer/);
assert.match(componentSource, /@media \(max-width: 620px\)/);
assert.match(componentSource, /src="\/brand-canva\.svg"/);
assert.match(componentSource, /\.pro-offer-modal button\s*\{[\s\S]*?font-family:/);
assert.match(componentSource, /animation: pro-offer-welcome-in 680ms/);
assert.match(componentSource, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(componentSource, /font-size: clamp\(1\.18rem, 5\.4vw, 1\.3rem\)/);
assert.match(componentSource, /\.pro-offer-title\s*\{[\s\S]*?white-space: nowrap/);
assert.match(canvaLogo, /^<svg[^>]+width="80"[^>]+height="30"/);

assert.match(homeHtml, /tiembanh_open_pro_upgrade_after_login/);
assert.match(homeHtml, /window\.openPaymentModal\('pro', '40\.000đ\/tháng', 'pro'\)/);

assertInlineScriptsParse('auth/index.html', authHtml);
assertInlineScriptsParse('index.html', homeHtml);

console.log('post-login PRO offer frontend tests passed');

// ========================================
// Environment Configuration
// ========================================
// Auto-detect environment based on hostname

(function() {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    const BACKEND_URLS = {
        dev: 'http://localhost:3000',
        prod: 'https://api.tiembanh4k.com'
    };

    const backendUrl = (isLocalhost ? BACKEND_URLS.dev : BACKEND_URLS.prod).replace(/\/+$/, '');
    const environment = isLocalhost ? 'development' : 'production';

    window.APP_CONFIG = Object.freeze({
        BACKEND_URL: backendUrl,
        ENVIRONMENT: environment
    });
})();

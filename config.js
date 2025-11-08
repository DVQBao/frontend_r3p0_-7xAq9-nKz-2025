// ========================================
// Environment Configuration
// ========================================
// Auto-detect environment based on hostname

(function() {
    // Detect if running on localhost
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';

    // Backend URLs
    const BACKEND_URLS = {
        dev: 'http://localhost:3000',
        prod: 'https://backend-c0r3-7xpq9zn2025.onrender.com'
    };

    // Auto-select based on environment
    const backendUrl = isLocalhost ? BACKEND_URLS.dev : BACKEND_URLS.prod;
    const environment = isLocalhost ? 'development' : 'production';

    // Export configuration
    window.APP_CONFIG = {
        BACKEND_URL: backendUrl,
        ENVIRONMENT: environment
    };

    // Log configuration (for debugging)
    console.log('%c🌍 Environment Configuration', 'color: #4CAF50; font-weight: bold; font-size: 14px');
    console.log(`   Environment: ${environment}`);
    console.log(`   Backend URL: ${backendUrl}`);
    console.log(`   Frontend URL: ${window.location.origin}`);
})();


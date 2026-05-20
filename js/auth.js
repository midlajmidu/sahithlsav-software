// js/auth.js — SSF Portal Production Auth & Identity
// Handles: Single Admin Session, Inactivity, Redirects, and Back-button guards

const SESSION_CHECK_INTERVAL = 30000; // 30s

/**
 * Global Session Checker
 * @param {boolean} redirectIfMissing - Should we kick out unauthorized users?
 */
async function checkAuth(redirectIfMissing = true) {
    // 1. Check Supabase Session
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (!session || error) {
        if (redirectIfMissing) {
            console.log('Unauthorized access attempt blocked.');
            window.location.replace('login.html');
        }
        return null;
    }

    // 2. Start Session Guard (Inactivity Tracker)
    if (typeof SessionGuard !== 'undefined') {
        SessionGuard.startSessionWatcher();
        SessionGuard.protectBackButton();
    }

    return session;
}

/**
 * Unified Logout
 */
async function handleLogout() {
    if (typeof logActivity === 'function') {
        await logActivity('logout', 'auth');
    }
    
    await supabaseClient.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('login.html');
}

/**
 * Activity Logging Proxy (Ensures logs are safe)
 */
async function logActivity(action, module, meta = {}) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const userEmail = session?.user?.email || 'admin';

    try {
        await supabaseClient.from('activity_logs').insert({
            action,
            module,
            user_email: userEmail,
            meta: meta,
            ip_address: 'client-ip' // In a serverless setup, this is usually handled by Edge Functions/WAF
        });
    } catch (err) {
        console.warn('Logging failed:', err);
    }
}

// Export to window
window.checkAuth = checkAuth;
window.handleLogout = handleLogout;
window.logActivity = logActivity;

/**
 * Error Boundary / Global Handler (Nielsen #9)
 */
window.onerror = function(message, source, lineno, colno, error) {
    console.error('SSF Portal Error:', message, error);
    // Don't show technical jargon to users
    if (typeof SessionGuard !== 'undefined') {
        SessionGuard.notify('A minor technical glitch occurred. Actions were logged.', 'warning');
    }
    return false;
};

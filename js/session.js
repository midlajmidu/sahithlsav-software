// js/session.js — SSF Portal Production Session Guard

const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10 Minutes
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
let _inactivityTimer = null;

/**
 * Reset inactivity timer on any user interaction
 */
function _resetTimer() {
    clearTimeout(_inactivityTimer);
    _inactivityTimer = setTimeout(_handleAutoLogout, INACTIVITY_LIMIT);
}

/**
 * Execute security logout
 */
async function _handleAutoLogout() {
    console.log('Session expired due to inactivity.');
    
    if (typeof supabaseClient !== 'undefined') {
        await supabaseClient.auth.signOut();
    }
    
    // Clear all persistent data
    localStorage.clear();
    sessionStorage.clear();
    
    // Redirect with reason
    window.location.replace('login.html?reason=timeout');
}

/**
 * Initialize watcher
 */
function startSessionWatcher() {
    ACTIVITY_EVENTS.forEach(event => {
        document.addEventListener(event, _resetTimer, { passive: true });
    });
    _resetTimer();
}

/**
 * Prevent browser back button after logout
 */
function protectBackButton() {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = function() {
        window.history.pushState(null, "", window.location.href);
    };
}

/**
 * Simple Toast/Notification system for production UX
 */
const notify = {
    show(message, type = 'info') {
        const container = document.getElementById('toast-container') || _createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} fade-in`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${type === 'success' ? '✅' : 'ℹ️'}</span>
                <span class="toast-text">${message}</span>
            </div>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }
};

function _createToastContainer() {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:10000; display:flex; flex-direction:column; gap:10px;';
    document.body.appendChild(div);
    return div;
}


// Sidebar Toggle Logic for Mobile
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }
});


/**
 * Confirm before destructive actions
 */
async function confirmAction(title, message) {
    // In a real production app, this would be a custom modal. 
    // Using native confirm for reliability if custom modal isn't ready.
    return confirm(`${title}\n\n${message}`);
}

/**
 * Global Loader UI
 */
function showLoader(message = 'Loading...') {
    let loader = document.getElementById('global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.innerHTML = `
            <div class="loader-backdrop" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.8);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;backdrop-filter:blur(2px);">
                <div class="loader-spinner" style="width:40px;height:40px;border:4px solid #f3f3f3;border-top:4px solid var(--primary);border-radius:50%;animation:spin 1s linear infinite;"></div>
                <p id="loader-text" style="margin-top:1rem;font-weight:600;color:var(--primary);">${message}</p>
            </div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        `;
        document.body.appendChild(loader);
    } else {
        document.getElementById('loader-text').textContent = message;
        loader.style.display = 'block';
    }
}

function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = 'none';
}

/**
 * Global UI helper (backward compatibility with ui.toast)
 */
window.ui = {
    toast: (msg, type) => notify.show(msg, type)
};

window.showLoader = showLoader;
window.hideLoader = hideLoader;
window.SessionGuard = { startSessionWatcher, protectBackButton, notify, confirmAction };

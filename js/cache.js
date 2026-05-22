// js/cache.js — Global Cache Management System
const CACHE_VERSION = "v3";
const DEBUG_MODE = false;

/**
 * Log if debug mode is on
 */
function cacheLog(msg, data) {
    if (DEBUG_MODE) {
        console.log(`[Cache System] ${msg}`, data || '');
    }
}

const CacheManager = {
    set(key, data, ttlMinutes = 5) {
        // No-op - caching disabled
    },
    get(key) {
        return null; // Always return null to force fetch
    },
    clear(fullKey) {
        sessionStorage.removeItem(fullKey);
    },
    invalidate(modules = []) {
        // Clear everything on invalidate just in case
        sessionStorage.clear();
    },
    clearAll() {
        sessionStorage.clear();
    }
};

// Global Helper to wrap Supabase fetches - now always fetches fresh
async function fetchWithCache(key, fetchFn, ttl = 5) {
    return await fetchFn();
}


window.CacheManager = CacheManager;
window.fetchWithCache = fetchWithCache;

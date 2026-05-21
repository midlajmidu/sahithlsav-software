// js/cache.js — Global Cache Management System
const CACHE_VERSION = "v3";
const DEBUG_MODE = true;

/**
 * Log if debug mode is on
 */
function cacheLog(msg, data) {
    if (DEBUG_MODE) {
        console.log(`[Cache System] ${msg}`, data || '');
    }
}

const CacheManager = {
    /**
     * Set data into sessionStorage with TTL and versioning
     */
    set(key, data, ttlMinutes = 5) {
        const fullKey = `${key}_${CACHE_VERSION}`;
        const entry = {
            data: data,
            expiry: Date.now() + (ttlMinutes * 60 * 1000)
        };
        sessionStorage.setItem(fullKey, JSON.stringify(entry));
        cacheLog(`Set: ${fullKey}`, { ttl: ttlMinutes });
    },

    /**
     * Get data from sessionStorage if version matches and not expired
     */
    get(key) {
        const fullKey = `${key}_${CACHE_VERSION}`;
        const cached = sessionStorage.getItem(fullKey);
        
        if (!cached) return null;

        try {
            const parsed = JSON.parse(cached);
            if (Date.now() > parsed.expiry) {
                this.clear(fullKey);
                cacheLog(`Expired: ${fullKey}`);
                return null;
            }
            cacheLog(`Load: ${fullKey}`);
            return parsed.data;
        } catch (e) {
            this.clear(fullKey);
            return null;
        }
    },

    /**
     * Clear specific key
     */
    clear(fullKey) {
        sessionStorage.removeItem(fullKey);
        cacheLog(`Cleared: ${fullKey}`);
    },

    /**
     * Invalidate related caches based on change type
     */
    invalidate(modules = []) {
        const allKeys = Object.keys(sessionStorage);
        const patterns = {
            'category': ['cat_cache', 'prog_cache', 'results_cache'],
            'program': ['prog_cache', 'results_cache', 'dashboard_cache'],
            'score': ['score_cache'],
            'fund': ['fund_cache', 'analytics_cache', 'dashboard_cache'],
            'results': ['results_cache', 'dashboard_cache']
        };

        let keysToClear = [];
        modules.forEach(mod => {
            if (patterns[mod]) {
                keysToClear = [...keysToClear, ...patterns[mod]];
            }
        });

        // Unique patterns
        const uniquePatterns = [...new Set(keysToClear)];

        allKeys.forEach(storageKey => {
            if (uniquePatterns.some(p => storageKey.startsWith(p))) {
                sessionStorage.removeItem(storageKey);
                cacheLog(`Auto-Invalidated: ${storageKey}`);
            }
        });
    },

    /**
     * Wipe all versioned cache
     */
    clearAll() {
        const allKeys = Object.keys(sessionStorage);
        allKeys.forEach(k => {
            if (k.includes(`_${CACHE_VERSION}`)) {
                sessionStorage.removeItem(k);
            }
        });
        cacheLog("Wiped all versioned cache");
    }
};

// Global Helper to wrap Supabase fetches
async function fetchWithCache(key, fetchFn, ttl = 5) {
    const cached = CacheManager.get(key);
    if (cached !== null) return cached;

    const data = await fetchFn();
    if (data) {
        CacheManager.set(key, data, ttl);
    }
    return data;
}

window.CacheManager = CacheManager;
window.fetchWithCache = fetchWithCache;

const SUPABASE_URL = "https://dcuwpqxeikiayexmqwgj.supabase.co";

const SUPABASE_KEY = "sb_publishable_HcU1GoBSsRrg4X_m-FOASQ_ygk4WQmH";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

/**
 * Cache helper for low-network and high-speed loading.
 */
async function getCachedData(key, fetchFn, ttlMinutes = 10) {
    const cached = localStorage.getItem(key);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            const now = new Date().getTime();
            if (now < parsed.expiry) {
                return parsed.data;
            }
        } catch (e) {
            localStorage.removeItem(key);
        }
    }

    const data = await fetchFn();
    if (data) {
        const expiry = new Date().getTime() + (ttlMinutes * 60 * 1000);
        localStorage.setItem(key, JSON.stringify({ data, expiry }));
    }
    return data;
}
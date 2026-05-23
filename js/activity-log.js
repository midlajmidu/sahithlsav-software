// js/activity-log.js — SSF Portal Activity Logger
// Stores action logs in Supabase 'activity_logs' table (create if missing)
// Falls back to localStorage if DB unavailable

const SSF_LOG_TABLE = 'activity_logs';

/**
 * Log an admin action to Supabase.
 * @param {string} action  - e.g. 'login', 'upload', 'delete', 'publish'
 * @param {string} module  - e.g. 'auth', 'results', 'fund', 'admin'
 * @param {object} meta    - optional extra data (sanitized before storage)
 */
async function logActivity(action, module = 'system', meta = {}) {
  try {
    // Safe meta — never log passwords or secrets
    const safeMeta = { ...meta };
    delete safeMeta.password;
    delete safeMeta.token;
    delete safeMeta.secret;

    let userEmail = 'anonymous_visitor';
    try {
      // Don't await session if not needed immediately, avoid hanging on slow network
      const sessionStr = localStorage.getItem('sb-' + SUPABASE_URL.split('//')[1].split('.')[0] + '-auth-token');
      if (sessionStr) {
          const session = JSON.parse(sessionStr);
          if (session?.user?.email) userEmail = session.user.email;
      }
    } catch (_) {}


    const entry = {
      action,
      module,
      user_email : userEmail,
      meta       : JSON.stringify(safeMeta),
      created_at : new Date().toISOString(),
    };

    // Try to insert into Supabase
    const { error } = await supabaseClient.from(SSF_LOG_TABLE).insert(entry);
    if (error) throw error;

  } catch (err) {
    // Graceful local fallback
    try {
      const local = JSON.parse(localStorage.getItem('ssf_activity_log') || '[]');
      local.unshift({ action, module, meta, ts: Date.now() });
      localStorage.setItem('ssf_activity_log', JSON.stringify(local.slice(0, 100)));
    } catch (_) {}
  }
}

window.logActivity = logActivity;

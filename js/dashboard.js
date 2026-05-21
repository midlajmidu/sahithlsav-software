// js/dashboard.js — SSF Dashboard: loads stats, charts, and fund totals

document.addEventListener('DOMContentLoaded', async () => {
  const session = await checkAuth(true);
  if (!session) return;

  loadDashboardData();
});

async function loadDashboardData() {
  showLoader('Loading dashboard...');

  try {
    const categories = await fetchWithCache('dashboard_cat', async () => {
        const { data } = await supabaseClient.from('categories').select('*');
        return data || [];
    }, 2);

    const programs = await fetchWithCache('dashboard_prog', async () => {
        const { data } = await supabaseClient.from('programs').select('*');
        return data || [];
    }, 2);

    const funds = await fetchWithCache('dashboard_fund', async () => {
        const { data } = await supabaseClient.from('fund_receipts').select('amount');
        return data || [];
    }, 1);


    const totalCategories  = categories.length;
    const totalPrograms    = programs.length;
    const uploaded         = programs.filter(p => p.poster_url).length;
    const pending          = totalPrograms - uploaded;
    const published        = programs.filter(p => p.published && p.poster_url).length;
    const completionPct    = totalPrograms === 0 ? 0 : Math.round((uploaded / totalPrograms) * 100);

    // Fund totals
    const totalFunds = funds.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    // ── Update stat cards ──────────────────────────────
    document.getElementById('stat-categories').textContent = totalCategories;
    document.getElementById('stat-programs').textContent   = totalPrograms;
    document.getElementById('stat-uploaded').textContent   = uploaded;
    document.getElementById('stat-pending').textContent    = pending;
    document.getElementById('stat-published').textContent  = published;
    document.getElementById('stat-completion').textContent = completionPct + '%';
    document.getElementById('progress-completion').style.width = completionPct + '%';

    const fundsEl = document.getElementById('stat-funds');
    if (fundsEl) {
      fundsEl.textContent = '₹' + totalFunds.toLocaleString('en-IN');
    }
    const fundsCountEl = document.getElementById('stat-funds-count');
    if (fundsCountEl) {
      fundsCountEl.textContent = `from ${funds.length} receipt${funds.length !== 1 ? 's' : ''}`;
    }

    // ── Doughnut chart ─────────────────────────────────
    const ctx = document.getElementById('completionPieChart').getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Uploaded', 'Pending'],
        datasets: [{
          data: [uploaded, pending],
          backgroundColor: ['#2e7d32', '#e2e8f0'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        cutout: '70%',
        plugins: { legend: { position: 'bottom' } },
      },
    });

    // ── Category progress bars ─────────────────────────
    const progressList = document.getElementById('category-progress-list');
    if (!progressList) return;
    progressList.innerHTML = '';

    if (categories.length === 0) {
      progressList.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No categories found.</p>';
      return;
    }

    categories.forEach(cat => {
      const catPrograms = programs.filter(p => p.category_id === cat.id);
      const catTotal    = catPrograms.length;
      const catUploaded = catPrograms.filter(p => p.poster_url).length;
      const percent     = catTotal === 0 ? 0 : Math.round((catUploaded / catTotal) * 100);

      let color = 'var(--warning)';
      if (percent === 100) color = 'var(--success)';
      if (percent === 0)   color = 'var(--danger)';

      progressList.innerHTML += `
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;font-size:0.875rem;">
            <strong>${cat.name}</strong>
            <span>${catUploaded} / ${catTotal} (${percent}%)</span>
          </div>
          <div class="progress-container">
            <div class="progress-bar" style="width:${percent}%;background-color:${color};"></div>
          </div>
        </div>
      `;
    });

  } catch (err) {
    console.error('[Dashboard]', err);
    ui.toast('Could not load dashboard data. Please refresh.', 'error');
  } finally {
    hideLoader();
  }
}

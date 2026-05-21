// js/fund-dashboard.js
// SSF Fund Dashboard - Admin Analytics & History

const PAGE_SIZE = 20;
let allReceipts = [];   // All fetched records for client-side search
let filteredReceipts = [];
let currentPage = 1;

/* ── Toast ── */
function toast(msg, type = 'info', dur = 3000) {
  let wrap = document.getElementById('toastWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toastWrap';
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el   = document.createElement('div');
  el.className = `toast-msg ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, dur);
}


/* ── Format currency ── */
function fmt(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

/* ── Format date short ── */
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

/* ── Amount in words (re-used for receipt view) ── */
function amountToWords(num) {
  const units = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
    'Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function convert(n) {
    if (n < 20) return units[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+units[n%10] : '');
    if (n < 1000) return units[Math.floor(n/100)]+' Hundred'+(n%100?' '+convert(n%100):'');
    if (n < 100000) return convert(Math.floor(n/1000))+' Thousand'+(n%1000?' '+convert(n%1000):'');
    if (n < 10000000) return convert(Math.floor(n/100000))+' Lakh'+(n%100000?' '+convert(n%100000):'');
    return convert(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+convert(n%10000000):'');
  }
  const s = convert(Math.abs(Math.floor(num)));
  return s ? s + ' Rupees Only' : 'Zero Rupees Only';
}

/* ══════════════════════════════
   LOAD ALL RECEIPTS
   ══════════════════════════════ */
async function loadAllReceipts() {
  const data = await fetchWithCache('fund_cache', async () => {
    const { data: res, error } = await supabaseClient
      .from('fund_receipts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res || [];
  }, 2);

  allReceipts     = data || [];
  filteredReceipts = [...allReceipts];
  return allReceipts;
}


/* ══════════════════════════════
   COMPUTE STATS
   ══════════════════════════════ */
function computeStats(records) {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const totalAmount = records.reduce((s, r) => s + Number(r.amount), 0);
  const todayAmt    = records.filter(r => r.created_at.startsWith(today)).reduce((s,r)=>s+Number(r.amount),0);
  const highest     = records.length ? Math.max(...records.map(r => Number(r.amount))) : 0;

  document.getElementById('stat-total').textContent   = fmt(totalAmount);
  document.getElementById('stat-today').textContent   = fmt(todayAmt);
  document.getElementById('stat-donors').textContent  = records.length;
  document.getElementById('stat-highest').textContent = fmt(highest);
}

/* ══════════════════════════════
   CHARTS
   ══════════════════════════════ */
let paymentChartInstance = null;

function buildCharts(records) {
  // Destroy existing chart if any
  if (paymentChartInstance) {
    paymentChartInstance.destroy();
  }

  // ── Payment method pie ──
  const pmMap = {};
  records.forEach(r => {
    pmMap[r.payment_method] = (pmMap[r.payment_method] || 0) + Number(r.amount);
  });
  
  const ctx = document.getElementById('paymentChart');
  if (!ctx) return;

  const pColors = ['#2e7d32','#2bbbad','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6'];
  paymentChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(pmMap),
      datasets: [{ data: Object.values(pmMap), backgroundColor: pColors, borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}


/* ══════════════════════════════
   HISTORY TABLE
   ══════════════════════════════ */
function paymentBadge(method) {
  const map = { Cash:'badge-cash', UPI:'badge-upi', 'Bank Transfer':'badge-bank' };
  return `<span class="badge ${map[method]||'badge-other'}">${method}</span>`;
}

function renderTable() {
  const tbody = document.getElementById('historyBody');
  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filteredReceipts.slice(start, start + PAGE_SIZE);

  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:#999;">No records found</td></tr>`;
    renderPagination();
    return;
  }

  tbody.innerHTML = page.map(r => `
    <tr>
      <td><strong style="font-family:monospace;">${r.receipt_number}</strong></td>
      <td>${r.donor_name}</td>
      <td>${r.place}</td>
      <td><strong>${fmt(r.amount)}</strong></td>
      <td>${paymentBadge(r.payment_method)}</td>
      <td>${r.collector_name}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td>
        <button class="action-icon" onclick="viewReceipt('${r.id}')" title="View">👁</button>
        <button class="action-icon del" onclick="deleteReceipt('${r.id}')" title="Delete">🗑</button>
      </td>
    </tr>
  `).join('');

  renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(filteredReceipts.length / PAGE_SIZE);
  const pag = document.getElementById('pagination');
  if (totalPages <= 1) { pag.innerHTML = ''; return; }

  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  pag.innerHTML = html;
}

function goPage(p) {
  currentPage = p;
  renderTable();
  document.querySelector('.table-panel').scrollIntoView({ behavior: 'smooth' });
}

/* ── Search ── */
function handleSearch(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    filteredReceipts = [...allReceipts];
  } else {
    filteredReceipts = allReceipts.filter(r =>
      r.donor_name.toLowerCase().includes(q) ||
      r.place.toLowerCase().includes(q) ||
      r.receipt_number.toLowerCase().includes(q) ||
      (r.collector_name && r.collector_name.toLowerCase().includes(q))
    );
  }
  currentPage = 1;
  renderTable();
}

/* ══════════════════════════════
   VIEW RECEIPT MODAL
   ══════════════════════════════ */
function viewReceipt(id) {
  const r = allReceipts.find(x => String(x.id) === String(id));
  if (!r) return;


  const paper = document.getElementById('viewReceiptPaper');
  paper.innerHTML = `
    <div class="rcp-header" style="text-align:center;border-bottom:2px dashed #aaa;padding-bottom:1rem;margin-bottom:1rem;">
      <img src="images/logo.png" style="height:56px;margin-bottom:0.5rem;">
      <h2 style="color:#2e7d32;font-size:1.1rem;font-family: 'Inter', sans-serif; line-height: 1.3;"><span class="ssf-font" style="font-size: 1.4em;">SSF</span><br><span style="font-size: 0.85em; letter-spacing: 0.05em;">CHATHAMANGALAM SECTOR SAHITHOLSAV</span></h2>
      <p style="font-size: 0.72rem; margin-bottom: 0.25rem; color: #777;">ssfchathamangalam@gmail.com</p>
      <p style="font-size:0.75rem;color:#555;font-family: 'Inter', sans-serif;">Official Fund Collection Receipt</p>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:1rem;">
      <span>Receipt No.: <strong>${r.receipt_number}</strong></span>
      <span>Date: <strong>${fmtDate(r.created_at)}</strong></span>
    </div>
    ${field('Received from', r.donor_name)}
    ${field('Place', r.place)}
    <div style="border:2px solid #2e7d32;border-radius:0.5rem;padding:0.75rem 1rem;margin:1rem 0;display:flex;align-items:center;gap:0.5rem;">
      <span style="font-size:1.4rem;font-weight:700;color:#2e7d32;">₹</span>
      <span style="font-size:1.7rem;font-weight:800;color:#2e7d32;">${Number(r.amount).toLocaleString('en-IN')}</span>
    </div>
    ${field('Amount in words', amountToWords(r.amount))}
    ${field('Payment Method', r.payment_method)}
    ${r.notes ? field('Notes', r.notes) : ''}
    <div style="display:flex;justify-content:flex-end;border-top:1.5px dashed #aaa;padding-top:1rem;margin-top:1rem;">
      <div style="text-align:center;font-size:0.75rem;color:#777;position:relative;">
        <img src="images/WhatsApp_Image_2026-05-19_at_23.15.24-removebg-preview.png" style="position:absolute; bottom:20px; left:50%; transform:translateX(-50%); height:40px; pointer-events:none;">
        <div style="width:100px;border-bottom:1.5px solid #aaa;height:28px;margin:0 auto 4px;"></div>Gen. Secretary
      </div>
    </div>
    <div style="text-align:center;margin-top:1rem;border-top:2px dashed #aaa;padding-top:1rem;font-size:0.75rem;color:#888;">
      <strong><span class="ssf-font" style="color:#2e7d32">SSF</span> Chathamangalam Sector</strong><br>
      <span style="font-size: 0.7rem; opacity: 0.8;">ssfchathamangalam@gmail.com</span><br>
      Thank you for your generous contribution 🌿
    </div>
  `;

  const modal = document.getElementById('viewModal');
  modal.style.display = 'flex';
}

function field(label, value) {
  return `
    <div style="margin-bottom:0.75rem;">
      <div style="font-size:0.7rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.2rem;">${label}</div>
      <div style="border-bottom:1.5px dotted #aaa;padding-bottom:0.25rem;font-weight:500;">${value}</div>
    </div>
  `;
}

function closeViewModal() {
  document.getElementById('viewModal').style.display = 'none';
}

function printViewModal() {
  const content = document.getElementById('viewReceiptPaper').innerHTML;
  const win = window.open('', '', 'width=500,height=700');
  win.document.write(`
    <html><head><title>Receipt</title>
    <style>
      body{font-family:Inter,sans-serif;padding:1.5cm;color:#111;}
      img{height:56px;}
    </style></head>
    <body>${content}</body></html>
  `);
  win.document.close();
  win.print();
}

/* ══════════════════════════════
   DELETE RECEIPT (PERMANENT)
   ══════════════════════════════ */
async function deleteReceipt(id) {
  const confirmed = await SessionGuard.confirmAction('Delete Receipt', 'Are you sure you want to permanently delete this receipt? This cannot be undone.');
  if (!confirmed) return;

  showLoader('Deleting...');
  try {
      const { error } = await supabaseClient
        .from('fund_receipts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      SessionGuard.notify.show('Receipt deleted permanently.', 'success');

      
      // Invalidate cache so refresh shows correct data
      if (window.CacheManager) {
        CacheManager.invalidate(['fund']);
      }
      
      // Update local state
      allReceipts      = allReceipts.filter(r => String(r.id) !== String(id));
      filteredReceipts = filteredReceipts.filter(r => String(r.id) !== String(id));
      
      computeStats(allReceipts);
      buildCharts(allReceipts);
      renderTable();


  } catch (err) {
      toast(err.message, 'error');
  } finally {
      hideLoader();
  }
}

/* ══════════════════════════════
   EXPORT CSV
   ══════════════════════════════ */
function exportCSV() {
  const headers = ['Receipt #','Donor Name','Place','Amount','Payment Method','Gen. Secretary','Notes','Date'];
  const rows = filteredReceipts.map(r => [
    r.receipt_number,
    r.donor_name,
    r.place,
    r.amount,
    r.payment_method,
    r.collector_name,
    r.notes || '',
    fmtDate(r.created_at)
  ]);

  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `SSF-Fund-Receipts-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exported!', 'success');
}

/* ══════════════════════════════
   INIT
   ══════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // Auth check - admin required for dashboard
  const session = await checkAuth(true);
  if (!session) return;

  showLoader('Loading fund data...');

  try {
    const records = await loadAllReceipts();
    if (!records) return;

    computeStats(records);
    buildCharts(records);
    renderTable();

    // Search listener
    document.getElementById('historySearch').addEventListener('input', (e) => {
      handleSearch(e.target.value);
    });

    // Close view modal on backdrop
    document.getElementById('viewModal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('viewModal')) closeViewModal();
    });

  } catch (err) {
    console.error(err);
    toast('Error loading dashboard: ' + err.message, 'error');
  } finally {
    hideLoader();
  }
});

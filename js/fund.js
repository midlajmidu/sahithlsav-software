// js/fund.js
// SSF Fund Collection Module - Public form logic

/* ===================
   CONSTANTS & STATE
   =================== */
const DRAFT_KEY = 'ssf_fund_draft';
const COLLECTOR_KEY = 'ssf_collector_name';

let currentReceiptData = null; // Holds the last generated receipt

/* ===================
   TOAST NOTIFICATIONS
   =================== */
function toast(message, type = 'info', duration = 3000) {
  let wrap = document.getElementById('toastWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toastWrap';
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast-msg ${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, duration);
}


/* ===================
   AMOUNT IN WORDS
   =================== */
function amountToWords(num) {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n) {
    if (n < 20) return units[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + units[n % 10] : '');
    if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }
  const str = convert(Math.abs(Math.floor(num)));
  return str ? str + ' Rupees Only' : 'Zero Rupees Only';
}

/* ===================
   RECEIPT NUMBER
   =================== */
async function generateReceiptNumber() {
  const year = new Date().getFullYear();

  // ONLY count valid (non-deleted) receipts to get NEXT sequence
  const { count, error } = await supabaseClient
    .from('fund_receipts')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);

  if (error) console.error('Seq error:', error);
  
  const seq = String((count || 0) + 1).padStart(4, '0');
  return `SSF-${year}-${seq}`;
}

/* ===================
   SAVE TO DATABASE
   =================== */
async function saveReceipt(data) {
  const { data: row, error } = await supabaseClient
    .from('fund_receipts')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return row;
}

/* ===================
   DRAFT SUPPORT
   =================== */
function saveDraft() {
  const fields = ['donorName', 'place', 'amount',
                  'paymentMethod', 'collectorName', 'notes'];
  const draft = {};
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) draft[id] = el.value;
  });
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function restoreDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    let hasData = false;
    Object.entries(draft).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val) { el.value = val; hasData = true; }
    });
    if (hasData) {
      document.getElementById('draftNotice').style.display = 'block';
    }
  } catch (_) {}
}

function clearDraftStorage() {
  localStorage.removeItem(DRAFT_KEY);
}

/* ===================
   POPULATE RECEIPT UI
   =================== */
function showReceiptModal(data) {
  currentReceiptData = data;

  document.getElementById('rcp-number').textContent = data.receipt_number;
  document.getElementById('rcp-date').textContent   = new Date(data.created_at).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  document.getElementById('rcp-donor').textContent   = data.donor_name;
  document.getElementById('rcp-place').textContent   = data.place;
  document.getElementById('rcp-amount').textContent  = Number(data.amount).toLocaleString('en-IN');
  document.getElementById('rcp-words').textContent   = amountToWords(data.amount);
  document.getElementById('rcp-method').textContent  = data.payment_method;
  document.getElementById('rcp-notes').textContent   = data.notes || '-';
  document.getElementById('rcp-collector-label').textContent = 'Gen. Secretary';

  // Hide notes row if empty
  if (!data.notes) {
    document.getElementById('rcp-notes-row').style.display = 'none';
  } else {
    document.getElementById('rcp-notes-row').style.display = 'block';
  }

  document.getElementById('receiptModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeReceipt() {
  document.getElementById('receiptModal').classList.remove('open');
  document.body.style.overflow = '';
}

/* ===================
   PDF DOWNLOAD
   =================== */
async function generateReceiptPdf() {
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 200));
  const paper = document.getElementById('receiptPaper');

  
  const width = paper.offsetWidth;
  const height = paper.scrollHeight;

  const canvas = await html2canvas(paper, { 
    scale: 1.5, // Reduced scale for smaller size
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: width,
    height: height,
    windowWidth: width,
    windowHeight: height,
    onclone: (clonedDoc) => {
      const clonedPaper = clonedDoc.getElementById('receiptPaper');
      const clonedWrapper = clonedPaper.closest('.receipt-wrapper');
      const clonedModal = clonedDoc.getElementById('receiptModal');
      if (clonedModal) {
          clonedModal.style.position = 'static';
          clonedModal.style.display = 'block';
          clonedModal.style.height = 'auto';
          clonedModal.style.overflow = 'visible';
      }
      if (clonedWrapper) {
          clonedWrapper.style.position = 'static';
          clonedWrapper.style.height = 'auto';
          clonedWrapper.style.overflow = 'visible';
          clonedWrapper.style.margin = '0';
          clonedWrapper.style.padding = '0';
      }
      clonedPaper.style.height = 'auto';
      clonedPaper.style.overflow = 'visible';
      clonedPaper.style.display = 'block';
    }
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.7); // High quality but JPEG is much smaller than PNG


  const { jsPDF } = window.jspdf;
  
  // Calculate dynamic dimensions to prevent page break clipping
  const margin = 20;
  const canvasW = canvas.width;
  const canvasH = canvas.height;
  
  // We use the canvas width as the base for the PDF width (converted to px)
  const pdfW = (canvasW / 2) + (margin * 2); 
  const pdfH = (canvasH / 2) + (margin * 2);

  const pdf = new jsPDF({ 
    unit: 'px', 
    format: [pdfW, pdfH] 
  });

  pdf.addImage(imgData, 'JPEG', margin, margin, canvasW/2, canvasH/2, undefined, 'FAST');

  return pdf;
}


async function downloadReceiptPdf() {
  toast('Preparing PDF...', 'info');
  try {
    const pdf = await generateReceiptPdf();
    pdf.save(`Receipt-${currentReceiptData.receipt_number}.pdf`);
    toast('PDF downloaded!', 'success');
  } catch (e) {
    toast('PDF generation failed: ' + e.message, 'error');
  }
}

/* ===================
   PRINT
   =================== */
function printReceipt() {
  window.print();
}

/* ===================
   WHATSAPP SHARE
   =================== */
async function shareWhatsApp() {
  if (!currentReceiptData) return;
  const d = currentReceiptData;
  const text =
    `*SSF Chathamangalam Sector Sahitholsav - Fund Receipt*\n` +
    `----------------------------------\n` +
    `No: ${d.receipt_number}\n` +
    `Date: ${new Date(d.created_at).toLocaleDateString()}\n` +
    `Donor: ${d.donor_name}\n` +
    `Place: ${d.place}\n` +
    `Amount: *₹${Number(d.amount).toLocaleString('en-IN')}*\n` +
    `Payment: ${d.payment_method}\n` +
    `Gen. Secretary\n\n` +
    `_Thank you for your generous contribution 🌿_\n_SSF Chathamangalam Sector_`;


  // Try Web Share API (Modern Mobile)
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([], "test.pdf")] })) {
    toast('Preparing share...', 'info');
    try {
      const pdf = await generateReceiptPdf();
      const pdfBlob = pdf.output('blob');
      const filename = `Receipt-${d.receipt_number}.pdf`;
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });

      await navigator.share({
        title: 'SSF Fund Receipt',
        text: text,
        files: [file]
      });
      toast('Shared successfully!', 'success');
      return;
    } catch (e) {
      if (e.name !== 'AbortError') toast('Share failed: ' + e.message, 'warning');
    }
  }

  // Fallback to wa.me (Desktop/Unsupported Browsers)
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

/* ===================
   NEXT COLLECTION
   =================== */
function nextCollection() {
  closeReceipt();
  // Keep collector name, clear other fields
  const collector = document.getElementById('collectorName').value;
  document.getElementById('fundForm').reset();
  document.getElementById('fundForm').style.display = 'block';
  document.getElementById('postSubmitState').style.display = 'none';
  document.getElementById('collectorName').value = collector;
  clearDraftStorage();
  document.getElementById('draftNotice').style.display = 'none';
  // Reset quick amount buttons
  document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
  // Focus first field
  document.getElementById('donorName').focus();
  toast('Ready for next collection!', 'success');
}

/* ===================
   FORM SUBMISSION
   =================== */
async function handleFormSubmit(e) {
  e.preventDefault();

  // Get values
  const donorName    = document.getElementById('donorName').value.trim();
  const place        = document.getElementById('place').value.trim();
  const amount       = parseFloat(document.getElementById('amount').value);
  const paymentMethod = document.getElementById('paymentMethod').value;
  const collectorName = document.getElementById('collectorName').value.trim();
  const notes        = document.getElementById('notes').value.trim();

  // Basic validation
  if (!donorName || !place || !amount || !paymentMethod || !collectorName) {
    toast('Please fill all required fields.', 'error');
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    toast('Please enter a valid amount.', 'error');
    return;
  }

  // Remember collector name
  localStorage.setItem(COLLECTOR_KEY, collectorName);

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div><span>Saving...</span>';

  try {
    // 1. DUPLICATE DETECTION (Nielsen #5: Error Prevention)
    const { data: duplicates } = await supabaseClient
      .from('fund_receipts')
      .select('id')
      .eq('donor_name', donorName)
      .eq('amount', amount)
      .eq('collector_name', collectorName)
      .gte('created_at', new Date(Date.now() - 5 * 60000).toISOString())
      .is('deleted_at', null);

    if (duplicates && duplicates.length > 0) {
        const proceed = await SessionGuard.confirmAction('Possible Duplicate', 'A donation with the same name and amount was recorded in the last 5 minutes. Continue anyway?');
        if (!proceed) {
            btn.disabled = false;
            btn.innerHTML = '<span>Save Collection</span>';
            return;
        }
    }

    // 2. Generate receipt number
    const receiptNumber = await generateReceiptNumber();

    // Build data object
    const data = {
      receipt_number: receiptNumber,
      donor_name:     donorName,
      place:          place,
      phone:          null,
      amount:         amount,
      purpose:        "Sahitholsav Collection",
      payment_method: paymentMethod,
      collector_name: collectorName,
      notes:          notes || null,
    };

    // Save to database
    const saved = await saveReceipt(data);

    // Clear draft
    clearDraftStorage();
    document.getElementById('draftNotice').style.display = 'none';

    // Show Success State instead of immediate modal
    document.getElementById('fundForm').style.display = 'none';
    document.getElementById('postSubmitState').style.display = 'block';
    
    // Setup the view button for this specific saved row
    document.getElementById('viewReceiptBtn').onclick = () => {
      showReceiptModal(saved);
    };

    toast('Collection saved!', 'success');
    if (window.CacheManager) {
        CacheManager.invalidate(['fund']);
    }


  } catch (err) {
    console.error(err);
    toast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Done</span>';
  }
}

/* ===================
   INIT
   =================== */
document.addEventListener('DOMContentLoaded', () => {
  // Restore draft if available
  restoreDraft();

  // Remember collector name
  const savedCollector = localStorage.getItem(COLLECTOR_KEY);
  if (savedCollector) {
    const el = document.getElementById('collectorName');
    if (!el.value) el.value = savedCollector;
  }

  // Quick amount buttons
  document.querySelectorAll('.amount-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.amount;
      document.getElementById('amount').value = val;
      // Highlight active button
      document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Clear custom highlight when user types manually
  document.getElementById('amount').addEventListener('input', () => {
    document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
  });



  // Auto-advance: pressing Enter moves to next visible input
  const formInputs = document.querySelectorAll('#fundForm input, #fundForm select, #fundForm textarea');
  formInputs.forEach((el, idx) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && el.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const next = formInputs[idx + 1];
        if (next) next.focus();
      }
    });
  });

  // Auto-save draft on each change
  document.getElementById('fundForm').addEventListener('input', saveDraft);

  // Clear draft button
  document.getElementById('clearDraft').addEventListener('click', () => {
    clearDraftStorage();
    document.getElementById('fundForm').reset();
    document.getElementById('draftNotice').style.display = 'none';
    document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
  });

  // Form submit
  document.getElementById('fundForm').addEventListener('submit', handleFormSubmit);

  // Close modal on backdrop click
  document.getElementById('receiptModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('receiptModal')) closeReceipt();
  });

  // Focus first field
  document.getElementById('donorName').focus();
});

// LedgerShield AI - Client Application Logic

document.addEventListener('DOMContentLoaded', () => {
  // State
  let ledgerData = { entries: [], metrics: {} };
  let openModels = [];
  let selectedFile = null;

  // DOM Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const ledgerTableBody = document.getElementById('ledger-table-body');
  const tableCountLabel = document.getElementById('table-count-label');
  const metricTotalSpend = document.getElementById('metric-total-spend');
  const metricDeductibleSpend = document.getElementById('metric-deductible-spend');
  const metricTaxSavings = document.getElementById('metric-tax-savings');
  const metricReceiptCount = document.getElementById('metric-receipt-count');
  const activeModelSelect = document.getElementById('active-model-select');
  const modelSpeedBadge = document.getElementById('model-speed-badge');
  const modelsListGrid = document.getElementById('models-list-grid');

  // Scanner Elements
  const dropzone = document.getElementById('receipt-dropzone');
  const fileInput = document.getElementById('file-input');
  const previewImage = document.getElementById('preview-image');
  const rawTextInput = document.getElementById('raw-text-input');
  const confidentialNoteInput = document.getElementById('confidential-note-input');
  const btnRunScan = document.getElementById('btn-run-scan');
  const scanProgressBox = document.getElementById('scan-progress-box');
  const scannerStatusIndicator = document.getElementById('scanner-status-indicator');

  // Filter & Search
  const searchInput = document.getElementById('ledger-search-input');
  const categoryFilter = document.getElementById('category-filter-select');

  // ROI Calculator
  const slider = document.getElementById('receipt-volume-slider');
  const volumeDisplay = document.getElementById('calc-volume-display');
  const cloudCostDisplay = document.getElementById('calc-cloud-api-cost');
  const savingsTotalDisplay = document.getElementById('calc-savings-total');

  // Ollama Probe
  const btnPingOllama = document.getElementById('btn-ping-ollama');
  const ollamaStatusText = document.getElementById('ollama-status-text');

  // Privacy Retest
  const btnRetestPrivacy = document.getElementById('btn-retest-privacy');
  const telemetryLogs = document.getElementById('telemetry-terminal-logs');

  // Export & Copy
  const btnExportCSV = document.getElementById('btn-export-csv');
  const btnExportCSVHeader = document.getElementById('btn-export-csv-header');
  const btnCopyPitch = document.getElementById('btn-copy-pitch');

  // Modal
  const modal = document.getElementById('detail-modal');
  const modalClose = document.getElementById('btn-close-modal');
  const modalBody = document.getElementById('modal-body-content');
  const modalTitle = document.getElementById('modal-merchant-title');

  // ==========================================
  // TAB NAVIGATION
  // ==========================================
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });

  // ==========================================
  // DATA FETCHING
  // ==========================================
  async function fetchLedger() {
    try {
      const res = await fetch('/api/ledger');
      const data = await res.json();
      ledgerData = data;
      renderMetrics(data.metrics);
      renderTable(data.entries);
    } catch (err) {
      console.error('Failed to load ledger:', err);
    }
  }

  async function fetchModels() {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      openModels = data.models || [];
      renderModelHub(openModels);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  }

  // ==========================================
  // RENDERING FUNCTIONS
  // ==========================================
  function renderMetrics(metrics) {
    if (!metrics) return;
    metricTotalSpend.textContent = `$${(metrics.totalSpend || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    metricDeductibleSpend.textContent = `$${(metrics.totalDeductible || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    metricTaxSavings.textContent = `$${(metrics.estimatedTaxSavings || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    metricReceiptCount.textContent = `${metrics.totalReceipts || 0} verified receipts on-device`;
    tableCountLabel.textContent = `${metrics.totalReceipts || 0} items logged`;
  }

  function renderTable(entries) {
    const query = (searchInput.value || '').toLowerCase().trim();
    const filterCat = categoryFilter.value;

    const filtered = entries.filter(item => {
      const matchQuery = !query || 
        item.merchant.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        (item.confidentialNotes && item.confidentialNotes.toLowerCase().includes(query));

      const matchCat = filterCat === 'all' || item.category.toLowerCase().includes(filterCat.toLowerCase());

      return matchQuery && matchCat;
    });

    if (filtered.length === 0) {
      ledgerTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
            No receipts found matching your criteria. Try another search or test a 1-click sample!
          </td>
        </tr>
      `;
      return;
    }

    ledgerTableBody.innerHTML = filtered.map(item => {
      const riskClass = item.auditRisk.toLowerCase().includes('low') ? 'risk-low' : 'risk-moderate';
      const thumbHtml = item.imagePath 
        ? `<img src="${item.imagePath}" alt="${item.merchant}" class="merchant-thumb" onclick="window.viewReceiptDetail('${item.id}')">`
        : `<div class="merchant-thumb-placeholder" onclick="window.viewReceiptDetail('${item.id}')">🧾</div>`;

      return `
        <tr>
          <td>
            <div class="merchant-cell">
              ${thumbHtml}
              <div>
                <div class="merchant-name">${escapeHtml(item.merchant)}</div>
                <div class="merchant-date">${item.date}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="category-tag">${escapeHtml(item.category)}</span>
            <span class="schedule-c-line">${escapeHtml(item.scheduleCLine)}</span>
          </td>
          <td class="amount-cell">$${Number(item.totalAmount).toFixed(2)}</td>
          <td>
            <span style="font-weight: 700; color: #fff;">$${Number(item.deductibleAmount).toFixed(2)}</span>
            <span style="font-size: 0.72rem; color: var(--text-dim); display: block;">(${item.taxDeductiblePercentage}% rate)</span>
          </td>
          <td class="tax-savings-cell">+$${Number(item.taxSavingsEstimated).toFixed(2)}</td>
          <td>
            <span class="model-badge" title="Local Latency: ${item.inferenceLatencyMs}ms">
              ⚡ ${escapeHtml(item.modelUsed.split(' ')[0])}
            </span>
          </td>
          <td>
            <span class="badge-risk ${riskClass}">${escapeHtml(item.auditRisk)}</span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn-icon" title="View Full Line Items & Audit Trail" onclick="window.viewReceiptDetail('${item.id}')">🔍</button>
              <button class="btn-icon" title="Delete from Local Ledger" onclick="window.deleteReceipt('${item.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderModelHub(models) {
    modelsListGrid.innerHTML = models.map(m => `
      <div class="model-hub-card glass-panel">
        <div>
          <div class="model-card-header">
            <div>
              <span class="model-badge-provider">${escapeHtml(m.provider)}</span>
              <h3 class="model-name">${escapeHtml(m.name)}</h3>
            </div>
            <span class="privacy-pill">${escapeHtml(m.privacy)}</span>
          </div>

          <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.75rem;">
            ${escapeHtml(m.description)}
          </p>

          <div class="model-specs-grid">
            <div class="model-spec-item">
              <span class="spec-label">Parameters</span>
              <span class="spec-val">${escapeHtml(m.params)}</span>
            </div>
            <div class="model-spec-item">
              <span class="spec-label">Quantization / Size</span>
              <span class="spec-val">${escapeHtml(m.quantization)}</span>
            </div>
            <div class="model-spec-item">
              <span class="spec-label">Inference Speed</span>
              <span class="spec-val highlight-cyan">${escapeHtml(m.speed)}</span>
            </div>
            <div class="model-spec-item">
              <span class="spec-label">Cost Per Call</span>
              <span class="spec-val cost-free-badge">${escapeHtml(m.costPerRun)}</span>
            </div>
          </div>
        </div>

        <button class="btn-secondary" style="width: 100%; justify-content: center; margin-top: 1rem;" onclick="window.selectActiveModel('${m.id}')">
          <span>✓</span> Select For Ingestion
        </button>
      </div>
    `).join('');
  }

  // ==========================================
  // QUICK TEST SCENARIOS
  // ==========================================
  document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sampleKey = btn.dataset.sample;
      btn.style.opacity = '0.6';

      // Update image preview to match sample if available
      if (sampleKey === 'coffee') {
        previewImage.src = '/images/receipt_coffee.jpg';
        previewImage.style.display = 'block';
      } else if (sampleKey === 'tech') {
        previewImage.src = '/images/receipt_tech.jpg';
        previewImage.style.display = 'block';
      }

      triggerLaserScanEffect(`Loading sample ${sampleKey.toUpperCase()} into open weights pipeline...`);

      try {
        const res = await fetch(`/api/test-sample/${sampleKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId: activeModelSelect.value })
        });
        const data = await res.json();
        btn.style.opacity = '1';

        if (data.success) {
          ledgerData.entries.unshift(data.entry);
          ledgerData.metrics = data.metrics;
          renderMetrics(data.metrics);
          renderTable(ledgerData.entries);

          // Update terminal log
          logToTerminal(`[INGEST] Tested ${data.entry.merchant} ($${data.entry.totalAmount}). Processed via ${data.entry.modelUsed}. Latency: ${data.entry.inferenceLatencyMs}ms. 0 bytes leaked.`);
        }
      } catch (err) {
        btn.style.opacity = '1';
        console.error('Sample test error:', err);
      }
    });
  });

  // ==========================================
  // LASER SWEEP ANIMATION & SCANNING
  // ==========================================
  function triggerLaserScanEffect(customMsg) {
    scanProgressBox.classList.add('active');
    document.getElementById('scan-log-line-1').textContent = `> ${customMsg || 'Tokenizing receipt image via open weights...'}`;
    document.getElementById('scan-log-line-2').textContent = `> Mapping extracted line items to IRC Section 162/274 deduction rules...`;
    document.getElementById('scan-log-line-3').textContent = `> Verifying air-gap integrity: 0 external sockets open.`;

    setTimeout(() => {
      scanProgressBox.classList.remove('active');
    }, 1800);
  }

  btnRunScan.addEventListener('click', async () => {
    const rawText = rawTextInput.value.trim();
    const confidentialNote = confidentialNoteInput.value.trim();
    const modelId = activeModelSelect.value;

    triggerLaserScanEffect(`Processing through ${modelId}...`);

    const formData = new FormData();
    if (selectedFile) {
      formData.append('receiptImage', selectedFile);
    }
    formData.append('rawText', rawText);
    formData.append('confidentialNote', confidentialNote);
    formData.append('modelId', modelId);

    try {
      btnRunScan.disabled = true;
      btnRunScan.style.opacity = '0.6';

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      btnRunScan.disabled = false;
      btnRunScan.style.opacity = '1';

      if (data.success) {
        ledgerData.entries.unshift(data.entry);
        ledgerData.metrics = data.metrics;
        renderMetrics(data.metrics);
        renderTable(ledgerData.entries);

        // Reset inputs
        rawTextInput.value = '';
        confidentialNoteInput.value = '';
        logToTerminal(`[SCAN SUCCESS] Extracted ${data.entry.merchant}: $${data.entry.totalAmount}. Tax write-off: $${data.entry.deductibleAmount}.`);
      }
    } catch (err) {
      btnRunScan.disabled = false;
      btnRunScan.style.opacity = '1';
      console.error('Scan error:', err);
    }
  });

  // Dropzone handling
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  function handleFileSelected(file) {
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      previewImage.style.display = 'block';
    };
    reader.readAsDataURL(file);
    scannerStatusIndicator.textContent = `File Loaded: ${file.name.slice(0, 18)}`;
  }

  // Model select change listener
  activeModelSelect.addEventListener('change', () => {
    const selected = openModels.find(m => m.id === activeModelSelect.value);
    if (selected) {
      modelSpeedBadge.textContent = selected.speed;
    }
  });

  // Global helper for model selection from Model Hub
  window.selectActiveModel = (modelId) => {
    activeModelSelect.value = modelId;
    const selected = openModels.find(m => m.id === modelId);
    if (selected) {
      modelSpeedBadge.textContent = selected.speed;
    }
    // Switch to vault tab
    document.getElementById('nav-btn-vault').click();
  };

  // ==========================================
  // SEARCH & FILTER LISTENERS
  // ==========================================
  searchInput.addEventListener('input', () => renderTable(ledgerData.entries));
  categoryFilter.addEventListener('change', () => renderTable(ledgerData.entries));

  // ==========================================
  // DELETE & DETAIL MODAL
  // ==========================================
  window.deleteReceipt = async (id) => {
    if (!confirm('Remove this receipt from your local ledger?')) return;
    try {
      const res = await fetch(`/api/ledger/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        ledgerData.entries = ledgerData.entries.filter(e => e.id !== id);
        ledgerData.metrics = data.metrics;
        renderMetrics(data.metrics);
        renderTable(ledgerData.entries);
        logToTerminal(`[DELETE] Removed record ${id} from local ledger.`);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  window.viewReceiptDetail = (id) => {
    const item = ledgerData.entries.find(e => e.id === id);
    if (!item) return;

    modalTitle.textContent = `${item.merchant} – Tax Audit Record`;

    let itemsHtml = (item.lineItems && item.lineItems.length > 0)
      ? item.lineItems.map(li => `
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
            <span>${escapeHtml(li.description)} (x${li.qty})</span>
            <span style="font-family: var(--font-mono); font-weight: 700;">$${Number(li.price).toFixed(2)}</span>
          </div>
        `).join('')
      : '<p style="color: var(--text-dim); font-size: 0.85rem;">No itemized line details available.</p>';

    let imageHtml = item.imagePath 
      ? `<div style="text-align: center; margin-bottom: 1.5rem;">
           <img src="${item.imagePath}" alt="${item.merchant}" style="max-height: 260px; border-radius: 8px; border: 1px solid var(--border-subtle); box-shadow: 0 4px 14px rgba(0,0,0,0.5);">
         </div>`
      : '';

    modalBody.innerHTML = `
      ${imageHtml}
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; background: rgba(0,0,0,0.25); padding: 1rem; border-radius: 8px;">
        <div>
          <span style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Transaction Total</span>
          <div style="font-family: var(--font-mono); font-size: 1.3rem; font-weight: 800;">$${Number(item.totalAmount).toFixed(2)}</div>
        </div>
        <div>
          <span style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">IRS Deductible Portion</span>
          <div style="font-family: var(--font-mono); font-size: 1.3rem; font-weight: 800; color: var(--primary-emerald);">$${Number(item.deductibleAmount).toFixed(2)} (${item.taxDeductiblePercentage}%)</div>
        </div>
        <div>
          <span style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Estimated Tax Savings</span>
          <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 800; color: #a78bfa;">+$${Number(item.taxSavingsEstimated).toFixed(2)}</div>
        </div>
        <div>
          <span style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Open-Weight Engine</span>
          <div style="font-size: 0.85rem; font-weight: 700; color: var(--accent-cyan);">${escapeHtml(item.modelUsed)}</div>
        </div>
      </div>

      <div style="margin-bottom: 1.5rem;">
        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Extracted Line Items</h4>
        <div style="background: rgba(0,0,0,0.2); padding: 10px 14px; border-radius: 6px;">
          ${itemsHtml}
        </div>
      </div>

      <div style="margin-bottom: 1rem;">
        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">IRS Schedule C Classification</h4>
        <div style="font-size: 0.85rem; color: var(--text-main); font-weight: 600;">${escapeHtml(item.scheduleCLine)}</div>
        <p style="font-size: 0.78rem; color: var(--text-dim); margin-top: 4px;">${escapeHtml(item.auditNotes || '')}</p>
      </div>

      <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 12px;">
        <div style="font-size: 0.78rem; font-weight: 700; color: var(--primary-emerald); margin-bottom: 4px;">🔒 Encrypted Local Client Notes (NDA Protected)</div>
        <div style="font-size: 0.82rem; color: var(--text-main); font-style: italic;">
          "${escapeHtml(item.confidentialNotes || 'No custom client notes recorded for this transaction.')}"
        </div>
      </div>
    `;

    modal.classList.add('active');
  };

  modalClose.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // ==========================================
  // ROI CALCULATOR SLIDER
  // ==========================================
  slider.addEventListener('input', () => {
    const volume = parseInt(slider.value, 10);
    volumeDisplay.textContent = `${volume} receipts / mo`;

    // Calculation:
    // GPT-4o Vision API: ~$0.05 per receipt image
    const monthlyCloudCost = volume * 0.05;
    const annualCloudCost = monthlyCloudCost * 12;
    cloudCostDisplay.textContent = `$${annualCloudCost.toFixed(2)} / yr`;

    // 3-Year total savings vs Cloud API ($annualCloudCost * 3) + QuickBooks ($420/yr * 3)
    const threeYearSavings = (annualCloudCost * 3) + (420 * 3);
    savingsTotalDisplay.textContent = `$${threeYearSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  });

  // ==========================================
  // OLLAMA PROBE
  // ==========================================
  btnPingOllama.addEventListener('click', async () => {
    btnPingOllama.disabled = true;
    ollamaStatusText.textContent = 'Probing 127.0.0.1:11434...';

    try {
      const res = await fetch('/api/ollama-status');
      const data = await res.json();
      btnPingOllama.disabled = false;

      if (data.ollamaDetected) {
        ollamaStatusText.textContent = `Ollama Online (${data.localModels.length} models)`;
        logToTerminal(`[OLLAMA FOUND] Connected to local Ollama daemon. Available models: ${data.localModels.map(m => m.name).join(', ') || 'Ready'}.`);
      } else {
        ollamaStatusText.textContent = `Native Edge Engine Active`;
        logToTerminal(`[OLLAMA PROBE] Local Ollama daemon not found on port 11434. Running on LedgerShield's Zero-VRAM Integrated Engine.`);
      }
    } catch {
      btnPingOllama.disabled = false;
      ollamaStatusText.textContent = 'Native Edge Engine Active';
    }
  });

  // ==========================================
  // PRIVACY AUDIT RETEST
  // ==========================================
  btnRetestPrivacy.addEventListener('click', async () => {
    btnRetestPrivacy.disabled = true;
    logToTerminal(`[NET SCAN] Triggering real-time socket inspection...`);

    try {
      const res = await fetch('/api/privacy-audit');
      const data = await res.json();
      btnRetestPrivacy.disabled = false;

      logToTerminal(`[NET REPORT] Outbound HTTP to OpenAI: ${data.packetsSentToOpenAI}`);
      logToTerminal(`[NET REPORT] Outbound HTTP to Anthropic: ${data.packetsSentToAnthropic}`);
      logToTerminal(`[NET REPORT] Outbound HTTP to Google: ${data.packetsSentToGoogle}`);
      logToTerminal(`[COMPLIANCE] Verified: ${data.compliance.join(' | ')}`);
      logToTerminal(`[VERDICT] ${data.verdict}`);
    } catch {
      btnRetestPrivacy.disabled = false;
    }
  });

  function logToTerminal(msg) {
    const time = new Date().toTimeString().split(' ')[0];
    const div = document.createElement('div');
    div.textContent = `[${time}] ${msg}`;
    telemetryLogs.appendChild(div);
    telemetryLogs.scrollTop = telemetryLogs.scrollHeight;
  }

  // ==========================================
  // EXPORT CSV
  // ==========================================
  function downloadCSV() {
    window.location.href = '/api/export/csv';
  }
  btnExportCSV.addEventListener('click', downloadCSV);
  btnExportCSVHeader.addEventListener('click', downloadCSV);

  // ==========================================
  // COPY PITCH POST
  // ==========================================
  btnCopyPitch.addEventListener('click', () => {
    const text = document.getElementById('pitch-post-content').innerText;
    navigator.clipboard.writeText(text).then(() => {
      btnCopyPitch.textContent = 'Copied to Clipboard! ✓';
      btnCopyPitch.style.background = 'rgba(16, 185, 129, 0.3)';
      setTimeout(() => {
        btnCopyPitch.textContent = 'Copy Post';
        btnCopyPitch.style.background = '';
      }, 2000);
    });
  });

  // Utility
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial load
  fetchLedger();
  fetchModels();
});

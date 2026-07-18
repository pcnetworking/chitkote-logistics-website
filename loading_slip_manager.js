/**
 * CHITKOTE LOGISTICS & STTC
 * Loading Slip Client Controller & Math Engine
 */

window.LoadingSlipManager = {
  currentPage: 1,
  totalPages: 1,
  limit: 10,
  searchTerm: '',
  companyFilter: 'ALL',
  isInitialized: false,
  currentSlipData: null,

  async init() {
    await this.loadCompanies();
    if (this.isInitialized) {
      this.fetchRecords();
      return;
    }

    // Set up search and filter bindings
    const searchInput = document.getElementById('loadingSlipSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value;
        this.currentPage = 1;
        this.fetchRecords();
      });
    }

    const companyFilter = document.getElementById('loadingSlipCompanyFilter');
    if (companyFilter) {
      companyFilter.addEventListener('change', (e) => {
        this.companyFilter = e.target.value;
        this.currentPage = 1;
        this.fetchRecords();
      });
    }

    // Setup input listeners for real-time math
    this.setupMathListeners();

    // Auto-fill bindings for Vehicle / Driver / Owner details
    this.setupAutofillBindings();

    this.isInitialized = true;
    this.fetchRecords();
  },

  async fetchRecords() {
    try {
      const url = `http://localhost:5000/api/loading-slips?page=${this.currentPage}&limit=${this.limit}&companyId=${this.companyFilter}&search=${encodeURIComponent(this.searchTerm)}`;
      const res = await fetch(url);
      const data = await res.json();

      this.renderTable(data.records);
      this.updatePagination(data.pagination);
    } catch (e) {
      console.error('Error fetching loading slips:', e);
    }
  },

  renderTable(records) {
    const tbody = document.getElementById('loadingSlipTableBody');
    if (!tbody) return;

    if (!records || records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4">No Loading Slips found.</td></tr>`;
      return;
    }

    tbody.innerHTML = records.map(r => {
      const dateStr = new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const company = this.companiesCache[r.company_id] || { short_name: r.company_id === 'CHITKOTE' ? 'Chitkote' : 'STTC' };
      const compLabel = company.short_name;
      const cLessVal = Number(r.c_less_val || 0).toLocaleString('en-IN');
      const freightVal = Number(r.freight_val || 0).toLocaleString('en-IN');
      const expensesTotal = Number(r.expenses_total || 0).toLocaleString('en-IN');

      return `
        <tr>
          <td>
            <div style="font-weight:700; color:#1e293b;">${r.slip_no}</div>
            <small class="text-muted">${dateStr}</small>
          </td>
          <td>
            <span class="badge-mini" style="background:${r.company_id === 'CHITKOTE' ? '#eff6ff; color:#1d4ed8;' : '#fef2f2; color:#b91c1c;'}">${compLabel}</span>
          </td>
          <td>
            <div style="font-weight:600;">${r.vehicle_no}</div>
            <small class="text-muted">${r.from_location} ➡️ ${r.to_location}</small>
          </td>
          <td>
            <div>${r.consignor_name || 'N/A'}</div>
            <small class="text-muted">${r.particulars || ''}</small>
          </td>
          <td style="text-align:right; font-weight:600;">₹${freightVal}</td>
          <td style="text-align:right; color:#b91c1c;">₹${expensesTotal}</td>
          <td style="text-align:right; font-weight:700; color:#166534;">₹${cLessVal}</td>
          <td>
            <div style="display:flex; gap:6px; justify-content:center;">
              <button type="button" class="btn-table-action" onclick="window.LoadingSlipManager.viewSlip('${r.id}')" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd;">
                View Slip
              </button>
              <button type="button" class="btn-table-action" onclick="window.LoadingSlipManager.deleteSlip('${r.id}')" style="background:#fee2e2; color:#991b1b; border-color:#fca5a5;">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  updatePagination(pag) {
    const info = document.getElementById('loadingSlipPaginationInfo');
    if (info) {
      const start = (pag.currentPage - 1) * pag.limit + 1;
      const end = Math.min(start + pag.limit - 1, pag.totalRecords);
      info.textContent = pag.totalRecords > 0 
        ? `Showing ${start} to ${end} of ${pag.totalRecords} entries`
        : `Showing 0 to 0 of 0 entries`;
    }

    this.totalPages = pag.totalPages || 1;

    const btnPrev = document.getElementById('btnLsPrevPage');
    if (btnPrev) btnPrev.disabled = this.currentPage <= 1;

    const btnNext = document.getElementById('btnLsNextPage');
    if (btnNext) btnNext.disabled = this.currentPage >= this.totalPages;
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.fetchRecords();
    }
  },

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.fetchRecords();
    }
  },

  openCreateSlipModal() {
    const form = document.getElementById('loadingSlipCreateForm');
    if (form) form.reset();

    // Reset readonly display outputs
    const readOnlies = ['No', 'LeftTotal', 'CLess', 'Bank', 'Balance', 'ExpensesSum'];
    readOnlies.forEach(field => {
      const el = document.getElementById(`loadingSlipForm${field}`);
      if (el) el.value = '0';
    });
    document.getElementById('loadingSlipFormNo').value = 'Auto-generated on save';

    // Auto set date to today
    const dateInput = document.getElementById('loadingSlipFormDate');
    if (dateInput) {
      dateInput.value = new Date().toISOString().substring(0, 10);
    }

    document.getElementById('loadingSlipCreateModal').style.display = 'flex';
  },

  setupMathListeners() {
    const numericFields = [
      'Freight', 'Topay', 'Advance',
      'Commission', 'Crossing', 'Unload', 'Loading', 'Gm',
      'Cash'
    ];

    numericFields.forEach(field => {
      const input = document.getElementById(`loadingSlipForm${field}`);
      if (input) {
        input.addEventListener('input', () => this.calculateSheet());
        input.addEventListener('change', () => this.calculateSheet());
      }
    });
  },

  calculateSheet() {
    // Inputs
    const freight = parseFloat(document.getElementById('loadingSlipFormFreight').value) || 0;
    const topay = parseFloat(document.getElementById('loadingSlipFormTopay').value) || 0;
    const advance = parseFloat(document.getElementById('loadingSlipFormAdvance').value) || 0;

    const commission = parseFloat(document.getElementById('loadingSlipFormCommission').value) || 0;
    const crossing = parseFloat(document.getElementById('loadingSlipFormCrossing').value) || 0;
    const unload = parseFloat(document.getElementById('loadingSlipFormUnload').value) || 0;
    const loading = parseFloat(document.getElementById('loadingSlipFormLoading').value) || 0;
    const gm = parseFloat(document.getElementById('loadingSlipFormGm').value) || 0;

    const cash = parseFloat(document.getElementById('loadingSlipFormCash').value) || 0;

    // Left Column Calculations
    const leftTotal = advance; // in excel, the Total Rs matching the sum of Advance (deducted in cash/bank split)
    
    // Right Column Deductions
    const balance = freight - topay - advance;
    const expensesSum = commission + crossing + unload + loading + gm;
    const cLess = advance - expensesSum;
    const bank = cLess - cash;

    // Bind values back to DOM
    document.getElementById('loadingSlipFormLeftTotal').value = leftTotal.toFixed(2);
    document.getElementById('loadingSlipFormBalance').value = balance.toFixed(2);
    document.getElementById('loadingSlipFormExpensesSum').value = expensesSum.toFixed(2);
    document.getElementById('loadingSlipFormCLess').value = cLess.toFixed(2);
    document.getElementById('loadingSlipFormBank').value = bank.toFixed(2);
  },

  setupAutofillBindings() {
    const vehInput = document.getElementById('loadingSlipFormVehicle');
    if (vehInput) {
      vehInput.addEventListener('change', async (e) => {
        const val = e.target.value.trim().toUpperCase();
        if (!val) return;

        try {
          // Fetch master vehicle list
          const res = await fetch(`http://localhost:5000/api/vehicles?search=${encodeURIComponent(val)}`);
          const list = await res.json();
          const match = list.find(v => v.vehicle_number.toUpperCase() === val);
          if (match) {
            if (match.driver_name) document.getElementById('loadingSlipFormDriver').value = match.driver_name;
            if (match.driver_phone) document.getElementById('loadingSlipFormDriverPhone').value = match.driver_phone;
            if (match.owner_name) document.getElementById('loadingSlipFormOwner').value = match.owner_name;
            
            // Check driver phone if empty
            if (match.driver_name) {
              const dRes = await fetch(`http://localhost:5000/api/drivers?search=${encodeURIComponent(match.driver_name)}`);
              const dList = await dRes.json();
              const dMatch = dList.find(d => d.driver_name.toLowerCase() === match.driver_name.toLowerCase());
              if (dMatch && dMatch.phone) {
                document.getElementById('loadingSlipFormDriverPhone').value = dMatch.phone;
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      });
    }

    const drvInput = document.getElementById('loadingSlipFormDriver');
    if (drvInput) {
      drvInput.addEventListener('change', async (e) => {
        const val = e.target.value.trim();
        if (!val) return;

        try {
          const res = await fetch(`http://localhost:5000/api/drivers?search=${encodeURIComponent(val)}`);
          const list = await res.json();
          const match = list.find(d => d.driver_name.toLowerCase() === val.toLowerCase());
          if (match && match.phone) {
            document.getElementById('loadingSlipFormDriverPhone').value = match.phone;
          }
        } catch (e) {
          console.error(e);
        }
      });
    }
  },

  async saveSlipFromForm() {
    const companyId = document.getElementById('loadingSlipFormCompany').value;
    const date = document.getElementById('loadingSlipFormDate').value;
    const vehicleNo = document.getElementById('loadingSlipFormVehicle').value.trim().toUpperCase();
    const fromLocation = document.getElementById('loadingSlipFormFrom').value.trim();
    const toLocation = document.getElementById('loadingSlipFormTo').value.trim();

    if (!vehicleNo || !fromLocation || !toLocation || !date) {
      alert('Please fill in Date, Truck Number, From and To locations.');
      return;
    }

    const payload = {
      companyId,
      date,
      vehicleNo,
      fromLocation,
      toLocation,
      driverName: document.getElementById('loadingSlipFormDriver').value.trim(),
      driverPhone: document.getElementById('loadingSlipFormDriverPhone').value.trim(),
      ownerName: document.getElementById('loadingSlipFormOwner').value.trim(),
      ownerPhone: document.getElementById('loadingSlipFormOwnerPhone').value.trim(),
      particulars: document.getElementById('loadingSlipFormParticulars').value.trim(),
      weight: document.getElementById('loadingSlipFormWeight').value.trim(),
      consignorName: document.getElementById('loadingSlipFormConsignor').value.trim(),
      consigneeName: document.getElementById('loadingSlipFormConsignee').value.trim(),
      freightVal: parseFloat(document.getElementById('loadingSlipFormFreight').value) || 0,
      topayVal: parseFloat(document.getElementById('loadingSlipFormTopay').value) || 0,
      advanceVal: parseFloat(document.getElementById('loadingSlipFormAdvance').value) || 0,
      commissionVal: parseFloat(document.getElementById('loadingSlipFormCommission').value) || 0,
      crossingVal: parseFloat(document.getElementById('loadingSlipFormCrossing').value) || 0,
      unloadVal: parseFloat(document.getElementById('loadingSlipFormUnload').value) || 0,
      loadingVal: parseFloat(document.getElementById('loadingSlipFormLoading').value) || 0,
      gmVal: parseFloat(document.getElementById('loadingSlipFormGm').value) || 0,
      cashVal: parseFloat(document.getElementById('loadingSlipFormCash').value) || 0,
      bankVal: parseFloat(document.getElementById('loadingSlipFormBank').value) || 0
    };

    try {
      const res = await fetch('http://localhost:5000/api/loading-slips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save loading slip.');
      }

      alert(`Success! Loading Slip generated: ${data.slipNo}`);
      document.getElementById('loadingSlipCreateModal').style.display = 'none';
      
      this.currentPage = 1;
      await this.fetchRecords();

      // Launch view slip directly for printing
      await this.viewSlip(data.id);
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  async viewSlip(id) {
    try {
      const res = await fetch(`http://localhost:5000/api/loading-slips/${id}`);
      if (!res.ok) throw new Error('Could not retrieve slip details.');
      const data = await res.json();

      this.currentSlipData = data;
      this.currentTemplate = 'loading_slip'; // Reset to default "loading_slip" layout
      
      // Update UI active buttons
      const btnLS = document.getElementById('btnTemplateLoadingSlip');
      const btnCB = document.getElementById('btnTemplateCommissionBill');
      if (btnLS) btnLS.classList.add('active');
      if (btnCB) btnCB.classList.remove('active');

      const html = this.renderPrintHTML(data);
      document.getElementById('loadingSlipViewModalBody').innerHTML = html;
      document.getElementById('loadingSlipViewModal').style.display = 'flex';
    } catch (e) {
      alert(`Error viewing loading slip: ${e.message}`);
    }
  },

  async deleteSlip(id) {
    if (!confirm('Are you sure you want to delete this Loading Slip permanently? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/loading-slips/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Deletion failed.');
      alert('Loading Slip successfully deleted.');
      await this.fetchRecords();
    } catch (e) {
      alert(`Error deleting loading slip: ${e.message}`);
    }
  },

  printCurrentSlip() {
    const printArea = document.getElementById('loadingSlipViewModalBody').innerHTML;
    const printWin = window.open('', '_blank');
    printWin.document.open();
    printWin.document.write(`
      <html>
        <head>
          <title>Print Loading Slip - ${this.currentSlipData ? this.currentSlipData.slip_no : 'Document'}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; font-family: 'Courier New', Courier, monospace; color: #000; background: #fff; }
              @page { size: A4 portrait; margin: 1.5cm; }
            }
            body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; }
            table { width: 100%; border-collapse: collapse; }
            td, th { padding: 6px; }
            .excel-table td { border: 1px solid #000; }
            .double-line { border-bottom: 3px double #000; }
            .bold { font-weight: bold; }
            .center { text-align: center; }
            .right { text-align: right; }
            .text-danger { color: red !important; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${printArea}
        </body>
      </html>
    `);
    printWin.document.close();
  },

  renderPrintHTML(slip) {
    const formattedDate = new Date(slip.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    // Retrieve company profile dynamically from cache or fallback defaults
    const company = (this.companiesCache && this.companiesCache[slip.company_id]) || {
      name: slip.company_id === 'SRI_TAMILNADU' ? 'SRI TAMILNADU TRANSPORT CO.' : 'CHITKOTE LOGISTICS INDIA PVT. LTD.',
      short_name: slip.company_id === 'SRI_TAMILNADU' ? 'STTC' : 'CK Logistics',
      short_code: slip.company_id === 'SRI_TAMILNADU' ? 'STTC' : 'CKL',
      phone: slip.company_id === 'SRI_TAMILNADU' ? '9493588819, 9030003955, 9014523955' : '94057-73955',
      email: slip.company_id === 'SRI_TAMILNADU' ? 'operations@sritamilnadutransport.com' : 'dispatch@chitkotelogistics.com',
      address: slip.company_id === 'SRI_TAMILNADU' 
        ? '#4/76, S. No B1, B2, Auto Nagar Gandiguda Vill-Shamshabad R.R. Dist. Hyderabad-509325. T.S.' 
        : '8-1-206/87/1, Pragathi Colony Main Road, Hyderabad - 500005, Telangana',
      logo: slip.company_id === 'SRI_TAMILNADU' ? 'Images/Logo.jpeg' : 'Images/newlogo_processed.png',
      terms: '1. This is a digitally generated Bilty/LR Copy\n2. Company is not responsible for leakages & thefts during transit.',
      bank_name: slip.company_id === 'SRI_TAMILNADU' ? 'HDFC BANK LTD.' : 'ICICI BANK LTD.',
      bank_acc_no: slip.company_id === 'SRI_TAMILNADU' ? '20682000000669' : '001234567890',
      bank_ifsc: slip.company_id === 'SRI_TAMILNADU' ? 'HDFC0002068' : 'ICIC0000012',
      bank_branch: slip.company_id === 'SRI_TAMILNADU' ? 'SHAMSHABAD' : 'JUBILEE HILLS'
    };

    if (this.currentTemplate === 'loading_slip') {
      // Format 2: Physical Loading Slip layout matching the user's photo
      const cellLines = company.phone ? company.phone.split(',').map(p => p.trim()) : [];
      const serviceLine = slip.company_id === 'SRI_TAMILNADU' 
        ? 'Service to : All Karnataka, Tamilnadu, Kerala, & Pondicherry.' 
        : 'Service to : All India Safe Transport Logistics Services.';
        
      return `
        <div class="loading-slip-print-container" style="border: 2px solid #ef4444; border-radius: 8px; padding: 24px; background:#fffdfc; font-family:'Outfit', 'Inter', 'Courier New', monospace; box-sizing:border-box; color:#000;">
          
          <!-- Top bar with brand pill, Om circular logo, and cell numbers -->
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #ef4444; padding-bottom:12px; margin-bottom:16px;">
            <div>
              <span style="border: 3px solid #ef4444; color:#ef4444; font-weight:800; font-size:1.4rem; padding: 2px 10px; border-radius:12px; letter-spacing:1px; display:inline-block; font-style:italic;">
                ${company.short_code}
              </span>
            </div>
            
            <div style="width: 50px; height: 50px; border: 2px dashed #ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.5rem; color:#ef4444; font-weight:bold;">
              ॐ
            </div>
            
            <div style="text-align:right; font-size:0.85rem; font-weight:bold; color:#334155; line-height:1.4;">
              ${cellLines.map((num, i) => i === 0 ? `Cell: ${num}` : `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; : ${num}`).join('<br>')}
            </div>
          </div>

          <!-- Main Company Header -->
          <div style="text-align:center; margin-bottom:20px;">
            <h1 style="margin: 0; font-size: 2.2rem; font-weight: 800; color: #ef4444; letter-spacing: 0.5px; text-transform:uppercase; font-family:'Outfit',sans-serif;">
              ${company.name}
            </h1>
            <div style="font-size: 1.05rem; font-weight: 700; color: #ef4444; margin-top: 4px; letter-spacing:1px; text-transform:uppercase;">
              LORRY SUPPLIERS & COMMISSION AGENT
            </div>
            <div style="font-size: 0.9rem; font-weight: 600; color:#334155; margin-top: 6px;">
              ${serviceLine}
            </div>
            <div style="font-size: 0.85rem; font-weight: 600; color:#475569; margin-top: 4px; line-height:1.4;">
              ${company.address}
            </div>
          </div>

          <!-- Document Title & Date Row -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; font-weight:bold; font-size:1rem;">
            <div style="color:#ef4444; font-size:1.3rem; font-weight:800; display:flex; align-items:center; gap:8px;">
              <span style="font-size:0.9rem; color:#64748b;">No.</span> 
              <span>${slip.slip_no.replace(/^[^-]+-[^-]+-/, '')}</span>
            </div>
            <div style="color:#1e293b;">
              Date <span style="border-bottom: 2px dotted #ef4444; padding: 0 16px;">${formattedDate}</span>
            </div>
          </div>

          <!-- To, M/s Receiver Details -->
          <div style="margin-bottom:20px; font-size:1.05rem; font-weight:600; color:#1e293b; line-height:1.8;">
            <div>To,</div>
            <div style="display:flex; gap:10px;">
              <span style="white-space:nowrap; padding-left:24px;">M/s.</span>
              <span style="border-bottom: 2px dotted #ef4444; flex-grow:1; color:#0f172a; font-weight:700;">${slip.consignor_name || 'As per Bill'}</span>
            </div>
          </div>

          <!-- Dear Sir, Order Confirmation text -->
          <div style="margin-bottom:24px; font-size:1.05rem; font-weight:600; color:#334155; padding-left:24px;">
            Dear Sir,<br>
            <div style="text-indent: 40px; margin-top:4px;">
              As per your Telephone order we are sending our Truck
            </div>
            <div style="text-align:center; font-size:0.92rem; color:#ef4444; font-weight:bold; margin-top:6px; font-style:italic;">
              (please insure your Goods)
            </div>
          </div>

          <!-- Details Table layout with dotted line outputs -->
          <div style="display:flex; flex-direction:column; gap:16px; font-size:1.1rem; font-weight:600; color:#1e293b; margin-bottom:24px;">
            
            <div style="display:flex; align-items:flex-end;">
              <span style="white-space:nowrap; margin-right:8px; color:#475569;">Truck No.</span>
              <span style="border-bottom: 2px dotted #ef4444; flex-grow:1; color:#0f172a; font-weight:700; text-transform:uppercase; padding-bottom:2px;">${slip.vehicle_no}</span>
            </div>

            <div style="display:flex; gap:20px;">
              <div style="display:flex; align-items:flex-end; flex: 1;">
                <span style="white-space:nowrap; margin-right:8px; color:#475569;">From</span>
                <span style="border-bottom: 2px dotted #ef4444; flex-grow:1; color:#0f172a; font-weight:700; text-transform:uppercase; padding-bottom:2px;">${slip.from_location}</span>
              </div>
              <div style="display:flex; align-items:flex-end; flex: 1;">
                <span style="white-space:nowrap; margin-right:8px; color:#475569;">To</span>
                <span style="border-bottom: 2px dotted #ef4444; flex-grow:1; color:#0f172a; font-weight:700; text-transform:uppercase; padding-bottom:2px;">${slip.to_location}</span>
              </div>
            </div>

            <div style="display:flex; gap:20px;">
              <div style="display:flex; align-items:flex-end; flex: 1.2;">
                <span style="white-space:nowrap; margin-right:8px; color:#475569;">Goods</span>
                <span style="border-bottom: 2px dotted #ef4444; flex-grow:1; color:#0f172a; font-weight:700; padding-bottom:2px;">${slip.particulars || 'N/A'}</span>
              </div>
              <div style="display:flex; align-items:flex-end; flex: 0.8;">
                <span style="white-space:nowrap; margin-right:8px; color:#475569;">Weight</span>
                <span style="border-bottom: 2px dotted #ef4444; flex-grow:1; color:#0f172a; font-weight:700; padding-bottom:2px;">${slip.weight || 'N/A'}</span>
              </div>
            </div>

            <div style="display:flex; gap:20px;">
              <div style="display:flex; align-items:flex-end; flex: 1.1;">
                <span style="white-space:nowrap; margin-right:8px; color:#475569;">Fixed Rate Rs.</span>
                <span style="border-bottom: 2px dotted #ef4444; flex-grow:1; color:#0f172a; font-weight:700; padding-bottom:2px;">₹${Number(slip.freight_val).toLocaleString('en-IN')}/-</span>
              </div>
              <div style="display:flex; align-items:flex-end; flex: 0.9;">
                <span style="white-space:nowrap; margin-right:8px; color:#475569;">Advance Rs.</span>
                <span style="border-bottom: 2px dotted #ef4444; flex-grow:1; color:#0f172a; font-weight:700; padding-bottom:2px;">₹${Number(slip.advance_val).toLocaleString('en-IN')}/-</span>
              </div>
            </div>

            <div style="display:flex; gap:20px;">
              <div style="display:flex; align-items:flex-end; flex: 1.1;">
                <span style="white-space:nowrap; margin-right:8px; color:#475569;">Balance Rs.</span>
                <span style="border-bottom: 2px dotted #ef4444; flex-grow:1; color:#0f172a; font-weight:700; padding-bottom:2px;">₹${Number(slip.balance_val).toLocaleString('en-IN')}/-</span>
              </div>
              <div style="display:flex; align-items:flex-end; flex: 0.9;">
                <span style="white-space:nowrap; margin-right:8px; color:#475569;">Payable at</span>
                <span style="border-bottom: 2px dotted #ef4444; flex-grow:1; color:#ef4444; font-weight:800; text-transform:uppercase; padding-bottom:2px;">${slip.to_location}</span>
              </div>
            </div>

          </div>

          <!-- Note: Not responsible warning in a red rounded outline box -->
          <div style="border: 2px solid #ef4444; border-radius: 12px; padding: 10px; text-align:center; color:#ef4444; font-weight:bold; font-size:1rem; margin-bottom:24px; text-transform:uppercase;">
            NOTE : Not Responsible for Leakage Breakages & Damges.
          </div>

          <!-- Bottom Footer Details Grid -->
          <div style="display:flex; justify-content:space-between; align-items:flex-end;">
            <!-- Bank Details Box -->
            <div style="border: 2px solid #ef4444; border-radius: 10px; padding: 12px; width: 62%; background:#f0fdf4; color:#166534; font-size:0.85rem; line-height:1.5;">
              <div style="font-weight:bold; margin-bottom:4px; text-decoration:underline;">Our Bank Details :</div>
              <strong style="text-transform:uppercase;">${company.name},</strong><br>
              <table style="width:100%; border:none; margin-top:2px;">
                <tr>
                  <td style="padding:0; font-weight:600;">Bank: ${company.bank_name || 'N/A'}</td>
                  <td style="padding:0; font-weight:600;">IFSC: ${company.bank_ifsc || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding:0; font-weight:600;">A/c. No.: ${company.bank_acc_no || 'N/A'}</td>
                  <td style="padding:0; font-weight:600;">Branch: ${company.bank_branch || 'N/A'}</td>
                </tr>
              </table>
            </div>

            <!-- Signature block -->
            <div style="text-align:right; font-weight:bold; width:33%; font-size:1.05rem;">
              <div style="color:#ef4444; margin-bottom:50px;">For ${company.short_code}.</div>
              <div style="border-top: 1.5px dashed #cbd5e1; padding-top:4px; text-align:center; font-size:0.85rem; color:#64748b;">Authorized Signatory</div>
            </div>
          </div>

        </div>
      `;
    } else {
      // Format 1: Commission Bill format (the previous double-column layout)
      const footerCompany = company.short_code ? `For ${company.short_name}` : 'For Chitkote Logistics';
      
      return `
        <div style="border: 2px solid #000; padding: 16px; background:#ffffff; box-sizing:border-box; font-family:'Courier New', Courier, monospace; color:#000;">
          
          <!-- Cell phone header -->
          <div style="display:flex; justify-content:flex-end; font-size: 0.9rem; font-weight: bold;">
            Cell:- ${company.phone}
          </div>

          <!-- Brand Name -->
          <div class="center" style="margin-top: 4px; text-align:center;">
            <h1 style="margin: 0; font-size: 1.8rem; font-weight: bold; color: red; font-style: italic; text-transform:uppercase;">
              ${company.name}
            </h1>
            <div style="font-size: 0.85rem; font-weight: bold; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px;">
              TRANSPORT CONTRACTOR & COMMISSION AGENT
            </div>
            <div style="font-size: 0.85rem; font-weight: bold; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 3px 0; margin-top: 5px;">
              Service to: ${company.short_code === 'STTC' ? 'All Tamilnadu, Kerla, Pondicherry & Karnataka' : 'All India Safe Transport Logistics Services'}
            </div>
          </div>

          <!-- Address Bar -->
          <table style="margin-top: 6px; border-bottom: 1.5px solid #000; font-size: 0.82rem; font-weight: bold; width:100%;">
            <tr>
              <td width="90" style="padding-left:0; font-weight:bold;">SNO. Address:</td>
              <td style="color:red; font-size:0.85rem; padding-left:0; font-weight:bold;">${company.address}</td>
            </tr>
          </table>

          <!-- Trip Details Grid -->
          <table style="margin-top: 8px; font-size: 0.9rem; font-weight: bold; width:100%;" class="excel-table">
            <tr>
              <td width="15%">TRUCK</td>
              <td width="35%">${slip.vehicle_no}</td>
              <td width="15%">Date</td>
              <td width="35%">${formattedDate}</td>
            </tr>
            <tr>
              <td>FROM</td>
              <td style="text-transform:uppercase;">${slip.from_location}</td>
              <td>TO</td>
              <td style="text-transform:uppercase;">${slip.to_location}</td>
            </tr>
            <tr>
              <td>Driver</td>
              <td>${slip.driver_name || 'N/A'}</td>
              <td>Cell No</td>
              <td>${slip.driver_phone || 'N/A'}</td>
            </tr>
            <tr>
              <td>Owner</td>
              <td>${slip.owner_name || 'N/A'}</td>
              <td>Cell No</td>
              <td>${slip.owner_phone || 'N/A'}</td>
            </tr>
            <tr>
              <td>Particulars</td>
              <td>${slip.particulars || 'N/A'}</td>
              <td>WEIGHT</td>
              <td>${slip.weight || 'N/A'}</td>
            </tr>
          </table>

          <!-- Consignor Rows -->
          <table style="margin-top: 4px; border-bottom: 1.5px solid #000; font-size: 0.9rem; font-weight: bold; width:100%;">
            <tr>
              <td width="20%" style="padding-left:0;">Consignor Name M/s:-</td>
              <td style="padding-left:0;">${slip.consignor_name || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding-left:0;">Consignee Name M/s:-</td>
              <td style="padding-left:0;">${slip.consignee_name || 'As per Bill'}</td>
            </tr>
          </table>

          <!-- Double Column Financial Balance Statement -->
          <div style="display:flex; margin-top: 10px; font-size: 0.95rem; font-weight: bold;">
            
            <!-- Column 1: Receipts & Advances -->
            <div style="width: 50%; border-right: 1.5px solid #000;">
              <table class="excel-table" style="width: 100%;">
                <tr style="background:#f1f5f9;">
                  <td colspan="2" class="center" style="border-bottom: 1.5px solid #000; text-align:center;">RECEIPTS / DEPOSITS</td>
                </tr>
                <tr>
                  <td width="60%">Freight</td>
                  <td class="right" width="40%" style="text-align:right;">${Number(slip.freight_val).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                  <td>Topay</td>
                  <td class="right" style="text-align:right;">${Number(slip.topay_val).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr style="color:red;">
                  <td>Advance</td>
                  <td class="right" style="text-align:right;">${Number(slip.advance_val).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                  <td>TOTAL</td>
                  <td class="right" style="text-align:right;">-</td>
                </tr>
                <tr>
                  <td>Cash</td>
                  <td class="right" style="text-align:right;">-</td>
                </tr>
                <tr>
                  <td>R.B</td>
                  <td class="right" style="text-align:right;">-</td>
                </tr>
                <tr style="border-top:1.5px solid #000;">
                  <td>Total Rs</td>
                  <td class="right" style="text-align:right;">${Number(slip.advance_val).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                  <td>C.Less</td>
                  <td class="right" style="color:blue; text-align:right;">${Number(slip.c_less_val).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                  <td>Cash</td>
                  <td class="right" style="text-align:right;">${Number(slip.cash_val).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                  <td>Bank</td>
                  <td class="right" style="color:green; text-align:right;">${Number(slip.bank_val).toLocaleString('en-IN')}.00</td>
                </tr>
              </table>
            </div>

            <!-- Column 2: Deductions & Balance Payable -->
            <div style="width: 50%;">
              <table class="excel-table" style="width: 100%;">
                <tr style="background:#f1f5f9;">
                  <td colspan="2" class="center" style="border-bottom: 1.5px solid #000; text-align:center;">EXPENSES & PAYABLES</td>
                </tr>
                <tr style="color:red;">
                  <td width="60%">Balance</td>
                  <td class="right" width="40%" style="text-align:right;">${Number(slip.balance_val).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                  <td>D Commision</td>
                  <td class="right" style="text-align:right;">${Number(slip.commission_val).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                  <td>CROSSI</td>
                  <td class="right" style="text-align:right;">${Number(slip.crossing_val).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr style="color:orange;">
                  <td>UNLOAD</td>
                  <td class="right" style="text-align:right;">${Number(slip.unload_val).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                  <td>LOADING</td>
                  <td class="right" style="text-align:right;">${Number(slip.loading_val).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                  <td>GM</td>
                  <td class="right" style="text-align:right;">${Number(slip.gm_val).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr style="border-top:1.5px solid #000; color:red;">
                  <td>Total Rs</td>
                  <td class="right" style="text-align:right;">${Number(slip.expenses_total).toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                  <td colspan="2" style="border:none; height:74px;"></td>
                </tr>
              </table>
            </div>

          </div>

          <!-- Signature Row -->
          <table style="margin-top: 30px; font-size: 0.9rem; font-weight: bold; border-top: 1.5px dashed #000; padding-top: 8px; width:100%;">
            <tr>
              <td width="50%" style="text-align:center;">Signature Of Owner/Driver</td>
              <td width="50%" style="text-align:center;">For ${company.short_code}</td>
            </tr>
          </table>

          <!-- Warning Terms footer -->
          <div class="center text-danger" style="margin-top: 15px; font-size: 0.82rem; font-weight: bold; border: 1.5px solid #000; padding: 6px; text-transform: uppercase; text-align:center; color:red;">
            NOTE: Received should be submitted within 15 days of unloading date, if not received within given time payment will not be done.
          </div>

        </div>
      `;
    }
  },

  companiesCache: {},

  async loadCompanies() {
    try {
      const res = await fetch('http://localhost:5000/api/companies');
      const list = await res.json();
      this.companiesCache = {};
      list.forEach(c => {
        this.companiesCache[c.id] = c;
      });
    } catch (e) {
      console.error('Error fetching companies cache in LoadingSlipManager:', e);
    }
  },

  async loadCompaniesTab() {
    await this.loadCompanies();
    const grid = document.getElementById('companiesListGrid');
    if (!grid) return;

    const companies = Object.values(this.companiesCache);
    grid.innerHTML = companies.map(c => {
      const bankDetailsStr = c.bank_name ? `
        <div style="margin-top: 10px; padding: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 0.85rem; color:#166534; line-height:1.4;">
          <strong>🏦 Settlement Bank Account Details:</strong><br>
          Bank Name: <strong>${c.bank_name}</strong><br>
          Account No: <strong>${c.bank_acc_no}</strong><br>
          IFSC Code: <strong>${c.bank_ifsc}</strong><br>
          Branch: <strong>${c.bank_branch}</strong>
        </div>
      ` : `
        <div style="margin-top: 10px; padding: 10px; background: #fff7ed; border: 1px solid #ffedd5; border-radius: 6px; font-size: 0.85rem; color:#c2410c;">
          ⚠️ No settlement bank account set.
        </div>
      `;

      return `
        <div class="admin-table-card" style="padding: 20px; display:flex; flex-direction:column; justify-content:space-between; border: 1px solid #e2e8f0; border-radius:10px; background:#fff; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <h4 style="margin:0; font-size:1.15rem; color:#1e293b; font-weight:700;">${c.name}</h4>
              <span class="badge-mini" style="background:#eff6ff; color:#1d4ed8; font-weight:bold;">${c.short_code}</span>
            </div>
            
            <div style="display:flex; gap:12px; margin-top:12px; font-size:0.85rem; color:#475569;">
              <div style="width: 60px; height: 60px; border: 1px solid #cbd5e1; border-radius: 6px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#f8fafc; flex-shrink:0;">
                <img src="${c.logo || 'Images/newlogo_processed.png'}" style="max-width:100%; max-height:100%; object-fit:contain;">
              </div>
              <div style="flex-grow:1; line-height:1.4;">
                <strong>Prefix:</strong> ${c.prefix}<br>
                <strong>Phone:</strong> ${c.phone}<br>
                <strong>Email:</strong> ${c.email}
              </div>
            </div>

            <div style="margin-top: 10px; font-size: 0.85rem; color: #475569; line-height:1.4;">
              <strong>Address:</strong><br>
              <span style="color:#64748b; font-size:0.8rem;">${c.address}</span>
            </div>

            <div style="margin-top: 10px; display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size: 0.85rem; color: #475569;">
              <div><strong>GSTIN:</strong> ${c.gstin}</div>
              <div><strong>PAN:</strong> ${c.pan}</div>
            </div>

            ${bankDetailsStr}
          </div>
          
          <button type="button" class="btn btn-secondary" onclick="window.LoadingSlipManager.openCompanyEditModal('${c.id}')" style="margin-top: 16px; border: 1px solid #cbd5e1; font-weight:bold; width:100%; padding:8px; cursor:pointer;">
            ✏️ Edit Profile Settings
          </button>
        </div>
      `;
    }).join('');
  },

  openCompanyEditModal(companyId) {
    const c = this.companiesCache[companyId];
    if (!c) return;

    document.getElementById('companyEditId').value = c.id;
    document.getElementById('companyEditName').value = c.name || '';
    document.getElementById('companyEditShortName').value = c.short_name || '';
    document.getElementById('companyEditShortCode').value = c.short_code || '';
    document.getElementById('companyEditPrefix').value = c.prefix || '';
    document.getElementById('companyEditPhone').value = c.phone || '';
    document.getElementById('companyEditEmail').value = c.email || '';
    document.getElementById('companyEditLogo').value = c.logo || '';
    document.getElementById('companyEditAddress').value = c.address || '';
    document.getElementById('companyEditGstin').value = c.gstin || '';
    document.getElementById('companyEditPan').value = c.pan || '';
    document.getElementById('companyEditState').value = c.state || '';
    document.getElementById('companyEditStateCode').value = c.state_code || '';
    document.getElementById('companyEditBankName').value = c.bank_name || '';
    document.getElementById('companyEditBankAccNo').value = c.bank_acc_no || '';
    document.getElementById('companyEditBankIfsc').value = c.bank_ifsc || '';
    document.getElementById('companyEditBankBranch').value = c.bank_branch || '';
    document.getElementById('companyEditTerms').value = c.terms || '';

    document.getElementById('companyEditModal').style.display = 'flex';
  },

  async saveCompanyProfile() {
    const id = document.getElementById('companyEditId').value;
    const body = {
      name: document.getElementById('companyEditName').value,
      short_name: document.getElementById('companyEditShortName').value,
      short_code: document.getElementById('companyEditShortCode').value,
      prefix: document.getElementById('companyEditPrefix').value,
      phone: document.getElementById('companyEditPhone').value,
      email: document.getElementById('companyEditEmail').value,
      logo: document.getElementById('companyEditLogo').value,
      address: document.getElementById('companyEditAddress').value,
      gstin: document.getElementById('companyEditGstin').value,
      pan: document.getElementById('companyEditPan').value,
      state: document.getElementById('companyEditState').value,
      state_code: document.getElementById('companyEditStateCode').value,
      bank_name: document.getElementById('companyEditBankName').value,
      bank_acc_no: document.getElementById('companyEditBankAccNo').value,
      bank_ifsc: document.getElementById('companyEditBankIfsc').value,
      bank_branch: document.getElementById('companyEditBankBranch').value,
      terms: document.getElementById('companyEditTerms').value
    };

    try {
      const res = await fetch(`http://localhost:5000/api/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('companyEditModal').style.display = 'none';
        this.showToast('Company profile updated successfully!', 'success');

        // Reload data
        await this.loadCompaniesTab();
        
        // Also refresh companies in LRManager if loaded
        if (typeof window.LRManager !== 'undefined' && typeof window.LRManager.loadCompanies === 'function') {
          await window.LRManager.loadCompanies();
        }
      } else {
        alert('Error saving company profile: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Error saving company profile:', e);
      alert('Network error saving company profile');
    }
  },

  switchTemplate(templateId) {
    this.currentTemplate = templateId;
    
    // Update active state of buttons
    const btnLS = document.getElementById('btnTemplateLoadingSlip');
    const btnCB = document.getElementById('btnTemplateCommissionBill');
    if (btnLS) btnLS.classList.toggle('active', templateId === 'loading_slip');
    if (btnCB) btnCB.classList.toggle('active', templateId === 'commission_bill');
    
    const body = document.getElementById('loadingSlipViewModalBody');
    if (body && this.currentSlipData) {
      body.innerHTML = this.renderPrintHTML(this.currentSlipData);
    }
  },

  showToast(message, type = 'info') {
    if (window.OnboardingManager && typeof window.OnboardingManager.showToast === 'function') {
      window.OnboardingManager.showToast(message, type);
      return;
    }
    let toastContainer = document.getElementById('cklToastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'cklToastContainer';
      toastContainer.className = 'ckl-toast-container';
      document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = `ckl-toast ckl-toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

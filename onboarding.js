/**
 * CHITKOTE LOGISTICS INDIA PVT. LTD.
 * Truck Owner Onboarding Module - Relational DB Client Engine
 */

const API_BASE_URL = 'http://localhost:5000/api';

// Helper for API requests
async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      config.body = JSON.stringify(body);
    }
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (e) {
    console.error('API Error:', e);
    throw e;
  }
}

// Global Storage Engine backed by Relational Database with memory caching
const OnboardingStore = {
  cache: [],

  async initCache() {
    try {
      this.cache = await apiCall('/onboarding/owners');
    } catch (e) {
      console.error('Failed to initialize onboarding owners cache:', e);
      this.cache = [];
    }
  },

  getOwners() {
    return this.cache;
  },

  async saveOwner(ownerData) {
    try {
      const result = await apiCall('/onboarding/owners', 'POST', ownerData);
      await this.initCache();
      return result;
    } catch (e) {
      console.error('Failed to register onboarding owner:', e);
      return { error: e.message };
    }
  },

  async updateStatus(id, status, remarkText) {
    try {
      const result = await apiCall(`/onboarding/owners/${id}/status`, 'PUT', { status, remarkText });
      await this.initCache();
      return result;
    } catch (e) {
      console.error('Failed to update status:', e);
      return { error: e.message };
    }
  }
};

// Global Storage Engine backed by Relational Database for Careers & JDs
const CareersStore = {
  cache: [],

  async initCache() {
    try {
      this.cache = await apiCall('/careers/jds');
    } catch (e) {
      console.error('Failed to initialize careers cache:', e);
      this.cache = [];
    }
  },

  getJobs() {
    return this.cache;
  },

  async addJob(jobData) {
    try {
      const result = await apiCall('/careers/jds', 'POST', jobData);
      await this.initCache();
      return result;
    } catch (e) {
      console.error('Failed to create job opening:', e);
      throw e;
    }
  },

  async updateJob(id, jobData) {
    try {
      const result = await apiCall(`/careers/jds/${id}`, 'PUT', jobData);
      await this.initCache();
      return result;
    } catch (e) {
      console.error('Failed to update job opening:', e);
      throw e;
    }
  },

  async deleteJob(id) {
    try {
      await apiCall(`/careers/jds/${id}`, 'DELETE');
      await this.initCache();
    } catch (e) {
      console.error('Failed to delete job opening:', e);
    }
  }
};

// Wizard Module Controller
class OnboardingWizard {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 6;
    this.formData = {
      vehicles: [],
      documents: {},
      mobileVerified: false
    };
    this.initDOM();
  }

  initDOM() {
    // Buttons
    this.btnPrev = document.getElementById('onboardingPrev');
    this.btnNext = document.getElementById('onboardingNext');
    this.btnSubmit = document.getElementById('onboardingSubmit');
    this.btnSendOtp = document.getElementById('btnSendOtp');
    this.btnAddVehicle = document.getElementById('btnAddVehicle');
    this.vehiclesContainer = document.getElementById('vehiclesContainer');

    // Attach listeners
    if (this.btnPrev) this.btnPrev.addEventListener('click', () => this.navigateStep(-1));
    if (this.btnNext) this.btnNext.addEventListener('click', () => this.navigateStep(1));
    if (this.btnAddVehicle) this.btnAddVehicle.addEventListener('click', () => this.addVehicleRow());
    if (this.btnSendOtp) this.btnSendOtp.addEventListener('click', () => this.handleOtpFlow());

    const form = document.getElementById('onboardingForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // Add initial vehicle row
    if (this.vehiclesContainer && this.vehiclesContainer.children.length === 0) {
      this.addVehicleRow();
    }

    // Bind File Upload Dropzones
    this.setupFileUploads();
  }

  navigateStep(dir) {
    if (dir === 1 && !this.validateStep(this.currentStep)) {
      return;
    }
    const newStep = this.currentStep + dir;
    if (newStep >= 1 && newStep <= this.totalSteps) {
      this.currentStep = newStep;
      this.updateWizardUI();
    }
  }

  updateWizardUI() {
    // Stepper nodes
    document.querySelectorAll('.ob-step-node').forEach((node, idx) => {
      node.className = 'ob-step-node';
      if (idx + 1 < this.currentStep) node.classList.add('completed');
      else if (idx + 1 === this.currentStep) node.classList.add('active');
    });

    // Step cards visibility
    document.querySelectorAll('.ob-form-step').forEach((step, idx) => {
      step.classList.toggle('active', idx + 1 === this.currentStep);
    });

    // Top progress bar width
    const bar = document.getElementById('obProgressBar');
    if (bar) {
      const pct = ((this.currentStep - 1) / (this.totalSteps - 1)) * 100;
      bar.style.width = `${pct}%`;
    }

    // Footer buttons
    if (this.btnPrev) this.btnPrev.style.display = this.currentStep === 1 ? 'none' : 'inline-block';
    if (this.btnNext) this.btnNext.style.display = this.currentStep === this.totalSteps ? 'none' : 'inline-block';
    if (this.btnSubmit) this.btnSubmit.style.display = this.currentStep === this.totalSteps ? 'inline-block' : 'none';
  }

  validateStep(step) {
    const currentStepEl = document.getElementById(`obStep${step}`);
    if (!currentStepEl) return true;

    // Check HTML5 required inputs in active step
    const inputs = currentStepEl.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    let firstInvalid = null;

    inputs.forEach(input => {
      if (!input.value.trim()) {
        isValid = false;
        input.classList.add('is-invalid');
        if (!firstInvalid) firstInvalid = input;
      } else {
        input.classList.remove('is-invalid');
      }
    });

    // Custom validations
    if (step === 1) {
      const panInput = document.getElementById('obPan');
      const mobileInput = document.getElementById('obMobile');
      
      if (panInput && panInput.value) {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panRegex.test(panInput.value.toUpperCase())) {
          this.showToast('Invalid PAN Card Format. Format should be ABCDE1234F', 'warning');
          panInput.focus();
          return false;
        }

        // Duplicate PAN Check in cache
        const existing = OnboardingStore.getOwners().find(o => (o.panNumber || o.pan_number || '').toUpperCase() === panInput.value.toUpperCase());
        if (existing) {
          this.showToast(`PAN Number ${panInput.value} is already registered under ID ${existing.ownerCode || existing.owner_code}`, 'error');
          return false;
        }
      }

      if (mobileInput && mobileInput.value.length < 10) {
        this.showToast('Please enter a valid 10-digit mobile number.', 'warning');
        return false;
      }
    }

    if (step === 3) {
      // Validate Vehicle rows
      const vehicleRows = this.vehiclesContainer.querySelectorAll('.vehicle-row');
      if (vehicleRows.length === 0) {
        this.showToast('Please add at least one vehicle.', 'warning');
        return false;
      }

      const allVehicles = OnboardingStore.getOwners().flatMap(o => o.vehicles || []);
      for (let row of vehicleRows) {
        const vehNumInput = row.querySelector('.input-veh-number');
        if (vehNumInput && vehNumInput.value) {
          const cleanNum = vehNumInput.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const dup = allVehicles.find(v => (v.vehicleNumber || v.vehicle_number || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanNum);
          if (dup) {
            this.showToast(`Vehicle Number ${vehNumInput.value} is already registered in system.`, 'error');
            vehNumInput.focus();
            return false;
          }
        }
      }
    }

    if (step === 4) {
      // Check mandatory document uploads
      const mandatoryDocs = ['rc_book', 'pan_card', 'vehicle_insurance', 'owner_photo'];
      const missing = mandatoryDocs.filter(docKey => !this.formData.documents[docKey]);
      if (missing.length > 0) {
        const missingLabels = missing.map(m => m.replace('_', ' ').toUpperCase()).join(', ');
        this.showToast(`Please upload all mandatory documents: ${missingLabels}`, 'warning');
        return false;
      }
    }

    if (!isValid && firstInvalid) {
      firstInvalid.focus();
      this.showToast('Please fill in all mandatory required fields marked with *', 'warning');
    }

    return isValid;
  }

  addVehicleRow() {
    const rowCount = this.vehiclesContainer.children.length + 1;
    const rowDiv = document.createElement('div');
    rowDiv.className = 'vehicle-row card-sub-box';
    rowDiv.innerHTML = `
      <div class="vehicle-row-header">
        <h4><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg> Vehicle #${rowCount}</h4>
        ${rowCount > 1 ? `<button type="button" class="btn-remove-veh" title="Remove Vehicle">&times; Remove</button>` : ''}
      </div>
      <div class="form-grid-3">
        <label>
          <span>Vehicle Registration No.*</span>
          <input type="text" class="input-veh-number" placeholder="e.g. TS08EX1234" required style="text-transform:uppercase;">
        </label>
        <label>
          <span>Vehicle Type*</span>
          <select class="input-veh-type" required>
            <option value="">Select Type</option>
            <option value="14 FT">14 FT Truck</option>
            <option value="17 FT">17 FT Open/Closed</option>
            <option value="20 FT">20 FT Container</option>
            <option value="22 FT">22 FT Container</option>
            <option value="32 FT Container">32 FT Container (SXL/MXL)</option>
            <option value="Trailer">Multi-Axle Trailer</option>
            <option value="Open Body">Open Body Truck</option>
            <option value="Container">Closed Body Container</option>
            <option value="Other">Other Category</option>
          </select>
        </label>
        <label>
          <span>Carrying Capacity (Tons)*</span>
          <input type="number" step="0.5" min="1" max="50" class="input-veh-capacity" placeholder="e.g. 18.5" required>
        </label>
        <label>
          <span>Registration State*</span>
          <select class="input-veh-state" required>
            <option value="Telangana">Telangana</option>
            <option value="Tamil Nadu">Tamil Nadu</option>
            <option value="Maharashtra">Maharashtra</option>
            <option value="Andhra Pradesh">Andhra Pradesh</option>
            <option value="Karnataka">Karnataka</option>
            <option value="Gujarat">Gujarat</option>
            <option value="Other">Other State</option>
          </select>
        </label>
        <label>
          <span>Model Manufacturing Year*</span>
          <input type="number" min="2005" max="2026" class="input-veh-year" placeholder="e.g. 2022" required>
        </label>
      </div>
    `;

    const removeBtn = rowDiv.querySelector('.btn-remove-veh');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        rowDiv.remove();
        this.renumberVehicles();
      });
    }

    this.vehiclesContainer.appendChild(rowDiv);
  }

  renumberVehicles() {
    const rows = this.vehiclesContainer.querySelectorAll('.vehicle-row');
    rows.forEach((row, idx) => {
      const h4 = row.querySelector('.vehicle-row-header h4');
      if (h4) {
        h4.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg> Vehicle #${idx + 1}`;
      }
    });
  }

  setupFileUploads() {
    const dropzoneEls = document.querySelectorAll('.upload-dropzone');
    dropzoneEls.forEach(dz => {
      const fileInput = dz.querySelector('input[type="file"]');
      const docKey = dz.getAttribute('data-doc');

      dz.addEventListener('click', (e) => {
        if (e.target !== fileInput) fileInput.click();
      });

      dz.addEventListener('dragover', (e) => {
        e.preventDefault();
        dz.classList.add('dragover');
      });

      dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
      dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          this.handleFileSelected(docKey, e.dataTransfer.files[0], dz);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleFileSelected(docKey, e.target.files[0], dz);
        }
      });
    });
  }

  handleFileSelected(docKey, file, dzElement) {
    const allowedMime = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10 MB

    if (!allowedMime.includes(file.type)) {
      this.showToast('Invalid file format. Allowed formats: PDF, JPG, JPEG, PNG', 'error');
      return;
    }

    if (file.size > maxSize) {
      this.showToast('File size exceeds the 10 MB maximum limit.', 'error');
      return;
    }

    // Animate progress
    const progressContainer = dzElement.querySelector('.dz-progress');
    const progressBar = dzElement.querySelector('.dz-progress-bar');
    const statusText = dzElement.querySelector('.dz-status');

    if (progressContainer) progressContainer.style.display = 'block';
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 25;
      if (progressBar) progressBar.style.width = `${progress}%`;

      if (progress >= 100) {
        clearInterval(interval);
        
        const sizeFormatted = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        this.formData.documents[docKey] = {
          fileName: file.name,
          fileSize: sizeFormatted,
          mimeType: file.type,
          status: 'Uploaded'
        };

        dzElement.classList.add('uploaded');
        if (statusText) {
          statusText.innerHTML = `<span class="badge-upload-done">✓ ${file.name} (${sizeFormatted})</span>`;
        }
        this.showToast(`Document uploaded successfully: ${file.name}`, 'success');
      }
    }, 150);
  }

  handleOtpFlow() {
    const mobileInput = document.getElementById('obMobile');
    if (!mobileInput || mobileInput.value.length < 10) {
      this.showToast('Please enter a valid 10-digit mobile number to verify OTP.', 'warning');
      mobileInput.focus();
      return;
    }

    const modal = document.getElementById('otpVerificationModal');
    const targetPhoneSpan = document.getElementById('otpPhoneTarget');
    if (targetPhoneSpan) targetPhoneSpan.textContent = `+91 ${mobileInput.value}`;

    if (modal) modal.style.display = 'flex';
    this.showToast(`OTP sent to +91 ${mobileInput.value} (Demo Code: 4920)`, 'info');
  }

  async handleSubmit(e) {
    e.preventDefault();

    const declarationCheck = document.getElementById('obDeclaration');
    if (declarationCheck && !declarationCheck.checked) {
      this.showToast('Please accept the mandatory terms and declaration statement.', 'warning');
      declarationCheck.focus();
      return;
    }

    // Compile Vehicle rows
    const vehicleRows = this.vehiclesContainer.querySelectorAll('.vehicle-row');
    const vehiclesList = [];

    vehicleRows.forEach(row => {
      vehiclesList.push({
        vehicleNumber: row.querySelector('.input-veh-number').value.trim().toUpperCase(),
        vehicleType: row.querySelector('.input-veh-type').value,
        capacityTons: parseFloat(row.querySelector('.input-veh-capacity').value),
        registrationState: row.querySelector('.input-veh-state').value,
        modelYear: parseInt(row.querySelector('.input-veh-year').value)
      });
    });

    const payload = {
      fullName: document.getElementById('obFullName').value.trim(),
      mobileNumber: document.getElementById('obMobile').value.trim(),
      altMobileNumber: document.getElementById('obAltMobile').value.trim(),
      email: document.getElementById('obEmail').value.trim(),
      panNumber: document.getElementById('obPan').value.trim().toUpperCase(),
      aadhaarNumber: document.getElementById('obAadhaar').value.trim(),
      address: document.getElementById('obAddress').value.trim(),
      city: document.getElementById('obCity').value.trim(),
      state: document.getElementById('obState').value,
      pincode: document.getElementById('obPincode').value.trim(),
      entityType: document.getElementById('obEntityType').value,
      companyName: document.getElementById('obCompanyName').value.trim(),
      gstNumber: document.getElementById('obGstNumber').value.trim().toUpperCase(),
      businessAddress: document.getElementById('obBusinessAddress').value.trim(),
      vehicles: vehiclesList,
      documents: this.formData.documents,
      bankDetails: {
        accountHolderName: document.getElementById('obAccountHolder').value.trim(),
        bankName: document.getElementById('obBankName').value.trim(),
        accountNumber: document.getElementById('obAccountNumber').value.trim(),
        ifscCode: document.getElementById('obIfscCode').value.trim().toUpperCase(),
        upiId: document.getElementById('obUpiId').value.trim()
      }
    };

    const result = await OnboardingStore.saveOwner(payload);
    if (result.error) {
      alert(`⚠️ Registration failed: ${result.error}`);
      return;
    }

    const record = {
      ownerCode: result.ownerCode,
      fullName: result.fullName
    };

    this.displaySuccessScreen(record);
  }

  displaySuccessScreen(record) {
    const wizardCard = document.getElementById('onboardingCard');
    const successCard = document.getElementById('onboardingSuccessCard');
    const ownerIdDisplay = document.getElementById('displayOwnerId');
    const ownerNameDisplay = document.getElementById('displayOwnerName');

    if (ownerIdDisplay) ownerIdDisplay.textContent = record.ownerCode;
    if (ownerNameDisplay) ownerNameDisplay.textContent = record.fullName;

    if (wizardCard) wizardCard.style.display = 'none';
    if (successCard) {
      successCard.style.display = 'block';
      successCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    this.showToast(`Registration Successful! Assigned ID: ${record.ownerCode}`, 'success');
    
    // Refresh Admin Dashboard
    if (window.AdminPortal) window.AdminPortal.render();
  }

  showToast(message, type = 'info') {
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
    setTimeout(() => {
      toast.classList.add('show');
    }, 50);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }
}

// Truck Owner Self-Service Dashboard Controller
class OwnerDashboard {
  constructor() {
    this.activeUser = null;
    this.initListeners();
  }

  initListeners() {
    const loginBtn = document.getElementById('btnOwnerLogin');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => this.handleLogin());
    }

    const logoutBtn = document.getElementById('btnOwnerLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }
  }

  async handleLogin() {
    const mobileInput = document.getElementById('ownerLoginMobile');
    const mobile = mobileInput ? mobileInput.value.trim() : '';

    if (!mobile || mobile.length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    await OnboardingStore.initCache();
    const owners = OnboardingStore.getOwners();
    const user = owners.find(o => (o.mobileNumber || o.mobile_number) === mobile);

    if (!user) {
      alert(`No registration found for mobile +91 ${mobile}. Please register first on the Onboarding page.`);
      return;
    }

    this.activeUser = user;
    await this.render();
  }

  handleLogout() {
    this.activeUser = null;
    document.getElementById('ownerLoginSection').style.display = 'block';
    document.getElementById('ownerDashboardContent').style.display = 'none';
  }

  async render() {
    if (!this.activeUser) return;

    // Refresh record from store
    await OnboardingStore.initCache();
    const owners = OnboardingStore.getOwners();
    const updated = owners.find(o => (o.ownerCode || o.owner_code) === (this.activeUser.ownerCode || this.activeUser.owner_code));
    if (updated) this.activeUser = updated;

    document.getElementById('ownerLoginSection').style.display = 'none';
    const content = document.getElementById('ownerDashboardContent');
    content.style.display = 'block';

    document.getElementById('dashOwnerName').textContent = this.activeUser.fullName || this.activeUser.full_name;
    document.getElementById('dashOwnerId').textContent = this.activeUser.ownerCode || this.activeUser.owner_code;
    document.getElementById('dashCompanyName').textContent = this.activeUser.companyName || this.activeUser.company_name;

    // Render Status Badge
    const statusBadge = document.getElementById('dashStatusBadge');
    if (statusBadge) {
      statusBadge.className = `dash-status-pill status-${this.activeUser.status.toLowerCase().replace(/\s+/g, '-')}`;
      statusBadge.textContent = this.activeUser.status;
    }

    // Render Admin Remarks
    const remarksBox = document.getElementById('dashRemarksList');
    if (remarksBox) {
      if (this.activeUser.remarks && this.activeUser.remarks.length > 0) {
        remarksBox.innerHTML = this.activeUser.remarks.map(r => `
          <div class="dash-remark-item">
            <div class="remark-header"><strong>${r.admin}</strong> <span>${r.date}</span></div>
            <p>${r.text}</p>
          </div>
        `).join('');
      } else {
        remarksBox.innerHTML = '<p class="text-muted">No remarks yet.</p>';
      }
    }

    // Render Registered Vehicles List
    const vehBox = document.getElementById('dashVehiclesList');
    if (vehBox) {
      const vehicles = this.activeUser.vehicles || [];
      vehBox.innerHTML = vehicles.map(v => `
        <div class="dash-veh-card">
          <div class="veh-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg></div>
          <div class="veh-info">
            <h5>${v.vehicleNumber || v.vehicle_number}</h5>
            <p>${v.vehicleType || v.vehicle_type} • ${v.capacityTons || v.capacity_tons} Tons • Model ${v.modelYear || v.model_year}</p>
          </div>
          <span class="badge-mini">ID: ${v.vehicleCode || v.vehicle_code}</span>
        </div>
      `).join('');
    }

    // Certificate download display
    const certBtn = document.getElementById('btnDownloadCert');
    if (certBtn) {
      certBtn.style.display = this.activeUser.status === 'Approved' ? 'inline-block' : 'none';
      certBtn.onclick = () => alert(`Downloading Verification Pass Certificate for Truck Owner ID: ${this.activeUser.ownerCode || this.activeUser.owner_code}`);
    }
  }
}

// Admin Verification Portal Controller
class AdminPortal {
  constructor() {
    this.searchTerm = '';
    this.statusFilter = 'All';
    this.selectedOwnerId = null;
    this.selectedOwnerCode = null;
    this.initDOM();
  }

  isAuthenticated() {
    return sessionStorage.getItem('ckl_admin_logged_in') === 'true';
  }

  initDOM() {
    this.searchInput = document.getElementById('adminSearchInput');
    this.filterSelect = document.getElementById('adminStatusFilter');
    this.btnExport = document.getElementById('btnExportExcel');

    // Admin Authentication Elements
    const btnLogin = document.getElementById('btnAdminLogin');
    const btnLogout = document.getElementById('btnAdminLogout');
    const loginForm = document.getElementById('adminLoginForm');

    if (btnLogin) {
      btnLogin.addEventListener('click', () => this.handleAdminLogin());
    }

    if (loginForm) {
      loginForm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleAdminLogin();
        }
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.handleAdminLogout());
    }

    if (this.searchInput) {
      this.searchInput.addEventListener('input', async (e) => {
        this.searchTerm = e.target.value.trim().toLowerCase();
        await this.render();
      });
    }

    if (this.filterSelect) {
      this.filterSelect.addEventListener('change', async (e) => {
        this.statusFilter = e.target.value;
        await this.render();
      });
    }

    if (this.btnExport) {
      this.btnExport.addEventListener('click', () => this.exportApprovedToCSV());
    }

    // Modal Action Bindings
    const btnApprove = document.getElementById('btnAdminApprove');
    const btnReject = document.getElementById('btnAdminReject');
    const btnReqDocs = document.getElementById('btnAdminReqDocs');
    const modalClose = document.getElementById('btnCloseAdminModal');

    if (btnApprove) btnApprove.addEventListener('click', () => this.updateApplicationStatus('Approved'));
    if (btnReject) btnReject.addEventListener('click', () => this.updateApplicationStatus('Rejected'));
    if (btnReqDocs) btnReqDocs.addEventListener('click', () => this.updateApplicationStatus('Documents Pending'));
    if (modalClose) modalClose.addEventListener('click', () => this.closeReviewModal());

    this.updateAuthState();
  }

  handleAdminLogin() {
    const userInput = document.getElementById('adminLoginUser');
    const passInput = document.getElementById('adminLoginPass');
    const errorBox = document.getElementById('adminLoginError');

    const username = userInput ? userInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';

    if (username.toLowerCase() === 'admin' && password === 'admin@003955') {
      sessionStorage.setItem('ckl_admin_logged_in', 'true');
      if (errorBox) errorBox.style.display = 'none';
      if (userInput) userInput.value = '';
      if (passInput) passInput.value = '';
      this.updateAuthState();
    } else {
      if (errorBox) {
        errorBox.textContent = 'Invalid credentials. Please enter valid admin username & password.';
        errorBox.style.display = 'block';
      }
    }
  }

  handleAdminLogout() {
    sessionStorage.removeItem('ckl_admin_logged_in');
    this.updateAuthState();
  }

  async updateAuthState() {
    const isAuth = this.isAuthenticated();
    const loginSection = document.getElementById('adminLoginSection');
    const dashboardContent = document.getElementById('adminDashboardContent');

    if (loginSection) loginSection.style.display = isAuth ? 'none' : 'block';
    if (dashboardContent) dashboardContent.style.display = isAuth ? 'block' : 'none';

    if (isAuth) {
      await this.render();
    }
  }

  async render() {
    if (!this.isAuthenticated()) return;

    // Refresh database and render
    try {
      const response = await fetch(`${API_BASE_URL}/onboarding/owners?status=${this.statusFilter}&search=${encodeURIComponent(this.searchTerm)}`);
      const filtered = await response.json();

      const responseAll = await fetch(`${API_BASE_URL}/onboarding/owners`);
      const owners = await responseAll.json();

      // Stats Calculation
      const total = owners.length;
      const pending = owners.filter(o => o.status === 'Submitted' || o.status === 'Under Review').length;
      const approved = owners.filter(o => o.status === 'Approved').length;
      const rejected = owners.filter(o => o.status === 'Rejected').length;
      const docsPending = owners.filter(o => o.status === 'Documents Pending').length;

      const elTotal = document.getElementById('statTotalReg');
      const elPending = document.getElementById('statPending');
      const elApproved = document.getElementById('statApproved');
      const elRejected = document.getElementById('statRejected');
      const elDocsPending = document.getElementById('statDocsPending');

      if (elTotal) elTotal.textContent = total;
      if (elPending) elPending.textContent = pending;
      if (elApproved) elApproved.textContent = approved;
      if (elRejected) elRejected.textContent = rejected;
      if (elDocsPending) elDocsPending.textContent = docsPending;

      // Render Table Rows
      const tableBody = document.getElementById('adminTableBody');
      if (!tableBody) return;

      if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4">No onboarding records match criteria.</td></tr>`;
        return;
      }

      tableBody.innerHTML = filtered.map(o => `
        <tr>
          <td><strong>${o.owner_code || o.ownerCode}</strong></td>
          <td>
            <div class="cell-owner">
              <strong>${o.full_name || o.fullName}</strong>
              <small>${o.company_name || o.companyName}</small>
            </div>
          </td>
          <td>
            <div>+91 ${o.mobile_number || o.mobileNumber}</div>
            <small class="text-muted">PAN: ${o.pan_number || o.panNumber}</small>
          </td>
          <td>
            <span class="badge-veh-count">${o.vehicles ? o.vehicles.length : 0} Vehicle(s)</span>
            <small class="d-block text-muted">${o.vehicles && o.vehicles[0] ? o.vehicles[0].vehicle_number || o.vehicles[0].vehicleNumber : ''}</small>
          </td>
          <td>${o.submitted_at || o.submittedAt}</td>
          <td><span class="dash-status-pill status-${o.status.toLowerCase().replace(/\s+/g, '-')}">${o.status}</span></td>
          <td>
            <button type="button" class="btn-table-action" onclick="window.AdminPortal.openReviewModal('${o.owner_code || o.ownerCode}')">
              Review Documents
            </button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error('Failed to render carrier onboarding table from backend', e);
    }
  }

  async openReviewModal(ownerCode) {
    try {
      const responseAll = await fetch(`${API_BASE_URL}/onboarding/owners`);
      const owners = await responseAll.json();
      const owner = owners.find(o => (o.owner_code || o.ownerCode) === ownerCode);
      if (!owner) return;

      this.selectedOwnerId = owner.id;
      this.selectedOwnerCode = ownerCode;
      
      const modal = document.getElementById('adminReviewModal');
      if (!modal) return;

      document.getElementById('modalReviewCode').textContent = owner.owner_code || owner.ownerCode;
      document.getElementById('modalReviewOwnerName').textContent = owner.full_name || owner.fullName;
      document.getElementById('modalReviewCompany').textContent = owner.company_name || owner.companyName;

      // Render Documents List
      const docDiv = document.getElementById('modalReviewDocs');
      if (docDiv) {
        const docKeys = Object.keys(owner.documents || {});
        if (docKeys.length === 0) {
          docDiv.innerHTML = '<p class="text-muted">No uploaded files attached.</p>';
        } else {
          docDiv.innerHTML = docKeys.map(k => {
            const doc = owner.documents[k];
            return `
              <div class="review-doc-card">
                <div class="doc-meta">
                  <strong>${k.replace('_', ' ').toUpperCase()}</strong>
                  <p>${doc.fileName || doc.file_name} (${doc.fileSize || doc.file_size})</p>
                </div>
                <button type="button" class="btn-download-sim" onclick="alert('Viewing document preview: ${doc.fileName || doc.file_name}')">
                  View Document
                </button>
              </div>
            `;
          }).join('');
        }
      }

      // Render Remarks history
      const remarksHistory = document.getElementById('modalReviewHistory');
      if (remarksHistory) {
        remarksHistory.innerHTML = (owner.remarks || []).map(r => `
          <div class="remark-history-item" style="border-bottom:1px solid #f1f5f9; padding:8px 0;">
            <small style="color:#64748b;"><strong>${r.admin}</strong> • ${r.date} (${r.transition})</small>
            <p style="margin:4px 0 0 0; font-size:0.88rem; color:#1e293b;">${r.text}</p>
          </div>
        `).join('');
      }

      modal.style.display = 'flex';
    } catch(e) {
      alert('Failed to retrieve application details.');
    }
  }

  closeReviewModal() {
    const modal = document.getElementById('adminReviewModal');
    if (modal) modal.style.display = 'none';
    this.selectedOwnerId = null;
    this.selectedOwnerCode = null;
  }

  async updateApplicationStatus(newStatus) {
    if (!this.selectedOwnerId) return;

    const remarksInput = document.getElementById('modalAdminRemarkText');
    const remarkText = remarksInput ? remarksInput.value.trim() : '';

    if (newStatus !== 'Approved' && !remarkText) {
      alert('Please provide a remark explaining the review decision or document requirement.');
      if (remarksInput) remarksInput.focus();
      return;
    }

    try {
      const result = await OnboardingStore.updateStatus(this.selectedOwnerId, newStatus, remarkText);
      if (result.error) {
        alert(result.error);
        return;
      }
      alert(`Carrier status updated to: ${newStatus}`);
      if (remarksInput) remarksInput.value = '';
      this.closeReviewModal();
      await this.render();

      if (window.OwnerDashboard) await window.OwnerDashboard.render();
    } catch (e) {
      alert('Failed to update status in database.');
    }
  }

  async exportApprovedToCSV() {
    try {
      const response = await fetch(`${API_BASE_URL}/onboarding/owners`);
      const allOwners = await response.json();
      const owners = allOwners.filter(o => o.status === 'Approved');
      
      if (owners.length === 0) {
        alert('No approved truck owner records available to export.');
        return;
      }

      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += 'Truck Owner ID,Full Name,Mobile,Email,PAN,Company Name,GST,Vehicles Count,Bank Name,Account No,IFSC,Approved Date\n';

      owners.forEach(o => {
        const bank = o.bankDetails || {};
        const row = [
          `"${o.owner_code || o.ownerCode}"`,
          `"${o.full_name || o.fullName}"`,
          `"${o.mobile_number || o.mobileNumber}"`,
          `"${o.email_address || o.email}"`,
          `"${o.pan_number || o.panNumber}"`,
          `"${o.company_name || o.companyName}"`,
          `"${o.gst_number || o.gstNumber || 'N/A'}"`,
          `"${o.vehicles ? o.vehicles.length : 0}"`,
          `"${bank.bank_name || 'N/A'}"`,
          `"${bank.account_number || 'N/A'}"`,
          `"${bank.ifsc_code || 'N/A'}"`,
          `"${o.updated_at || o.updatedAt}"`
        ].join(',');
        csvContent += row + '\n';
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Chitkote_Approved_Truck_Owners_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('Failed to compile approved carriers data.');
    }
  }
}

// Careers & JD Manager Controller
class CareersManager {
  constructor() {
    this.activeJobId = null;
    this.initDOM();
  }

  async initDOM() {
    // Bind Admin JD Modal Controls
    const btnOpenAdd = document.getElementById('btnAdminAddJd');
    const btnSaveJd = document.getElementById('btnSaveJdModal');
    const btnCloseJd = document.getElementById('btnCloseJdModal');

    if (btnOpenAdd) {
      btnOpenAdd.addEventListener('click', () => this.openAddJdModal());
    }

    if (btnSaveJd) {
      btnSaveJd.addEventListener('click', () => this.saveJd());
    }

    if (btnCloseJd) {
      btnCloseJd.addEventListener('click', () => this.closeJdModal());
    }

    // Public Application Modal Close
    const btnCloseApply = document.getElementById('btnCloseJobApplyModal');
    if (btnCloseApply) {
      btnCloseApply.addEventListener('click', () => {
        const modal = document.getElementById('jobApplyModal');
        if (modal) modal.style.display = 'none';
      });
    }

    // Submit Job Application Form
    const btnSubmitApp = document.getElementById('btnSubmitJobApp');
    if (btnSubmitApp) {
      btnSubmitApp.addEventListener('click', (e) => {
        e.preventDefault();
        const name = document.getElementById('appFullName')?.value.trim();
        const mobile = document.getElementById('appMobile')?.value.trim();
        if (!name || !mobile) {
          alert('Please enter your full name and 10-digit mobile number.');
          return;
        }
        alert(`Thank you ${name}! Your application for the position has been submitted successfully to Chitkote Logistics HR Team.`);
        const modal = document.getElementById('jobApplyModal');
        if (modal) modal.style.display = 'none';
      });
    }

    await this.renderPublicGrid();
    await this.renderAdminTable();
  }

  async renderPublicGrid() {
    const container = document.getElementById('publicCareersGrid');
    if (!container) return;

    await CareersStore.initCache();
    const jobs = CareersStore.getJobs().filter(j => j.status === 'Active');

    if (jobs.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b; background: #f8fafc; border-radius: 12px;">No open positions at the moment. Please check back soon!</div>`;
      return;
    }

    container.innerHTML = jobs.map(j => `
      <div class="career-card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:24px; display:flex; flex-direction:column; justify-content:space-between; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <span style="font-size:0.8rem; font-weight:700; color:#166534; background:#f0fdf4; padding:4px 10px; border-radius:20px; border:1px solid #bbf7d0;">${j.department}</span>
            <span style="font-size:0.8rem; color:#64748b;">Posted: ${j.postedDate}</span>
          </div>
          <h3 style="font-size:1.25rem; color:#1e293b; margin:0 0 8px 0; font-weight:700;">${j.title}</h3>
          <div style="display:flex; flex-wrap:wrap; gap:12px; font-size:0.875rem; color:#475569; margin-bottom:14px;">
            <span>📍 ${j.location}</span>
            <span>💼 ${j.type}</span>
            <span>⏱️ Exp: ${j.experience}</span>
          </div>
          <p style="font-size:0.92rem; color:#475569; line-height:1.5; margin-bottom:16px;">${j.description}</p>
        </div>
        <div style="display:flex; gap:10px; margin-top:12px;">
          <button type="button" class="btn btn-primary btn-apply-job" data-job-id="${j.id}" onclick="window.openJobApplyModal('${j.id}')" style="width:100%; text-align:center; cursor:pointer;">
            View Details & Apply
          </button>
        </div>
      </div>
    `).join('');
  }

  async renderAdminTable() {
    const tableBody = document.getElementById('adminCareersTableBody');
    const totalCount = document.getElementById('statTotalJds');
    const activeCount = document.getElementById('statActiveJds');

    await CareersStore.initCache();
    const jobs = CareersStore.getJobs();

    if (totalCount) totalCount.textContent = jobs.length;
    if (activeCount) activeCount.textContent = jobs.filter(j => j.status === 'Active').length;

    if (!tableBody) return;

    if (jobs.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">No Job Descriptions created yet. Click "Add New Job Description (JD)" above.</td></tr>`;
      return;
    }

    tableBody.innerHTML = jobs.map(j => `
      <tr>
        <td><strong>${j.id}</strong></td>
        <td>
          <strong style="color:#1e293b; display:block;">${j.title}</strong>
          <small class="text-muted">Exp: ${j.experience} • ${j.type}</small>
        </td>
        <td><span class="badge-mini" style="background:#f1f5f9; color:#334155;">${j.department}</span></td>
        <td>📍 ${j.location}</td>
        <td>
          <button type="button" class="dash-status-pill status-${j.status.toLowerCase()}" style="border:none; cursor:pointer;" onclick="window.CareersManager.toggleJobStatus('${j.id}')">
            ${j.status} (Click to toggle)
          </button>
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn-table-action" onclick="window.CareersManager.openEditJdModal('${j.id}')">
              Edit JD
            </button>
            <button type="button" class="btn-table-action" style="background:#fee2e2; color:#991b1b; border-color:#fca5a5;" onclick="window.CareersManager.deleteJd('${j.id}')">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  openAddJdModal() {
    this.activeJobId = null;
    const modal = document.getElementById('adminJdModal');
    const titleEl = document.getElementById('jdModalHeading');
    const form = document.getElementById('adminJdForm');

    if (titleEl) titleEl.textContent = 'Add New Job Description (JD)';
    if (form) form.reset();
    if (modal) modal.style.display = 'flex';
  }

  openEditJdModal(id) {
    const jobs = CareersStore.getJobs();
    const job = jobs.find(j => j.id === id);
    if (!job) return;

    this.activeJobId = id;
    const modal = document.getElementById('adminJdModal');
    const titleEl = document.getElementById('jdModalHeading');

    if (titleEl) titleEl.textContent = `Edit Job Description (${job.id})`;

    document.getElementById('jdTitle').value = job.title || '';
    document.getElementById('jdDepartment').value = job.department || 'Operations';
    document.getElementById('jdLocation').value = job.location || '';
    document.getElementById('jdType').value = job.type || 'Full Time';
    document.getElementById('jdExperience').value = job.experience || '';
    document.getElementById('jdStatus').value = job.status || 'Active';
    document.getElementById('jdDescription').value = job.description || '';
    document.getElementById('jdResponsibilities').value = job.responsibilities || '';
    document.getElementById('jdRequirements').value = job.requirements || '';

    if (modal) modal.style.display = 'flex';
  }

  closeJdModal() {
    const modal = document.getElementById('adminJdModal');
    if (modal) modal.style.display = 'none';
  }

  async saveJd() {
    const title = document.getElementById('jdTitle')?.value.trim();
    const department = document.getElementById('jdDepartment')?.value;
    const location = document.getElementById('jdLocation')?.value.trim();
    const type = document.getElementById('jdType')?.value;
    const experience = document.getElementById('jdExperience')?.value.trim();
    const status = document.getElementById('jdStatus')?.value;
    const description = document.getElementById('jdDescription')?.value.trim();
    const responsibilities = document.getElementById('jdResponsibilities')?.value.trim();
    const requirements = document.getElementById('jdRequirements')?.value.trim();

    if (!title || !location || !description) {
      alert('Please fill in Job Title, Location, and Summary Description.');
      return;
    }

    const jobPayload = {
      title,
      department,
      location,
      type,
      experience,
      status,
      description,
      responsibilities,
      requirements
    };

    try {
      if (this.activeJobId) {
        await CareersStore.updateJob(this.activeJobId, jobPayload);
        alert(`Job Description ${this.activeJobId} updated successfully!`);
      } else {
        const created = await CareersStore.addJob(jobPayload);
        alert(`New Job Description created successfully with ID: ${created.id}!`);
      }

      this.closeJdModal();
      await this.renderAdminTable();
      await this.renderPublicGrid();
    } catch (e) {
      alert('Failed to save Job Description in database.');
    }
  }

  async toggleJobStatus(id) {
    const jobs = CareersStore.getJobs();
    const job = jobs.find(j => j.id === id);
    if (!job) return;

    const newStatus = job.status === 'Active' ? 'Closed' : 'Active';
    try {
      await CareersStore.updateJob(id, { status: newStatus });
      await this.renderAdminTable();
      await this.renderPublicGrid();
    } catch (e) {
      alert('Failed to toggle job status.');
    }
  }

  async deleteJd(id) {
    if (confirm(`Are you sure you want to delete Job Description ${id}?`)) {
      try {
        await CareersStore.deleteJob(id);
        await this.renderAdminTable();
        await this.renderPublicGrid();
      } catch (e) {
        alert('Failed to delete job opening.');
      }
    }
  }

  openApplyModal(id) {
    const jobs = CareersStore.getJobs();
    const job = jobs.find(j => j.id === id);
    if (!job) return;

    const modal = document.getElementById('jobApplyModal');
    if (!modal) return;

    document.getElementById('applyJobTitle').textContent = job.title;
    document.getElementById('applyJobCode').textContent = `${job.id} • ${job.department}`;
    document.getElementById('applyJobLocation').textContent = job.location;
    document.getElementById('applyJobExp').textContent = job.experience;
    document.getElementById('applyJobDesc').textContent = job.description;

    const respBox = document.getElementById('applyJobResp');
    if (respBox) respBox.innerHTML = (job.responsibilities || '').split('\n').map(r => `<li>${r}</li>`).join('');

    const reqBox = document.getElementById('applyJobReq');
    if (reqBox) reqBox.innerHTML = (job.requirements || '').split('\n').map(r => `<li>${r}</li>`).join('');

    modal.style.display = 'flex';
  }
}

// Global initialization when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  // Pre-fetch caches from database
  await OnboardingStore.initCache();
  await CareersStore.initCache();

  window.OnboardingWizard = new OnboardingWizard();
  window.OwnerDashboard = new OwnerDashboard();
  window.AdminPortal = new AdminPortal();
  window.CareersManager = new CareersManager();
  window.openJobApplyModal = (id) => {
    if (window.CareersManager) {
      window.CareersManager.openApplyModal(id);
    }
  };

  // Modal OTP Close logic
  const closeOtp = document.getElementById('btnCloseOtpModal');
  const modalOtp = document.getElementById('otpVerificationModal');
  const btnVerifyOtp = document.getElementById('btnConfirmOtp');

  if (closeOtp && modalOtp) {
    closeOtp.addEventListener('click', () => modalOtp.style.display = 'none');
  }

  if (btnVerifyOtp) {
    btnVerifyOtp.addEventListener('click', () => {
      const digits = document.querySelectorAll('.otp-digit-input');
      const val = Array.from(digits).map(d => d.value).join('');
      if (val === '4920' || val.length === 4) {
        alert('OTP Verification Successful! Phone number verified.');
        if (modalOtp) modalOtp.style.display = 'none';
        
        const badge = document.getElementById('mobileVerifyBadge');
        if (badge) {
          badge.className = 'badge-mini badge-verified';
          badge.textContent = '✓ Verified';
        }
      } else {
        alert('Invalid OTP. Please enter code 4920.');
      }
    });
  }
});

/**
 * CHITKOTE LOGISTICS INDIA PVT. LTD. & SRI TAMIL NADU TRANSPORT CO.
 * Multi-Company LR (Lorry Receipt / Bilty) Management System
 * Database Integrated Core Client - Handles Async API CRUD, Search, Auto-Calc & PDF Rendering
 */

const LRManager = (function () {
  const API_BASE_URL = 'http://localhost:5000/api';

  // Global filters state
  let currentCompanyFilter = 'ALL';
  let currentStatusFilter = 'ALL';
  let currentSearchQuery = '';
  let currentPage = 1;
  let totalPages = 1;

  // Cached masters for synchronous autocomplete checks
  let customersCache = [];
  let vehiclesCache = [];
  let driversCache = [];

  // Company Configurations (used for styling & static labels on frontend)
  let COMPANIES = {
    CHITKOTE: {
      id: 'CHITKOTE',
      name: 'Chitkote Logistics India Pvt Ltd',
      shortName: 'CK Logistics',
      shortCode: 'CKL',
      prefix: 'CL26-27/',
      phone: '94057-73955',
      email: 'dispatch@chitkotelogistics.com',
      address: '8-1-206/87/1, Pragathi Colony Main Road, Hyderabad - 500005, Telangana',
      pan: 'AANCC4088L',
      gstin: '36AANCC4088L1Z1',
      state: 'Telangana',
      stateCode: '36',
      logo: 'Images/newlogo_processed.png',
      terms: '1. This is a digitally generated Bilty/LR Copy\n2. Company is not responsible for leakages & thefts during transit unless insured.\n3. Goods loaded at owner\'s risk.',
      declaration: 'Certified that the particulars given above are true and correct',
      bankName: 'ICICI BANK LTD.',
      bankAccNo: '001234567890',
      bankIfsc: 'ICIC0000012',
      bankBranch: 'JUBILEE HILLS'
    },
    SRI_TAMILNADU: {
      id: 'SRI_TAMILNADU',
      name: 'Sri TamilNadu Transport Co',
      shortName: 'Sri TamilNadu Transport Co',
      shortCode: 'STTC',
      prefix: 'STTC26-27/',
      phone: '91234-56789',
      email: 'operations@sritamilnadutransport.com',
      address: 'Old No. 142/A, Madhavaram High Road, Near Flyover, Chennai - 600060, Tamil Nadu',
      pan: 'STNPT9876K',
      gstin: '33STNPT9876K1Z9',
      state: 'Tamil Nadu',
      stateCode: '33',
      logo: 'Images/Logo.jpeg',
      terms: '1. This is a digitally generated Bilty/LR Copy\n2. Delivery subject to presentation of original consignee copy.\n3. Demurrage charge @ ₹1000/day applicable after 24 hrs of destination arrival.',
      declaration: 'Certified that the particulars given above are true and correct',
      bankName: 'HDFC BANK LTD.',
      bankAccNo: '20682000000669',
      bankIfsc: 'HDFC0002068',
      bankBranch: 'SHAMSHABAD'
    }
  };

  // GST State Code Mapping (India)
  const GST_STATE_MAP = {
    '01': { state: 'Jammu & Kashmir', city: 'Srinagar' },
    '02': { state: 'Himachal Pradesh', city: 'Shimla' },
    '03': { state: 'Punjab', city: 'Ludhiana' },
    '04': { state: 'Chandigarh', city: 'Chandigarh' },
    '05': { state: 'Uttarakhand', city: 'Dehradun' },
    '06': { state: 'Haryana', city: 'Gurgaon' },
    '07': { state: 'Delhi', city: 'New Delhi' },
    '08': { state: 'Rajasthan', city: 'Jaipur' },
    '09': { state: 'Uttar Pradesh', city: 'Noida' },
    '10': { state: 'Bihar', city: 'Patna' },
    '11': { state: 'Sikkim', city: 'Gangtok' },
    '12': { state: 'Arunachal Pradesh', city: 'Itanagar' },
    '13': { state: 'Nagaland', city: 'Kohima' },
    '14': { state: 'Manipur', city: 'Imphal' },
    '15': { state: 'Mizoram', city: 'Aizawl' },
    '16': { state: 'Tripura', city: 'Agartala' },
    '17': { state: 'Meghalaya', city: 'Shillong' },
    '18': { state: 'Assam', city: 'Guwahati' },
    '19': { state: 'West Bengal', city: 'Kolkata' },
    '20': { state: 'Jharkhand', city: 'Ranchi' },
    '21': { state: 'Odisha', city: 'Bhubaneswar' },
    '22': { state: 'Chhattisgarh', city: 'Raipur' },
    '23': { state: 'Madhya Pradesh', city: 'Indore' },
    '24': { state: 'Gujarat', city: 'Ahmedabad' },
    '27': { state: 'Maharashtra', city: 'Mumbai' },
    '29': { state: 'Karnataka', city: 'Bangalore' },
    '30': { state: 'Goa', city: 'Panaji' },
    '32': { state: 'Kerala', city: 'Kochi' },
    '33': { state: 'Tamil Nadu', city: 'Chennai' },
    '34': { state: 'Puducherry', city: 'Puducherry' },
    '36': { state: 'Telangana', city: 'Hyderabad' },
    '37': { state: 'Andhra Pradesh', city: 'Visakhapatnam' }
  };

  const KNOWN_GST_DATABASE = {
    '36AADTM1728Q1Z3': {
      companyName: 'MANNA TRUST',
      contactPerson: 'Srinivas Rao',
      phone: '99631-88008',
      email: 'mannatrust@gmail.com',
      address: 'C-2-293/82/J/A/Plot No 53A 3rd floor, Jubilee Hills Road',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500033'
    },
    '33AAIPN2063J1ZR': {
      companyName: 'DURAI ENGINEERING PRODUCTS',
      contactPerson: 'K. Durairaj',
      phone: '94432-11020',
      email: 'duraiengg@yahoo.co.in',
      address: 'Old No.1143 New No.343 Sanganoor, Mettupalayam Road',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      pincode: '641043'
    },
    '33AAACT1029F1Z2': {
      companyName: 'TVS MOTOR SUPPLIES PVT LTD',
      contactPerson: 'R. Murugan',
      phone: '98401-22334',
      email: 'dispatch@tvsmotor.com',
      address: 'Plot B-12, Hosur Industrial Estate',
      city: 'Hosur',
      state: 'Tamil Nadu',
      pincode: '635109'
    },
    '36AAACH9921B1Z4': {
      companyName: 'HYDERABAD PHARMA LABS',
      contactPerson: 'Dr. Reddy',
      phone: '98850-12345',
      email: 'logistics@hydpharma.com',
      address: 'IDA Pashamylaram, Phase II',
      city: 'Patancheru',
      state: 'Telangana',
      pincode: '502307'
    }
  };

  // Convert Number to Words (Rupees)
  function numberToWordsIndian(num) {
    if (isNaN(num) || num === 0) return 'Zero Rupees Only';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function inWords(n) {
      if ((n = n.toString()).length > 9) return 'Overflow';
      let n_array = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!n_array) return '';
      let str = '';
      str += (n_array[1] != 0) ? (a[Number(n_array[1])] || b[n_array[1][0]] + ' ' + a[n_array[1][1]]) + 'Crore ' : '';
      str += (n_array[2] != 0) ? (a[Number(n_array[2])] || b[n_array[2][0]] + ' ' + a[n_array[2][1]]) + 'Lakh ' : '';
      str += (n_array[3] != 0) ? (a[Number(n_array[3])] || b[n_array[3][0]] + ' ' + a[n_array[3][1]]) + 'Thousand ' : '';
      str += (n_array[4] != 0) ? (a[Number(n_array[4])] || b[n_array[4][0]] + ' ' + a[n_array[4][1]]) + 'Hundred ' : '';
      str += (n_array[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n_array[5])] || b[n_array[5][0]] + ' ' + a[n_array[5][1]]) : '';
      return str;
    }

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    let result = inWords(rupees).trim() + ' Rupees';
    if (paise > 0) {
      result += ' and ' + inWords(paise).trim() + ' Paise';
    }
    return result + ' Only';
  }

  // Pure SVG QR Code Generator
  function generateSVGQRCode(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    const size = 21;
    let rects = [];
    function drawFinder(x, y) {
      rects.push(`<rect x="${x}" y="${y}" width="7" height="7" fill="#000"/>`);
      rects.push(`<rect x="${x+1}" y="${y+1}" width="5" height="5" fill="#fff"/>`);
      rects.push(`<rect x="${x+2}" y="${y+2}" width="3" height="3" fill="#000"/>`);
    }
    drawFinder(0, 0);
    drawFinder(14, 0);
    drawFinder(0, 14);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if ((r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8)) continue;
        const bit = Math.abs((hash ^ (r * 31 + c * 17 + r * c)) % 3) === 0;
        if (bit) {
          rects.push(`<rect x="${c}" y="${r}" width="1" height="1" fill="#000"/>`);
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 23 23" width="96" height="96" shape-rendering="crispEdges">
      <rect x="-1" y="-1" width="23" height="23" fill="#ffffff" />
      ${rects.join('')}
    </svg>`;
  }

  // Generate Bilty PDF / Printable HTML matching reference design
  function renderBiltyHTML(lr) {
    const company = COMPANIES[lr.company_id] || COMPANIES.CHITKOTE;
    const qrSvg = generateSVGQRCode(`LR:${lr.lr_no}|Co:${company.name}|GST:${company.gstin}|Date:${lr.date}|Vehicle:${lr.vehicle_no}|Driver:${lr.driver_name || ''}|Amount:${lr.total_amount}`);
    
    // Line items rendering
    const items = lr.items || [];
    const itemsRows = items.map(item => `
      <tr>
        <td style="text-align:center; padding:8px; border:1px solid #000; font-size:12px;">${item.sr_no || item.srNo}</td>
        <td style="text-align:center; padding:8px; border:1px solid #000; font-size:12px;">${item.packets}</td>
        <td style="text-align:left; padding:8px; border:1px solid #000; font-size:12px;">${item.description}</td>
        <td style="text-align:center; padding:8px; border:1px solid #000; font-size:12px;">${item.weight}</td>
        <td style="text-align:center; padding:8px; border:1px solid #000; font-size:12px;">${item.unit}</td>
        <td style="text-align:right; padding:8px; border:1px solid #000; font-size:12px;">${Number(item.rate).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
        <td style="text-align:right; padding:8px; border:1px solid #000; font-size:12px; font-weight:600;">${Number(item.freight_amt || item.freightAmt).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
      </tr>
    `).join('');

    return `
    <div class="bilty-document-container" style="width: 100%; max-width: 850px; margin: 0 auto; background: #ffffff; color: #000000; font-family: Arial, Helvetica, sans-serif; border: 2px solid #000000; padding: 12px; box-sizing: border-box; font-size: 11px; line-height: 1.3;">
      
      <!-- TOP HEADER BLOCK -->
      <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #000; margin-bottom: 8px;">
        <tr>
          <td style="width: 110px; vertical-align: top; padding-bottom: 8px;">
            ${company.logo ? `<img src="${company.logo}" style="max-width: 90px; height: auto;" alt="Logo">` : `<div style="font-weight:bold; font-size:14px;">[${company.shortCode}]</div>`}
          </td>
          <td style="text-align: center; vertical-align: top; padding-bottom: 8px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif; color:#000;">${company.name}</h2>
            <div style="font-size: 11px; margin-top: 4px; font-weight: 500;">${company.address}</div>
          </td>
          <td style="width: 180px; text-align: left; vertical-align: top; font-size: 11px; padding-bottom: 8px; line-height: 1.4;">
            <div><strong>Phone No:</strong> ${company.phone}</div>
            <div><strong>PAN:</strong> ${company.pan}</div>
            <div><strong>GSTIN:</strong> ${company.gstin}</div>
          </td>
        </tr>
      </table>

      <!-- 3-BOX UPPER LAYOUT -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
        <tr>
          <!-- Box 1: Freight Paid By, Vehicle & Driver -->
          <td style="width: 34%; vertical-align: top; padding-right: 6px;">
            <div style="border: 1px solid #000; border-radius: 8px; padding: 8px; min-height: 105px;">
              <div style="font-weight: bold; text-decoration: underline; margin-bottom: 4px; font-size: 11px;">Freight Paid By:</div>
              <div style="margin-bottom: 4px;">Consignor : &nbsp; ${lr.freight_paid_by === 'Consignor' ? '✓' : ''}</div>
              <div style="margin-bottom: 6px;">Consignee : &nbsp; ${lr.freight_paid_by === 'Consignee' ? '✓' : ''}</div>
              <div style="font-weight: 600;">Vehicle &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; : &nbsp; ${lr.vehicle_no}</div>
              <div style="font-weight: 600; margin-top: 3px;">Driver &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; : &nbsp; ${lr.driver_name || 'N/A'} ${lr.driver_phone ? '(' + lr.driver_phone + ')' : ''}</div>
            </div>
          </td>

          <!-- Box 2: Insurance -->
          <td style="width: 30%; vertical-align: top; padding-right: 6px;">
            <div style="border: 1px solid #000; border-radius: 8px; padding: 8px; min-height: 105px;">
              <div style="font-weight: bold; text-align: center; margin-bottom: 6px; font-size: 11px;">INSURANCE</div>
              <div style="font-size: 10px; line-height: 1.3; color: #111;">${lr.insurance_status || 'The Consignor has NOT insured the consignment'}</div>
            </div>
          </td>

          <!-- Box 3: Delivery Door/Godown & LR Details -->
          <td style="width: 36%; vertical-align: top;">
            <div style="font-size: 11px; margin-bottom: 6px;">
              <strong>Address of Delivery Door/Godown</strong><br>
              <span style="font-size: 10.5px;">${lr.delivery_address || lr.consignee_address}</span>
            </div>
            <div style="border: 1px solid #000; border-radius: 8px; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div><strong>L.R No:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${lr.lr_no}</div>
                <div><strong>Date:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${lr.date}</div>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- CONSIGNOR & CONSIGNEE SECTION + E-WAY/INVOICE BOX -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
        <tr>
          <!-- Left Column: Consignor & Consignee Details -->
          <td style="width: 64%; vertical-align: top; padding-right: 6px;">
            <!-- Consignor -->
            <div style="border-bottom: 1px solid #000; padding-bottom: 6px; margin-bottom: 6px;">
              <div style="font-weight: bold; margin-bottom: 2px;">Consignor's Name & Address</div>
              <div style="font-weight: bold; text-transform: uppercase;">${lr.consignor_name} ${lr.consignor_gstin ? `(GST: ${lr.consignor_gstin})` : ''}</div>
              <div style="font-size: 10.5px;">${lr.consignor_address}</div>
              <div style="font-size: 10.5px;"><strong>Contact No:</strong> ${lr.consignor_contact}</div>
            </div>
            <!-- Consignee -->
            <div style="padding-top: 2px;">
              <div style="font-weight: bold; margin-bottom: 2px;">Consignee's Name & Address</div>
              <div style="font-weight: bold; text-transform: uppercase;">${lr.consignee_name} ${lr.consignee_gstin ? `(GST: ${lr.consignee_gstin})` : ''}</div>
              <div style="font-size: 10.5px;">${lr.consignee_address}</div>
            </div>
          </td>

          <!-- Right Column: E-Way Bill, Invoice & Route -->
          <td style="width: 36%; vertical-align: top;">
            <div style="border: 1px solid #000; border-radius: 8px; padding: 8px; margin-bottom: 6px; min-height: 70px;">
              <div><strong>E-WayBill No:</strong> ${lr.eway_bill_no || ''}</div>
              <div><strong>Invoice No:</strong> ${lr.invoice_no || ''}</div>
              <div><strong>Invoice Value:</strong> ${lr.invoice_value ? '₹ ' + Number(lr.invoice_value).toLocaleString('en-IN') : ''}</div>
            </div>

            <div style="border: 1px solid #000; border-radius: 8px; padding: 8px; display: flex; justify-content: space-between;">
              <div><strong>From:</strong> &nbsp;&nbsp; ${lr.from_location}</div>
              <div><strong>To:</strong> &nbsp;&nbsp; ${lr.to_location}</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- LINE ITEMS TABLE -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 8px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="border: 1px solid #000; padding: 6px; font-weight: bold; width: 6%;">Sr No.</th>
            <th style="border: 1px solid #000; padding: 6px; font-weight: bold; width: 10%;">No. of Packets</th>
            <th style="border: 1px solid #000; padding: 6px; font-weight: bold; width: 34%;">Description</th>
            <th style="border: 1px solid #000; padding: 6px; font-weight: bold; width: 12%;">Actual Weight</th>
            <th style="border: 1px solid #000; padding: 6px; font-weight: bold; width: 10%;">Unit</th>
            <th style="border: 1px solid #000; padding: 6px; font-weight: bold; width: 12%;">Rate</th>
            <th style="border: 1px solid #000; padding: 6px; font-weight: bold; width: 16%;">Freight Amt</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <!-- WORDS & FREIGHT BREAKDOWN SECTION -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
        <tr>
          <!-- Left: Amount in Words & Remarks -->
          <td style="width: 50%; vertical-align: top; padding-right: 8px;">
            <div style="border: 1px solid #000; padding: 8px; border-radius: 6px; margin-bottom: 6px;">
              <div><strong>Amount In Words</strong></div>
              <div style="font-weight: bold; margin-top: 4px; font-size: 11px;">${lr.amount_in_words || numberToWordsIndian(lr.total_amount)}</div>
            </div>
            <div style="border: 1px solid #000; padding: 8px; border-radius: 6px; font-size: 10.5px;">
              <strong>Remarks:</strong> ${lr.remarks || 'Company is not responsible for the leakages & thefts'}
            </div>
          </td>

          <!-- Right: Summary Table (Charges breakdown detailed) -->
          <td style="width: 50%; vertical-align: top;">
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 10px;">
              <tr style="background: #f1f5f9; font-weight: bold;">
                <td style="border: 1px solid #000; padding: 3px; width: 60%;">Description</td>
                <td style="border: 1px solid #000; padding: 3px; text-align: right; width: 40%;">Amount (₹)</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; padding: 3px;">Basic Freight</td>
                <td style="border: 1px solid #000; padding: 3px; text-align: right;">${Number(lr.freight_amt).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
              </tr>
              ${lr.loading_charges > 0 ? `<tr><td style="border: 1px solid #000; padding: 3px;">Loading Charges</td><td style="border: 1px solid #000; padding: 3px; text-align: right;">${Number(lr.loading_charges).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>` : ''}
              ${lr.unloading_charges > 0 ? `<tr><td style="border: 1px solid #000; padding: 3px;">Unloading Charges</td><td style="border: 1px solid #000; padding: 3px; text-align: right;">${Number(lr.unloading_charges).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>` : ''}
              ${lr.toll_charges > 0 ? `<tr><td style="border: 1px solid #000; padding: 3px;">Toll Charges</td><td style="border: 1px solid #000; padding: 3px; text-align: right;">${Number(lr.toll_charges).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>` : ''}
              ${lr.detention_charges > 0 ? `<tr><td style="border: 1px solid #000; padding: 3px;">Detention Charges</td><td style="border: 1px solid #000; padding: 3px; text-align: right;">${Number(lr.detention_charges).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>` : ''}
              ${lr.other_charges > 0 ? `<tr><td style="border: 1px solid #000; padding: 3px;">Other Charges</td><td style="border: 1px solid #000; padding: 3px; text-align: right;">${Number(lr.other_charges).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>` : ''}
              <tr style="background: #f1f5f9; font-weight: bold;">
                <td style="border: 1px solid #000; padding: 3px;">Taxable Amount</td>
                <td style="border: 1px solid #000; padding: 3px; text-align: right;">₹ ${Number(lr.taxable_amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; padding: 3px;">GST (${lr.gst_percent || 0}%)</td>
                <td style="border: 1px solid #000; padding: 3px; text-align: right;">${Number(lr.gst_amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="background: #f1f5f9; font-weight: bold;">
                <td style="border: 1px solid #000; padding: 3px;">Total Amount</td>
                <td style="border: 1px solid #000; padding: 3px; text-align: right;">₹ ${Number(lr.total_amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; padding: 3px; font-weight: 500;">Less: Advance</td>
                <td style="border: 1px solid #000; padding: 3px; text-align: right;">₹ ${Number(lr.advance_amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="background: #e2e8f0; font-weight: bold; font-size: 11px;">
                <td style="border: 1px solid #000; padding: 4px; color: #000;">Net Payable (To Pay)</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right; color: #b91c1c;">₹ ${Number(lr.to_pay_amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- BOTTOM TERMS & SIGNATURE SECTION -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <!-- Terms & Conditions -->
          <td style="width: 58%; vertical-align: top; padding: 8px; border-right: 1px solid #000; font-size: 10px;">
            <div style="font-weight: bold; margin-bottom: 4px; font-size: 11px;">Terms & Conditions:</div>
            <div style="white-space: pre-line; line-height: 1.4;">${company.terms}</div>
          </td>

          <!-- Certification, Signature & Verification QR Code -->
          <td style="width: 42%; vertical-align: bottom; padding: 8px; font-size: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <div style="font-style: italic; margin-bottom: 6px;">${company.declaration}</div>
                <div style="font-weight: bold; margin-bottom: 24px;">For, ${company.name}</div>
                <div style="border-top: 1px dashed #000; width: 140px; text-align: center; padding-top: 2px; font-weight: bold;">Signature</div>
              </div>
              <div style="text-align: center;">
                ${qrSvg}
                <div style="font-size: 8px; margin-top: 2px; color: #444;">Scan to Verify</div>
              </div>
            </div>
          </td>
        </tr>
      </table>

    </div>
    `;
  }

  // Build WhatsApp Share Link
  function buildWhatsAppShareURL(lr) {
    const company = COMPANIES[lr.company_id] || COMPANIES.CHITKOTE;
    const recipientPhone = (lr.consignor_contact || lr.consignee_contact || '').replace(/[^0-9]/g, '');
    const phoneWithCountry = recipientPhone.length === 10 ? '91' + recipientPhone : recipientPhone;
    
    const message = `*LORRY RECEIPT / BILTY CONFIRMATION* 🚛\n\n` +
      `*LR No:* ${lr.lr_no}\n` +
      `*Company:* ${company.name}\n` +
      `*Date:* ${lr.date}\n` +
      `*Vehicle No:* ${lr.vehicle_no}\n` +
      `*Driver:* ${lr.driver_name || 'N/A'} (${lr.driver_phone || ''})\n` +
      `*From:* ${lr.from_location} ➡️ *To:* ${lr.to_location}\n` +
      `*Consignor:* ${lr.consignor_name}\n` +
      `*Consignee:* ${lr.consignee_name}\n` +
      `*Total Amount:* ₹${Number(lr.total_amount).toLocaleString('en-IN')}\n` +
      `*Advance Paid:* ₹${Number(lr.advance_amount).toLocaleString('en-IN')}\n` +
      `*Balance To Pay:* ₹${Number(lr.to_pay_amount).toLocaleString('en-IN')}\n` +
      `*Current Status:* ${lr.status}\n\n` +
      `Thank you for choosing ${company.name}! For tracking support, contact ${company.phone}.`;

    return `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(message)}`;
  }

  // Tally Prime XML Export Generator
  function generateTallyXML(lrs) {
    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>\n<TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    const xmlFooter = `</TALLYMESSAGE>`;

    const vouchersXml = lrs.map(lr => {
      const company = COMPANIES[lr.company_id] || COMPANIES.CHITKOTE;
      return `  <VOUCHER VCHTYPE="Sales" ACTION="Create">
    <DATE>${lr.date.replace(/-/g, '')}</DATE>
    <NARRATION>Freight charges for LR ${lr.lr_no} Vehicle ${lr.vehicle_no} Driver ${lr.driver_name || ''} from ${lr.from_location} to ${lr.to_location}. E-Way Bill: ${lr.eway_bill_no || 'N/A'}</NARRATION>
    <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
    <VOUCHERNUMBER>${lr.lr_no}</VOUCHERNUMBER>
    <REFERENCE>${lr.invoice_no || lr.lr_no}</REFERENCE>
    <PARTYLEDGERNAME>${lr.consignor_name.replace(/&/g, '&amp;')}</PARTYLEDGERNAME>
    <COMPANYNAME>${company.name.replace(/&/g, '&amp;')}</COMPANYNAME>
    <STATENAME>${company.state}</STATENAME>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${lr.consignor_name.replace(/&/g, '&amp;')}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
      <AMOUNT>-${Number(lr.total_amount).toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Freight Income</LEDGERNAME>
      <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
      <AMOUNT>${Number(lr.freight_amt).toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    ${lr.gst_amount > 0 ? `
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Output IGST / CGST</LEDGERNAME>
      <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
      <AMOUNT>${Number(lr.gst_amount).toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>` : ''}
  </VOUCHER>\n`;
    }).join('');

    return xmlHeader + vouchersXml + xmlFooter;
  }

  // API Call helper
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

  return {
    COMPANIES,
    numberToWordsIndian,
    generateSVGQRCode,
    renderBiltyHTML,
    buildWhatsAppShareURL,
    generateTallyXML,

    // Autocomplete Check
    async getCustomersFromAPI(search = '') {
      try {
        customersCache = await apiCall(`/customers?search=${encodeURIComponent(search)}`);
        return customersCache;
      } catch (e) {
        console.warn('Fallback to local array due to server downtime');
        return [];
      }
    },

    async getVehiclesFromAPI(search = '') {
      try {
        vehiclesCache = await apiCall(`/vehicles?search=${encodeURIComponent(search)}`);
        return vehiclesCache;
      } catch (e) {
        return [];
      }
    },

    async getDriversFromAPI(search = '') {
      try {
        driversCache = await apiCall(`/drivers?search=${encodeURIComponent(search)}`);
        return driversCache;
      } catch (e) {
        return [];
      }
    },

    // GSTIN Autofetch logic
    async fetchGSTDetails(gstin) {
      if (!gstin) return null;
      const cleanGstin = gstin.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

      // 1. Check database customers first
      try {
        const dbCusts = await apiCall(`/customers?search=${encodeURIComponent(cleanGstin)}`);
        const existing = dbCusts.find(c => c.gstin && c.gstin.trim().toUpperCase() === cleanGstin);
        if (existing) {
          return {
            companyName: existing.company_name,
            contactPerson: existing.contact_person || '',
            phone: existing.phone || '',
            email: existing.email || '',
            address: existing.address || '',
            city: existing.city || '',
            state: existing.state || '',
            pincode: existing.pincode || '',
            gstin: cleanGstin,
            status: 'Active',
            foundInDb: true
          };
        }
      } catch (e) {
        console.warn('Failed to query customers by GST from backend.');
      }

      // 2. Check local preset
      if (KNOWN_GST_DATABASE[cleanGstin]) {
        return {
          ...KNOWN_GST_DATABASE[cleanGstin],
          gstin: cleanGstin,
          status: 'Active',
          foundInDb: true
        };
      }

      // 3. Decode GST details
      if (cleanGstin.length === 15 && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGstin)) {
        const stateCode = cleanGstin.slice(0, 2);
        const pan = cleanGstin.slice(2, 12);
        const stateInfo = GST_STATE_MAP[stateCode] || { state: 'India', city: 'Transport Hub' };

        const formattedName = `GST ENTITY ${pan} (${stateInfo.state})`;

        return {
          companyName: formattedName,
          contactPerson: 'Authorized Signatory',
          phone: '',
          email: '',
          address: `Industrial Area, ${stateInfo.city}, ${stateInfo.state}`,
          city: stateInfo.city,
          state: stateInfo.state,
          pincode: `${stateCode}0001`,
          gstin: cleanGstin,
          pan: pan,
          status: 'Active Verified GSTIN',
          foundInDb: false
        };
      }

      return null;
    },

    async onGSTINInputCustomer(gstin) {
      if (gstin && gstin.trim().length === 15) {
        await this.fetchGSTDetailsCustomer();
      }
    },

    async fetchGSTDetailsCustomer() {
      const gstinInput = document.getElementById('custGstin');
      const statusDiv = document.getElementById('custGstStatus');
      if (!gstinInput) return;

      const gstin = gstinInput.value;
      const data = await this.fetchGSTDetails(gstin);

      if (data) {
        document.getElementById('custName').value = data.companyName || '';
        document.getElementById('custContact').value = data.contactPerson || '';
        document.getElementById('custPhone').value = data.phone || '';
        document.getElementById('custEmail').value = data.email || '';
        document.getElementById('custCity').value = data.city || '';
        document.getElementById('custState').value = data.state || '';
        document.getElementById('custPincode').value = data.pincode || '';
        document.getElementById('custAddress').value = data.address || '';

        if (statusDiv) {
          statusDiv.style.color = '#166534';
          statusDiv.innerHTML = `✅ <strong>Verified Active GSTIN</strong> (${data.companyName} - ${data.state} [State Code: ${gstin.trim().slice(0,2)}])`;
        }
      } else {
        if (statusDiv) {
          statusDiv.style.color = '#dc2626';
          statusDiv.innerHTML = `⚠️ <strong>Invalid or Unverified GSTIN.</strong> Must be 15 alphanumeric characters.`;
        }
      }
    },

    async fetchAndFillConsignorFromGSTIN() {
      const input = document.getElementById('lrFormGstinLookup');
      if (!input || !input.value) {
        alert('Please enter a 15-digit GSTIN first.');
        return;
      }
      const data = await this.fetchGSTDetails(input.value);
      if (data) {
        document.getElementById('lrFormConsignor').value = data.companyName;
        if (data.city) document.getElementById('lrFormFrom').value = data.city;
        await this.populateFormDatalists();
        alert(`✅ Consignor set to "${data.companyName}" (${data.city}, ${data.state}) from GSTIN: ${data.gstin}`);
      } else {
        alert('⚠️ Invalid GSTIN format. Please enter a valid 15-digit GSTIN.');
      }
    },

    async fetchAndFillConsigneeFromGSTIN() {
      const input = document.getElementById('lrFormGstinLookup');
      if (!input || !input.value) {
        alert('Please enter a 15-digit GSTIN first.');
        return;
      }
      const data = await this.fetchGSTDetails(input.value);
      if (data) {
        document.getElementById('lrFormConsignee').value = data.companyName;
        if (data.city) document.getElementById('lrFormTo').value = data.city;
        await this.populateFormDatalists();
        alert(`✅ Consignee set to "${data.companyName}" (${data.city}, ${data.state}) from GSTIN: ${data.gstin}`);
      } else {
        alert('⚠️ Invalid GSTIN format. Please enter a valid 15-digit GSTIN.');
      }
    },

    async setCompanyFilter(companyId) {
      currentCompanyFilter = companyId;
      currentPage = 1;
      await this.renderAll();
    },

    async setStatusFilter(status) {
      currentStatusFilter = status;
      currentPage = 1;
      await this.renderAll();
    },

    async setSearchQuery(q) {
      currentSearchQuery = q;
      currentPage = 1;
      await this.renderAll();
    },

    // Pagination Click events
    async nextPage() {
      if (currentPage < totalPages) {
        currentPage++;
        await this.renderLRTable();
      }
    },

    async prevPage() {
      if (currentPage > 1) {
        currentPage--;
        await this.renderLRTable();
      }
    },

    async loadCompanies() {
      try {
        const res = await fetch('http://localhost:5000/api/companies');
        const list = await res.json();
        list.forEach(c => {
          COMPANIES[c.id] = {
            id: c.id,
            name: c.name,
            shortName: c.short_name,
            shortCode: c.short_code,
            prefix: c.prefix,
            phone: c.phone,
            email: c.email,
            address: c.address,
            pan: c.pan,
            gstin: c.gstin,
            state: c.state,
            stateCode: c.state_code,
            logo: c.logo,
            terms: c.terms,
            declaration: c.declaration,
            bankName: c.bank_name,
            bankAccNo: c.bank_acc_no,
            bankIfsc: c.bank_ifsc,
            bankBranch: c.bank_branch
          };
        });
      } catch (e) {
        console.error('Error fetching companies cache in LRManager:', e);
      }
    },

    async init() {
      console.log('Multi-Company LR Management Database Engine Initialized');
      await this.loadCompanies();
      this.bindEvents();
      await this.renderAll();
    },

    bindEvents() {
      // Filter switchers
      const coSelect = document.getElementById('lrCompanyFilterSelect');
      if (coSelect) {
        coSelect.addEventListener('change', async (e) => {
          await this.setCompanyFilter(e.target.value);
        });
      }

      const stSelect = document.getElementById('lrStatusFilterSelect');
      if (stSelect) {
        stSelect.addEventListener('change', async (e) => {
          await this.setStatusFilter(e.target.value);
        });
      }

      const searchInput = document.getElementById('lrSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
          await this.setSearchQuery(e.target.value);
        });
      }
    },

    async renderAll() {
      try {
        await this.renderDashboardStats();
        await this.renderLRTable();
        await this.renderCustomerTable();
        await this.renderVehicleTable();
        await this.renderDriverTable();
      } catch (err) {
        console.error('Render error:', err);
      }
    },

    async renderDashboardStats() {
      try {
        const stats = await apiCall(`/dashboard/stats?companyId=${currentCompanyFilter}`);
        
        const elTotal = document.getElementById('statLrTotal');
        if (elTotal) elTotal.innerText = stats.totalLrs;

        const elChitkote = document.getElementById('statLrChitkote');
        if (elChitkote) elChitkote.innerText = stats.chitkoteCount;

        const elStnt = document.getElementById('statLrStnt');
        if (elStnt) elStnt.innerText = stats.sttcCount;

        const elFreight = document.getElementById('statLrFreight');
        if (elFreight) elFreight.innerText = '₹ ' + stats.totalFreight.toLocaleString('en-IN', {maximumFractionDigits: 0});

        const elPod = document.getElementById('statLrPendingPod');
        if (elPod) elPod.innerText = stats.pendingPod;

        const elToPay = document.getElementById('statLrTotalToPay');
        if (elToPay) elToPay.innerText = '₹ ' + stats.totalToPay.toLocaleString('en-IN', {maximumFractionDigits: 0});
      } catch (e) {
        console.warn('Could not load dashboard stats from backend.');
      }
    },

    async renderLRTable() {
      const tbody = document.getElementById('lrTableBody');
      if (!tbody) return;

      try {
        const response = await apiCall(`/lrs?companyId=${currentCompanyFilter}&status=${currentStatusFilter}&search=${encodeURIComponent(currentSearchQuery)}&page=${currentPage}&limit=10`);
        const { records, pagination } = response;
        totalPages = pagination.totalPages || 1;

        // Render page indicator text
        const pageInfoSpan = document.getElementById('lrPaginationInfo');
        if (pageInfoSpan) {
          const start = (currentPage - 1) * 10 + 1;
          const end = Math.min(currentPage * 10, pagination.totalRecords);
          pageInfoSpan.innerText = pagination.totalRecords > 0 
            ? `Showing ${start} to ${end} of ${pagination.totalRecords} entries`
            : `Showing 0 to 0 of 0 entries`;
        }

        // Enable / Disable Pagination Buttons
        const prevBtn = document.getElementById('btnLrPrevPage');
        const nextBtn = document.getElementById('btnLrNextPage');
        if (prevBtn) prevBtn.disabled = (currentPage === 1);
        if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);

        if (records.length === 0) {
          tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#64748b;">No Lorry Receipts (LRs) found matching the selected filters.</td></tr>`;
          return;
        }

        tbody.innerHTML = records.map(lr => {
          const company = COMPANIES[lr.company_id] || COMPANIES.CHITKOTE;
          const statusBadgeClass = {
            'Draft': 'status-draft',
            'Dispatched': 'status-dispatched',
            'In Transit': 'status-intransit',
            'Delivered': 'status-approved',
            'POD Uploaded': 'status-approved',
            'Billed': 'status-billed'
          }[lr.status] || 'status-draft';

          return `
            <tr>
              <td>
                <strong style="color:#0f172a;">${lr.lr_no}</strong>
                <div style="font-size:0.78rem; color:#64748b;">${lr.date}</div>
              </td>
              <td>
                <span class="company-badge-pill ${lr.company_id === 'CHITKOTE' ? 'co-chitkote' : 'co-stnt'}">
                  ${company.shortCode}
                </span>
                <div style="font-size:0.82rem; font-weight:600; margin-top:2px;">${company.name}</div>
              </td>
              <td>
                <div style="font-weight:600; color:#1e293b;">${lr.consignor_name}</div>
                <div style="font-size:0.8rem; color:#64748b;">➡️ ${lr.consignee_name}</div>
              </td>
              <td>
                <span class="badge-mini" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;">${lr.vehicle_no}</span>
                <div style="font-size:0.78rem; color:#475569; font-weight:500;">👤 Driver: ${lr.driver_name || 'N/A'}</div>
                <div style="font-size:0.78rem; color:#64748b;">${lr.from_location} to ${lr.to_location}</div>
              </td>
              <td>
                <strong style="color:#0f172a;">₹ ${Number(lr.total_amount).toLocaleString('en-IN')}</strong>
                <div style="font-size:0.78rem; color:#e04f00;">To Pay: ₹ ${Number(lr.to_pay_amount).toLocaleString('en-IN')}</div>
              </td>
              <td>
                <span class="dash-status-pill ${statusBadgeClass}">${lr.status}</span>
              </td>
              <td>
                ${lr.pod_document ? 
                  `<span style="color:#166534; font-size:0.82rem; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    Uploaded
                  </span>` : 
                  `<button type="button" class="btn-sm-action btn-upload-pod" onclick="LRManager.openPODModal('${lr.id}')">Upload POD</button>`
                }
              </td>
              <td>
                <div style="display:flex; gap:6px;">
                  <button type="button" class="btn-action-icon" title="View / Print PDF Bilty" onclick="LRManager.viewBiltyPDF('${lr.id}')">
                    🖨️
                  </button>
                  <button type="button" class="btn-action-icon" title="Share via WhatsApp" onclick="LRManager.shareWhatsApp('${lr.id}')">
                    💬
                  </button>
                  <button type="button" class="btn-action-icon" title="Edit LR Report" onclick="LRManager.openEditLRModal('${lr.id}')">
                    ✏️
                  </button>
                  <button type="button" class="btn-action-icon" title="Delete LR" onclick="LRManager.deleteLR('${lr.id}')" style="color:#b91c1c;">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#dc2626;">Failed to communicate with Relational DB Server on port 5000.</td></tr>`;
      }
    },

    async renderCustomerTable() {
      const tbody = document.getElementById('lrCustomerTableBody');
      if (!tbody) return;
      try {
        const customers = await this.getCustomersFromAPI();
        tbody.innerHTML = customers.map(c => `
          <tr>
            <td><strong>${c.id}</strong></td>
            <td>
              <div style="font-weight:600; color:#1e293b;">${c.company_name}</div>
              <div style="font-size:0.8rem; color:#64748b;">${c.address || ''}, ${c.city || ''}, ${c.state || ''}</div>
            </td>
            <td>
              <div style="font-weight:500; font-family:monospace;">${c.gstin || 'N/A'}</div>
              <div style="font-size:0.8rem; color:#64748b;">Pincode: ${c.pincode || 'N/A'}</div>
            </td>
            <td>
              <div>${c.contact_person || ''}</div>
              <div style="font-size:0.8rem; color:#0369a1;">📞 ${c.phone || 'N/A'}</div>
            </td>
            <td><span class="badge-mini">${c.customer_type}</span></td>
            <td>
              <button type="button" class="btn-sm-action" onclick="LRManager.deleteCustomer('${c.id}')" style="color:#b91c1c; border-color:#fecaca;">Delete</button>
            </td>
          </tr>
        `).join('');
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:12px;">Failed to load customers from relational database</td></tr>`;
      }
    },

    async renderVehicleTable() {
      const tbody = document.getElementById('lrVehicleTableBody');
      if (!tbody) return;
      try {
        const vehicles = await this.getVehiclesFromAPI();
        tbody.innerHTML = vehicles.map(v => `
          <tr>
            <td><strong style="color:#0369a1; font-size:1rem;">${v.vehicle_number}</strong></td>
            <td>${v.vehicle_type}</td>
            <td><strong>${v.capacity_tons || 0} Tons</strong></td>
            <td><span class="badge-mini">${v.owner_type}</span></td>
            <td>
              <div>${v.driver_name || 'N/A'}</div>
              <div style="font-size:0.8rem; color:#64748b;">📞 ${v.driver_phone || 'N/A'}</div>
            </td>
            <td>
              <div style="font-size:0.82rem;">RC Exp: <strong>${v.rc_expiry || 'N/A'}</strong></div>
              <div style="font-size:0.82rem; color:#b91c1c;">Ins Exp: <strong>${v.insurance_expiry || 'N/A'}</strong></div>
            </td>
          </tr>
        `).join('');
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:12px;">Failed to load vehicles list</td></tr>`;
      }
    },

    async renderDriverTable() {
      const tbody = document.getElementById('lrDriverTableBody');
      if (!tbody) return;
      try {
        const drivers = await this.getDriversFromAPI();
        tbody.innerHTML = drivers.map(d => `
          <tr>
            <td><strong>${d.driver_name}</strong></td>
            <td><span style="font-family:monospace; font-weight:600;">${d.license_number}</span></td>
            <td>📞 ${d.phone || 'N/A'}</td>
            <td>${d.experience_years || 0} Years</td>
            <td>Exp: <strong>${d.license_expiry || 'N/A'}</strong></td>
          </tr>
        `).join('');
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:12px;">Failed to load drivers database</td></tr>`;
      }
    },

    async populateFormDatalists() {
      // Pull dynamic autocomplete sets from backend APIs
      const customers = await this.getCustomersFromAPI();
      const vehicles = await this.getVehiclesFromAPI();
      const drivers = await this.getDriversFromAPI();

      // Consignors
      const consignorDl = document.getElementById('consignorDatalist');
      if (consignorDl) {
        consignorDl.innerHTML = customers.map(c => `<option value="${c.company_name}">${c.city ? c.city + ' - ' : ''}${c.gstin || ''}</option>`).join('');
      }

      // Consignees
      const consigneeDl = document.getElementById('consigneeDatalist');
      if (consigneeDl) {
        consigneeDl.innerHTML = customers.map(c => `<option value="${c.company_name}">${c.city ? c.city + ' - ' : ''}${c.gstin || ''}</option>`).join('');
      }

      // Vehicles
      const vehicleDl = document.getElementById('vehicleDatalist');
      if (vehicleDl) {
        vehicleDl.innerHTML = vehicles.map(v => `<option value="${v.vehicle_number}">${v.vehicle_type} (${v.driver_name || 'No Driver'})</option>`).join('');
      }

      // Drivers
      const driverDl = document.getElementById('driverDatalist');
      if (driverDl) {
        driverDl.innerHTML = drivers.map(d => `<option value="${d.driver_name}">${d.phone ? 'Phone: ' + d.phone : ''}</option>`).join('');
      }

      // Cities autocomplete (from database)
      const citiesSet = new Set(['Hyderabad', 'Chennai', 'Coimbatore', 'Hosur', 'Bangalore', 'Mumbai', 'Vijayawada']);
      customers.forEach(c => { if (c.city) citiesSet.add(c.city); });

      const cityOptionsHtml = Array.from(citiesSet).map(city => `<option value="${city}">`).join('');

      const fromCityDl = document.getElementById('fromCityDatalist');
      if (fromCityDl) fromCityDl.innerHTML = cityOptionsHtml;

      const toCityDl = document.getElementById('toCityDatalist');
      if (toCityDl) toCityDl.innerHTML = cityOptionsHtml;
    },

    async openCreateLRModal() {
      const modal = document.getElementById('lrCreateModal');
      const form = document.getElementById('lrCreateForm');
      if (!modal || !form) return;

      form.reset();
      document.getElementById('lrModalHeading').innerText = 'Create New Lorry Receipt (LR / Bilty)';
      document.getElementById('lrEditId').value = '';

      // Reset ancillary fields explicitly
      document.getElementById('lrFormLoading').value = 0;
      document.getElementById('lrFormUnloading').value = 0;
      document.getElementById('lrFormToll').value = 0;
      document.getElementById('lrFormDetention').value = 0;
      document.getElementById('lrFormOtherCharges').value = 0;

      await this.populateFormDatalists();

      const companySel = document.getElementById('lrFormCompany');
      await this.onCompanyChangeInForm(companySel ? companySel.value : 'CHITKOTE');
      document.getElementById('lrFormDate').value = new Date().toISOString().split('T')[0];

      modal.style.display = 'flex';
    },

    async onCompanyChangeInForm(companyId) {
      const company = COMPANIES[companyId] || COMPANIES.CHITKOTE;
      // LR Number is automatically computed by server transaction, show a temporary tag
      document.getElementById('lrFormNo').value = `[Auto-Gen Sequence: ${company.prefix}]`;
    },

    onConsignorChangeInForm(consignorName) {
      const c = customersCache.find(item => item.company_name.toLowerCase() === consignorName.toLowerCase());
      if (c && c.city) {
        document.getElementById('lrFormFrom').value = c.city;
      }
    },

    onConsigneeChangeInForm(consigneeName) {
      const c = customersCache.find(item => item.company_name.toLowerCase() === consigneeName.toLowerCase());
      if (c && c.city) {
        document.getElementById('lrFormTo').value = c.city;
      }
    },

    onVehicleChangeInForm(vehicleNo) {
      const v = vehiclesCache.find(item => item.vehicle_number.toLowerCase() === vehicleNo.toLowerCase());
      if (v && v.driver_name) {
        const driverInput = document.getElementById('lrFormDriver');
        if (driverInput) driverInput.value = v.driver_name;
        document.getElementById('lrFormDriverPhone').value = v.driver_phone || '';
      }
    },

    onDriverChangeInForm(driverName) {
      const d = driversCache.find(item => item.driver_name.toLowerCase() === driverName.toLowerCase());
      if (d) {
        document.getElementById('lrFormDriverPhone').value = d.phone || '';
      }
    },

    autoCalculateFreightInForm() {
      const weight = parseFloat(document.getElementById('lrFormWeight').value) || 0;
      const rate = parseFloat(document.getElementById('lrFormRate').value) || 0;
      const gstPct = parseFloat(document.getElementById('lrFormGstPct').value) || 0;
      const advance = parseFloat(document.getElementById('lrFormAdvance').value) || 0;

      // Extract new ancillary charges
      const loading = parseFloat(document.getElementById('lrFormLoading').value) || 0;
      const unloading = parseFloat(document.getElementById('lrFormUnloading').value) || 0;
      const toll = parseFloat(document.getElementById('lrFormToll').value) || 0;
      const detention = parseFloat(document.getElementById('lrFormDetention').value) || 0;
      const otherCharges = parseFloat(document.getElementById('lrFormOtherCharges').value) || 0;

      const basicFreight = weight * rate;
      const taxableAmount = basicFreight + loading + unloading + toll + detention + otherCharges;
      const gstAmt = (taxableAmount * gstPct) / 100;
      const totalAmt = taxableAmount + gstAmt;
      const toPay = totalAmt - advance;

      document.getElementById('lrFormFreightAmt').value = basicFreight.toFixed(2);
      document.getElementById('lrFormGstAmt').value = gstAmt.toFixed(2);
      document.getElementById('lrFormTotalAmt').value = totalAmt.toFixed(2);
      document.getElementById('lrFormToPay').value = toPay.toFixed(2);
      document.getElementById('lrFormWords').value = numberToWordsIndian(totalAmt);
    },

    async saveLRFromForm() {
      const editId = document.getElementById('lrEditId').value;
      const companyId = document.getElementById('lrFormCompany').value;
      const date = document.getElementById('lrFormDate').value;
      const freightPaidBy = document.getElementById('lrFormFreightPaidBy').value;
      const vehicleNo = document.getElementById('lrFormVehicle').value;
      const driverName = document.getElementById('lrFormDriver') ? document.getElementById('lrFormDriver').value : '';
      const driverPhone = document.getElementById('lrFormDriverPhone') ? document.getElementById('lrFormDriverPhone').value : '';
      const consignorName = document.getElementById('lrFormConsignor').value;
      const consigneeName = document.getElementById('lrFormConsignee').value;
      const fromLoc = document.getElementById('lrFormFrom').value;
      const toLoc = document.getElementById('lrFormTo').value;
      const ewayBillNo = document.getElementById('lrFormEway').value;
      const invoiceNo = document.getElementById('lrFormInvoiceNo').value;
      const invoiceValue = document.getElementById('lrFormInvoiceVal').value;

      // Inputs calculations
      const description = document.getElementById('lrFormDesc').value || 'General Goods';
      const weight = parseFloat(document.getElementById('lrFormWeight').value) || 0;
      const packets = parseInt(document.getElementById('lrFormPackets').value) || 1;
      const unit = document.getElementById('lrFormUnit').value || 'Tonnes';
      const rate = parseFloat(document.getElementById('lrFormRate').value) || 0;

      const loadingCharges = parseFloat(document.getElementById('lrFormLoading').value) || 0;
      const unloadingCharges = parseFloat(document.getElementById('lrFormUnloading').value) || 0;
      const tollCharges = parseFloat(document.getElementById('lrFormToll').value) || 0;
      const detentionCharges = parseFloat(document.getElementById('lrFormDetention').value) || 0;
      const otherCharges = parseFloat(document.getElementById('lrFormOtherCharges').value) || 0;

      const freightAmt = weight * rate;
      const gstPct = parseFloat(document.getElementById('lrFormGstPct').value) || 0;
      const advance = parseFloat(document.getElementById('lrFormAdvance').value) || 0;
      const remarks = document.getElementById('lrFormRemarks').value || 'Company is not responsible for leakages & thefts';

      // Validation
      if (!companyId || !date || !vehicleNo || !consignorName || !consigneeName || !fromLoc || !toLoc) {
        alert('Please fill out all required fields marked with *');
        return;
      }

      const bodyPayload = {
        companyId,
        date,
        freightPaidBy,
        vehicleNo,
        driverName,
        driverPhone,
        consignorName,
        consigneeName,
        fromLocation: fromLoc,
        toLocation: toLoc,
        ewayBillNo,
        invoiceNo,
        invoiceValue,
        freightAmt,
        loadingCharges,
        unloadingCharges,
        tollCharges,
        detentionCharges,
        otherCharges,
        gstPercent: gstPct,
        advanceAmount: advance,
        remarks,
        items: [{ srNo: 1, packets, description, weight, unit, rate, freightAmt }]
      };

      try {
        let response;
        if (editId) {
          response = await apiCall(`/lrs/${editId}`, 'PUT', bodyPayload);
          alert('✅ Lorry Receipt updated successfully!');
        } else {
          response = await apiCall('/lrs', 'POST', bodyPayload);
          alert(`✅ Lorry Receipt issued successfully! Number: ${response.lrNo}`);
        }

        document.getElementById('lrCreateModal').style.display = 'none';
        await this.renderAll();

        // View PDF immediately on successful issue/edit
        const newRecordId = editId || response.id;
        await this.viewBiltyPDF(newRecordId);
      } catch (err) {
        alert(`⚠️ Failed to save LR in database: ${err.message}`);
      }
    },

    async openEditLRModal(id) {
      try {
        const lr = await apiCall(`/lrs/${id}`);
        
        await this.openCreateLRModal();
        document.getElementById('lrModalHeading').innerText = `Edit Lorry Receipt (Bilty): ${lr.lr_no}`;
        document.getElementById('lrEditId').value = lr.id;

        document.getElementById('lrFormCompany').value = lr.company_id;
        document.getElementById('lrFormNo').value = lr.lr_no;
        document.getElementById('lrFormDate').value = lr.date;
        document.getElementById('lrFormFreightPaidBy').value = lr.freight_paid_by;
        document.getElementById('lrFormVehicle').value = lr.vehicle_no;

        if (document.getElementById('lrFormDriver') && lr.driver_name) {
          document.getElementById('lrFormDriver').value = lr.driver_name;
        }
        if (document.getElementById('lrFormDriverPhone')) {
          document.getElementById('lrFormDriverPhone').value = lr.driver_phone || '';
        }

        document.getElementById('lrFormConsignor').value = lr.consignor_name;
        document.getElementById('lrFormConsignee').value = lr.consignee_name;
        document.getElementById('lrFormFrom').value = lr.from_location;
        document.getElementById('lrFormTo').value = lr.to_location;
        document.getElementById('lrFormEway').value = lr.eway_bill_no || '';
        document.getElementById('lrFormInvoiceNo').value = lr.invoice_no || '';
        document.getElementById('lrFormInvoiceVal').value = lr.invoice_value || '';

        // Populate ancillary charges
        document.getElementById('lrFormLoading').value = lr.loading_charges || 0;
        document.getElementById('lrFormUnloading').value = lr.unloading_charges || 0;
        document.getElementById('lrFormToll').value = lr.toll_charges || 0;
        document.getElementById('lrFormDetention').value = lr.detention_charges || 0;
        document.getElementById('lrFormOtherCharges').value = lr.other_charges || 0;

        const item = (lr.items && lr.items[0]) || {};
        document.getElementById('lrFormDesc').value = item.description || '';
        document.getElementById('lrFormWeight').value = item.weight || '';
        document.getElementById('lrFormPackets').value = item.packets || 1;
        document.getElementById('lrFormUnit').value = item.unit || 'Tonnes';
        document.getElementById('lrFormRate').value = item.rate || '';
        document.getElementById('lrFormFreightAmt').value = lr.freight_amt || '';
        document.getElementById('lrFormGstPct').value = lr.gst_percent || 0;
        document.getElementById('lrFormGstAmt').value = lr.gst_amount || 0;
        document.getElementById('lrFormTotalAmt').value = lr.total_amount || '';
        document.getElementById('lrFormAdvance').value = lr.advance_amount || 0;
        document.getElementById('lrFormToPay').value = lr.to_pay_amount || '';
        document.getElementById('lrFormRemarks').value = lr.remarks || '';
      } catch (err) {
        alert('Failed to retrieve LR details from database.');
      }
    },

    async editFromViewModal() {
      const viewModal = document.getElementById('lrViewModal');
      if (!viewModal) return;
      const currentId = viewModal.getAttribute('data-current-lr');
      viewModal.style.display = 'none';
      if (currentId) {
        await this.openEditLRModal(currentId);
      }
    },

    async viewBiltyPDF(id) {
      try {
        const lr = await apiCall(`/lrs/${id}`);
        const modal = document.getElementById('lrViewModal');
        const body = document.getElementById('lrViewModalBody');
        if (!modal || !body) return;

        body.innerHTML = this.renderBiltyHTML(lr);
        modal.setAttribute('data-current-lr', id);
        modal.style.display = 'flex';
      } catch (e) {
        alert('Failed to render PDF Bilty. Server offline?');
      }
    },

    printCurrentBilty() {
      const body = document.getElementById('lrViewModalBody');
      if (!body) return;

      const printWindow = window.open('', '_blank', 'width=900,height=700');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Lorry Receipt - Print Bilty</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #fff; }
            @media print {
              body { padding: 0; }
              @page { size: auto; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          ${body.innerHTML}
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 300);
    },

    async shareWhatsApp(id) {
      try {
        const lr = await apiCall(`/lrs/${id}`);
        const url = buildWhatsAppShareURL(lr);
        window.open(url, '_blank');
      } catch (e) {
        alert('Error sharing LR via WhatsApp.');
      }
    },

    async deleteLR(id) {
      if (!confirm('⚠️ WARNING: Are you sure you want to permanently delete this Lorry Receipt (LR) from the database? This cannot be undone.')) return;
      try {
        await apiCall(`/lrs/${id}`, 'DELETE');
        alert('✅ Lorry Receipt deleted permanently.');
        await this.renderAll();
      } catch (e) {
        alert(`Failed to delete LR: ${e.message}`);
      }
    },

    async openPODModal(id) {
      try {
        const lr = await apiCall(`/lrs/${id}`);
        const modal = document.getElementById('lrPodModal');
        if (!modal) return;

        document.getElementById('podLrId').value = lr.id;
        document.getElementById('podLrTitle').innerText = `${lr.lr_no} (${lr.vehicle_no})`;
        document.getElementById('podStatusSelect').value = lr.status;
        modal.style.display = 'flex';
      } catch (e) {
        alert('Could not open POD modal.');
      }
    },

    async savePODModal() {
      const id = document.getElementById('podLrId').value;
      const fileInput = document.getElementById('podFileInput');
      const newStatus = document.getElementById('podStatusSelect').value;

      const payload = {
        status: newStatus,
        podDocument: (fileInput.files && fileInput.files[0]) ? fileInput.files[0].name : null
      };

      try {
        await apiCall(`/lrs/${id}/pod`, 'PUT', payload);
        alert('✅ Proof of Delivery (POD) record updated successfully.');
        document.getElementById('lrPodModal').style.display = 'none';
        await this.renderAll();
      } catch (e) {
        alert('Failed to save POD record: ' + e.message);
      }
    },

    // Customer Master CRUD
    openCustomerModal() {
      const modal = document.getElementById('customerModal');
      if (modal) modal.style.display = 'flex';
    },

    async saveCustomer() {
      const companyName = document.getElementById('custName').value;
      const gstin = document.getElementById('custGstin').value;
      const contactPerson = document.getElementById('custContact').value;
      const phone = document.getElementById('custPhone').value;
      const email = document.getElementById('custEmail').value;
      const city = document.getElementById('custCity').value;
      const state = document.getElementById('custState').value;
      const pincode = document.getElementById('custPincode').value;
      const address = document.getElementById('custAddress').value;
      const type = document.getElementById('custType').value;

      if (!companyName) {
        alert('Company Name is required!');
        return;
      }

      const payload = {
        companyName,
        gstin,
        pan: gstin ? gstin.slice(2, 12) : null,
        contactPerson,
        phone,
        email,
        address,
        city,
        state,
        pincode,
        customerType: type
      };

      try {
        await apiCall('/customers', 'POST', payload);
        alert('✅ Customer Master saved permanently!');
        document.getElementById('customerModal').style.display = 'none';
        await this.renderAll();
      } catch (e) {
        alert(`⚠️ Failed to save Customer Master: ${e.message}`);
      }
    },

    async deleteCustomer(id) {
      if (!confirm('Are you sure you want to delete this customer master?')) return;
      try {
        await apiCall(`/customers/${id}`, 'DELETE');
        alert('✅ Customer master deleted.');
        await this.renderAll();
      } catch (e) {
        alert('Failed to delete customer.');
      }
    },

    // Vehicle Master CRUD
    openVehicleModal() {
      const modal = document.getElementById('vehicleModal');
      if (modal) modal.style.display = 'flex';
    },

    async saveVehicle() {
      const vehicleNumber = document.getElementById('vehNumber').value;
      const vehicleType = document.getElementById('vehType').value;
      const capacityTons = parseFloat(document.getElementById('vehCapacity').value) || 0;
      const ownerType = document.getElementById('vehOwnerType').value;
      const driverName = document.getElementById('vehDriverName').value;
      const driverPhone = document.getElementById('vehDriverPhone').value;
      const rcExpiry = document.getElementById('vehRcExp').value;
      const insuranceExpiry = document.getElementById('vehInsExp').value;

      if (!vehicleNumber) {
        alert('Vehicle number is required!');
        return;
      }

      const payload = {
        vehicleNumber,
        vehicleType,
        capacityTons,
        ownerType,
        driverName,
        driverPhone,
        rcExpiry,
        insuranceExpiry
      };

      try {
        await apiCall('/vehicles', 'POST', payload);
        alert('✅ Vehicle Master saved permanently!');
        document.getElementById('vehicleModal').style.display = 'none';
        await this.renderAll();
      } catch (e) {
        alert(`⚠️ Failed to save Vehicle: ${e.message}`);
      }
    },

    // Driver Master CRUD
    openDriverModal() {
      const modal = document.getElementById('driverModal');
      if (modal) modal.style.display = 'flex';
    },

    async saveDriver() {
      const driverName = document.getElementById('drvName').value;
      const licenseNumber = document.getElementById('drvLicense').value;
      const phone = document.getElementById('drvPhone').value;
      const licenseExpiry = document.getElementById('drvExp').value;
      const experienceYears = parseInt(document.getElementById('drvYrs').value) || 1;

      if (!driverName || !licenseNumber) {
        alert('Driver Name and License Number are required!');
        return;
      }

      const payload = {
        driverName,
        licenseNumber,
        phone,
        licenseExpiry,
        experienceYears
      };

      try {
        await apiCall('/drivers', 'POST', payload);
        alert('✅ Driver Master saved permanently!');
        document.getElementById('driverModal').style.display = 'none';
        await this.renderAll();
      } catch (e) {
        alert(`⚠️ Failed to save Driver: ${e.message}`);
      }
    },

    // Exports
    async exportTallyXML() {
      try {
        const response = await apiCall(`/reports?type=tally&companyId=${currentCompanyFilter}&search=${encodeURIComponent(currentSearchQuery)}`);
        if (response.length === 0) {
          alert('No LRs available to export.');
          return;
        }
        const xmlData = generateTallyXML(response);
        const blob = new Blob([xmlData], { type: 'text/xml;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Tally_Sales_Vouchers_LR_${new Date().toISOString().split('T')[0]}.xml`;
        link.click();
      } catch (e) {
        alert('Failed to compile export data.');
      }
    },

    async exportRegisterCSV() {
      try {
        const response = await apiCall(`/reports?type=csv&companyId=${currentCompanyFilter}&search=${encodeURIComponent(currentSearchQuery)}`);
        if (response.length === 0) {
          alert('No LRs available to export.');
          return;
        }

        const headers = [
          'LR No', 'Date', 'Company', 'Consignor', 'Consignee', 'Vehicle No', 'From', 'To',
          'Basic Freight', 'Loading Charges', 'Unloading Charges', 'Toll Charges', 'Detention Charges',
          'Other Charges', 'Taxable Amt', 'GST %', 'GST Amt', 'Total Amt', 'Advance', 'To Pay', 'Status'
        ];
        
        const rows = response.map(l => [
          `"${l.lr_no}"`,
          `"${l.date}"`,
          `"${COMPANIES[l.company_id] ? COMPANIES[l.company_id].name : l.company_id}"`,
          `"${l.consignor_name}"`,
          `"${l.consignee_name}"`,
          `"${l.vehicle_no}"`,
          `"${l.from_location}"`,
          `"${l.to_location}"`,
          l.freight_amt,
          l.loading_charges,
          l.unloading_charges,
          l.toll_charges,
          l.detention_charges,
          l.other_charges,
          l.taxable_amount,
          l.gst_percent,
          l.gst_amount,
          l.total_amount,
          l.advance_amount,
          l.to_pay_amount,
          `"${l.status}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `LR_Register_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        alert('Failed to compile export data.');
      }
    }
  };
})();

// Auto-boot on DOM ready or immediate if already loaded
function bootLRManager() {
  if (typeof LRManager !== 'undefined' && (document.getElementById('mainTabContentLRModule') || document.getElementById('lrTableBody'))) {
    LRManager.init();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootLRManager);
} else {
  bootLRManager();
}

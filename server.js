const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
require('dotenv').config();

const { db, initializeDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allow CORS from any origin (e.g. file:// or http://localhost:8080)
app.use(bodyParser.json());
app.use(morgan('dev'));

// Helper for audit logs
async function logAudit(action, tableName, recordId, oldValue, newValue, user = 'Deskside Admin') {
  try {
    await db('audit_logs').insert({
      action,
      table_name: tableName,
      record_id: String(recordId),
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      user
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// -------------------------------------------------------------
// 1. DASHBOARD STATS API
// -------------------------------------------------------------
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const { companyId } = req.query;

    let lrQuery = db('lorry_receipts');
    if (companyId && companyId !== 'ALL') {
      lrQuery = lrQuery.where('company_id', companyId);
    }

    const lrs = await lrQuery.select('*');

    const totalLrs = lrs.length;
    const chitkoteCount = lrs.filter(l => l.company_id === 'CHITKOTE').length;
    const sttcCount = lrs.filter(l => l.company_id === 'SRI_TAMILNADU').length;
    const totalFreight = lrs.reduce((sum, l) => sum + Number(l.total_amount || 0), 0);
    const pendingPod = lrs.filter(l => l.status !== 'Delivered' && l.status !== 'POD Uploaded' && l.status !== 'Billed' && !l.pod_document).length;
    const totalToPay = lrs.reduce((sum, l) => sum + Number(l.to_pay_amount || 0), 0);

    // Fetch top customers (Consignor-wise)
    const topCustomers = await db('lorry_receipts')
      .select('consignor_name')
      .count('id as count')
      .sum('total_amount as revenue')
      .groupBy('consignor_name')
      .orderBy('revenue', 'desc')
      .limit(5);

    // Fetch top vehicles
    const topVehicles = await db('lorry_receipts')
      .select('vehicle_no')
      .count('id as count')
      .sum('total_amount as revenue')
      .groupBy('vehicle_no')
      .orderBy('revenue', 'desc')
      .limit(5);

    // Recent 5 LRs
    const recentLrs = await db('lorry_receipts')
      .orderBy('created_at', 'desc')
      .limit(5);

    res.json({
      totalLrs,
      chitkoteCount,
      sttcCount,
      totalFreight,
      pendingPod,
      totalToPay,
      topCustomers,
      topVehicles,
      recentLrs
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Server error fetching dashboard statistics' });
  }
});

// -------------------------------------------------------------
// 2. LORRY RECEIPTS (LR) CRUD APIs
// -------------------------------------------------------------

// List LRs with pagination, search, and filters
app.get('/api/lrs', async (req, res) => {
  try {
    const { companyId, status, search, page = 1, limit = 15 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('lorry_receipts');
    let countQuery = db('lorry_receipts');

    if (companyId && companyId !== 'ALL') {
      query = query.where('company_id', companyId);
      countQuery = countQuery.where('company_id', companyId);
    }

    if (status && status !== 'ALL') {
      query = query.where('status', status);
      countQuery = countQuery.where('status', status);
    }

    if (search && search.trim() !== '') {
      const s = `%${search.trim().toLowerCase()}%`;
      const searchFilter = function() {
        this.whereRaw('LOWER(lr_no) LIKE ?', [s])
            .orWhereRaw('LOWER(consignor_name) LIKE ?', [s])
            .orWhereRaw('LOWER(consignee_name) LIKE ?', [s])
            .orWhereRaw('LOWER(vehicle_no) LIKE ?', [s])
            .orWhereRaw('LOWER(driver_name) LIKE ?', [s])
            .orWhereRaw('LOWER(from_location) LIKE ?', [s])
            .orWhereRaw('LOWER(to_location) LIKE ?', [s]);
      };
      query = query.where(searchFilter);
      countQuery = countQuery.where(searchFilter);
    }

    // Get total count for pagination
    const totalRecordsResult = await countQuery.count('id as count').first();
    const totalRecords = totalRecordsResult ? Number(totalRecordsResult.count) : 0;

    // Get data
    const records = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select('*');

    res.json({
      records,
      pagination: {
        totalRecords,
        currentPage: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalRecords / limit)
      }
    });
  } catch (err) {
    console.error('Error listing LRs:', err);
    res.status(500).json({ error: 'Server error listing lorry receipts' });
  }
});

// Get single LR details (with items)
app.get('/api/lrs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const lr = await db('lorry_receipts').where('id', id).first();
    if (!lr) {
      return res.status(404).json({ error: 'Lorry Receipt not found' });
    }

    const items = await db('lorry_receipt_items').where('lr_id', id).orderBy('sr_no', 'asc');
    lr.items = items;

    res.json(lr);
  } catch (err) {
    console.error('Error fetching LR details:', err);
    res.status(500).json({ error: 'Server error fetching lorry receipt details' });
  }
});

// Create LR (Database transaction, duplicate prevention, and auto numbering)
app.post('/api/lrs', async (req, res) => {
  const trx = await db.transaction();
  try {
    const {
      companyId,
      date,
      freightPaidBy,
      vehicleNo,
      driverName,
      driverPhone,
      consignorName,
      consigneeName,
      fromLocation,
      toLocation,
      ewayBillNo,
      invoiceNo,
      invoiceValue,
      items, // array of items
      freightAmt,
      loadingCharges = 0,
      unloadingCharges = 0,
      tollCharges = 0,
      detentionCharges = 0,
      otherCharges = 0,
      gstPercent = 0,
      advanceAmount = 0,
      remarks,
      terms
    } = req.body;

    // Server-side validation
    if (!companyId || !date || !vehicleNo || !consignorName || !consigneeName || !fromLocation || !toLocation) {
      await trx.rollback();
      return res.status(400).json({ error: 'Validation error: Missing required fields.' });
    }

    // 1. Safe auto-increment sequence retrieval for the specific company
    const counterRow = await trx('company_counters').where('company_id', companyId).first();
    if (!counterRow) {
      await trx.rollback();
      return res.status(500).json({ error: `Counter sequence not configured for company branch: ${companyId}` });
    }

    const companyRow = await trx('companies').where('id', companyId).first();
    if (!companyRow) {
      await trx.rollback();
      return res.status(404).json({ error: 'Company not found' });
    }

    const newSeq = counterRow.counter_val + 1;
    const formattedSeq = String(newSeq).padStart(3, '0');
    const autoLrNo = `${companyRow.prefix}${formattedSeq}`;

    // 2. Prevent duplicate LR numbers
    const existingLr = await trx('lorry_receipts').where('lr_no', autoLrNo).first();
    if (existingLr) {
      await trx.rollback();
      return res.status(409).json({ error: `Conflict: Duplicate Lorry Receipt Number generated: ${autoLrNo}. Please retry.` });
    }

    // Auto-save masters for dynamic autocomplete in future
    await autoSaveMasters(trx, consignorName, consigneeName, vehicleNo, driverName, driverPhone, fromLocation, toLocation);

    // Retrieve consignor & consignee details for copying
    const consignorObj = await trx('customers').whereRaw('LOWER(company_name) = ?', [consignorName.toLowerCase()]).first();
    const consigneeObj = await trx('customers').whereRaw('LOWER(company_name) = ?', [consigneeName.toLowerCase()]).first();

    const consignorGstin = consignorObj ? consignorObj.gstin : '';
    const consignorAddress = consignorObj ? consignorObj.address : fromLocation;
    const consignorContact = consignorObj ? consignorObj.phone : '';

    const consigneeGstin = consigneeObj ? consigneeObj.gstin : '';
    const consigneeAddress = consigneeObj ? consigneeObj.address : toLocation;
    const consigneeContact = consigneeObj ? consigneeObj.phone : '';

    // Calculate math on backend to guarantee numeric accuracy
    const numFreight = Number(freightAmt) || 0;
    const numLoading = Number(loadingCharges) || 0;
    const numUnloading = Number(unloadingCharges) || 0;
    const numToll = Number(tollCharges) || 0;
    const numDetention = Number(detentionCharges) || 0;
    const numOther = Number(otherCharges) || 0;
    const numGstPct = Number(gstPercent) || 0;
    const numAdvance = Number(advanceAmount) || 0;

    const taxableAmount = numFreight + numLoading + numUnloading + numToll + numDetention + numOther;
    const gstAmount = (taxableAmount * numGstPct) / 100;
    const totalAmount = taxableAmount + gstAmount;
    const toPayAmount = totalAmount - numAdvance;

    // Convert number to words (Indian Rupees)
    const amountInWords = numberToWordsIndian(totalAmount);

    const newLrId = `LR-${Date.now()}`;

    // 3. Save LR Record
    const newLrRecord = {
      id: newLrId,
      company_id: companyId,
      lr_no: autoLrNo,
      date,
      freight_paid_by: freightPaidBy || 'Consignor',
      vehicle_no: vehicleNo.trim().toUpperCase(),
      driver_name: driverName ? driverName.trim() : null,
      driver_phone: driverPhone ? driverPhone.trim() : null,
      insurance_status: 'The Consignor has NOT insured the consignment',
      delivery_address: consigneeAddress,
      consignor_name: consignorName.trim(),
      consignor_gstin: consignorGstin,
      consignor_address: consignorAddress,
      consignor_contact: consignorContact,
      consignee_name: consigneeName.trim(),
      consignee_gstin: consigneeGstin,
      consignee_address: consigneeAddress,
      consignee_contact: consigneeContact,
      eway_bill_no: ewayBillNo ? ewayBillNo.trim() : null,
      invoice_no: invoiceNo ? invoiceNo.trim() : null,
      invoice_value: invoiceValue ? String(invoiceValue).trim() : null,
      from_location: fromLocation.trim(),
      to_location: toLocation.trim(),
      amount_in_words: amountInWords,
      freight_amt: numFreight,
      loading_charges: numLoading,
      unloading_charges: numUnloading,
      toll_charges: numToll,
      detention_charges: numDetention,
      other_charges: numOther,
      taxable_amount: taxableAmount,
      gst_percent: numGstPct,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      advance_amount: numAdvance,
      to_pay_amount: toPayAmount,
      remarks: remarks || 'Company is not responsible for leakages & thefts',
      terms: terms || companyRow.terms,
      status: 'Dispatched',
      pod_document: null
    };

    await trx('lorry_receipts').insert(newLrRecord);

    // 4. Save items
    if (items && Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map((it, idx) => ({
        lr_id: newLrId,
        sr_no: it.srNo || (idx + 1),
        packets: Number(it.packets) || 1,
        description: it.description || 'General Goods',
        weight: Number(it.weight) || 0,
        unit: it.unit || 'Tonnes',
        rate: Number(it.rate) || 0,
        freight_amt: Number(it.freightAmt) || (Number(it.weight || 0) * Number(it.rate || 0))
      }));
      await trx('lorry_receipt_items').insert(itemsToInsert);
    } else {
      // Create fallback item from direct fields if no nested items array passed
      await trx('lorry_receipt_items').insert({
        lr_id: newLrId,
        sr_no: 1,
        packets: Number(req.body.packets) || 1,
        description: req.body.description || 'General Goods',
        weight: Number(req.body.weight) || 0,
        unit: req.body.unit || 'Tonnes',
        rate: Number(req.body.rate) || 0,
        freight_amt: numFreight
      });
    }

    // 5. Update Company Counter
    await trx('company_counters').where('company_id', companyId).update({ counter_val: newSeq });

    await trx.commit();

    await logAudit('CREATE', 'lorry_receipts', newLrId, null, newLrRecord);
    res.status(201).json({ success: true, id: newLrId, lrNo: autoLrNo });
  } catch (err) {
    await trx.rollback();
    console.error('Error saving Lorry Receipt transaction:', err);
    res.status(500).json({ error: 'Database transaction failed during LR issue: ' + err.message });
  }
});

// Update LR
app.put('/api/lrs/:id', async (req, res) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const oldLr = await trx('lorry_receipts').where('id', id).first();
    if (!oldLr) {
      await trx.rollback();
      return res.status(404).json({ error: 'Lorry Receipt not found' });
    }

    const {
      companyId,
      date,
      freightPaidBy,
      vehicleNo,
      driverName,
      driverPhone,
      consignorName,
      consigneeName,
      fromLocation,
      toLocation,
      ewayBillNo,
      invoiceNo,
      invoiceValue,
      items,
      freightAmt,
      loadingCharges = 0,
      unloadingCharges = 0,
      tollCharges = 0,
      detentionCharges = 0,
      otherCharges = 0,
      gstPercent = 0,
      advanceAmount = 0,
      remarks,
      status
    } = req.body;

    // Auto-save masters for dynamic autocomplete
    await autoSaveMasters(trx, consignorName, consigneeName, vehicleNo, driverName, driverPhone, fromLocation, toLocation);

    // Retrieve consignor & consignee details
    const consignorObj = await trx('customers').whereRaw('LOWER(company_name) = ?', [consignorName.toLowerCase()]).first();
    const consigneeObj = await trx('customers').whereRaw('LOWER(company_name) = ?', [consigneeName.toLowerCase()]).first();

    const consignorGstin = consignorObj ? consignorObj.gstin : '';
    const consignorAddress = consignorObj ? consignorObj.address : fromLocation;
    const consignorContact = consignorObj ? consignorObj.phone : '';

    const consigneeGstin = consigneeObj ? consigneeObj.gstin : '';
    const consigneeAddress = consigneeObj ? consigneeObj.address : toLocation;
    const consigneeContact = consigneeObj ? consigneeObj.phone : '';

    const numFreight = Number(freightAmt) || 0;
    const numLoading = Number(loadingCharges) || 0;
    const numUnloading = Number(unloadingCharges) || 0;
    const numToll = Number(tollCharges) || 0;
    const numDetention = Number(detentionCharges) || 0;
    const numOther = Number(otherCharges) || 0;
    const numGstPct = Number(gstPercent) || 0;
    const numAdvance = Number(advanceAmount) || 0;

    const taxableAmount = numFreight + numLoading + numUnloading + numToll + numDetention + numOther;
    const gstAmount = (taxableAmount * numGstPct) / 100;
    const totalAmount = taxableAmount + gstAmount;
    const toPayAmount = totalAmount - numAdvance;

    const amountInWords = numberToWordsIndian(totalAmount);

    const updatedRecord = {
      company_id: companyId || oldLr.company_id,
      date: date || oldLr.date,
      freight_paid_by: freightPaidBy || oldLr.freight_paid_by,
      vehicle_no: vehicleNo ? vehicleNo.trim().toUpperCase() : oldLr.vehicle_no,
      driver_name: driverName ? driverName.trim() : oldLr.driver_name,
      driver_phone: driverPhone ? driverPhone.trim() : oldLr.driver_phone,
      consignor_name: consignorName ? consignorName.trim() : oldLr.consignor_name,
      consignor_gstin: consignorGstin,
      consignor_address: consignorAddress,
      consignor_contact: consignorContact,
      consignee_name: consigneeName ? consigneeName.trim() : oldLr.consignee_name,
      consignee_gstin: consigneeGstin,
      consignee_address: consigneeAddress,
      consignee_contact: consigneeContact,
      delivery_address: consigneeAddress,
      eway_bill_no: ewayBillNo ? ewayBillNo.trim() : oldLr.eway_bill_no,
      invoice_no: invoiceNo ? invoiceNo.trim() : oldLr.invoice_no,
      invoice_value: invoiceValue ? String(invoiceValue).trim() : oldLr.invoice_value,
      from_location: fromLocation ? fromLocation.trim() : oldLr.from_location,
      to_location: toLocation ? toLocation.trim() : oldLr.to_location,
      amount_in_words: amountInWords,
      freight_amt: numFreight,
      loading_charges: numLoading,
      unloading_charges: numUnloading,
      toll_charges: numToll,
      detention_charges: numDetention,
      other_charges: numOther,
      taxable_amount: taxableAmount,
      gst_percent: numGstPct,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      advance_amount: numAdvance,
      to_pay_amount: toPayAmount,
      remarks: remarks || oldLr.remarks,
      status: status || oldLr.status,
      updated_at: db.fn.now()
    };

    await trx('lorry_receipts').where('id', id).update(updatedRecord);

    // Update items (Delete and recreate is cleanest for simple single-item forms)
    await trx('lorry_receipt_items').where('lr_id', id).delete();
    if (items && Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map((it, idx) => ({
        lr_id: id,
        sr_no: it.srNo || (idx + 1),
        packets: Number(it.packets) || 1,
        description: it.description || 'General Goods',
        weight: Number(it.weight) || 0,
        unit: it.unit || 'Tonnes',
        rate: Number(it.rate) || 0,
        freight_amt: Number(it.freightAmt) || (Number(it.weight || 0) * Number(it.rate || 0))
      }));
      await trx('lorry_receipt_items').insert(itemsToInsert);
    } else {
      await trx('lorry_receipt_items').insert({
        lr_id: id,
        sr_no: 1,
        packets: Number(req.body.packets) || 1,
        description: req.body.description || 'General Goods',
        weight: Number(req.body.weight) || 0,
        unit: req.body.unit || 'Tonnes',
        rate: Number(req.body.rate) || 0,
        freight_amt: numFreight
      });
    }

    await trx.commit();

    const newLr = await db('lorry_receipts').where('id', id).first();
    await logAudit('UPDATE', 'lorry_receipts', id, oldLr, newLr);

    res.json({ success: true, message: 'Lorry Receipt updated successfully' });
  } catch (err) {
    await trx.rollback();
    console.error('Error updating LR:', err);
    res.status(500).json({ error: 'Failed to update Lorry Receipt: ' + err.message });
  }
});

// Delete LR
app.delete('/api/lrs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const oldLr = await db('lorry_receipts').where('id', id).first();
    if (!oldLr) {
      return res.status(404).json({ error: 'Lorry Receipt not found' });
    }

    await db('lorry_receipts').where('id', id).delete(); // cascade foreign key deletes items automatically in DB definition
    await logAudit('DELETE', 'lorry_receipts', id, oldLr, null);

    res.json({ success: true, message: 'Lorry Receipt deleted permanently' });
  } catch (err) {
    console.error('Error deleting LR:', err);
    res.status(500).json({ error: 'Server error deleting Lorry Receipt' });
  }
});

// Update POD document & status
app.put('/api/lrs/:id/pod', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, podDocument } = req.body;

    const oldLr = await db('lorry_receipts').where('id', id).first();
    if (!oldLr) {
      return res.status(404).json({ error: 'Lorry Receipt not found' });
    }

    const updated = {
      status: status || oldLr.status,
      pod_document: podDocument || oldLr.pod_document,
      updated_at: db.fn.now()
    };

    await db('lorry_receipts').where('id', id).update(updated);

    const newLr = await db('lorry_receipts').where('id', id).first();
    await logAudit('UPLOAD_POD', 'lorry_receipts', id, oldLr, newLr);

    res.json({ success: true, message: 'POD record saved successfully' });
  } catch (err) {
    console.error('Error saving POD:', err);
    res.status(500).json({ error: 'Server error saving POD document' });
  }
});

// Helper auto-save master records during LR generation
async function autoSaveMasters(trx, consignorName, consigneeName, vehicleNo, driverName, driverPhone, fromLocation, toLocation) {
  // Consignor Auto-save
  if (consignorName && consignorName.trim()) {
    const name = consignorName.trim();
    const existing = await trx('customers').whereRaw('LOWER(company_name) = ?', [name.toLowerCase()]).first();
    if (!existing) {
      const code = `CUST-${Date.now()}-${Math.floor(100+Math.random()*900)}`;
      await trx('customers').insert({
        id: code,
        company_name: name,
        customer_type: 'Consignor',
        city: fromLocation,
        address: fromLocation
      });
      await logAudit('AUTO_CREATE', 'customers', code, null, { company_name: name });
    }
  }

  // Consignee Auto-save
  if (consigneeName && consigneeName.trim()) {
    const name = consigneeName.trim();
    const existing = await trx('customers').whereRaw('LOWER(company_name) = ?', [name.toLowerCase()]).first();
    if (!existing) {
      const code = `CUST-${Date.now()}-${Math.floor(100+Math.random()*900)}`;
      await trx('customers').insert({
        id: code,
        company_name: name,
        customer_type: 'Consignee',
        city: toLocation,
        address: toLocation
      });
      await logAudit('AUTO_CREATE', 'customers', code, null, { company_name: name });
    }
  }

  // Vehicle Auto-save
  if (vehicleNo && vehicleNo.trim()) {
    const num = vehicleNo.trim().toUpperCase();
    const existing = await trx('vehicles_master').where('vehicle_number', num).first();
    if (!existing) {
      const code = `VEH-${Date.now()}`;
      await trx('vehicles_master').insert({
        id: code,
        vehicle_number: num,
        vehicle_type: 'Container Truck',
        owner_type: 'Attached',
        driver_name: driverName || null,
        driver_phone: driverPhone || null
      });
      await logAudit('AUTO_CREATE', 'vehicles_master', code, null, { vehicle_number: num });
    }
  }

  // Driver Auto-save
  if (driverName && driverName.trim()) {
    const name = driverName.trim();
    const existing = await trx('drivers_master').whereRaw('LOWER(driver_name) = ?', [name.toLowerCase()]).first();
    if (!existing) {
      const code = `DRV-${Date.now()}`;
      const mockLicense = `DL-${Math.floor(100000 + Math.random() * 900000)}`;
      await trx('drivers_master').insert({
        id: code,
        driver_name: name,
        phone: driverPhone || null,
        license_number: mockLicense
      });
      await logAudit('AUTO_CREATE', 'drivers_master', code, null, { driver_name: name });
    }
  }
}

// -------------------------------------------------------------
// 3. CUSTOMER MASTER CRUD APIs
// -------------------------------------------------------------
app.get('/api/customers', async (req, res) => {
  try {
    const { search } = req.query;
    let query = db('customers');
    if (search && search.trim() !== '') {
      const s = `%${search.trim().toLowerCase()}%`;
      query = query.whereRaw('LOWER(company_name) LIKE ?', [s])
                   .orWhereRaw('LOWER(gstin) LIKE ?', [s]);
    }
    const list = await query.orderBy('company_name', 'asc').select('*');
    res.json(list);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Server error listing customers' });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { companyName, gstin, pan, contactPerson, phone, email, address, city, state, pincode, customerType = 'Both' } = req.body;

    if (!companyName) {
      return res.status(400).json({ error: 'Company Name is a required field.' });
    }

    // Prevent duplicate customers: prefer GST as unique identifier.
    if (gstin && gstin.trim() !== '') {
      const existingGst = await db('customers').whereRaw('LOWER(gstin) = ?', [gstin.trim().toLowerCase()]).first();
      if (existingGst) {
        return res.status(409).json({ error: `Customer with GSTIN ${gstin} already exists as ID: ${existingGst.id}` });
      }
    }

    // Fallback: check if exact company name exists
    const existingName = await db('customers').whereRaw('LOWER(company_name) = ?', [companyName.trim().toLowerCase()]).first();
    if (existingName) {
      return res.status(409).json({ error: `Customer with name "${companyName}" already exists as ID: ${existingName.id}` });
    }

    const code = `CUST-${Date.now()}`;
    const newCustomer = {
      id: code,
      company_name: companyName.trim(),
      gstin: gstin ? gstin.trim().toUpperCase() : null,
      pan: pan ? pan.trim().toUpperCase() : null,
      contact_person: contactPerson ? contactPerson.trim() : null,
      phone: phone ? phone.trim() : null,
      email: email ? email.trim() : null,
      address: address ? address.trim() : null,
      city: city ? city.trim() : null,
      state: state ? state.trim() : null,
      pincode: pincode ? pincode.trim() : null,
      customer_type: customerType
    };

    await db('customers').insert(newCustomer);
    await logAudit('CREATE', 'customers', code, null, newCustomer);

    res.status(201).json(newCustomer);
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({ error: 'Server error creating customer' });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const old = await db('customers').where('id', id).first();
    if (!old) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await db('customers').where('id', id).delete();
    await logAudit('DELETE', 'customers', id, old, null);

    res.json({ success: true, message: 'Customer master deleted successfully' });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ error: 'Server error deleting customer master record' });
  }
});

// -------------------------------------------------------------
// 4. VEHICLE MASTER CRUD APIs
// -------------------------------------------------------------
app.get('/api/vehicles', async (req, res) => {
  try {
    const { search } = req.query;
    let query = db('vehicles_master');
    if (search && search.trim() !== '') {
      const s = `%${search.trim().toUpperCase()}%`;
      query = query.whereRaw('UPPER(vehicle_number) LIKE ?', [s]);
    }
    const list = await query.orderBy('vehicle_number', 'asc').select('*');
    res.json(list);
  } catch (err) {
    console.error('Error fetching vehicles:', err);
    res.status(500).json({ error: 'Server error listing vehicles' });
  }
});

app.post('/api/vehicles', async (req, res) => {
  try {
    const { vehicleNumber, vehicleType, capacityTons, ownerType = 'Attached', ownerName, driverName, driverPhone, rcExpiry, insuranceExpiry } = req.body;

    if (!vehicleNumber) {
      return res.status(400).json({ error: 'Vehicle Number is required.' });
    }

    const num = vehicleNumber.trim().toUpperCase();
    const existing = await db('vehicles_master').where('vehicle_number', num).first();
    if (existing) {
      return res.status(409).json({ error: `Vehicle Number ${num} already exists as ID: ${existing.id}` });
    }

    const code = `VEH-${Date.now()}`;
    const newVehicle = {
      id: code,
      vehicle_number: num,
      vehicle_type: vehicleType || 'Container Truck',
      capacity_tons: capacityTons ? Number(capacityTons) : null,
      owner_type: ownerType,
      owner_name: ownerName || (ownerType === 'Owned' ? 'Chitkote Logistics Fleet' : 'Attached Owner'),
      driver_name: driverName ? driverName.trim() : null,
      driver_phone: driverPhone ? driverPhone.trim() : null,
      rc_expiry: rcExpiry || null,
      insurance_expiry: insuranceExpiry || null
    };

    await db('vehicles_master').insert(newVehicle);
    await logAudit('CREATE', 'vehicles_master', code, null, newVehicle);

    res.status(201).json(newVehicle);
  } catch (err) {
    console.error('Error creating vehicle:', err);
    res.status(500).json({ error: 'Server error creating vehicle record' });
  }
});

// -------------------------------------------------------------
// 5. DRIVER MASTER CRUD APIs
// -------------------------------------------------------------
app.get('/api/drivers', async (req, res) => {
  try {
    const { search } = req.query;
    let query = db('drivers_master');
    if (search && search.trim() !== '') {
      const s = `%${search.trim().toLowerCase()}%`;
      query = query.whereRaw('LOWER(driver_name) LIKE ?', [s]);
    }
    const list = await query.orderBy('driver_name', 'asc').select('*');
    res.json(list);
  } catch (err) {
    console.error('Error fetching drivers:', err);
    res.status(500).json({ error: 'Server error listing drivers' });
  }
});

app.post('/api/drivers', async (req, res) => {
  try {
    const { driverName, phone, licenseNumber, licenseExpiry, emergencyPhone, experienceYears } = req.body;

    if (!driverName || !licenseNumber) {
      return res.status(400).json({ error: 'Driver Name and License Number are required.' });
    }

    const lic = licenseNumber.trim().toUpperCase();
    const existing = await db('drivers_master').where('license_number', lic).first();
    if (existing) {
      return res.status(409).json({ error: `Driver with License Number ${lic} already exists as ID: ${existing.id}` });
    }

    const code = `DRV-${Date.now()}`;
    const newDriver = {
      id: code,
      driver_name: driverName.trim(),
      phone: phone ? phone.trim() : null,
      license_number: lic,
      license_expiry: licenseExpiry || null,
      emergency_phone: emergencyPhone || null,
      experience_years: experienceYears ? Number(experienceYears) : null
    };

    await db('drivers_master').insert(newDriver);
    await logAudit('CREATE', 'drivers_master', code, null, newDriver);

    res.status(201).json(newDriver);
  } catch (err) {
    console.error('Error creating driver:', err);
    res.status(500).json({ error: 'Server error creating driver record' });
  }
});

// -------------------------------------------------------------
// 6. REPORTS API
// -------------------------------------------------------------
app.get('/api/reports', async (req, res) => {
  try {
    const { type, companyId, startDate, endDate, customerId, vehicleNo, driverName } = req.query;

    let query = db('lorry_receipts');

    if (companyId && companyId !== 'ALL') {
      query = query.where('company_id', companyId);
    }
    if (startDate) {
      query = query.where('date', '>=', startDate);
    }
    if (endDate) {
      query = query.where('date', '<=', endDate);
    }
    if (customerId) {
      query = query.where('consignor_name', customerId);
    }
    if (vehicleNo) {
      query = query.where('vehicle_no', vehicleNo);
    }
    if (driverName) {
      query = query.where('driver_name', driverName);
    }

    const data = await query.orderBy('date', 'desc').select('*');

    res.json(data);
  } catch (err) {
    console.error('Error compiling reports:', err);
    res.status(500).json({ error: 'Server error compiling reports data' });
  }
});

// -------------------------------------------------------------
// 7. CARRIER ONBOARDING APIs
// -------------------------------------------------------------
app.get('/api/onboarding/owners', async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = db('truck_owners');

    if (status && status !== 'All') {
      query = query.where('status', status);
    }

    if (search && search.trim() !== '') {
      const s = `%${search.trim().toLowerCase()}%`;
      query = query.where(function() {
        this.whereRaw('LOWER(owner_code) LIKE ?', [s])
            .orWhereRaw('LOWER(full_name) LIKE ?', [s])
            .orWhereRaw('LOWER(mobile_number) LIKE ?', [s])
            .orWhereRaw('LOWER(pan_number) LIKE ?', [s])
            .orWhereRaw('LOWER(company_name) LIKE ?', [s]);
      });
    }

    const owners = await query.orderBy('id', 'desc').select('*');

    // Attach vehicles count for each
    for (let o of owners) {
      const vehiList = await db('onboarding_vehicles').where('truck_owner_id', o.id);
      o.vehicles = vehiList;
      
      const docList = await db('onboarding_documents').where('truck_owner_id', o.id);
      o.documents = {};
      docList.forEach(d => {
        o.documents[d.document_type] = {
          fileName: d.file_name,
          fileSize: d.file_size,
          status: d.verification_status
        };
      });

      const bank = await db('bank_details').where('truck_owner_id', o.id).first();
      o.bankDetails = bank || {};

      const remarks = await db('admin_remarks').where('truck_owner_id', o.id).orderBy('id', 'desc');
      o.remarks = remarks.map(r => ({
        admin: r.admin_username,
        text: r.remark_text,
        date: r.created_at,
        transition: r.status_transition
      }));
    }

    res.json(owners);
  } catch (err) {
    console.error('Error fetching onboarding owners:', err);
    res.status(500).json({ error: 'Server error listing onboarding carriers' });
  }
});

app.post('/api/onboarding/owners', async (req, res) => {
  const trx = await db.transaction();
  try {
    const {
      fullName,
      mobileNumber,
      altMobileNumber,
      email,
      panNumber,
      aadhaarNumber,
      address,
      city,
      state,
      pincode,
      entityType,
      companyName,
      gstNumber,
      businessAddress,
      vehicles,
      documents,
      bankDetails
    } = req.body;

    if (!fullName || !mobileNumber || !email || !panNumber || !address || !city || !state || !pincode || !entityType || !companyName || !businessAddress) {
      await trx.rollback();
      return res.status(400).json({ error: 'Missing required onboarding fields' });
    }

    // Check unique mobile & PAN
    const existingMobile = await trx('truck_owners').where('mobile_number', mobileNumber).first();
    if (existingMobile) {
      await trx.rollback();
      return res.status(409).json({ error: `Carrier with Mobile +91 ${mobileNumber} is already registered.` });
    }

    const existingPan = await trx('truck_owners').where('pan_number', panNumber.toUpperCase()).first();
    if (existingPan) {
      await trx.rollback();
      return res.status(409).json({ error: `Carrier with PAN ${panNumber.toUpperCase()} is already registered.` });
    }

    // Get next ID & Code sequence
    const maxRow = await trx('truck_owners').max('id as maxId').first();
    const nextId = (maxRow && maxRow.maxId ? Number(maxRow.maxId) : 0) + 1;
    const ownerCode = `CKL-TRO-${String(nextId).padStart(6, '0')}`;

    const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    // 1. Insert Truck Owner
    const newOwner = {
      id: nextId,
      owner_code: ownerCode,
      full_name: fullName.trim(),
      mobile_number: mobileNumber.trim(),
      alt_mobile_number: altMobileNumber ? altMobileNumber.trim() : null,
      email_address: email.trim(),
      pan_number: panNumber.trim().toUpperCase(),
      aadhaar_number: aadhaarNumber ? aadhaarNumber.trim() : null,
      address: address.trim(),
      city: city.trim(),
      state,
      pincode: pincode.trim(),
      entity_type: entityType,
      company_name: companyName.trim(),
      gst_number: gstNumber ? gstNumber.trim().toUpperCase() : null,
      business_address: businessAddress.trim(),
      status: 'Submitted',
      submitted_at: nowStr,
      updated_at: nowStr
    };
    await trx('truck_owners').insert(newOwner);

    // 2. Insert Bank Details
    if (bankDetails) {
      await trx('bank_details').insert({
        truck_owner_id: nextId,
        account_holder_name: bankDetails.accountHolderName ? bankDetails.accountHolderName.trim() : fullName.trim(),
        bank_name: bankDetails.bankName ? bankDetails.bankName.trim() : 'N/A',
        account_number: bankDetails.accountNumber ? bankDetails.accountNumber.trim() : 'N/A',
        ifsc_code: bankDetails.ifscCode ? bankDetails.ifscCode.trim().toUpperCase() : 'N/A',
        upi_id: bankDetails.upiId ? bankDetails.upiId.trim() : null
      });
    }

    // 3. Insert Vehicles
    if (vehicles && Array.isArray(vehicles)) {
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        const vMaxRow = await trx('onboarding_vehicles').max('id as maxVId').first();
        const vNextId = (vMaxRow && vMaxRow.maxVId ? Number(vMaxRow.maxVId) : 0) + 1;
        const vCode = `CKL-VEH-${String(vNextId).padStart(6, '0')}`;

        await trx('onboarding_vehicles').insert({
          id: vNextId,
          vehicle_code: vCode,
          truck_owner_id: nextId,
          vehicle_number: v.vehicleNumber.trim().toUpperCase(),
          vehicle_type: v.vehicleType,
          capacity_tons: Number(v.capacityTons) || 0,
          registration_state: v.registrationState || state,
          model_year: Number(v.modelYear) || new Date().getFullYear()
        });
      }
    }

    // 4. Insert Documents
    if (documents) {
      const docTypes = Object.keys(documents);
      for (let key of docTypes) {
        const doc = documents[key];
        await trx('onboarding_documents').insert({
          truck_owner_id: nextId,
          document_type: key,
          is_mandatory: true,
          file_name: doc.fileName || doc.name || 'document.pdf',
          file_size: doc.fileSize || doc.size || '1.0 MB',
          verification_status: doc.status || 'Pending'
        });
      }
    }

    // 5. Insert Remarks
    await trx('admin_remarks').insert({
      truck_owner_id: nextId,
      admin_username: 'System Automatic',
      remark_text: 'Application submitted online for document verification.',
      status_transition: 'Submitted',
      created_at: nowStr
    });

    await trx.commit();

    await logAudit('REGISTER_CARRIER', 'truck_owners', nextId, null, newOwner);
    res.status(201).json({ success: true, ownerCode, fullName });
  } catch (err) {
    await trx.rollback();
    console.error('Error submitting onboarding application:', err);
    res.status(500).json({ error: 'Server database transaction failed during carrier onboarding: ' + err.message });
  }
});

app.put('/api/onboarding/owners/:id/status', async (req, res) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const { status, remarkText, adminUser = 'Operation Desk Admin' } = req.body;

    const owner = await trx('truck_owners').where('id', id).first();
    if (!owner) {
      await trx.rollback();
      return res.status(404).json({ error: 'Truck owner application not found' });
    }

    const nowStr = new Date().toLocaleString('en-IN');

    // Update status
    await trx('truck_owners').where('id', id).update({
      status,
      updated_at: nowStr
    });

    // Add remark
    await trx('admin_remarks').insert({
      truck_owner_id: id,
      admin_username: adminUser,
      remark_text: remarkText || `Status updated to ${status}.`,
      status_transition: status,
      created_at: nowStr
    });

    await trx.commit();

    await logAudit('UPDATE_ONBOARDING_STATUS', 'truck_owners', id, { oldStatus: owner.status }, { newStatus: status, remark: remarkText });
    res.json({ success: true, message: `Truck owner status successfully updated to ${status}` });
  } catch (err) {
    await trx.rollback();
    console.error('Error updating onboarding status:', err);
    res.status(500).json({ error: 'Failed to update onboarding status: ' + err.message });
  }
});

// -------------------------------------------------------------
// 8. CAREERS / JOB OPENINGS APIs
// -------------------------------------------------------------
app.get('/api/careers/jds', async (req, res) => {
  try {
    const list = await db('careers_jd').orderBy('created_at', 'desc').select('*');
    // Format to match JS class consumption
    const formatted = list.map(j => ({
      id: j.id,
      title: j.title,
      department: j.department,
      location: j.location,
      type: j.type,
      experience: j.experience,
      status: j.status,
      postedDate: j.posted_date,
      description: j.description,
      responsibilities: j.responsibilities,
      requirements: j.requirements
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching JDs:', err);
    res.status(500).json({ error: 'Server error listing jobs' });
  }
});

app.post('/api/careers/jds', async (req, res) => {
  try {
    const { title, department, location, type, experience, status = 'Active', description, responsibilities, requirements } = req.body;

    if (!title || !department || !description) {
      return res.status(400).json({ error: 'Title, Department, and Description are required.' });
    }

    const countResult = await db('careers_jd').count('id as count').first();
    const count = countResult ? Number(countResult.count) : 0;
    const newId = `JOB-${String(count + 1).padStart(3, '0')}`;

    const newJd = {
      id: newId,
      title,
      department,
      location,
      type: type || 'Full Time',
      experience,
      status,
      posted_date: new Date().toISOString().slice(0, 10),
      description,
      responsibilities,
      requirements
    };

    await db('careers_jd').insert(newJd);
    await logAudit('CREATE_JD', 'careers_jd', newId, null, newJd);

    res.status(201).json(newJd);
  } catch (err) {
    console.error('Error creating job description:', err);
    res.status(500).json({ error: 'Server error creating job opening' });
  }
});

app.put('/api/careers/jds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, department, location, type, experience, status, description, responsibilities, requirements } = req.body;

    const oldJd = await db('careers_jd').where('id', id).first();
    if (!oldJd) {
      return res.status(404).json({ error: 'Job opening not found' });
    }

    const updated = {
      title: title || oldJd.title,
      department: department || oldJd.department,
      location: location || oldJd.location,
      type: type || oldJd.type,
      experience: experience || oldJd.experience,
      status: status || oldJd.status,
      description: description || oldJd.description,
      responsibilities: responsibilities || oldJd.responsibilities,
      requirements: requirements || oldJd.requirements,
      updated_at: db.fn.now()
    };

    await db('careers_jd').where('id', id).update(updated);

    const newJd = await db('careers_jd').where('id', id).first();
    await logAudit('UPDATE_JD', 'careers_jd', id, oldJd, newJd);

    res.json({ success: true, message: 'Job opening updated successfully' });
  } catch (err) {
    console.error('Error updating JD:', err);
    res.status(500).json({ error: 'Server error updating job description' });
  }
});

app.delete('/api/careers/jds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const old = await db('careers_jd').where('id', id).first();
    if (!old) {
      return res.status(404).json({ error: 'Job opening not found' });
    }

    await db('careers_jd').where('id', id).delete();
    await logAudit('DELETE_JD', 'careers_jd', id, old, null);

    res.json({ success: true, message: 'Job opening deleted successfully' });
  } catch (err) {
    console.error('Error deleting JD:', err);
    res.status(500).json({ error: 'Server error deleting job opening' });
  }
});

// -------------------------------------------------------------
// 9. LOADING SLIP APIs
// -------------------------------------------------------------
app.get('/api/loading-slips', async (req, res) => {
  try {
    const { companyId, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('loading_slips');
    let countQuery = db('loading_slips');

    if (companyId && companyId !== 'ALL') {
      query = query.where('company_id', companyId);
      countQuery = countQuery.where('company_id', companyId);
    }

    if (search && search.trim() !== '') {
      const s = `%${search.trim().toLowerCase()}%`;
      const searchFilter = function() {
        this.whereRaw('LOWER(slip_no) LIKE ?', [s])
            .orWhereRaw('LOWER(vehicle_no) LIKE ?', [s])
            .orWhereRaw('LOWER(driver_name) LIKE ?', [s])
            .orWhereRaw('LOWER(owner_name) LIKE ?', [s])
            .orWhereRaw('LOWER(from_location) LIKE ?', [s])
            .orWhereRaw('LOWER(to_location) LIKE ?', [s])
            .orWhereRaw('LOWER(consignor_name) LIKE ?', [s]);
      };
      query = query.where(searchFilter);
      countQuery = countQuery.where(searchFilter);
    }

    const totalRecordsResult = await countQuery.count('id as count').first();
    const totalRecords = totalRecordsResult ? Number(totalRecordsResult.count) : 0;

    const records = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select('*');

    res.json({
      records,
      pagination: {
        totalRecords,
        currentPage: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalRecords / limit)
      }
    });
  } catch (err) {
    console.error('Error listing loading slips:', err);
    res.status(500).json({ error: 'Server error listing loading slips' });
  }
});

app.get('/api/loading-slips/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const slip = await db('loading_slips').where('id', id).first();
    if (!slip) {
      return res.status(404).json({ error: 'Loading slip not found' });
    }
    res.json(slip);
  } catch (err) {
    console.error('Error fetching loading slip details:', err);
    res.status(500).json({ error: 'Server error fetching loading slip' });
  }
});

app.post('/api/loading-slips', async (req, res) => {
  const trx = await db.transaction();
  try {
    const {
      companyId,
      date,
      vehicleNo,
      fromLocation,
      toLocation,
      driverName,
      driverPhone,
      ownerName,
      ownerPhone,
      particulars,
      weight,
      consignorName,
      consigneeName,
      freightVal = 0,
      topayVal = 0,
      advanceVal = 0,
      commissionVal = 0,
      crossingVal = 0,
      unloadVal = 0,
      loadingVal = 0,
      gmVal = 0,
      cashVal = 0,
      bankVal = 0
    } = req.body;

    if (!companyId || !date || !vehicleNo || !fromLocation || !toLocation) {
      await trx.rollback();
      return res.status(400).json({ error: 'Missing required loading slip fields.' });
    }

    const counterRow = await trx('loading_slip_counters').where('company_id', companyId).first();
    if (!counterRow) {
      await trx.rollback();
      return res.status(500).json({ error: `Counter not configured for company branch: ${companyId}` });
    }

    const companyRow = await trx('companies').where('id', companyId).first();
    if (!companyRow) {
      await trx.rollback();
      return res.status(404).json({ error: 'Company not found' });
    }

    const newSeq = counterRow.counter_val + 1;
    const formattedSeq = String(newSeq).padStart(6, '0');
    // Format prefix based on company: e.g. STTC-LS-2026-000001 or CK-LS-2026-000001
    const prefix = companyId === 'CHITKOTE' ? 'CK-LS-2026-' : 'STTC-LS-2026-';
    const slipNo = `${prefix}${formattedSeq}`;

    // Prevent duplicates
    const existing = await trx('loading_slips').where('slip_no', slipNo).first();
    if (existing) {
      await trx.rollback();
      return res.status(409).json({ error: `Duplicate Loading Slip Number generated: ${slipNo}` });
    }

    // Auto-save new Vehicle and Driver if not in masters
    if (vehicleNo && vehicleNo.trim()) {
      const vNum = vehicleNo.trim().toUpperCase();
      const existV = await trx('vehicles_master').where('vehicle_number', vNum).first();
      if (!existV) {
        await trx('vehicles_master').insert({
          id: `VEH-${Date.now()}`,
          vehicle_number: vNum,
          vehicle_type: 'Container Truck',
          owner_type: 'Attached',
          owner_name: ownerName || 'Attached Owner',
          driver_name: driverName || null,
          driver_phone: driverPhone || null
        });
      }
    }

    if (driverName && driverName.trim()) {
      const dName = driverName.trim();
      const existD = await trx('drivers_master').whereRaw('LOWER(driver_name) = ?', [dName.toLowerCase()]).first();
      if (!existD) {
        await trx('drivers_master').insert({
          id: `DRV-${Date.now()}`,
          driver_name: dName,
          phone: driverPhone || null,
          license_number: `DL-${Math.floor(100000 + Math.random() * 900000)}`
        });
      }
    }

    // Math calculations on backend
    const numFreight = Number(freightVal) || 0;
    const numTopay = Number(topayVal) || 0;
    const numAdvance = Number(advanceVal) || 0;
    const numCommission = Number(commissionVal) || 0;
    const numCrossing = Number(crossingVal) || 0;
    const numUnload = Number(unloadVal) || 0;
    const numLoading = Number(loadingVal) || 0;
    const numGm = Number(gmVal) || 0;

    const balanceVal = numFreight - numTopay - numAdvance;
    const expensesTotal = numCommission + numCrossing + numUnload + numLoading + numGm;
    const cLessVal = numAdvance - expensesTotal;
    
    const numCash = Number(cashVal) || 0;
    const computedBankVal = cLessVal - numCash;

    const slipId = `LS-${Date.now()}`;
    const newRecord = {
      id: slipId,
      company_id: companyId,
      slip_no: slipNo,
      date,
      vehicle_no: vehicleNo.trim().toUpperCase(),
      from_location: fromLocation.trim(),
      to_location: toLocation.trim(),
      driver_name: driverName ? driverName.trim() : null,
      driver_phone: driverPhone ? driverPhone.trim() : null,
      owner_name: ownerName ? ownerName.trim() : null,
      owner_phone: ownerPhone ? ownerPhone.trim() : null,
      particulars: particulars ? particulars.trim() : null,
      weight: weight ? weight.trim() : null,
      consignor_name: consignorName ? consignorName.trim() : null,
      consignee_name: consigneeName ? consigneeName.trim() : null,
      freight_val: numFreight,
      topay_val: numTopay,
      advance_val: numAdvance,
      balance_val: balanceVal,
      commission_val: numCommission,
      crossing_val: numCrossing,
      unload_val: numUnload,
      loading_val: numLoading,
      gm_val: numGm,
      expenses_total: expensesTotal,
      c_less_val: cLessVal,
      cash_val: numCash,
      bank_val: computedBankVal
    };

    await trx('loading_slips').insert(newRecord);
    await trx('loading_slip_counters').where('company_id', companyId).update({ counter_val: newSeq });

    await trx.commit();

    await logAudit('CREATE_LOADING_SLIP', 'loading_slips', slipId, null, newRecord);
    res.status(201).json({ success: true, id: slipId, slipNo });
  } catch (err) {
    await trx.rollback();
    console.error('Error creating loading slip:', err);
    res.status(500).json({ error: 'Failed to issue loading slip: ' + err.message });
  }
});

app.delete('/api/loading-slips/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const old = await db('loading_slips').where('id', id).first();
    if (!old) {
      return res.status(404).json({ error: 'Loading slip not found' });
    }
    await db('loading_slips').where('id', id).delete();
    await logAudit('DELETE_LOADING_SLIP', 'loading_slips', id, old, null);
    res.json({ success: true, message: 'Loading slip deleted successfully' });
  } catch (err) {
    console.error('Error deleting loading slip:', err);
    res.status(500).json({ error: 'Server error deleting loading slip' });
  }
});

// -------------------------------------------------------------
// 10. COMPANY PROFILE APIs
// -------------------------------------------------------------
app.get('/api/companies', async (req, res) => {
  try {
    const list = await db('companies').select('*');
    res.json(list);
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ error: 'Server error fetching companies' });
  }
});

app.get('/api/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await db('companies').where('id', id).first();
    if (!item) {
      return res.status(404).json({ error: 'Company profile not found' });
    }
    res.json(item);
  } catch (err) {
    console.error('Error fetching company profile:', err);
    res.status(500).json({ error: 'Server error fetching company profile' });
  }
});

app.put('/api/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, short_name, short_code, prefix, phone, email,
      address, pan, gstin, state, state_code, logo, terms, declaration,
      bank_name, bank_acc_no, bank_ifsc, bank_branch
    } = req.body;

    const oldVal = await db('companies').where('id', id).first();
    if (!oldVal) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const updated = {
      name: name || oldVal.name,
      short_name: short_name || oldVal.short_name,
      short_code: short_code || oldVal.short_code,
      prefix: prefix || oldVal.prefix,
      phone: phone || oldVal.phone,
      email: email || oldVal.email,
      address: address || oldVal.address,
      pan: pan || oldVal.pan,
      gstin: gstin || oldVal.gstin,
      state: state || oldVal.state,
      state_code: state_code || oldVal.state_code,
      logo: logo !== undefined ? logo : oldVal.logo,
      terms: terms !== undefined ? terms : oldVal.terms,
      declaration: declaration !== undefined ? declaration : oldVal.declaration,
      bank_name: bank_name !== undefined ? bank_name : oldVal.bank_name,
      bank_acc_no: bank_acc_no !== undefined ? bank_acc_no : oldVal.bank_acc_no,
      bank_ifsc: bank_ifsc !== undefined ? bank_ifsc : oldVal.bank_ifsc,
      bank_branch: bank_branch !== undefined ? bank_branch : oldVal.bank_branch,
      updated_at: db.fn.now()
    };

    await db('companies').where('id', id).update(updated);
    const newVal = await db('companies').where('id', id).first();
    await logAudit('UPDATE_COMPANY', 'companies', id, oldVal, newVal);

    res.json({ success: true, message: 'Company profile updated successfully', data: newVal });
  } catch (err) {
    console.error('Error updating company profile:', err);
    res.status(500).json({ error: 'Server error updating company profile: ' + err.message });
  }
});

// -------------------------------------------------------------
// MATH & WORDS UTILITIES
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// APP STARTUP
// -------------------------------------------------------------
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Critical database initialization error. Server aborted:', err);
});

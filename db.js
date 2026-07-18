const knex = require('knex');
const path = require('path');
require('dotenv').config();

const dbType = process.env.DB_TYPE || 'sqlite';
let config;

if (dbType === 'postgres') {
  config = {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'ck_logistics'
    },
    useNullAsDefault: true
  };
} else if (dbType === 'mysql') {
  config = {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ck_logistics'
    },
    useNullAsDefault: true
  };
} else {
  // default to sqlite
  config = {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, process.env.DB_FILE || 'database.sqlite')
    },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  };
}

const db = knex(config);

async function initializeDatabase() {
  console.log(`Initializing database of type: ${dbType}`);

  // 1. Companies Table
  if (!(await db.schema.hasTable('companies'))) {
    await db.schema.createTable('companies', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('short_name').notNullable();
      table.string('short_code').notNullable();
      table.string('prefix').notNullable();
      table.string('phone').notNullable();
      table.string('email').notNullable();
      table.text('address').notNullable();
      table.string('pan').notNullable();
      table.string('gstin').notNullable();
      table.string('state').notNullable();
      table.string('state_code').notNullable();
      table.string('logo').nullable();
      table.text('terms').nullable();
      table.string('declaration').nullable();
      table.string('bank_name').nullable();
      table.string('bank_acc_no').nullable();
      table.string('bank_ifsc').nullable();
      table.string('bank_branch').nullable();
      table.timestamps(true, true);
    });
    console.log('Created companies table');

    // Seed companies
    await db('companies').insert([
      {
        id: 'CHITKOTE',
        name: 'Chitkote Logistics India Pvt Ltd',
        short_name: 'CK Logistics',
        short_code: 'CKL',
        prefix: 'CL26-27/',
        phone: '94057-73955',
        email: 'dispatch@chitkotelogistics.com',
        address: '8-1-206/87/1, Pragathi Colony Main Road, Hyderabad - 500005, Telangana',
        pan: 'AANCC4088L',
        gstin: '36AANCC4088L1Z1',
        state: 'Telangana',
        state_code: '36',
        logo: 'Images/newlogo_processed.png',
        terms: '1. This is a digitally generated Bilty/LR Copy\n2. Company is not responsible for leakages & thefts during transit unless insured.\n3. Goods loaded at owner\'s risk.',
        declaration: 'Certified that the particulars given above are true and correct',
        bank_name: 'ICICI BANK LTD.',
        bank_acc_no: '001234567890',
        bank_ifsc: 'ICIC0000012',
        bank_branch: 'JUBILEE HILLS'
      },
      {
        id: 'SRI_TAMILNADU',
        name: 'Sri TamilNadu Transport Co',
        short_name: 'Sri TamilNadu Transport Co',
        short_code: 'STTC',
        prefix: 'STTC26-27/',
        phone: '91234-56789',
        email: 'operations@sritamilnadutransport.com',
        address: 'Old No. 142/A, Madhavaram High Road, Near Flyover, Chennai - 600060, Tamil Nadu',
        pan: 'STNPT9876K',
        gstin: '33STNPT9876K1Z9',
        state: 'Tamil Nadu',
        state_code: '33',
        logo: 'Images/Logo.jpeg',
        terms: '1. This is a digitally generated Bilty/LR Copy\n2. Delivery subject to presentation of original consignee copy.\n3. Demurrage charge @ ₹1000/day applicable after 24 hrs of destination arrival.',
        declaration: 'Certified that the particulars given above are true and correct',
        bank_name: 'HDFC BANK LTD.',
        bank_acc_no: '20682000000669',
        bank_ifsc: 'HDFC0002068',
        bank_branch: 'SHAMSHABAD'
      }
    ]);
  }

  // Schema alteration migration check for existing databases
  if (await db.schema.hasTable('companies')) {
    if (!(await db.schema.hasColumn('companies', 'bank_name'))) {
      await db.schema.alterTable('companies', (table) => {
        table.string('bank_name').nullable();
        table.string('bank_acc_no').nullable();
        table.string('bank_ifsc').nullable();
        table.string('bank_branch').nullable();
      });
      console.log('Added bank details columns to companies table via alterTable');
      
      // Seed default bank values to existing company records
      await db('companies').where('id', 'SRI_TAMILNADU').update({
        bank_name: 'HDFC BANK LTD.',
        bank_acc_no: '20682000000669',
        bank_ifsc: 'HDFC0002068',
        bank_branch: 'SHAMSHABAD'
      });
      await db('companies').where('id', 'CHITKOTE').update({
        bank_name: 'ICICI BANK LTD.',
        bank_acc_no: '001234567890',
        bank_ifsc: 'ICIC0000012',
        bank_branch: 'JUBILEE HILLS'
      });
    }
  }

  // 2. Company Counters (For safe LR sequential numbering)
  if (!(await db.schema.hasTable('company_counters'))) {
    await db.schema.createTable('company_counters', (table) => {
      table.string('company_id').primary().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('counter_val').defaultTo(0);
    });
    console.log('Created company_counters table');

    await db('company_counters').insert([
      { company_id: 'CHITKOTE', counter_val: 2 },
      { company_id: 'SRI_TAMILNADU', counter_val: 1 }
    ]);
  }

  // 3. Customers Table
  if (!(await db.schema.hasTable('customers'))) {
    await db.schema.createTable('customers', (table) => {
      table.string('id').primary();
      table.string('company_name').notNullable();
      table.string('gstin').nullable();
      table.string('pan').nullable();
      table.string('contact_person').nullable();
      table.string('phone').nullable();
      table.string('email').nullable();
      table.text('address').nullable();
      table.string('city').nullable();
      table.string('state').nullable();
      table.string('pincode').nullable();
      table.string('customer_type').notNullable().defaultTo('Both'); // Consignor, Consignee, Both
      table.timestamps(true, true);
      table.index('company_name');
    });
    console.log('Created customers table');

    // Seed customers
    await db('customers').insert([
      {
        id: 'CUST-001',
        company_name: 'MANNA TRUST',
        gstin: '36AADTM1728Q1Z3',
        pan: 'AADTM1728Q',
        contact_person: 'Srinivas Rao',
        phone: '99631-88008',
        email: 'mannatrust@gmail.com',
        address: 'C-2-293/82/J/A/Plot No 53A 3rd floor, Jubilee Hills Road',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500033',
        customer_type: 'Both'
      },
      {
        id: 'CUST-002',
        company_name: 'DURAI ENGINEERING PRODUCTS',
        gstin: '33AAIPN2063J1ZR',
        pan: 'AAIPN2063J',
        contact_person: 'K. Durairaj',
        phone: '94432-11020',
        email: 'duraiengg@yahoo.co.in',
        address: 'Old No.1143 New No.343 Sanganoor, Mettupalayam Road',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        pincode: '641043',
        customer_type: 'Consignee'
      },
      {
        id: 'CUST-003',
        company_name: 'TVS MOTOR SUPPLIES PVT LTD',
        gstin: '33AAACT1029F1Z2',
        pan: 'AAACT1029F',
        contact_person: 'R. Murugan',
        phone: '98401-22334',
        email: 'dispatch@tvsmotor.com',
        address: 'Plot B-12, Hosur Industrial Estate',
        city: 'Hosur',
        state: 'Tamil Nadu',
        pincode: '635109',
        customer_type: 'Consignor'
      },
      {
        id: 'CUST-004',
        company_name: 'HYDERABAD PHARMA LABS',
        gstin: '36AAACH9921B1Z4',
        pan: 'AAACH9921B',
        contact_person: 'Dr. Reddy',
        phone: '98850-12345',
        email: 'logistics@hydpharma.com',
        address: 'IDA Pashamylaram, Phase II',
        city: 'Patancheru',
        state: 'Telangana',
        pincode: '502307',
        customer_type: 'Consignor'
      }
    ]);
  }

  // 4. Vehicles Master Table
  if (!(await db.schema.hasTable('vehicles_master'))) {
    await db.schema.createTable('vehicles_master', (table) => {
      table.string('id').primary();
      table.string('vehicle_number').notNullable().unique();
      table.string('vehicle_type').notNullable();
      table.decimal('capacity_tons', 6, 2).nullable();
      table.string('owner_type').notNullable().defaultTo('Attached'); // Owned, Attached
      table.string('owner_name').nullable();
      table.string('driver_name').nullable();
      table.string('driver_phone').nullable();
      table.string('rc_expiry').nullable();
      table.string('insurance_expiry').nullable();
      table.string('permit').nullable();
      table.string('fitness').nullable();
      table.timestamps(true, true);
      table.index('vehicle_number');
    });
    console.log('Created vehicles_master table');

    // Seed vehicles master
    await db('vehicles_master').insert([
      {
        id: 'VEH-001',
        vehicle_number: 'KA51AB0244',
        vehicle_type: '32 FT Container Multi-Axle',
        capacity_tons: 18.5,
        owner_type: 'Attached',
        owner_name: 'Venkatesh Transports',
        driver_name: 'Ramesh Kumar',
        driver_phone: '98765-43210',
        rc_expiry: '2028-11-30',
        insurance_expiry: '2027-05-15'
      },
      {
        id: 'VEH-002',
        vehicle_number: 'TS08EX1234',
        vehicle_type: '20 FT Closed Body Container',
        capacity_tons: 9.0,
        owner_type: 'Owned',
        owner_name: 'Chitkote Logistics Fleet',
        driver_name: 'Mohd Pasha',
        driver_phone: '91234-56780',
        rc_expiry: '2029-01-10',
        insurance_expiry: '2026-12-20'
      },
      {
        id: 'VEH-003',
        vehicle_number: 'TN09BY5678',
        vehicle_type: '14 FT Eicher Open Body',
        capacity_tons: 4.5,
        owner_type: 'Attached',
        owner_name: 'Sri Selvam Carriers',
        driver_name: 'S. Kaliappan',
        driver_phone: '94440-99887',
        rc_expiry: '2027-08-22',
        insurance_expiry: '2026-10-05'
      }
    ]);
  }

  // 5. Drivers Master Table
  if (!(await db.schema.hasTable('drivers_master'))) {
    await db.schema.createTable('drivers_master', (table) => {
      table.string('id').primary();
      table.string('driver_name').notNullable();
      table.string('phone').nullable();
      table.string('license_number').notNullable().unique();
      table.string('license_expiry').nullable();
      table.string('emergency_phone').nullable();
      table.integer('experience_years').nullable();
      table.string('aadhaar_number').nullable();
      table.timestamps(true, true);
    });
    console.log('Created drivers_master table');

    // Seed drivers master
    await db('drivers_master').insert([
      {
        id: 'DRV-001',
        driver_name: 'Ramesh Kumar',
        license_number: 'TS00820180019283',
        phone: '98765-43210',
        emergency_phone: '98765-43299',
        license_expiry: '2029-04-12',
        experience_years: 8
      },
      {
        id: 'DRV-002',
        driver_name: 'Mohd Pasha',
        license_number: 'TS00920150044122',
        phone: '91234-56780',
        emergency_phone: '91234-56781',
        license_expiry: '2027-09-30',
        experience_years: 12
      },
      {
        id: 'DRV-003',
        driver_name: 'S. Kaliappan',
        license_number: 'TN0120170098271',
        phone: '94440-99887',
        emergency_phone: '94440-99888',
        license_expiry: '2028-06-15',
        experience_years: 6
      }
    ]);
  }

  // 6. Lorry Receipts (LRs) Table
  if (!(await db.schema.hasTable('lorry_receipts'))) {
    await db.schema.createTable('lorry_receipts', (table) => {
      table.string('id').primary();
      table.string('company_id').notNullable().references('id').inTable('companies');
      table.string('lr_no').notNullable().unique();
      table.date('date').notNullable();
      table.string('freight_paid_by').notNullable();
      table.string('vehicle_no').notNullable();
      table.string('driver_name').nullable();
      table.string('driver_phone').nullable();
      table.string('insurance_status').nullable();
      table.text('delivery_address').nullable();
      table.string('consignor_name').notNullable();
      table.string('consignor_gstin').nullable();
      table.text('consignor_address').nullable();
      table.string('consignor_contact').nullable();
      table.string('consignee_name').notNullable();
      table.string('consignee_gstin').nullable();
      table.text('consignee_address').nullable();
      table.string('consignee_contact').nullable();
      table.string('eway_bill_no').nullable();
      table.string('invoice_no').nullable();
      table.string('invoice_value').nullable();
      table.string('from_location').notNullable();
      table.string('to_location').notNullable();
      table.string('amount_in_words').nullable();
      table.decimal('freight_amt', 12, 2).notNullable().defaultTo(0);
      table.decimal('loading_charges', 12, 2).defaultTo(0);
      table.decimal('unloading_charges', 12, 2).defaultTo(0);
      table.decimal('toll_charges', 12, 2).defaultTo(0);
      table.decimal('detention_charges', 12, 2).defaultTo(0);
      table.decimal('other_charges', 12, 2).defaultTo(0);
      table.decimal('taxable_amount', 12, 2).notNullable().defaultTo(0);
      table.integer('gst_percent').defaultTo(0);
      table.decimal('gst_amount', 12, 2).defaultTo(0);
      table.decimal('total_amount', 12, 2).notNullable().defaultTo(0);
      table.decimal('advance_amount', 12, 2).defaultTo(0);
      table.decimal('to_pay_amount', 12, 2).notNullable().defaultTo(0);
      table.text('remarks').nullable();
      table.text('terms').nullable();
      table.string('status').notNullable().defaultTo('Draft'); // Draft, Dispatched, In Transit, Delivered, POD Uploaded, Billed
      table.string('pod_document').nullable();
      table.timestamps(true, true);
      table.index('lr_no');
      table.index('company_id');
      table.index('status');
    });
    console.log('Created lorry_receipts table');

    // Seed LRs
    await db('lorry_receipts').insert([
      {
        id: 'LR-002',
        company_id: 'CHITKOTE',
        lr_no: 'CL26-27/002',
        date: '2026-07-14',
        freight_paid_by: 'Consignor',
        vehicle_no: 'KA51AB0244',
        driver_name: 'Ramesh Kumar',
        driver_phone: '98765-43210',
        insurance_status: 'The Consignor has NOT insured the consignment',
        delivery_address: 'Durai Engineering Products, Old No.1143 New No.343 Sanganoor, Mettupalayam Road, Coimbatore, 641043, Tamil Nadu',
        consignor_name: 'MANNA TRUST',
        consignor_gstin: '36AADTM1728Q1Z3',
        consignor_address: 'C-2-293/82/J/A/Plot No 53A 3rd floor, Jubilee Hills Road, Hyderabad, 500033, Telangana',
        consignor_contact: '99631-88008',
        consignee_name: 'DURAI ENGINEERING PRODUCTS',
        consignee_gstin: '33AAIPN2063J1ZR',
        consignee_address: 'Durai Engineering Products, Old No.1143 New No.343 Sanganoor, Mettupalayam Road, Coimbatore, 641043, Tamil Nadu',
        consignee_contact: '94432-11020',
        eway_bill_no: '',
        invoice_no: '22',
        invoice_value: '',
        from_location: 'Hyderabad',
        to_location: 'Coimbatore',
        amount_in_words: 'Thirty Four Thousand Rupees Only',
        freight_amt: 34000.00,
        taxable_amount: 34000.00,
        gst_percent: 0,
        gst_amount: 0.00,
        total_amount: 34000.00,
        advance_amount: 0.00,
        to_pay_amount: 34000.00,
        remarks: 'Company is not responsible for the leakages & thefts',
        terms: 'This is a digitally generated Bilty/LR Copy',
        status: 'Dispatched',
        pod_document: null
      },
      {
        id: 'LR-001',
        company_id: 'CHITKOTE',
        lr_no: 'CL26-27/001',
        date: '2026-07-10',
        freight_paid_by: 'Consignor',
        vehicle_no: 'TS08EX1234',
        driver_name: 'Mohd Pasha',
        driver_phone: '91234-56780',
        insurance_status: 'Insured by Transporter Policy #POL-88219',
        delivery_address: 'TVS Motor Depot, Plot B-12 Industrial Estate, Hosur, 635109, Tamil Nadu',
        consignor_name: 'HYDERABAD PHARMA LABS',
        consignor_gstin: '36AAACH9921B1Z4',
        consignor_address: 'IDA Pashamylaram, Phase II, Patancheru, Hyderabad, 502307, Telangana',
        consignor_contact: '98850-12345',
        consignee_name: 'TVS MOTOR SUPPLIES PVT LTD',
        consignee_gstin: '33AAACT1029F1Z2',
        consignee_address: 'Plot B-12, Hosur Industrial Estate, Hosur, 635109, Tamil Nadu',
        consignee_contact: '98401-22334',
        eway_bill_no: '311029384756',
        invoice_no: 'HPL-2026-091',
        invoice_value: '450000',
        from_location: 'Hyderabad',
        to_location: 'Hosur',
        amount_in_words: 'Thirty Five Thousand Seven Hundred Rupees Only',
        freight_amt: 35700.00,
        taxable_amount: 35700.00,
        gst_percent: 5,
        gst_amount: 1785.00,
        total_amount: 37485.00,
        advance_amount: 10000.00,
        to_pay_amount: 27485.00,
        remarks: 'Handle with care. Temperature sensitive.',
        terms: 'This is a digitally generated Bilty/LR Copy',
        status: 'Delivered',
        pod_document: 'POD_CL2627_001_Signed.pdf'
      },
      {
        id: 'LR-003',
        company_id: 'SRI_TAMILNADU',
        lr_no: 'STTC26-27/001',
        date: '2026-07-15',
        freight_paid_by: 'To Pay',
        vehicle_no: 'TN09BY5678',
        driver_name: 'S. Kaliappan',
        driver_phone: '94440-99887',
        insurance_status: 'The Consignor has NOT insured the consignment',
        delivery_address: 'MANNA TRUST Office, Jubilee Hills Road, Hyderabad, 500033, Telangana',
        consignor_name: 'TVS MOTOR SUPPLIES PVT LTD',
        consignor_gstin: '33AAACT1029F1Z2',
        consignor_address: 'Plot B-12, Hosur Industrial Estate, Hosur, 635109, Tamil Nadu',
        consignor_contact: '98401-22334',
        consignee_name: 'MANNA TRUST',
        consignee_gstin: '36AADTM1728Q1Z3',
        consignee_address: 'C-2-293/82/J/A/Plot No 53A 3rd floor, Jubilee Hills Road, Hyderabad, 500033, Telangana',
        consignee_contact: '99631-88008',
        eway_bill_no: '441098273645',
        invoice_no: 'TVS-CHE-882',
        invoice_value: '210000',
        from_location: 'Hosur',
        to_location: 'Hyderabad',
        amount_in_words: 'Twenty Three Thousand One Hundred Rupees Only',
        freight_amt: 23100.00,
        taxable_amount: 23100.00,
        gst_percent: 0,
        gst_amount: 0.00,
        total_amount: 23100.00,
        advance_amount: 5000.00,
        to_pay_amount: 18100.00,
        remarks: 'Urgent delivery required for production line',
        terms: 'This is a digitally generated Bilty/LR Copy',
        status: 'In Transit',
        pod_document: null
      }
    ]);
  }

  // 7. Lorry Receipt Items Table
  if (!(await db.schema.hasTable('lorry_receipt_items'))) {
    await db.schema.createTable('lorry_receipt_items', (table) => {
      table.increments('id').primary();
      table.string('lr_id').notNullable().references('id').inTable('lorry_receipts').onDelete('CASCADE');
      table.integer('sr_no').notNullable();
      table.integer('packets').notNullable().defaultTo(1);
      table.string('description').notNullable();
      table.decimal('weight', 10, 2).notNullable().defaultTo(0);
      table.string('unit').notNullable().defaultTo('Tonnes');
      table.decimal('rate', 12, 2).notNullable().defaultTo(0);
      table.decimal('freight_amt', 12, 2).notNullable().defaultTo(0);
      table.timestamps(true, true);
    });
    console.log('Created lorry_receipt_items table');

    // Seed items
    await db('lorry_receipt_items').insert([
      { lr_id: 'LR-002', sr_no: 1, packets: 1, description: 'Mecneri', weight: 5.0, unit: 'Tonnes', rate: 6800.00, freight_amt: 34000.00 },
      { lr_id: 'LR-001', sr_no: 1, packets: 120, description: 'Pharma Raw Material Barrels', weight: 8.5, unit: 'Tonnes', rate: 4200.00, freight_amt: 35700.00 },
      { lr_id: 'LR-003', sr_no: 1, packets: 45, description: 'Machinery Components & Tools', weight: 4.2, unit: 'Tonnes', rate: 5500.00, freight_amt: 23100.00 }
    ]);
  }

  // 8. Careers JD Table
  if (!(await db.schema.hasTable('careers_jd'))) {
    await db.schema.createTable('careers_jd', (table) => {
      table.string('id').primary();
      table.string('title').notNullable();
      table.string('department').notNullable();
      table.string('location').notNullable();
      table.string('type').notNullable(); // Full Time, Part Time, Contract
      table.string('experience').nullable();
      table.string('status').notNullable().defaultTo('Active'); // Active, Closed
      table.string('posted_date').notNullable();
      table.text('description').notNullable();
      table.text('responsibilities').nullable(); // line-separated
      table.text('requirements').nullable(); // line-separated
      table.timestamps(true, true);
    });
    console.log('Created careers_jd table');

    // Seed careers JDs
    await db('careers_jd').insert([
      {
        id: 'JOB-001',
        title: 'Dispatch Operations Executive',
        department: 'Operations',
        location: 'Hyderabad, Telangana',
        type: 'Full Time',
        experience: '2 - 4 Years',
        status: 'Active',
        posted_date: '2026-07-01',
        description: 'Manage daily truck dispatch, fleet allocation, and driver coordination across Telangana & Maharashtra logistics corridors.',
        responsibilities: 'Coordinate vehicle scheduling and loading at client warehouses.\nTrack active container movements and update delivery timestamps.\nResolve route contingencies and communicate with fleet owners.',
        requirements: 'Prior experience in logistics / transport dispatch operations.\nFluency in Telugu, Hindi, and basic English.\nProficiency with GPS tracking tools and mobile logistics apps.'
      },
      {
        id: 'JOB-002',
        title: 'Freight Sales Manager',
        department: 'Business Development',
        location: 'Chennai, Tamil Nadu',
        type: 'Full Time',
        experience: '4 - 7 Years',
        status: 'Active',
        posted_date: '2026-07-05',
        description: 'Lead enterprise client acquisition for full truck load (FTL) and industrial container cargo across South India.',
        responsibilities: 'Identify and onboard manufacturing and industrial freight clients.\nPrepare rate quotations and negotiate transport service contracts.\nMaintain key client relationships and drive revenue growth.',
        requirements: 'Bachelor degree with proven B2B freight/logistics sales track record.\nStrong network of industrial shippers in Tamil Nadu and AP.\nExcellent negotiation and contract management skills.'
      },
      {
        id: 'JOB-003',
        title: 'Fleet & Vehicle Document Auditor',
        department: 'Carrier Onboarding',
        location: 'Hyderabad / Remote',
        type: 'Full Time',
        experience: '1 - 3 Years',
        status: 'Active',
        posted_date: '2026-07-10',
        description: 'Verify truck owner registration files, RC copies, insurance policies, and driver credentials for platform onboarding.',
        responsibilities: 'Inspect uploaded carrier documents for compliance and authenticity.\nCommunicate missing document requirements to carrier partners.\nApprove carrier accounts upon physical & document verification.',
        requirements: 'Understanding of RTO vehicle documents (RC, Insurance, Fitness).\nAttention to detail and document verification accuracy.\nGood communication skills.'
      }
    ]);
  }

  // 9. Truck Owners (Carrier Onboarding) Table
  if (!(await db.schema.hasTable('truck_owners'))) {
    await db.schema.createTable('truck_owners', (table) => {
      table.increments('id').primary();
      table.string('owner_code').notNullable().unique();
      table.string('full_name').notNullable();
      table.string('mobile_number').notNullable().unique();
      table.string('alt_mobile_number').nullable();
      table.string('email_address').notNullable();
      table.string('pan_number').notNullable().unique();
      table.string('aadhaar_number').nullable();
      table.text('address').notNullable();
      table.string('city').notNullable();
      table.string('state').notNullable();
      table.string('pincode').notNullable();
      table.string('entity_type').notNullable(); // Individual, Proprietor, Partnership, Pvt Ltd
      table.string('company_name').notNullable();
      table.string('gst_number').nullable();
      table.text('business_address').notNullable();
      table.string('status').notNullable().defaultTo('Submitted'); // Submitted, Under Review, Documents Pending, Approved, Rejected
      table.string('submitted_at').notNullable();
      table.string('updated_at').notNullable();
    });
    console.log('Created truck_owners table');

    // Seed onboarding owners
    await db('truck_owners').insert([
      {
        id: 1,
        owner_code: 'CKL-TRO-000001',
        full_name: 'Rajesh Sharma',
        mobile_number: '9876543210',
        alt_mobile_number: '9876543211',
        email_address: 'rajesh.sharma@gmail.com',
        pan_number: 'ABCPS1234F',
        aadhaar_number: '123456789012',
        address: 'Plot 45, Auto Nagar, Gachibowli',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500032',
        entity_type: 'Proprietorship',
        company_name: 'Sharma Transport Carrier Services',
        gst_number: '36ABCPS1234F1Z5',
        business_address: 'Plot 45, Auto Nagar, Gachibowli, Hyderabad, TS',
        status: 'Approved',
        submitted_at: '2026-07-01 10:30 AM',
        updated_at: '2026-07-02 02:15 PM'
      },
      {
        id: 2,
        owner_code: 'CKL-TRO-000002',
        full_name: 'Venkatesh Rao',
        mobile_number: '9390003955',
        alt_mobile_number: '9123456789',
        email_address: 'vrao.logistics@gmail.com',
        pan_number: 'XYZPV5678K',
        aadhaar_number: '987654321098',
        address: 'Door 12-4, Madhavaram High Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600060',
        entity_type: 'Individual',
        company_name: 'Venkatesh Fleet Operations',
        gst_number: '',
        business_address: 'Door 12-4, Madhavaram High Road, Chennai, TN',
        status: 'Documents Pending',
        submitted_at: '2026-07-10 11:20 AM',
        updated_at: '2026-07-11 09:40 AM'
      }
    ]);
  }

  // 10. Onboarding Vehicles Table
  if (!(await db.schema.hasTable('onboarding_vehicles'))) {
    await db.schema.createTable('onboarding_vehicles', (table) => {
      table.increments('id').primary();
      table.string('vehicle_code').notNullable().unique();
      table.integer('truck_owner_id').notNullable().references('id').inTable('truck_owners').onDelete('CASCADE');
      table.string('vehicle_number').notNullable().unique();
      table.string('vehicle_type').notNullable();
      table.decimal('capacity_tons', 5, 2).notNullable();
      table.string('registration_state').notNullable();
      table.integer('model_year').notNullable();
      table.timestamps(true, true);
    });
    console.log('Created onboarding_vehicles table');

    await db('onboarding_vehicles').insert([
      { vehicle_code: 'CKL-VEH-000001', truck_owner_id: 1, vehicle_number: 'TS08EX1234', vehicle_type: '32 FT Container', capacity_tons: 18.5, registration_state: 'Telangana', model_year: 2022 },
      { vehicle_code: 'CKL-VEH-000002', truck_owner_id: 1, vehicle_number: 'TS07EY9876', vehicle_type: '20 FT Container', capacity_tons: 9.0, registration_state: 'Telangana', model_year: 2021 },
      { vehicle_code: 'CKL-VEH-000003', truck_owner_id: 2, vehicle_number: 'TN05BC4321', vehicle_type: '17 FT Open Body', capacity_tons: 7.5, registration_state: 'Tamil Nadu', model_year: 2023 }
    ]);
  }

  // 11. Onboarding Documents Table
  if (!(await db.schema.hasTable('onboarding_documents'))) {
    await db.schema.createTable('onboarding_documents', (table) => {
      table.increments('id').primary();
      table.integer('truck_owner_id').notNullable().references('id').inTable('truck_owners').onDelete('CASCADE');
      table.string('document_type').notNullable();
      table.boolean('is_mandatory').defaultTo(false);
      table.string('file_name').notNullable();
      table.string('file_size').notNullable();
      table.string('verification_status').notNullable().defaultTo('Pending'); // Pending, Verified, Rejected
      table.timestamps(true, true);
    });
    console.log('Created onboarding_documents table');

    await db('onboarding_documents').insert([
      { truck_owner_id: 1, document_type: 'rc_book', is_mandatory: true, file_name: 'RC_TS08EX1234.pdf', file_size: '2.4 MB', verification_status: 'Verified' },
      { truck_owner_id: 1, document_type: 'pan_card', is_mandatory: true, file_name: 'PAN_Card.png', file_size: '1.1 MB', verification_status: 'Verified' },
      { truck_owner_id: 1, document_type: 'vehicle_insurance', is_mandatory: true, file_name: 'Insurance_2026.pdf', file_size: '3.0 MB', verification_status: 'Verified' },
      { truck_owner_id: 1, document_type: 'owner_photo', is_mandatory: true, file_name: 'Owner_Passport.jpg', file_size: '850 KB', verification_status: 'Verified' },
      { truck_owner_id: 2, document_type: 'rc_book', is_mandatory: true, file_name: 'RC_TN05BC4321.pdf', file_size: '1.8 MB', verification_status: 'Pending' },
      { truck_owner_id: 2, document_type: 'pan_card', is_mandatory: true, file_name: 'PAN_Venkatesh.jpg', file_size: '920 KB', verification_status: 'Verified' }
    ]);
  }

  // 12. Bank Details Table
  if (!(await db.schema.hasTable('bank_details'))) {
    await db.schema.createTable('bank_details', (table) => {
      table.increments('id').primary();
      table.integer('truck_owner_id').notNullable().unique().references('id').inTable('truck_owners').onDelete('CASCADE');
      table.string('account_holder_name').notNullable();
      table.string('bank_name').notNullable();
      table.string('account_number').notNullable();
      table.string('ifsc_code').notNullable();
      table.string('upi_id').nullable();
      table.timestamps(true, true);
    });
    console.log('Created bank_details table');

    await db('bank_details').insert([
      { truck_owner_id: 1, account_holder_name: 'Rajesh Sharma', bank_name: 'HDFC Bank', account_number: '50100234567890', ifsc_code: 'HDFC0001234', upi_id: 'sharmatransport@hdfc' },
      { truck_owner_id: 2, account_holder_name: 'Venkatesh Rao', bank_name: 'State Bank of India', account_number: '30495867123', ifsc_code: 'SBIN0004567', upi_id: 'venkatesh@sbi' }
    ]);
  }

  // 13. Onboarding Admin Remarks Table
  if (!(await db.schema.hasTable('admin_remarks'))) {
    await db.schema.createTable('admin_remarks', (table) => {
      table.increments('id').primary();
      table.integer('truck_owner_id').notNullable().references('id').inTable('truck_owners').onDelete('CASCADE');
      table.string('admin_username').notNullable().defaultTo('System Admin');
      table.text('remark_text').notNullable();
      table.string('status_transition').nullable();
      table.string('created_at').notNullable();
    });
    console.log('Created admin_remarks table');

    await db('admin_remarks').insert([
      { truck_owner_id: 1, admin_username: 'Operation Desk', remark_text: 'All mandatory RC & PAN documents verified. Physical verification complete.', status_transition: 'Approved', created_at: '2026-07-02 02:15 PM' },
      { truck_owner_id: 2, admin_username: 'Verification Team', remark_text: 'Vehicle Insurance document missing. Please upload clear copy of Insurance Policy.', status_transition: 'Documents Pending', created_at: '2026-07-11 09:40 AM' }
    ]);
  }

  // 14. Audit Logs Table
  if (!(await db.schema.hasTable('audit_logs'))) {
    await db.schema.createTable('audit_logs', (table) => {
      table.increments('id').primary();
      table.string('action').notNullable(); // e.g. CREATE, UPDATE, DELETE
      table.string('table_name').notNullable();
      table.string('record_id').notNullable();
      table.text('old_value').nullable();
      table.text('new_value').nullable();
      table.string('user').notNullable().defaultTo('System Admin');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    await db('audit_logs').insert({
      action: 'INIT',
      table_name: 'database',
      record_id: '0',
      new_value: JSON.stringify({ message: 'Relational database initialized successfully' })
    });
  }

  // 15. Loading Slip Counters
  if (!(await db.schema.hasTable('loading_slip_counters'))) {
    await db.schema.createTable('loading_slip_counters', (table) => {
      table.string('company_id').primary().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('counter_val').defaultTo(0);
    });
    console.log('Created loading_slip_counters table');

    await db('loading_slip_counters').insert([
      { company_id: 'CHITKOTE', counter_val: 0 },
      { company_id: 'SRI_TAMILNADU', counter_val: 1 }
    ]);
  }

  // 16. Loading Slips Table
  if (!(await db.schema.hasTable('loading_slips'))) {
    await db.schema.createTable('loading_slips', (table) => {
      table.string('id').primary();
      table.string('company_id').notNullable().references('id').inTable('companies');
      table.string('slip_no').notNullable().unique();
      table.date('date').notNullable();
      table.string('vehicle_no').notNullable();
      table.string('from_location').notNullable();
      table.string('to_location').notNullable();
      table.string('driver_name').nullable();
      table.string('driver_phone').nullable();
      table.string('owner_name').nullable();
      table.string('owner_phone').nullable();
      table.string('particulars').nullable();
      table.string('weight').nullable();
      table.string('consignor_name').nullable();
      table.string('consignee_name').nullable();
      table.decimal('freight_val', 12, 2).defaultTo(0);
      table.decimal('topay_val', 12, 2).defaultTo(0);
      table.decimal('advance_val', 12, 2).defaultTo(0);
      table.decimal('balance_val', 12, 2).defaultTo(0);
      table.decimal('commission_val', 12, 2).defaultTo(0);
      table.decimal('crossing_val', 12, 2).defaultTo(0);
      table.decimal('unload_val', 12, 2).defaultTo(0);
      table.decimal('loading_val', 12, 2).defaultTo(0);
      table.decimal('gm_val', 12, 2).defaultTo(0);
      table.decimal('expenses_total', 12, 2).defaultTo(0);
      table.decimal('c_less_val', 12, 2).defaultTo(0);
      table.decimal('cash_val', 12, 2).defaultTo(0);
      table.decimal('bank_val', 12, 2).defaultTo(0);
      table.timestamps(true, true);

      table.index('slip_no');
      table.index('company_id');
    });
    console.log('Created loading_slips table');

    // Seed initial loading slip matching Excel reference
    await db('loading_slips').insert({
      id: 'LS-1731671987000',
      company_id: 'SRI_TAMILNADU',
      slip_no: 'STTC-LS-2026-000001',
      date: '2026-11-05',
      vehicle_no: 'TN52AB1233',
      from_location: 'Hyderabad',
      to_location: 'Pollachi',
      driver_name: 'Santosh Kumar',
      driver_phone: '9030003955',
      owner_name: 'KING TP',
      owner_phone: '9876543210',
      particulars: 'Santosh freight',
      weight: '30MT',
      consignor_name: 'As per Bill',
      consignee_name: '',
      freight_val: 75000.00,
      topay_val: 0.00,
      advance_val: 74000.00,
      balance_val: 1000.00,
      commission_val: 2390.00,
      crossing_val: 0.00,
      unload_val: 1000.00,
      loading_val: 0.00,
      gm_val: 100.00,
      expenses_total: 3490.00,
      c_less_val: 70510.00,
      cash_val: 0.00,
      bank_val: 70510.00
    });
  }

  console.log('Database tables successfully verified and initialized');
}

module.exports = {
  db,
  initializeDatabase
};

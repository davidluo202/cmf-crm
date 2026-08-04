import mysql from 'mysql2/promise';

let pool: any = null;

export function getPool(): any {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL not configured');
    pool = mysql.createPool(url);
  }
  return pool;
}

/** Ensure CRM-specific tables/columns exist */
export async function ensureCrmTables(p: any) {
  // Create crm_clients table if not exists (CRM's own client records for manual entry)
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS crm_clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) UNIQUE,
        account_number VARCHAR(20),
        client_type VARCHAR(10) DEFAULT '10',
        channel VARCHAR(2) DEFAULT '0',
        name VARCHAR(200),
        name_en VARCHAR(200),
        phone VARCHAR(50),
        email VARCHAR(200),
        address TEXT,
        bank_name VARCHAR(200),
        bank_account VARCHAR(100),
        bank_account_type VARCHAR(20) DEFAULT 'checking',
        bank_currency VARCHAR(10) DEFAULT 'HKD',
        markup_percent DECIMAL(5,2) DEFAULT 0.30,
        status VARCHAR(20) DEFAULT '活跃',
        segment VARCHAR(50) DEFAULT 'Individual',
        tier VARCHAR(20) DEFAULT 'Bronze',
        rm VARCHAR(100),
        aum DECIMAL(20,2) DEFAULT 0,
        last_contact DATETIME,
        onboarded_date DATE,
        application_id INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch { /* table may already exist */ }

  // Add identity document columns if missing
  const idCols = [
    ['id_type', "VARCHAR(50)"],
    ['id_number', "VARCHAR(100)"],
    ['id_expiry', "DATE"],
    ['id_issuing_country', "VARCHAR(100)"],
    ['date_of_birth', "DATE"],
    ['gender', "VARCHAR(10)"],
    ['is_professional_investor', "BOOLEAN DEFAULT TRUE"],
    // Corporate-specific columns
    ['entity_type', "VARCHAR(50)"],
    ['business_nature', "VARCHAR(100)"],
    ['country_of_incorporation', "VARCHAR(100)"],
    ['date_of_incorporation', "DATE"],
    ['cert_of_incorporation_no', "VARCHAR(50)"],
    ['business_registration_no', "VARCHAR(50)"],
    ['registered_address', "TEXT"],
    ['business_address', "TEXT"],
    ['office_phone', "VARCHAR(50)"],
    ['fax', "VARCHAR(50)"],
    ['website', "VARCHAR(200)"],
    ['contact_name', "VARCHAR(100)"],
    ['contact_title', "VARCHAR(100)"],
    ['contact_phone', "VARCHAR(50)"],
    ['contact_email', "VARCHAR(200)"],
  ] as const;
  for (const [col, def] of idCols) {
    try { await p.query(`ALTER TABLE crm_clients ADD COLUMN ${col} ${def}`); } catch { /* already exists */ }
  }

  // Create client_balances table
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS client_balances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL UNIQUE,
        balance_hkd DECIMAL(20,2) DEFAULT 0,
        balance_usd DECIMAL(20,2) DEFAULT 0,
        balance_cny DECIMAL(20,2) DEFAULT 0,
        frozen_hkd DECIMAL(20,2) DEFAULT 0,
        frozen_usd DECIMAL(20,2) DEFAULT 0,
        frozen_cny DECIMAL(20,2) DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch {}

  // Create client_bank_accounts table
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS client_bank_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        bank_name VARCHAR(200),
        bank_account VARCHAR(100),
        bank_currency VARCHAR(10) DEFAULT 'HKD',
        bank_account_type VARCHAR(20) DEFAULT 'saving',
        branch_code VARCHAR(10),
        is_primary BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch {}

  // Add branch_code if missing
  try { await p.query(`ALTER TABLE client_bank_accounts ADD COLUMN branch_code VARCHAR(10)`); } catch {}

  // Create sanctions_checks table
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS sanctions_checks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        trigger_type VARCHAR(50),
        client_name VARCHAR(200),
        hit_count INT DEFAULT 0,
        hits JSON,
        status VARCHAR(20) DEFAULT 'clear',
        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checked_by VARCHAR(100)
      )
    `);
  } catch {}

  // Create fund_transactions table
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS fund_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tx_code VARCHAR(50) UNIQUE,
        client_id INT NOT NULL,
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(20,2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        bank_name VARCHAR(200),
        bank_account VARCHAR(100),
        receipt_url TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        remarks TEXT,
        source_system VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        confirmed_at DATETIME,
        confirmed_by VARCHAR(100),
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch {}
}

/**
 * Get all clients - combines:
 * 1. Approved applications from account opening system (applications + personal_basic_info)
 * 2. Manually created CRM clients (crm_clients)
 */
export async function getAllClients(p: any) {
  await ensureCrmTables(p);

  // Get approved applications with basic info
  let appClients: any[] = [];
  try {
    const [rows] = await p.query(`
      SELECT a.id, a.applicationNumber as code, a.applicationCode, a.status,
             a.submittedAt as created_at, a.updatedAt as updated_at,
             b.chineseName as name, b.englishName as name_en,
             b.idType as id_type, b.idNumber as id_number, b.idExpiry as id_expiry,
             b.idIssuingCountry as id_issuing_country, b.dateOfBirth as date_of_birth,
             b.gender,
             d.email, d.mobileNumber as phone, d.mobileCountryCode as phone_code,
             d.residentialAddress as address
      FROM applications a
      LEFT JOIN personal_basic_info b ON a.id = b.applicationId
      LEFT JOIN personal_detailed_info d ON a.id = d.applicationId
      WHERE a.status IN ('approved', 'submitted', 'under_review')
      ORDER BY a.id DESC
    `);
    appClients = (rows as any[]).map(r => ({
      id: r.id,
      code: r.code || r.applicationCode || `APP-${r.id}`,
      nameCn: r.name || '',
      nameEn: r.name_en || '',
      email: r.email || '',
      phone: r.phone_code ? `${r.phone_code} ${r.phone}` : (r.phone || ''),
      idType: r.id_type || '',
      idNumber: r.id_number || '',
      idExpiry: r.id_expiry || '',
      idIssuingCountry: r.id_issuing_country || '',
      dateOfBirth: r.date_of_birth || '',
      gender: r.gender || '',
      segment: 'Individual',
      tier: 'Bronze',
      rm: '',
      aum: 0,
      status: r.status === 'approved' ? '活跃' : '审核中',
      lastContact: null,
      createdAt: r.created_at,
      source: 'account_opening',
    }));
  } catch { /* tables may not exist yet */ }

  // Get manually created CRM clients
  let crmClients: any[] = [];
  try {
    const [rows] = await p.query(`SELECT * FROM crm_clients ORDER BY id DESC`);
    crmClients = (rows as any[]).map(r => ({
      id: 10000 + r.id, // offset to avoid ID collision
      code: r.code || '',
      nameCn: r.name || '',
      nameEn: r.name_en || '',
      email: r.email || '',
      phone: r.phone || '',
      address: r.address || '',
      idType: r.id_type || '',
      idNumber: r.id_number || '',
      idExpiry: r.id_expiry || '',
      idIssuingCountry: r.id_issuing_country || '',
      dateOfBirth: r.date_of_birth || '',
      gender: r.gender || '',
      bankName: r.bank_name || '',
      bankAccount: r.bank_account || '',
      bankAccountType: r.bank_account_type || '',
      bankCurrency: r.bank_currency || '',
      markupPercent: r.markup_percent != null ? Number(r.markup_percent) : null,
      isProfessionalInvestor: r.is_professional_investor != null ? !!r.is_professional_investor : true,
      entityType: r.entity_type || '',
      businessNature: r.business_nature || '',
      countryOfIncorporation: r.country_of_incorporation || '',
      dateOfIncorporation: r.date_of_incorporation || '',
      certOfIncorporationNo: r.cert_of_incorporation_no || '',
      businessRegistrationNo: r.business_registration_no || '',
      registeredAddress: r.registered_address || '',
      businessAddress: r.business_address || '',
      officePhone: r.office_phone || '',
      fax: r.fax || '',
      website: r.website || '',
      contactName: r.contact_name || '',
      contactTitle: r.contact_title || '',
      contactPhone: r.contact_phone || '',
      contactEmail: r.contact_email || '',
      segment: r.segment || 'Individual',
      tier: r.tier || 'Bronze',
      rm: r.rm || '',
      aum: Number(r.aum) || 0,
      status: r.status || '活跃',
      onboardedDate: r.onboarded_date || null,
      lastContact: r.last_contact,
      createdAt: r.created_at,
      source: 'manual',
    }));
  } catch { /* table may not exist */ }

  return [...appClients, ...crmClients];
}

/** Create a manual CRM client */
export async function createCrmClient(p: any, data: any) {
  await ensureCrmTables(p);

  // Check duplicate code
  if (data.code) {
    const [existing] = await p.query('SELECT id FROM crm_clients WHERE code = ?', [data.code]);
    if ((existing as any[]).length > 0) {
      throw new Error(`客户编号 ${data.code} 已存在`);
    }
  }

  const [result] = await p.query(
    `INSERT INTO crm_clients (code, account_number, client_type, channel, name, name_en, phone, email, address, status, segment, tier, rm, aum)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.code || null,
      data.accountNumber || null,
      data.clientType || '10',
      data.channel || '0',
      data.nameCn || data.name || '',
      data.nameEn || '',
      data.phone || '',
      data.email || '',
      data.address || '',
      data.status || '活跃',
      data.segment || 'Individual',
      data.tier || 'Bronze',
      data.rm || null,
      data.aum || 0,
    ]
  );
  return result;
}

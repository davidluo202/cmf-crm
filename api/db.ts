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
      segment: r.segment || 'Individual',
      tier: r.tier || 'Bronze',
      rm: r.rm || '',
      aum: Number(r.aum) || 0,
      status: r.status || '活跃',
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

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:XCBgJFsPbtJgiaCGaKgQXxnnhTJzyusL@switchyard.proxy.rlwy.net:45054/railway',
  ssl: { rejectUnauthorized: false },
  max: 3,
});

// Generate 14-digit client code: AA-B-C-YYYY-SSSSSS
async function generateClientCode(): Promise<{ clientCode: string; bcan: string }> {
  // Get next sequence number
  const seqRes = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM clients');
  const nextId = parseInt(seqRes.rows[0].next_id) || 1;
  const bcan = String(nextId).padStart(6, '0');
  const year = new Date().getFullYear();
  // Format: 10-1-0-YYYY-SSSSSS
  const clientCode = `10-1-0-${year}-${bcan}`;
  return { clientCode, bcan };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { applicationCode, personalInfo, documents, approvalInfo } = req.body;

  if (!applicationCode || !personalInfo) {
    return res.status(400).json({ success: false, error: '缺少申请编号或个人信息' });
  }

  try {
    const pi = personalInfo;
    const email = (pi.email || '').toLowerCase();

    // Check if client already exists by email
    const existingClient = await pool.query('SELECT id, code FROM clients WHERE LOWER(email) = $1', [email]);

    let clientCode: string;
    let bcan: string;
    let clientId: number;

    if (existingClient.rows.length > 0) {
      // Client exists — update info, return existing code
      clientId = existingClient.rows[0].id;
      clientCode = existingClient.rows[0].code;
      bcan = clientCode.split('-').pop() || '';

      await pool.query(`
        UPDATE clients SET
          name = $1, name_en = $2, surname = $3, firstname = $4,
          surname_en = $5, firstname_en = $6, gender = $7,
          phone = $8, email = $9, address = $10,
          status = '活跃', updated_at = NOW()
        WHERE id = $11
      `, [
        (pi.surname || '') + (pi.firstname || ''),
        ((pi.firstnameEn || '') + ' ' + (pi.surnameEn || '')).trim(),
        pi.surname, pi.firstname, pi.surnameEn, pi.firstnameEn,
        pi.gender, pi.phone, email, pi.address,
        clientId,
      ]);
    } else {
      // New client — generate code and insert
      const codes = await generateClientCode();
      clientCode = codes.clientCode;
      bcan = codes.bcan;
      const code668 = `668${bcan.slice(-4).padStart(4, '0')}`;

      const insertRes = await pool.query(`
        INSERT INTO clients (code, name, name_en, surname, firstname, surname_en, firstname_en,
          gender, phone, email, address, status, markup_percent, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '活跃', 0.3, NOW(), NOW())
        RETURNING id
      `, [
        code668,
        (pi.surname || '') + (pi.firstname || ''),
        ((pi.firstnameEn || '') + ' ' + (pi.surnameEn || '')).trim(),
        pi.surname, pi.firstname, pi.surnameEn, pi.firstnameEn,
        pi.gender, pi.phone, email, pi.address,
      ]);
      clientId = insertRes.rows[0].id;

      // Create portal_users entry if not exists
      const puExists = await pool.query('SELECT id FROM portal_users WHERE email = $1', [email]);
      if (puExists.rows.length === 0 && email) {
        await pool.query(
          'INSERT INTO portal_users (email, name, password_hash) VALUES ($1, $2, $3)',
          [email, (pi.surname || '') + (pi.firstname || ''), 'pending_setup']
        );
      }

      // Initialize client_balances
      await pool.query(
        'INSERT INTO client_balances (client_id) VALUES ($1) ON CONFLICT (client_id) DO NOTHING',
        [clientId]
      );
    }

    // Store onboarding reference
    // (In future: store documents, approval info, etc.)

    return res.json({
      success: true,
      clientCode,
      bcan,
      clientId,
      code668: `668${bcan.slice(-4).padStart(4, '0')}`,
      applicationCode,
    });
  } catch (err: any) {
    console.error('Onboarding import error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

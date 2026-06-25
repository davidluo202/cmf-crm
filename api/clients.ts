import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool, ensureCrmColumns, generateAccountNumber } from './db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pool = getPool();
  await ensureCrmColumns(pool);

  try {
    const { id, action } = req.query;

    // GET /api/clients?action=next-code — return next available client code + account number
    if (req.method === 'GET' && action === 'next-code') {
      const clientType = (req.query.clientType as string) || '10';
      const channel = (req.query.channel as string) || '0';
      const result = await generateAccountNumber(pool, clientType as any, channel as any);
      return res.json({ success: true, ...result });
    }

    // GET /api/clients?id=X — single client
    if (req.method === 'GET' && id) {
      const r = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
      if (!r.rows[0]) return res.status(404).json({ success: false, error: 'Client not found' });
      return res.json({ success: true, data: mapRow(r.rows[0]) });
    }

    // GET /api/clients — list all
    if (req.method === 'GET') {
      const r = await pool.query(
        'SELECT c.*, pu.id AS portal_user_id FROM clients c LEFT JOIN portal_users pu ON LOWER(c.email) = LOWER(pu.email) ORDER BY c.id DESC'
      );
      return res.json({ success: true, data: r.rows.map(mapRow) });
    }

    // POST /api/clients — create new client (CRM is the single source of client codes)
    // 支持两种模式：
    //   1. 自动生成编号（默认）：不传 code/accountNumber
    //   2. 手工补录（已有客户）：传入 code 和/或 accountNumber，系统直接使用
    if (req.method === 'POST') {
      const b = req.body || {};
      const clientType = b.clientType || '10';
      const channel = b.channel || '0';

      let code: string;
      let accountNumber: string;

      if (b.code || b.accountNumber) {
        // 手工补录模式：使用传入的编号
        code = b.code || '';
        accountNumber = b.accountNumber || '';
        // 检查编号是否已存在
        if (code) {
          const dup = await pool.query('SELECT id FROM clients WHERE code = $1', [code]);
          if (dup.rows.length > 0) {
            return res.status(400).json({ success: false, error: `客户编号 ${code} 已存在` });
          }
        }
        if (accountNumber) {
          const dup2 = await pool.query('SELECT id FROM clients WHERE account_number = $1', [accountNumber]);
          if (dup2.rows.length > 0) {
            return res.status(400).json({ success: false, error: `账户号 ${accountNumber} 已存在` });
          }
        }
      } else {
        // 自动生成编号
        const gen = await generateAccountNumber(pool, clientType as any, channel as any);
        code = gen.code;
        accountNumber = gen.accountNumber;
      }

      const r = await pool.query(
        `INSERT INTO clients (code, account_number, client_type, channel, name, name_en, phone, email, address, bank_name, bank_account, bank_account_type, bank_currency, markup_percent, status, segment, tier, rm, aum, onboarded_date, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),NOW()) RETURNING *`,
        [
          code,
          accountNumber,
          clientType,
          channel,
          b.nameCn || b.name || '',
          b.nameEn || '',
          b.phone || '',
          b.email || '',
          b.address || '',
          b.bankName || '',
          b.bankAccount || '',
          b.bankAccountType || 'checking',
          b.bankCurrency || 'HKD',
          b.markupPercent ?? 0.3,
          b.status || '活跃',
          b.segment || 'Individual',
          b.tier || 'Bronze',
          b.rm || null,
          b.aum || 0,
          b.onboardedDate || null,
        ]
      );
      return res.json({ success: true, data: mapRow(r.rows[0]) });
    }

    // PUT /api/clients?id=X — update client
    if (req.method === 'PUT' && id) {
      const b = req.body || {};
      const fields: string[] = [];
      const vals: any[] = [];
      let idx = 1;

      const addField = (col: string, val: any) => {
        if (val !== undefined) { fields.push(`${col} = $${idx++}`); vals.push(val); }
      };

      addField('name', b.nameCn ?? b.name);
      addField('name_en', b.nameEn);
      addField('phone', b.phone);
      addField('email', b.email);
      addField('address', b.address);
      addField('bank_name', b.bankName);
      addField('bank_account', b.bankAccount);
      addField('bank_account_type', b.bankAccountType);
      addField('bank_currency', b.bankCurrency);
      addField('markup_percent', b.markupPercent);
      addField('status', b.status);
      addField('segment', b.segment);
      addField('tier', b.tier);
      addField('rm', b.rm);
      addField('aum', b.aum);
      addField('last_contact', b.lastContact);
      addField('onboarded_date', b.onboardedDate);

      if (fields.length === 0) return res.json({ success: true, message: 'No fields to update' });

      fields.push(`updated_at = NOW()`);
      vals.push(id);

      const r = await pool.query(
        `UPDATE clients SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        vals
      );
      if (!r.rows[0]) return res.status(404).json({ success: false, error: 'Client not found' });
      return res.json({ success: true, data: mapRow(r.rows[0]) });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('CRM clients API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

function mapRow(r: any) {
  return {
    id: r.id,
    code: r.code,
    accountNumber: r.account_number || '',
    bcan: r.account_number ? r.account_number.slice(-6) : '',
    clientType: r.client_type || '10',
    channel: r.channel || '0',
    nameCn: r.name,
    nameEn: r.name_en || '',
    phone: r.phone || '',
    email: r.email || '',
    address: r.address || '',
    bankName: r.bank_name || '',
    bankAccount: r.bank_account || '',
    bankAccountType: r.bank_account_type || 'checking',
    bankCurrency: r.bank_currency || 'HKD',
    markupPercent: r.markup_percent != null ? Number(r.markup_percent) : 0.3,
    status: r.status || '活跃',
    segment: r.segment || 'Individual',
    tier: r.tier || 'Bronze',
    rm: r.rm || '',
    aum: Number(r.aum) || 0,
    lastContact: r.last_contact,
    onboardedDate: r.onboarded_date,
    hasPortalAccount: !!r.portal_user_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

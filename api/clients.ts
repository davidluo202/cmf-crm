import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let pool: any;
  try {
    const { getPool } = await import('./db.js');
    pool = getPool();
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'DB init failed: ' + err.message });
  }

  try {
    const { getAllClients, createCrmClient } = await import('./db.js');
    // GET /api/clients - list all clients, or single client with ?id=
    if (req.method === 'GET') {
      const clients = await getAllClients(pool);
      const qid = req.query.id as string | undefined;
      if (qid) {
        const client = clients.find((c: any) => String(c.id) === qid || String(c.code) === qid);
        return res.json({ success: true, data: client || null });
      }
      return res.json({ success: true, data: clients });
    }

    // PUT /api/clients?id= - update client
    if (req.method === 'PUT') {
      const clientId = req.query.id as string;
      if (!clientId) return res.status(400).json({ success: false, error: 'Missing id' });
      const b = req.body || {};
      const { ensureCrmTables } = await import('./db.js');
      await ensureCrmTables(pool);

      // Try updating crm_clients first (check raw id, offset id, or code)
      const parsedId = parseInt(clientId);
      const rawId = parsedId >= 10000 ? parsedId - 10000 : parsedId;
      const [existing] = await pool.query('SELECT id FROM crm_clients WHERE id = ? OR id = ? OR code = ?', [clientId, rawId, clientId]);
      if ((existing as any[]).length > 0) {
        const row = (existing as any[])[0];
        const fields: string[] = [];
        const vals: any[] = [];
        const map: Record<string, string> = {
          code: 'code', nameCn: 'name', nameEn: 'name_en', phone: 'phone', email: 'email', address: 'address',
          segment: 'segment', tier: 'tier', rm: 'rm', aum: 'aum', markupPercent: 'markup_percent',
          status: 'status', idType: 'id_type', idNumber: 'id_number', gender: 'gender',
          dateOfBirth: 'date_of_birth', idExpiry: 'id_expiry', idIssuingCountry: 'id_issuing_country',
        };
        const dateCols = new Set(['date_of_birth', 'id_expiry']);
        for (const [k, col] of Object.entries(map)) {
          if (b[k] !== undefined) {
            fields.push(`${col} = ?`);
            let val = b[k];
            if (dateCols.has(col)) {
              // Convert empty strings to null, strip time from ISO dates for MySQL DATE
              val = val ? String(val).slice(0, 10) : null;
              if (val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) val = null;
            }
            vals.push(val);
          }
        }
        if (fields.length > 0) {
          vals.push(row.id);
          await pool.query(`UPDATE crm_clients SET ${fields.join(', ')} WHERE id = ?`, vals);
        }
        // Read back the full updated record
        const [updatedRows] = await pool.query('SELECT * FROM crm_clients WHERE id = ?', [row.id]);
        const r = (updatedRows as any[])[0];
        const updated = r ? {
          id: 10000 + r.id,
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
          segment: r.segment || 'Individual',
          tier: r.tier || 'Bronze',
          rm: r.rm || '',
          aum: Number(r.aum) || 0,
          markupPercent: r.markup_percent != null ? Number(r.markup_percent) : null,
          status: r.status || '活跃',
          onboardedDate: r.onboarded_date || null,
          createdAt: r.created_at,
        } : null;
        return res.json({ success: true, data: updated });
      }

      // For account_opening clients, update personal_basic_info
      const numId = parseInt(clientId);
      if (!isNaN(numId)) {
        const fields: string[] = [];
        const vals: any[] = [];
        if (b.nameCn !== undefined) { fields.push('chineseName = ?'); vals.push(b.nameCn); }
        if (b.nameEn !== undefined) { fields.push('englishName = ?'); vals.push(b.nameEn); }
        if (fields.length > 0) {
          vals.push(numId);
          await pool.query(`UPDATE personal_basic_info SET ${fields.join(', ')} WHERE applicationId = ?`, vals);
        }
        const clients = await getAllClients(pool);
        const updated = clients.find((c: any) => c.id === numId);
        return res.json({ success: true, data: updated || null });
      }

      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    // POST /api/clients - create manual client
    if (req.method === 'POST') {
      const b = req.body || {};
      const data: any = {
        nameCn: b.nameCn || b.name || '',
        nameEn: b.nameEn || '',
        phone: b.phone || '',
        email: b.email || '',
        clientType: b.clientType || '10',
        channel: b.channel || '0',
        segment: b.segment || 'Individual',
        status: b.status || '活跃',
      };
      if (b.code) data.code = b.code;
      if (b.accountNumber) data.accountNumber = b.accountNumber;

      await createCrmClient(pool, data);
      return res.json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('CRM clients API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

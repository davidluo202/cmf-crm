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

      // Try updating crm_clients first
      const [existing] = await pool.query('SELECT id FROM crm_clients WHERE id = ? OR code = ?', [clientId, clientId]);
      if ((existing as any[]).length > 0) {
        const row = (existing as any[])[0];
        const fields: string[] = [];
        const vals: any[] = [];
        const map: Record<string, string> = {
          nameCn: 'name', nameEn: 'name_en', phone: 'phone', email: 'email', address: 'address',
          segment: 'segment', tier: 'tier', rm: 'rm', aum: 'aum', markupPercent: 'markup_percent',
          status: 'status', idType: 'id_type', idNumber: 'id_number', gender: 'gender',
          dateOfBirth: 'date_of_birth', idExpiry: 'id_expiry', idIssuingCountry: 'id_issuing_country',
        };
        for (const [k, col] of Object.entries(map)) {
          if (b[k] !== undefined) { fields.push(`${col} = ?`); vals.push(b[k]); }
        }
        if (fields.length > 0) {
          vals.push(row.id);
          await pool.query(`UPDATE crm_clients SET ${fields.join(', ')} WHERE id = ?`, vals);
        }
        const clients = await getAllClients(pool);
        const updated = clients.find((c: any) => String(c.code) === String(clientId) || String(c.id) === String(clientId));
        return res.json({ success: true, data: updated || null });
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

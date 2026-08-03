import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let pool: any;
  try {
    const { getPool, ensureCrmTables } = await import('./db.js');
    pool = getPool();
    await ensureCrmTables(pool);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'DB init failed: ' + err.message });
  }

  try {
    // Helper: resolve clientId (code or offset id) to raw crm_clients.id
    async function resolveClientId(clientId: string): Promise<number | null> {
      // Try code match first
      const [byCode] = await pool.query('SELECT id FROM crm_clients WHERE code = ?', [clientId]);
      if ((byCode as any[]).length > 0) return (byCode as any[])[0].id;
      // Fall back to numeric id
      const parsed = parseInt(clientId);
      if (!isNaN(parsed)) {
        const rawId = parsed >= 10000 ? parsed - 10000 : parsed;
        const [byId] = await pool.query('SELECT id FROM crm_clients WHERE id = ?', [rawId]);
        if ((byId as any[]).length > 0) return (byId as any[])[0].id;
      }
      return null;
    }

    // GET ?clientId=X — list bank accounts for a client
    if (req.method === 'GET') {
      const clientId = req.query.clientId as string;
      if (!clientId) return res.status(400).json({ success: false, error: 'Missing clientId' });
      const rawId = await resolveClientId(clientId);
      if (rawId === null) return res.json({ success: true, data: [] });
      const [rows] = await pool.query(
        'SELECT * FROM client_bank_accounts WHERE client_id = ? ORDER BY is_primary DESC, id ASC',
        [rawId]
      );
      return res.json({ success: true, data: rows });
    }

    // POST — add new bank account
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.clientId) return res.status(400).json({ success: false, error: 'Missing clientId' });
      const rawId = await resolveClientId(b.clientId);
      if (rawId === null) return res.status(400).json({ success: false, error: 'Client not found' });
      const [result] = await pool.query(
        `INSERT INTO client_bank_accounts (client_id, bank_name, bank_account, bank_currency, bank_account_type, branch_code, is_primary)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          rawId,
          b.bankName || '',
          b.bankAccount || '',
          b.bankCurrency || 'HKD',
          b.bankAccountType || 'saving',
          b.branchCode || '',
          b.isPrimary ? 1 : 0,
        ]
      );
      return res.json({ success: true, id: (result as any).insertId });
    }

    // DELETE ?id=X — delete a bank account
    if (req.method === 'DELETE') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ success: false, error: 'Missing id' });
      await pool.query('DELETE FROM client_bank_accounts WHERE id = ?', [parseInt(id)]);
      return res.json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('client-banks API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

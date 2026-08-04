import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
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
    async function resolveClientId(clientId: string): Promise<number | null> {
      const [byCode] = await pool.query('SELECT id FROM crm_clients WHERE code = ?', [clientId]);
      if ((byCode as any[]).length > 0) return (byCode as any[])[0].id;
      const parsed = parseInt(clientId);
      if (!isNaN(parsed)) {
        const rawId = parsed >= 10000 ? parsed - 10000 : parsed;
        const [byId] = await pool.query('SELECT id FROM crm_clients WHERE id = ?', [rawId]);
        if ((byId as any[]).length > 0) return (byId as any[])[0].id;
      }
      return null;
    }

    function generateTxCode(type: string): string {
      const prefix = type === 'deposit' ? 'DEP' : type === 'withdrawal' ? 'WDR' : 'TRF';
      const now = new Date();
      const yy = String(now.getFullYear()).slice(2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const seq = String(Math.floor(Math.random() * 9000) + 1000);
      return `${prefix}-${yy}${mm}${dd}-${seq}`;
    }

    // GET ?clientId=X
    if (req.method === 'GET') {
      const clientId = req.query.clientId as string;
      if (!clientId) return res.status(400).json({ success: false, error: 'Missing clientId' });
      const rawId = await resolveClientId(clientId);
      if (rawId === null) return res.json({ success: true, data: [] });
      const [rows] = await pool.query(
        'SELECT * FROM fund_transactions WHERE client_id = ? ORDER BY created_at DESC',
        [rawId]
      );
      return res.json({ success: true, data: rows });
    }

    // POST — create transaction
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.clientId) return res.status(400).json({ success: false, error: 'Missing clientId' });
      if (!b.type || !b.amount || !b.currency) return res.status(400).json({ success: false, error: 'Missing type, amount or currency' });
      const rawId = await resolveClientId(b.clientId);
      if (rawId === null) return res.status(400).json({ success: false, error: 'Client not found' });

      // Generate unique tx_code (retry once if collision)
      let txCode = generateTxCode(b.type);
      try {
        const [exist] = await pool.query('SELECT id FROM fund_transactions WHERE tx_code = ?', [txCode]);
        if ((exist as any[]).length > 0) txCode = generateTxCode(b.type);
      } catch {}

      // Auto-run sanctions check before creating transaction
      let txStatus = 'pending';
      let remarksExtra = '';
      try {
        const [clientRows] = await pool.query('SELECT name, name_en FROM crm_clients WHERE id = ?', [rawId]);
        const clientRow = (clientRows as any[])[0];
        if (clientRow) {
          const SANCTIONS_API_KEY = '60e75f2d08a24d98a967f6315f00b251';
          const namesToScreen = [clientRow.name, clientRow.name_en].filter(Boolean);
          let allHits: any[] = [];
          for (const name of namesToScreen) {
            const url = `https://api.sanctions.io/search/?min_score=0.80&name=${encodeURIComponent(name)}&data_source=all`;
            const sr = await fetch(url, { headers: { 'Authorization': `Bearer ${SANCTIONS_API_KEY}`, 'Accept': 'application/json' } });
            if (sr.ok) {
              const sd = await sr.json();
              for (const hit of (sd.results || [])) {
                if (!allHits.some((h: any) => h.name === hit.name && h.data_source === hit.data_source)) {
                  allHits.push(hit);
                }
              }
            }
          }
          const displayName = [clientRow.name, clientRow.name_en].filter(Boolean).join(' / ');
          const sanctionStatus = allHits.length > 0 ? 'alert' : 'clear';
          await pool.query(
            `INSERT INTO sanctions_checks (client_id, trigger_type, client_name, hit_count, hits, status) VALUES (?, 'transaction', ?, ?, ?, ?)`,
            [rawId, displayName, allHits.length, JSON.stringify(allHits), sanctionStatus]
          );
          if (allHits.length > 0) {
            txStatus = 'pending_review';
            remarksExtra = `[AML Alert: ${allHits.length} hit(s)]`;
          }
        }
      } catch { /* sanctions check failure should not block transaction */ }

      const finalRemarks = remarksExtra ? `${remarksExtra} ${b.remarks || ''}`.trim() : (b.remarks || '');

      const [result] = await pool.query(
        `INSERT INTO fund_transactions (tx_code, client_id, type, amount, currency, bank_name, bank_account, remarks, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [txCode, rawId, b.type, b.amount, b.currency, b.bankName || '', b.bankAccount || '', finalRemarks, txStatus]
      );
      return res.json({ success: true, id: (result as any).insertId, txCode, amlStatus: txStatus === 'pending_review' ? 'alert' : 'clear' });
    }

    // PUT ?id=X — update status
    if (req.method === 'PUT') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ success: false, error: 'Missing id' });
      const b = req.body || {};
      if (!b.status) return res.status(400).json({ success: false, error: 'Missing status' });

      const updates: string[] = ['status = ?'];
      const params: any[] = [b.status];
      if (b.status === 'confirmed' || b.status === 'completed') {
        updates.push('confirmed_at = NOW()');
        if (b.confirmedBy) { updates.push('confirmed_by = ?'); params.push(b.confirmedBy); }
      }
      if (b.remarks !== undefined) { updates.push('remarks = ?'); params.push(b.remarks); }
      params.push(parseInt(id));

      await pool.query(`UPDATE fund_transactions SET ${updates.join(', ')} WHERE id = ?`, params);
      return res.json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('fund-transactions API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
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

  // Ensure client_holdings table exists
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_holdings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        security_code VARCHAR(50) NOT NULL,
        security_name VARCHAR(200) NOT NULL,
        exchange_name VARCHAR(20) DEFAULT 'OTC',
        quantity DECIMAL(18,2) NOT NULL,
        cost_price DECIMAL(18,8),
        market_price DECIMAL(18,8),
        currency VARCHAR(10) DEFAULT 'USD',
        acquired_date DATE,
        status VARCHAR(20) DEFAULT 'active',
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch { /* table may already exist */ }

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

    // GET ?clientId=X — list active holdings
    if (req.method === 'GET') {
      const clientId = req.query.clientId as string;
      if (!clientId) return res.status(400).json({ success: false, error: 'Missing clientId' });
      const rawId = await resolveClientId(clientId);
      if (rawId === null) return res.json({ success: true, data: [] });
      const [rows] = await pool.query(
        "SELECT * FROM client_holdings WHERE client_id = ? AND status = 'active' ORDER BY acquired_date DESC",
        [rawId]
      );
      return res.json({ success: true, data: rows });
    }

    // POST — create holding
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.clientId) return res.status(400).json({ success: false, error: 'Missing clientId' });
      if (!b.securityCode || !b.securityName || !b.quantity) return res.status(400).json({ success: false, error: 'Missing securityCode, securityName or quantity' });
      const rawId = await resolveClientId(b.clientId);
      if (rawId === null) return res.status(400).json({ success: false, error: 'Client not found' });

      const [result] = await pool.query(
        `INSERT INTO client_holdings (client_id, security_code, security_name, exchange_name, quantity, cost_price, market_price, currency, acquired_date, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rawId, b.securityCode, b.securityName, b.exchangeName || 'OTC', b.quantity, b.costPrice || null, b.marketPrice || null, b.currency || 'USD', b.acquiredDate || null, b.remarks || null]
      );
      return res.json({ success: true, id: (result as any).insertId });
    }

    // PUT ?id=X — update holding
    if (req.method === 'PUT') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ success: false, error: 'Missing id' });
      const b = req.body || {};

      const updates: string[] = [];
      const params: any[] = [];

      if (b.securityCode !== undefined) { updates.push('security_code = ?'); params.push(b.securityCode); }
      if (b.securityName !== undefined) { updates.push('security_name = ?'); params.push(b.securityName); }
      if (b.exchangeName !== undefined) { updates.push('exchange_name = ?'); params.push(b.exchangeName); }
      if (b.quantity !== undefined) { updates.push('quantity = ?'); params.push(b.quantity); }
      if (b.costPrice !== undefined) { updates.push('cost_price = ?'); params.push(b.costPrice); }
      if (b.marketPrice !== undefined) { updates.push('market_price = ?'); params.push(b.marketPrice); }
      if (b.currency !== undefined) { updates.push('currency = ?'); params.push(b.currency); }
      if (b.acquiredDate !== undefined) { updates.push('acquired_date = ?'); params.push(b.acquiredDate); }
      if (b.status !== undefined) { updates.push('status = ?'); params.push(b.status); }
      if (b.remarks !== undefined) { updates.push('remarks = ?'); params.push(b.remarks); }

      if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });

      params.push(parseInt(id));
      await pool.query(`UPDATE client_holdings SET ${updates.join(', ')} WHERE id = ?`, params);
      return res.json({ success: true });
    }

    // DELETE ?id=X — soft delete
    if (req.method === 'DELETE') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ success: false, error: 'Missing id' });
      await pool.query("UPDATE client_holdings SET status = 'closed' WHERE id = ?", [parseInt(id)]);
      return res.json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('client-holdings API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let pool: any;
  try {
    const { getPool, ensureCrmTables } = await import('./db.js');
    pool = getPool();
    await ensureCrmTables(pool);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'DB init: ' + err.message });
  }

  const { action, clientId } = req.query;

  try {
    // GET /api/fund?action=balance&clientId=X - 查询余额
    if (req.method === 'GET' && action === 'balance' && clientId) {
      const [rows] = await pool.query('SELECT * FROM client_balances WHERE client_id = ?', [clientId]);
      const bal = (rows as any[])[0] || null;
      return res.json({ success: true, data: bal });
    }

    // GET /api/fund?action=history&clientId=X - 查询交易流水
    if (req.method === 'GET' && action === 'history' && clientId) {
      const [rows] = await pool.query(
        'SELECT * FROM fund_transactions WHERE client_id = ? ORDER BY created_at DESC LIMIT 100',
        [clientId]
      );
      return res.json({ success: true, data: rows });
    }

    // GET /api/fund?action=all-balances - 查询所有客户余额
    if (req.method === 'GET' && action === 'all-balances') {
      const [rows] = await pool.query('SELECT * FROM client_balances ORDER BY client_id');
      return res.json({ success: true, data: rows });
    }

    // POST /api/fund?action=transfer - 资金划转
    if (req.method === 'POST' && action === 'transfer') {
      const { fromClientId, toClientId, amount, currency, txCode, sourceSystem, remarks } = req.body || {};
      if (!fromClientId || !toClientId || !amount || !currency) {
        return res.status(400).json({ success: false, error: '参数不完整' });
      }

      const cur = currency.toLowerCase();
      const balCol = `balance_${cur}`;
      const amt = parseFloat(amount);

      // Check from balance
      const [fromBal] = await pool.query('SELECT * FROM client_balances WHERE client_id = ?', [fromClientId]);
      const from = (fromBal as any[])[0];
      if (!from) return res.status(400).json({ success: false, error: '借方账户不存在' });
      const available = parseFloat(from[balCol] || 0) - parseFloat(from[`frozen_${cur}`] || 0);
      if (available < amt) return res.status(400).json({ success: false, error: `${currency}余额不足，可用${available.toFixed(2)}` });

      // Execute transfer
      await pool.query(`UPDATE client_balances SET ${balCol} = ${balCol} - ? WHERE client_id = ?`, [amt, fromClientId]);
      await pool.query(
        `INSERT INTO client_balances (client_id, ${balCol}) VALUES (?, ?) ON DUPLICATE KEY UPDATE ${balCol} = ${balCol} + ?`,
        [toClientId, amt, amt]
      );

      // Record transaction
      const code = txCode || `TXN-${Date.now()}`;
      await pool.query(
        `INSERT INTO fund_transactions (tx_code, client_id, type, amount, currency, source_system, remarks) VALUES (?, ?, 'transfer_out', ?, ?, ?, ?)`,
        [code + '-OUT', fromClientId, amt, currency, sourceSystem || 'CRM', remarks || '']
      );
      await pool.query(
        `INSERT INTO fund_transactions (tx_code, client_id, type, amount, currency, source_system, remarks) VALUES (?, ?, 'transfer_in', ?, ?, ?, ?)`,
        [code + '-IN', toClientId, amt, currency, sourceSystem || 'CRM', remarks || '']
      );

      return res.json({ success: true, txCode: code });
    }

    // POST /api/fund?action=deposit - 入金
    if (req.method === 'POST' && action === 'deposit') {
      const { clientId: cid, amount, currency, bankName, bankAccount, remarks, sourceSystem } = req.body || {};
      if (!cid || !amount || !currency) {
        return res.status(400).json({ success: false, error: '参数不完整' });
      }

      const cur = currency.toLowerCase();
      const amt = parseFloat(amount);
      const code = `DEP-${Date.now()}`;

      // Create balance record if not exists, then add
      await pool.query(
        `INSERT INTO client_balances (client_id, balance_${cur}) VALUES (?, ?) ON DUPLICATE KEY UPDATE balance_${cur} = balance_${cur} + ?`,
        [cid, amt, amt]
      );

      await pool.query(
        `INSERT INTO fund_transactions (tx_code, client_id, type, amount, currency, bank_name, bank_account, status, source_system, remarks) VALUES (?, ?, 'deposit', ?, ?, ?, ?, 'confirmed', ?, ?)`,
        [code, cid, amt, currency, bankName || '', bankAccount || '', sourceSystem || 'CRM', remarks || '']
      );

      return res.json({ success: true, txCode: code });
    }

    // POST /api/fund?action=withdraw - 出金
    if (req.method === 'POST' && action === 'withdraw') {
      const { clientId: cid, amount, currency, bankName, bankAccount, remarks, sourceSystem } = req.body || {};
      if (!cid || !amount || !currency) {
        return res.status(400).json({ success: false, error: '参数不完整' });
      }

      const cur = currency.toLowerCase();
      const amt = parseFloat(amount);

      // Check balance
      const [bal] = await pool.query('SELECT * FROM client_balances WHERE client_id = ?', [cid]);
      const b = (bal as any[])[0];
      if (!b) return res.status(400).json({ success: false, error: '账户不存在' });
      const available = parseFloat(b[`balance_${cur}`] || 0) - parseFloat(b[`frozen_${cur}`] || 0);
      if (available < amt) return res.status(400).json({ success: false, error: `${currency}余额不足` });

      const code = `WDR-${Date.now()}`;
      await pool.query(`UPDATE client_balances SET balance_${cur} = balance_${cur} - ? WHERE client_id = ?`, [amt, cid]);

      await pool.query(
        `INSERT INTO fund_transactions (tx_code, client_id, type, amount, currency, bank_name, bank_account, status, source_system, remarks) VALUES (?, ?, 'withdraw', ?, ?, ?, ?, 'confirmed', ?, ?)`,
        [code, cid, amt, currency, bankName || '', bankAccount || '', sourceSystem || 'CRM', remarks || '']
      );

      return res.json({ success: true, txCode: code });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed or missing action' });
  } catch (err: any) {
    console.error('Fund API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

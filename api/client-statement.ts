import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  let pool: any;
  try {
    const { getPool, ensureCrmTables } = await import('./db.js');
    pool = getPool();
    await ensureCrmTables(pool);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'DB init failed: ' + err.message });
  }

  try {
    const { clientId, type, month, date } = req.query as Record<string, string>;
    if (!clientId) return res.status(400).json({ success: false, error: 'Missing clientId' });
    if (!type || (type === 'monthly' && !month) || (type === 'daily' && !date)) {
      return res.status(400).json({ success: false, error: 'Missing type/month/date' });
    }

    // Resolve client
    async function resolveClientId(cid: string): Promise<number | null> {
      const [byCode] = await pool.query('SELECT id FROM crm_clients WHERE code = ?', [cid]);
      if ((byCode as any[]).length > 0) return (byCode as any[])[0].id;
      const parsed = parseInt(cid);
      if (!isNaN(parsed)) {
        const rawId = parsed >= 10000 ? parsed - 10000 : parsed;
        const [byId] = await pool.query('SELECT id FROM crm_clients WHERE id = ?', [rawId]);
        if ((byId as any[]).length > 0) return (byId as any[])[0].id;
      }
      return null;
    }

    const rawId = await resolveClientId(clientId);
    if (rawId === null) return res.status(404).json({ success: false, error: 'Client not found' });

    // Load client info
    const [clientRows] = await pool.query('SELECT * FROM crm_clients WHERE id = ?', [rawId]);
    const clientInfo = (clientRows as any[])[0] || {};

    // Determine period bounds
    let periodStart: string, periodEnd: string, periodLabel: string;
    if (type === 'monthly') {
      // month = "2026-06"
      const [yr, mo] = month.split('-').map(Number);
      periodStart = `${month}-01 00:00:00`;
      const lastDay = new Date(yr, mo, 0).getDate();
      periodEnd = `${month}-${String(lastDay).padStart(2, '0')} 23:59:59`;
      periodLabel = month;
    } else {
      // daily, date = "2026-08-03"
      periodStart = `${date} 00:00:00`;
      periodEnd = `${date} 23:59:59`;
      periodLabel = date;
    }

    // Transactions in period
    const [txRows] = await pool.query(
      `SELECT * FROM fund_transactions WHERE client_id = ? AND created_at >= ? AND created_at <= ? AND status IN ('confirmed','completed') ORDER BY created_at ASC`,
      [rawId, periodStart, periodEnd]
    );
    const transactions = txRows as any[];

    // All completed/confirmed transactions before period start (for opening balance)
    const [prevRows] = await pool.query(
      `SELECT type, amount, currency FROM fund_transactions WHERE client_id = ? AND created_at < ? AND status IN ('confirmed','completed')`,
      [rawId, periodStart]
    );

    // Compute balances by currency
    function computeBalance(rows: any[]): Record<string, number> {
      const bal: Record<string, number> = {};
      for (const r of rows) {
        const cur = r.currency || 'HKD';
        if (!bal[cur]) bal[cur] = 0;
        if (r.type === 'deposit') bal[cur] += Number(r.amount);
        else if (r.type === 'withdrawal') bal[cur] -= Number(r.amount);
        // transfer_otc does not change cash balance
      }
      return bal;
    }

    const openingBalance = computeBalance(prevRows as any[]);

    // Closing = opening + completed transactions in period
    const periodCompleted = transactions.filter((t: any) => t.status === 'confirmed' || t.status === 'completed');
    const closingBalance = { ...openingBalance };
    for (const r of periodCompleted) {
      const cur = r.currency || 'HKD';
      if (!closingBalance[cur]) closingBalance[cur] = 0;
      if (r.type === 'deposit') closingBalance[cur] += Number(r.amount);
      else if (r.type === 'withdrawal') closingBalance[cur] -= Number(r.amount);
    }

    return res.json({
      success: true,
      data: {
        client: {
          id: rawId,
          code: clientInfo.code || '',
          name: clientInfo.name || '',
          nameEn: clientInfo.name_en || '',
          email: clientInfo.email || '',
        },
        period: { type, label: periodLabel, start: periodStart, end: periodEnd },
        transactions,
        openingBalance,
        closingBalance,
      },
    });
  } catch (err: any) {
    console.error('client-statement API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

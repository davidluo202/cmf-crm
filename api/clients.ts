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
    // GET /api/clients - list all clients
    if (req.method === 'GET') {
      const clients = await getAllClients(pool);
      return res.json({ success: true, data: clients });
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

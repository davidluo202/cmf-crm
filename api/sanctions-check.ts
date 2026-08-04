import type { VercelRequest, VercelResponse } from '@vercel/node';

const SANCTIONS_API_KEY = '60e75f2d08a24d98a967f6315f00b251';

async function screenName(name: string): Promise<{ hitCount: number; hits: any[] }> {
  const url = `https://api.sanctions.io/search/?min_score=0.80&name=${encodeURIComponent(name)}&data_source=all`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${SANCTIONS_API_KEY}`, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Sanctions API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const hits = (data.results || []).map((r: any) => ({
    confidence_score: r.confidence_score ?? 0,
    name: r.name ?? '',
    alt_names: r.alt_names ?? [],
    entity_type: r.entity_type ?? '',
    address: r.address ?? '',
    data_source: r.data_source ?? '',
  }));
  return { hitCount: data.count ?? hits.length, hits };
}

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
    return res.status(500).json({ success: false, error: 'DB init failed: ' + err.message });
  }

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

  try {
    // GET ?clientId=X — return screening history
    if (req.method === 'GET') {
      const clientId = req.query.clientId as string;
      if (!clientId) return res.status(400).json({ success: false, error: 'Missing clientId' });
      const rawId = await resolveClientId(clientId);
      if (rawId === null) return res.json({ success: true, data: [] });
      const [rows] = await pool.query(
        'SELECT * FROM sanctions_checks WHERE client_id = ? ORDER BY checked_at DESC',
        [rawId]
      );
      return res.json({ success: true, data: rows });
    }

    // POST {clientId, trigger} — run new screening
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.clientId) return res.status(400).json({ success: false, error: 'Missing clientId' });
      if (!b.trigger) return res.status(400).json({ success: false, error: 'Missing trigger' });

      const rawId = await resolveClientId(b.clientId);
      if (rawId === null) return res.status(400).json({ success: false, error: 'Client not found' });

      // Fetch client names
      const [clientRows] = await pool.query('SELECT name, name_en FROM crm_clients WHERE id = ?', [rawId]);
      const clientRow = (clientRows as any[])[0];
      if (!clientRow) return res.status(400).json({ success: false, error: 'Client not found' });

      const nameCn = clientRow.name || '';
      const nameEn = clientRow.name_en || '';
      const displayName = [nameCn, nameEn].filter(Boolean).join(' / ');

      // Screen both names, merge hits (deduplicate by name)
      let totalHitCount = 0;
      let allHits: any[] = [];

      const namesToScreen = [nameCn, nameEn].filter(Boolean);
      for (const name of namesToScreen) {
        const result = await screenName(name);
        totalHitCount = Math.max(totalHitCount, result.hitCount);
        for (const hit of result.hits) {
          if (!allHits.some(h => h.name === hit.name && h.data_source === hit.data_source)) {
            allHits.push(hit);
          }
        }
      }

      const status = allHits.length > 0 ? 'alert' : 'clear';

      await pool.query(
        `INSERT INTO sanctions_checks (client_id, trigger_type, client_name, hit_count, hits, status, checked_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [rawId, b.trigger, displayName, allHits.length, JSON.stringify(allHits), status, b.checkedBy || null]
      );

      return res.json({
        success: true,
        hitCount: allHits.length,
        hits: allHits,
        clear: allHits.length === 0,
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('sanctions-check API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

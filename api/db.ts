import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

/** Ensure CRM-specific columns exist on the clients table */
export async function ensureCrmColumns(p: Pool) {
  const additions = [
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS segment VARCHAR(50) DEFAULT 'Individual'",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'Bronze'",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS rm VARCHAR(100)",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS aum NUMERIC DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_contact TIMESTAMP",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarded_date DATE",
  ];
  for (const sql of additions) {
    try { await p.query(sql); } catch { /* column may already exist */ }
  }
}

/** Generate next client code: C0001, C0002, ... using MAX to avoid collision */
export async function nextClientCode(p: Pool): Promise<string> {
  const res = await p.query(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 2) AS INTEGER)), 0) + 1 AS next_num FROM clients WHERE code ~ '^C[0-9]+$'"
  );
  const nextNum = res.rows[0]?.next_num || 1;
  return `C${String(nextNum).padStart(4, '0')}`;
}

import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL || 'postgresql://postgres:XCBgJFsPbtJgiaCGaKgQXxnnhTJzyusL@switchyard.proxy.rlwy.net:45054/railway';
    pool = new Pool({
      connectionString: url,
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
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS account_number VARCHAR(20)",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type VARCHAR(10) DEFAULT '10'",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS channel VARCHAR(2) DEFAULT '0'",
  ];
  for (const sql of additions) {
    try { await p.query(sql); } catch { /* column may already exist */ }
  }
}

/**
 * 客户统一账户编号规则（14位）
 *
 * 结构：AA-B-C-YYYY-SSSSSS
 *   AA = 客户类型（10=零售, 20=企业, 30=机构）
 *   B  = 账户类型（暂统一设为0）
 *   C  = 渠道（0=线上, 1=线下）
 *   YYYY = 开户年份
 *   SSSSSS = 全局递增流水号（同时即BCAN号码）
 *
 * 示例：10102026000001（第1位零售线上客户）
 * BCAN = 最后6位 = 000001
 * 港交所标识 = BSU667-000001
 */
export async function generateAccountNumber(
  p: Pool,
  clientType: '10' | '20' | '30' = '10',
  channel: '0' | '1' = '0',
): Promise<{ accountNumber: string; bcan: string; code: string }> {
  // 全局递增流水号：取所有account_number最后6位的最大值+1
  const res = await p.query(
    "SELECT COALESCE(MAX(CAST(RIGHT(account_number, 6) AS INTEGER)), 0) + 1 AS next_seq FROM clients WHERE account_number IS NOT NULL AND LENGTH(account_number) = 14"
  );
  let nextSeq = res.rows[0]?.next_seq || 1;

  // 同时检查旧格式 C0001 的最大编号，确保流水号不低于已有客户数
  const oldRes = await p.query(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 2) AS INTEGER)), 0) AS max_old FROM clients WHERE code ~ '^C[0-9]+$'"
  );
  const maxOld = oldRes.rows[0]?.max_old || 0;
  if (nextSeq <= maxOld) nextSeq = maxOld + 1;

  const year = new Date().getFullYear().toString();
  const seqStr = String(nextSeq).padStart(6, '0');
  const accountNumber = `${clientType}0${channel}${year}${seqStr}`;
  const bcan = seqStr;
  // 兼容旧格式：同时生成C0001格式的code供现有系统使用
  const code = `C${String(nextSeq).padStart(4, '0')}`;

  return { accountNumber, bcan, code };
}

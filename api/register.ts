import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { Pool } from 'pg';

const DATABASE_URL = process.env.SSO_DATABASE_URL || 'postgresql://postgres:XCBgJFsPbtJgiaCGaKgQXxnnhTJzyusL@switchyard.proxy.rlwy.net:45054/railway';

let pool: Pool;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL, ssl: false });
  }
  return pool;
}

async function ensureAdminUsersTable(): Promise<void> {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(200) UNIQUE NOT NULL,
      name VARCHAR(100),
      password_hash VARCHAR(200) NOT NULL,
      role VARCHAR(50) DEFAULT 'staff',
      created_at TIMESTAMP DEFAULT NOW(),
      last_login TIMESTAMP
    )
  `);
}

function getSecret(): string {
  return process.env.VERIFY_SECRET || 'cmf-crm-verify-secret';
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateJWT(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, name, verifiedToken } = req.body;

  if (!verifiedToken) {
    return res.status(400).json({ error: '請先完成郵箱驗證' });
  }

  // Verify the verified token
  try {
    const decoded = JSON.parse(Buffer.from(verifiedToken, 'base64').toString());
    if (!decoded.verified || Date.now() > decoded.expires) {
      return res.status(400).json({ error: '驗證已過期，請重新驗證' });
    }
    const verifiedPayload = `verified:${decoded.email}:${decoded.expires}`;
    const expectedSig = crypto.createHmac('sha256', getSecret()).update(verifiedPayload).digest('hex');
    if (decoded.sig !== expectedSig) {
      return res.status(400).json({ error: '無效的驗證令牌' });
    }
    if (decoded.email !== email?.toLowerCase()) {
      return res.status(400).json({ error: '郵箱與驗證不匹配' });
    }
  } catch {
    return res.status(400).json({ error: '無效的驗證令牌' });
  }

  if (!email || !email.toLowerCase().endsWith('@cmfinancial.com')) {
    return res.status(400).json({ error: '僅限 @cmfinancial.com 郵箱註冊' });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: '密碼長度至少8位' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '請提供姓名' });
  }

  try {
    await ensureAdminUsersTable();
    const p = getPool();
    const passwordHash = hashPassword(password);
    const emailLower = email.toLowerCase();

    // Check if user already exists
    const existing = await p.query('SELECT id FROM admin_users WHERE email = $1', [emailLower]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: '該郵箱已註冊' });
    }

    await p.query(
      'INSERT INTO admin_users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)',
      [emailLower, name.trim(), passwordHash, 'staff']
    );

    const token = generateJWT({ email: emailLower, name: name.trim(), role: 'staff' });

    return res.status(200).json({
      success: true,
      token,
      user: { email: emailLower, name: name.trim() },
    });
  } catch (err) {
    console.error('[SSO Register] DB error:', err);
    return res.status(500).json({ error: '服務器錯誤，請稍後重試' });
  }
}

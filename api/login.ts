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

  const { email, password, captchaToken, captchaCode } = req.body;

  // Validate captcha first
  if (!captchaToken || !captchaCode) {
    return res.status(400).json({ error: '請輸入驗證碼' });
  }

  try {
    const decoded = JSON.parse(Buffer.from(captchaToken, 'base64').toString());
    if (Date.now() > decoded.expires) {
      return res.status(400).json({ error: '驗證碼已過期，請刷新' });
    }
    const payload = `captcha:${decoded.text}:${decoded.expires}`;
    const expectedSig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
    if (decoded.sig !== expectedSig) {
      return res.status(400).json({ error: '無效的驗證碼' });
    }
    if (captchaCode.toLowerCase() !== decoded.text) {
      return res.status(400).json({ error: '驗證碼不正確' });
    }
  } catch {
    return res.status(400).json({ error: '無效的驗證碼' });
  }

  if (!email || !email.toLowerCase().endsWith('@cmfinancial.com')) {
    return res.status(400).json({ error: '僅限 @cmfinancial.com 郵箱登入' });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: '請輸入密碼（至少8位）' });
  }

  try {
    await ensureAdminUsersTable();
    const p = getPool();
    const result = await p.query('SELECT * FROM admin_users WHERE email = $1', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '賬號不存在，請先註冊' });
    }

    const user = result.rows[0];
    const inputHash = hashPassword(password);

    if (inputHash !== user.password_hash) {
      return res.status(401).json({ error: '郵箱或密碼錯誤' });
    }

    // Update last_login
    await p.query('UPDATE admin_users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = generateJWT({ email: user.email, name: user.name, role: user.role });

    return res.status(200).json({
      success: true,
      token,
      user: { email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('[SSO Login] DB error:', err);
    return res.status(500).json({ error: '服務器錯誤，請稍後重試' });
  }
}

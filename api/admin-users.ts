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

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function getSecret(): string {
  return process.env.VERIFY_SECRET || 'cmf-crm-verify-secret';
}

function verifyToken(token: string): any {
  try {
    const parts = token.replace('Bearer ', '').split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const header = parts[0];
    const body = parts[1];
    const expectedSig = crypto.createHmac('sha256', getSecret()).update(`${header}.${body}`).digest('base64url');
    if (expectedSig !== parts[2]) return null;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function ensureTable(p: Pool) {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers.authorization || '';
  const user = verifyToken(auth);
  if (!user) return res.status(401).json({ success: false, error: '未登录' });

  const p = getPool();
  await ensureTable(p);

  const { action } = req.query;

  try {
    // GET /api/admin-users - list all users
    if (req.method === 'GET') {
      const r = await p.query('SELECT id, email, name, role, last_login, created_at FROM admin_users ORDER BY id');
      return res.json({
        success: true,
        data: r.rows.map(row => ({
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role,
          lastLogin: row.last_login,
          createdAt: row.created_at,
        })),
      });
    }

    // POST /api/admin-users - create user
    if (req.method === 'POST' && !action) {
      const { email, name, password, role } = req.body || {};
      if (!email || !name || !password) {
        return res.status(400).json({ success: false, error: '请填写完整' });
      }
      const hash = hashPassword(password);
      await p.query(
        'INSERT INTO admin_users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)',
        [email.toLowerCase(), name, hash, role || 'staff']
      );
      return res.json({ success: true });
    }

    // POST /api/admin-users?action=reset-password
    if (req.method === 'POST' && action === 'reset-password') {
      const { userId, password } = req.body || {};
      if (!userId || !password || password.length < 8) {
        return res.status(400).json({ success: false, error: '密码至少8位' });
      }
      const hash = hashPassword(password);
      await p.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, userId]);
      return res.json({ success: true });
    }

    // POST /api/admin-users?action=update-role
    if (req.method === 'POST' && action === 'update-role') {
      const { userId, role } = req.body || {};
      if (!userId || !role) {
        return res.status(400).json({ success: false, error: '参数不完整' });
      }
      await p.query('UPDATE admin_users SET role = $1 WHERE id = $2', [role, userId]);
      return res.json({ success: true });
    }

    // POST /api/admin-users?action=change-password (self)
    if (req.method === 'POST' && action === 'change-password') {
      const { password } = req.body || {};
      if (!password || password.length < 8) {
        return res.status(400).json({ success: false, error: '密码至少8位' });
      }
      const hash = hashPassword(password);
      await p.query('UPDATE admin_users SET password_hash = $1 WHERE email = $2', [hash, user.email]);
      return res.json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Admin users API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

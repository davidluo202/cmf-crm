import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function getSecret(): string {
  return process.env.VERIFY_SECRET || 'cmf-crm-verify-secret';
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + getSecret()).digest('hex');
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

  const passwordHash = hashPassword(password);
  const token = generateJWT({ email: email.toLowerCase(), name: name.trim(), role: 'user' });

  // DB integration later - for now return success with user info
  return res.status(200).json({
    success: true,
    token,
    user: { email: email.toLowerCase(), name: name.trim(), passwordHash },
  });
}

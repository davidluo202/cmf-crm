import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function getSecret(): string {
  return process.env.VERIFY_SECRET || 'cmf-crm-verify-secret';
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

  // DB integration later - for now accept any valid-format login
  const token = generateJWT({ email: email.toLowerCase(), role: 'user' });

  return res.status(200).json({
    success: true,
    token,
    user: { email: email.toLowerCase() },
  });
}

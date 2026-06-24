import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function getSecret(): string {
  return process.env.VERIFY_SECRET || 'cmf-crm-verify-secret';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, code } = req.body;
  if (!token || !code) {
    return res.status(400).json({ error: '缺少驗證碼或令牌' });
  }

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const { email, code: storedCode, expires, sig } = decoded;

    if (Date.now() > expires) {
      return res.status(400).json({ error: '驗證碼已過期，請重新獲取' });
    }

    const payload = `${email}:${storedCode}:${expires}`;
    const expectedSig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
    if (sig !== expectedSig) {
      return res.status(400).json({ error: '無效的令牌' });
    }

    if (code !== storedCode) {
      return res.status(400).json({ error: '驗證碼不正確' });
    }

    const verifiedExpires = Date.now() + 30 * 60 * 1000;
    const verifiedPayload = `verified:${email}:${verifiedExpires}`;
    const verifiedSig = crypto.createHmac('sha256', getSecret()).update(verifiedPayload).digest('hex');
    const verifiedToken = Buffer.from(JSON.stringify({ email, verified: true, expires: verifiedExpires, sig: verifiedSig })).toString('base64');

    return res.status(200).json({ success: true, email, verifiedToken });
  } catch {
    return res.status(400).json({ error: '無效的令牌格式' });
  }
}

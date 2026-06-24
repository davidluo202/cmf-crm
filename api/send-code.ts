import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function getSecret(): string {
  return process.env.VERIFY_SECRET || 'cmf-crm-verify-secret';
}

function signCode(email: string, code: string, expires: number): string {
  const payload = `${email}:${code}:${expires}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ email, code, expires, sig })).toString('base64');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: '請提供有效的郵箱地址' });
  }

  if (!email.toLowerCase().endsWith('@cmfinancial.com')) {
    return res.status(400).json({ error: '僅限 @cmfinancial.com 郵箱註冊' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = Date.now() + 10 * 60 * 1000;
  const token = signCode(email.toLowerCase(), code, expires);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '誠港金融CRM <noreply@cmf-otc.com>',
        to: [email],
        subject: 'CRM系統驗證碼 - 誠港金融',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <p style="color: #334155; font-size: 15px; text-align: center; font-weight: bold; margin-bottom: 24px;">
              CM Financial CRM System<br/>誠港金融客戶管理系統
            </p>
            <p style="color: #334155; font-size: 14px;">您好，</p>
            <p style="color: #334155; font-size: 14px;">您正在註冊CRM系統帳號，您的驗證碼為：</p>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #1e40af;">${code}</span>
            </div>
            <p style="color: #64748b; font-size: 13px;">此驗證碼將在10分鐘後失效。如非本人操作，請忽略此郵件。</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
            <p style="color: #475569; font-size: 12px; text-align: center;">
              誠港金融股份有限公司 Canton Mutual Financial Limited<br/>
              此郵件由系統自動發送，請勿直接回覆。
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Resend API error:', response.status, errorData);
      return res.status(500).json({ error: '驗證碼發送失敗' });
    }

    return res.status(200).json({ success: true, token });
  } catch (error) {
    console.error('Failed to send email:', error);
    return res.status(500).json({ error: '驗證碼發送失敗' });
  }
}

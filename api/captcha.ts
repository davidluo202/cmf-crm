import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function getSecret(): string {
  return process.env.VERIFY_SECRET || 'cmf-crm-verify-secret';
}

function generateCaptchaText(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let text = '';
  for (let i = 0; i < 4; i++) {
    text += chars[Math.floor(Math.random() * chars.length)];
  }
  return text;
}

function generateCaptchaSvg(text: string): string {
  const width = 120;
  const height = 40;
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c'];

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="100%" height="100%" fill="#f8f9fa" rx="6"/>`;

  for (let i = 0; i < 4; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    const color = colors[Math.floor(Math.random() * colors.length)];
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="0.5" opacity="0.5"/>`;
  }

  for (let i = 0; i < 20; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const color = colors[Math.floor(Math.random() * colors.length)];
    svg += `<circle cx="${cx}" cy="${cy}" r="1" fill="${color}" opacity="0.5"/>`;
  }

  for (let i = 0; i < text.length; i++) {
    const x = 15 + i * 25;
    const y = 25 + (Math.random() * 8 - 4);
    const rotate = Math.random() * 30 - 15;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const fontSize = 20 + Math.floor(Math.random() * 6);
    svg += `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="${color}" transform="rotate(${rotate} ${x} ${y})">${text[i]}</text>`;
  }

  svg += '</svg>';
  return svg;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const text = generateCaptchaText();
  const svg = generateCaptchaSvg(text);
  const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  const expires = Date.now() + 5 * 60 * 1000;
  const payload = `captcha:${text.toLowerCase()}:${expires}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  const captchaToken = Buffer.from(JSON.stringify({ text: text.toLowerCase(), expires, sig })).toString('base64');

  return res.status(200).json({ image, captchaToken });
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const url = process.env.DATABASE_URL;
    res.json({ ok: true, hasDbUrl: !!url });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

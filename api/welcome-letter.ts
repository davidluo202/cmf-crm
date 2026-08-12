import type { VercelRequest, VercelResponse } from '@vercel/node';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';

interface WelcomeLetterBody {
  clientId: string;
  clientName: string;
  clientNameEn: string;
  accountNumber: string;
  email: string;
  onboardedDate: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateWelcomeLetterPDF(data: WelcomeLetterBody): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 50, right: 50 } });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Register CJK font
      let F = 'Helvetica';
      const fontPath = path.join(process.cwd(), 'api', 'fonts', 'NotoSansCJKtc-Regular.otf');
      try {
        if (fs.existsSync(fontPath)) {
          doc.registerFont('NotoSansCJK', fontPath);
          F = 'NotoSansCJK';
        }
      } catch { /* fallback to Helvetica */ }

      // Logo
      const logoPath = path.join(process.cwd(), 'public', 'logo-zh-official.jpg');
      try {
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 50, 30, { width: 120 });
        }
      } catch { /* no logo */ }

      const W = 495; // content width
      const ML = 50;
      let y = 90;

      // Title
      doc.font(F).fontSize(16).fillColor('#1a3a6a');
      doc.text('開戶通知及入金指引', ML, y, { width: W, align: 'center' });
      y += 25;
      doc.fontSize(10).fillColor('#555');
      doc.text('Account Opening Notice & Deposit Instructions', ML, y, { width: W, align: 'center' });
      y += 25;

      // Separator
      doc.moveTo(ML, y).lineTo(ML + W, y).lineWidth(1.5).strokeColor('#1a3a6a').stroke();
      y += 20;

      // Greeting
      doc.font(F).fontSize(11).fillColor('#222');
      doc.text('尊敬的客戶，您好！', ML, y);
      y += 20;
      doc.fontSize(10);
      doc.text('歡迎您成為本公司的客戶，我們已為您開立證券交易賬戶。詳情如下：', ML, y, { width: W });
      y += 30;

      // Account info table
      const displayName = [data.clientName, data.clientNameEn].filter(Boolean).join(' / ');
      const infoRows = [
        ['賬戶類型 Account Type', '現金賬戶 Cash Account'],
        ['賬戶名稱 Account Name', displayName],
        ['賬戶號碼 Account No.', data.accountNumber],
        ['開立日期 Opening Date', data.onboardedDate],
      ];

      const labelW = 180;
      const valW = W - labelW;
      for (const [label, value] of infoRows) {
        doc.rect(ML, y, labelW, 22).fillAndStroke('#f0f4fa', '#d1d5db');
        doc.rect(ML + labelW, y, valW, 22).fillAndStroke('#fff', '#d1d5db');
        doc.fillColor('#4b5563').fontSize(9).text(label, ML + 6, y + 6, { width: labelW - 12 });
        doc.fillColor('#111').fontSize(9).text(value, ML + labelW + 6, y + 6, { width: valW - 12 });
        y += 22;
      }

      y += 20;

      // Deposit instructions header
      doc.font(F).fontSize(12).fillColor('#1a3a6a');
      doc.text('誠港金融入金指引', ML, y);
      y += 20;

      doc.fontSize(10).fillColor('#1a3a6a');
      doc.text('第一步：請把您的資金存入以下銀行賬戶', ML, y);
      y += 18;

      // Bank table header
      const cols = [50, 130, 40, 150, 85, 60]; // widths
      const headers = ['幣種', '銀行名稱', '編號', '收款戶名', '收款賬號', '國際代碼'];
      let x = ML;
      for (let i = 0; i < headers.length; i++) {
        doc.rect(x, y, cols[i], 18).fillAndStroke('#1a3a6a', '#1a3a6a');
        doc.fillColor('#fff').fontSize(7).text(headers[i], x + 3, y + 5, { width: cols[i] - 6 });
        x += cols[i];
      }
      y += 18;

      // Bank rows
      const bankRows = [
        ['港幣', '中信銀行(國際)', '018', 'CANTON MUTUAL FINANCIAL LIMITED - CLIENT ACCOUNT', '744-2-37805600', '—'],
        ['美元', '中信銀行(國際)', '018', 'CANTON MUTUAL FINANCIAL LIMITED - CLIENT ACCOUNT', '744-2-37805601', 'KWHKHKHH'],
        ['人民幣', '中信銀行(國際)', '018', 'CANTON MUTUAL FINANCIAL LIMITED - CLIENT ACCOUNT', '744-2-37805618', 'KWHKHKHH'],
      ];

      for (const row of bankRows) {
        x = ML;
        const rowH = 28;
        for (let i = 0; i < row.length; i++) {
          doc.rect(x, y, cols[i], rowH).fillAndStroke('#fff', '#d1d5db');
          doc.fillColor('#222').fontSize(6.5).text(row[i], x + 3, y + 4, { width: cols[i] - 6 });
          x += cols[i];
        }
        y += rowH;
      }

      y += 15;
      doc.fontSize(10).fillColor('#1a3a6a');
      doc.text('第二步：請把存款憑證發送至郵箱：operation@cmfinancial.com', ML, y);
      y += 25;

      doc.fontSize(9).fillColor('#555');
      doc.text('感謝閣下選擇使用誠港金融股份有限公司一站式環球投資服務。感謝您的信任與支持！', ML, y, { width: W });

      // Footer — fixed at bottom of page
      const footerY = 760;
      doc.moveTo(ML, footerY).lineTo(ML + W, footerY).lineWidth(0.5).strokeColor('#ccc').stroke();
      doc.font(F).fontSize(7).fillColor('#888');
      doc.text('誠港金融股份有限公司 Canton Mutual Financial Limited | Units 2304-05, 23/F, 308 Des Voeux Road Central, Hong Kong | (852) 2598 1700 | CE No. BSU667', ML, footerY + 6, { width: W, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function sendViaResend(
  to: string,
  clientName: string,
  pdfBuffer: Buffer,
): Promise<{ success: boolean; error?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };

  const displayName = clientName || 'Client';
  const emailBody = `尊敬的${displayName}客戶，您好！\n歡迎您成為本公司的客戶，我們已為您開立證券交易賬戶。\n詳情請見附件，謝謝！`;

  const payload = {
    from: 'customer-services@cmfinancial.com',
    to: [to],
    cc: ['jmou@cmfinancial.com', 'xluo@cmfinancial.com', 'operation@cmfinancial.com', 'compliance@cmfinancial.com'],
    subject: '歡迎成為誠港金融客戶 Welcome to Canton Mutual Financial',
    text: emailBody,
    attachments: [
      {
        filename: 'Welcome_Letter.pdf',
        content: pdfBuffer.toString('base64'),
      },
    ],
  };

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await resp.json();
  if (!resp.ok) {
    return { success: false, error: result.message || JSON.stringify(result) };
  }
  return { success: true, id: result.id };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { clientId, clientName, clientNameEn, accountNumber, email, onboardedDate } = req.body as WelcomeLetterBody;

  if (!email || !accountNumber) {
    return res.status(400).json({ success: false, error: '缺少必填字段：email, accountNumber' });
  }

  try {
    const pdfBuffer = await generateWelcomeLetterPDF({
      clientId, clientName, clientNameEn, accountNumber, email, onboardedDate,
    });

    const result = await sendViaResend(email, clientName || clientNameEn, pdfBuffer);

    if (!result.success) {
      return res.status(500).json({ success: false, error: '邮件发送失败: ' + result.error });
    }

    return res.status(200).json({ success: true, emailId: result.id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

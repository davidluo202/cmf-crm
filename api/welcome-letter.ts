import type { VercelRequest, VercelResponse } from '@vercel/node';

interface WelcomeLetterBody {
  clientId: string;
  clientName: string;
  clientNameEn: string;
  accountNumber: string;
  email: string;
  onboardedDate: string;
}

/** Build a minimal PDF with CJK text using embedded font-free approach.
 *  Since we have no pdfkit, we generate an HTML letter and convert to PDF
 *  via a lightweight raw-PDF builder that embeds text as UTF-16BE. */
function buildWelcomeLetterHtml(data: WelcomeLetterBody): string {
  const displayName = [data.clientName, data.clientNameEn].filter(Boolean).join(' / ');
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 40px 50px; }
  body { font-family: "SimSun","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",serif; font-size: 13px; color: #222; line-height: 1.8; }
  .header { text-align: center; border-bottom: 2px solid #1a3a6a; padding-bottom: 12px; margin-bottom: 24px; }
  .header h1 { font-size: 20px; color: #1a3a6a; margin: 0; letter-spacing: 4px; }
  .header .en { font-size: 12px; color: #555; margin-top: 2px; }
  .header .sub { font-size: 11px; color: #888; margin-top: 4px; }
  .section { margin-bottom: 18px; }
  .greeting { font-size: 14px; margin-bottom: 12px; }
  .info-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  .info-table td { padding: 4px 8px; vertical-align: top; }
  .info-table .label { color: #555; width: 100px; white-space: nowrap; }
  .bank-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  .bank-table th, .bank-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  .bank-table th { background: #f0f4fa; color: #1a3a6a; font-weight: 600; }
  .step { font-weight: 600; color: #1a3a6a; margin: 14px 0 6px; }
  .footer { border-top: 1px solid #ccc; padding-top: 16px; margin-top: 32px; font-size: 11px; color: #666; line-height: 1.6; }
</style>
</head>
<body>
<div class="header">
  <h1>誠港金融股份有限公司</h1>
  <div class="en">CANTON MUTUAL FINANCIAL LIMITED</div>
  <div class="sub">CE No.: BSU667 &nbsp;|&nbsp; 香港德輔道中308號 &nbsp;|&nbsp; (852) 2598 1700</div>
</div>

<div class="section">
  <div class="greeting">尊敬的客戶，您好！</div>
  <p>歡迎您成為本公司的客戶，我們已為您開立證券交易賬戶。詳情如下：</p>
  <table class="info-table">
    <tr><td class="label">賬戶類型：</td><td>現金賬戶</td></tr>
    <tr><td class="label">賬戶名稱：</td><td>${escapeHtml(displayName)}</td></tr>
    <tr><td class="label">賬戶號碼：</td><td>${escapeHtml(data.accountNumber)}</td></tr>
    <tr><td class="label">開立日期：</td><td>${escapeHtml(data.onboardedDate)}</td></tr>
  </table>
</div>

<div class="section">
  <h3 style="color:#1a3a6a;margin-bottom:8px;">誠港金融入金指引</h3>

  <div class="step">第一步：請把您的資金存入以下銀行賬戶</div>
  <table class="bank-table">
    <thead>
      <tr>
        <th>幣種</th><th>銀行名稱</th><th>銀行編號</th><th>收款戶名</th><th>收款賬號</th><th>國際代碼</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>港幣</td>
        <td>中信銀行（國際）有限公司</td>
        <td>018</td>
        <td>CANTON MUTUAL FINANCIAL LIMITED - CLIENT ACCOUNT</td>
        <td>744-2-37805600</td>
        <td>—</td>
      </tr>
      <tr>
        <td>美元</td>
        <td>中信銀行（國際）有限公司</td>
        <td>018</td>
        <td>CANTON MUTUAL FINANCIAL LIMITED - CLIENT ACCOUNT</td>
        <td>744-2-37805601</td>
        <td>KWHKHKHH</td>
      </tr>
      <tr>
        <td>人民幣</td>
        <td>中信銀行（國際）有限公司</td>
        <td>018</td>
        <td>CANTON MUTUAL FINANCIAL LIMITED - CLIENT ACCOUNT</td>
        <td>744-2-37805618</td>
        <td>KWHKHKHH</td>
      </tr>
    </tbody>
  </table>

  <div class="step">第二步：請把存款憑證發送至郵箱：operation@cmfinancial.com</div>
</div>

<div class="footer">
  <strong>誠港金融股份有限公司</strong><br>
  香港客服熱線：(852) 2598 1700<br>
  電郵地址：operation@cmfinancial.com<br>
  公司網址：www.cmfinancial.com
</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendViaResend(
  to: string,
  clientName: string,
  htmlContent: string,
): Promise<{ success: boolean; error?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY || '';

  // Encode HTML as base64 for the PDF-like attachment
  // Since we can't generate a real PDF without pdfkit, we send the HTML as an .html attachment
  // which renders identically when opened in any browser and can be printed to PDF
  const htmlBase64 = Buffer.from(htmlContent, 'utf-8').toString('base64');

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
        filename: 'Welcome_Letter.html',
        content: htmlBase64,
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
    const htmlContent = buildWelcomeLetterHtml({
      clientId, clientName, clientNameEn, accountNumber, email, onboardedDate,
    });

    const result = await sendViaResend(email, clientName || clientNameEn, htmlContent);

    if (!result.success) {
      return res.status(500).json({ success: false, error: '邮件发送失败: ' + result.error });
    }

    return res.status(200).json({ success: true, emailId: result.id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

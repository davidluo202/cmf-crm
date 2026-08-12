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

const BANK_NAME_TC = '中信銀行（國際）有限公司';
const BANK_NAME_SC = '中信银行（国际）有限公司';
const BANK_NAME_EN = 'China CITIC Bank International Limited';
const BANK_CODE = '018';
const BENEFICIARY = 'CANTON MUTUAL FINANCIAL LIMITED - CLIENT ACCOUNT';
const ACCT_HKD = '744-1-81145700';
const ACCT_USD = '744-1-81145701';
const ACCT_RMB = '744-1-81145718';
const SWIFT_USD = 'KWHKHKHH';
const SWIFT_RMB = 'KWHKHKHH';

const FOOTER_TC_LINE1 = '誠港金融股份有限公司';
const FOOTER_TC_LINE2 = '電話(852)2598 1700 | 傳真(852)2561 7028 | 郵箱customer-services@cmfinancial.com | 網址www.cmfinancial.com';
const FOOTER_TC_LINE3 = '地址:香港上環德輔道中308號23樓2304-5室 CE No. BSU667';

const FOOTER_EN_LINE1 = 'CANTON MUTUAL FINANCIAL LIMITED';
const FOOTER_EN_LINE2 = 'TEL(852)2598 1700 | FAX(852)2561 7028 | EMAIL customer-services@cmfinancial.com | WEB www.cmfinancial.com';
const FOOTER_EN_LINE3 = 'ADD: Units 2304-5, 23/F, 308 Des Voeux Road Central, Hong Kong CE No. BSU667';

function generateWelcomeLetterPDF(data: WelcomeLetterBody): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 30, left: 50, right: 50 } });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let F = 'Helvetica';
      const fontPath = path.join(process.cwd(), 'api', 'fonts', 'NotoSansCJKtc-Regular.otf');
      try {
        if (fs.existsSync(fontPath)) {
          doc.registerFont('NotoSansCJK', fontPath);
          F = 'NotoSansCJK';
        }
      } catch { /* fallback */ }

      const logoZh = path.join(process.cwd(), 'public', 'logo-zh-official.jpg');
      const logoEn = path.join(process.cwd(), 'public', 'logo-en-official.jpg');
      const W = 495;
      const ML = 50;
      const displayName = [data.clientName, data.clientNameEn].filter(Boolean).join(' / ');

      // Helper: draw logo
      function drawLogo(logoPath: string) {
        try {
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, ML, 30, { width: 120 });
          }
        } catch { /* no logo */ }
      }

      // Helper: draw separator
      function drawSep(y: number): number {
        doc.moveTo(ML, y).lineTo(ML + W, y).lineWidth(1.5).strokeColor('#1a3a6a').stroke();
        return y + 20;
      }

      // Helper: draw account info table
      function drawAccountTable(y: number, labels: string[]): number {
        const labelW = 180;
        const valW = W - labelW;
        const rows = [
          [labels[0], labels[4]],
          [labels[1], displayName],
          [labels[2], data.accountNumber],
          [labels[3], data.onboardedDate],
        ];
        for (const [label, value] of rows) {
          doc.rect(ML, y, labelW, 22).fillAndStroke('#f0f4fa', '#d1d5db');
          doc.rect(ML + labelW, y, valW, 22).fillAndStroke('#fff', '#d1d5db');
          doc.fillColor('#4b5563').fontSize(9).font(F).text(label, ML + 6, y + 6, { width: labelW - 12 });
          doc.fillColor('#111').fontSize(9).font(F).text(value, ML + labelW + 6, y + 6, { width: valW - 12 });
          y += 22;
        }
        return y;
      }

      // Helper: draw bank table
      function drawBankTable(
        y: number,
        headers: string[],
        bankName: string,
        currLabels: [string, string, string],
        noSwiftLabel: string,
      ): number {
        const cols = [50, 130, 40, 150, 85, 60];
        let x = ML;
        for (let i = 0; i < headers.length; i++) {
          doc.rect(x, y, cols[i], 18).fillAndStroke('#1a3a6a', '#1a3a6a');
          doc.fillColor('#fff').fontSize(7).font(F).text(headers[i], x + 3, y + 5, { width: cols[i] - 6 });
          x += cols[i];
        }
        y += 18;

        const bankRows = [
          [currLabels[0], bankName, BANK_CODE, BENEFICIARY, ACCT_HKD, 'KWHKHKHH'],
          [currLabels[1], bankName, BANK_CODE, BENEFICIARY, ACCT_USD, SWIFT_USD],
          [currLabels[2], bankName, BANK_CODE, BENEFICIARY, ACCT_RMB, SWIFT_RMB],
        ];

        for (const row of bankRows) {
          x = ML;
          const rowH = 28;
          for (let i = 0; i < row.length; i++) {
            doc.rect(x, y, cols[i], rowH).fillAndStroke('#fff', '#d1d5db');
            doc.fillColor('#222').fontSize(6.5).font(F).text(row[i], x + 3, y + 4, { width: cols[i] - 6 });
            x += cols[i];
          }
          y += rowH;
        }
        return y;
      }

      // Helper: draw footer — use page.write to bypass margin auto-pagination
      // A4=841.89pt, 10mm≈28pt, last line at ~814pt, first line at ~775pt
      function drawFooterTC() {
        doc.save();
        doc.font(F).fontSize(8).fillColor('#000');
        doc.text(FOOTER_TC_LINE1, ML, 775, { lineBreak: false });
        doc.fontSize(7).fillColor('#333');
        doc.text(FOOTER_TC_LINE2, ML, 788, { lineBreak: false });
        doc.text('地址：香港上環德輔道中308號23樓2304-5室', ML, 800, { lineBreak: false });
        doc.text('CE No. BSU667', ML + W - 80, 800, { lineBreak: false });
        doc.restore();
      }

      function drawFooterEN() {
        doc.save();
        doc.font(F).fontSize(8).fillColor('#000');
        doc.text(FOOTER_EN_LINE1, ML, 775, { lineBreak: false });
        doc.fontSize(7).fillColor('#333');
        doc.text(FOOTER_EN_LINE2, ML, 788, { lineBreak: false });
        doc.text('ADD: Units 2304-5, 23/F, 308 Des Voeux Road Central, Hong Kong', ML, 800, { lineBreak: false });
        doc.text('CE No. BSU667', ML + W - 80, 800, { lineBreak: false });
        doc.restore();
      }

      // ===================== PAGE 1: Traditional Chinese =====================
      drawLogo(logoZh);
      let y = 90;

      doc.font(F).fontSize(16).fillColor('#1a3a6a');
      doc.text('開戶通知及入金指引', ML, y, { width: W, align: 'center' });
      y += 30;
      y = drawSep(y);

      doc.font(F).fontSize(11).fillColor('#222');
      doc.text('尊敬的客戶，您好！', ML, y);
      y += 20;
      doc.fontSize(10);
      doc.text('歡迎您成為本公司的客戶，我們已為您開立證券交易賬戶。詳情如下：', ML, y, { width: W });
      y += 30;

      y = drawAccountTable(y, ['賬戶類型', '賬戶名稱', '賬戶號碼', '開立日期', '現金賬戶']);
      y += 20;

      doc.font(F).fontSize(12).fillColor('#1a3a6a');
      doc.text('誠港金融入金指引', ML, y);
      y += 20;
      doc.fontSize(10).fillColor('#1a3a6a');
      doc.text('第一步：請把您的資金存入以下銀行賬戶', ML, y);
      y += 18;

      y = drawBankTable(
        y,
        ['幣種', '銀行名稱', '銀行編號', '收款戶名', '收款賬號', '國際代碼'],
        BANK_NAME_TC, ['港幣', '美元', '人民幣'], '—',
      );
      y += 15;

      doc.fontSize(10).fillColor('#1a3a6a').font(F);
      doc.text('第二步：請把存款憑證發送至郵箱：operation@cmfinancial.com', ML, y);
      y += 25;

      doc.fontSize(9).fillColor('#555').font(F);
      doc.text('感謝閣下選擇使用誠港金融股份有限公司一站式環球投資服務。感謝您的信任與支持！', ML, y, { width: W });

      drawFooterTC();

      // ===================== PAGE 2: Simplified Chinese =====================
      doc.addPage({ size: 'A4', margins: { top: 60, bottom: 30, left: 50, right: 50 } });
      drawLogo(logoZh);
      y = 90;

      doc.font(F).fontSize(16).fillColor('#1a3a6a');
      doc.text('开户通知及入金指引', ML, y, { width: W, align: 'center' });
      y += 30;
      y = drawSep(y);

      doc.font(F).fontSize(11).fillColor('#222');
      doc.text('尊敬的客户，您好！', ML, y);
      y += 20;
      doc.fontSize(10);
      doc.text('欢迎您成为本公司的客户，我们已为您开立证券交易账户。详情如下：', ML, y, { width: W });
      y += 30;

      y = drawAccountTable(y, ['账户类型', '账户名称', '账户号码', '开立日期', '现金账户']);
      y += 20;

      doc.font(F).fontSize(12).fillColor('#1a3a6a');
      doc.text('诚港金融入金指引', ML, y);
      y += 20;
      doc.fontSize(10).fillColor('#1a3a6a');
      doc.text('第一步：请将您的资金存入以下银行账户', ML, y);
      y += 18;

      y = drawBankTable(
        y,
        ['币种', '银行名称', '银行编号', '收款户名', '收款账号', '国际代码'],
        BANK_NAME_SC, ['港币', '美元', '人民币'], '—',
      );
      y += 15;

      doc.fontSize(10).fillColor('#1a3a6a').font(F);
      doc.text('第二步：请把存款凭证发送至邮箱：operation@cmfinancial.com', ML, y);
      y += 25;

      doc.fontSize(9).fillColor('#555').font(F);
      doc.text('感谢阁下选择使用诚港金融股份有限公司一站式环球投资服务。感谢您的信任与支持！', ML, y, { width: W });

      drawFooterTC();

      // ===================== PAGE 3: English =====================
      doc.addPage({ size: 'A4', margins: { top: 60, bottom: 30, left: 50, right: 50 } });
      drawLogo(logoEn);
      y = 90;

      doc.font(F).fontSize(16).fillColor('#1a3a6a');
      doc.text('Account Opening Notice & Deposit Instructions', ML, y, { width: W, align: 'center' });
      y += 30;
      y = drawSep(y);

      doc.font(F).fontSize(11).fillColor('#222');
      doc.text('Dear Client,', ML, y);
      y += 20;
      doc.fontSize(10);
      doc.text('Welcome to Canton Mutual Financial Limited. We have opened a securities trading account for you. Details are as follows:', ML, y, { width: W });
      y += 30;

      const enInfoLabels = ['Account Type', 'Account Name', 'Account No.', 'Opening Date', 'Cash Account'];
      y = drawAccountTable(y, enInfoLabels);
      y += 20;

      doc.font(F).fontSize(12).fillColor('#1a3a6a');
      doc.text('Deposit Instructions', ML, y);
      y += 20;
      doc.fontSize(10).fillColor('#1a3a6a');
      doc.text('Step 1: Please deposit your funds into the following bank account', ML, y);
      y += 18;

      y = drawBankTable(
        y,
        ['Currency', 'Bank Name', 'Bank Code', 'Beneficiary', 'Account No.', 'SWIFT'],
        BANK_NAME_EN, ['HKD', 'USD', 'RMB'], '—',
      );
      y += 15;

      doc.fontSize(10).fillColor('#1a3a6a').font(F);
      doc.text('Step 2: Please send your deposit receipt to: operation@cmfinancial.com', ML, y);
      y += 25;

      doc.fontSize(9).fillColor('#555').font(F);
      doc.text('Thank you for choosing Canton Mutual Financial Limited. We appreciate your trust and support!', ML, y, { width: W });

      drawFooterEN();

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
    // cc: ['customer-services@cmfinancial.com', 'jmou@cmfinancial.com', 'xluo@cmfinancial.com', 'operation@cmfinancial.com', 'compliance@cmfinancial.com'], // 测试阶段暂不CC
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

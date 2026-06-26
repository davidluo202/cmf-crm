import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from './db';

// CMF Service Fee Schedule - stored in code, manageable via API
const FEE_SCHEDULE = {
  version: '2026-06-26',
  lastUpdated: '2026-06-26',

  hkStocks: {
    title: '港股交易服务',
    commission: {
      online: { rate: 0.00125, min: 88, currency: 'HKD', label: '网上交易佣金' },
      phone: { rate: 0.002, min: 100, currency: 'HKD', label: '电话交易佣金' },
      vipOnline: { rate: 0.001, min: 88, currency: 'HKD', label: 'VIP网上交易佣金' },
      vipPhone: { rate: 0.0015, min: 100, currency: 'HKD', label: 'VIP电话交易佣金' },
      large: { rate: 0.001, threshold: 1000000, currency: 'HKD', label: '大额交易佣金(≥100万)' },
    },
    statutory: {
      stampDuty: { rate: 0.001, label: '印花税', chargedBy: '香港政府', note: '买卖双方各付，四舍五入至最近整元' },
      sfcLevy: { rate: 0.000027, label: 'SFC交易征费', chargedBy: '证监会' },
      afrcLevy: { rate: 0.0000015, label: 'AFRC交易征费', chargedBy: '财务汇报局' },
      tradingFee: { rate: 0.0000565, label: '联交所交易费', chargedBy: '港交所' },
      settlementFee: { rate: 0.000042, min: 2, max: 100, currency: 'HKD', label: '中央结算费', chargedBy: 'HKSCC' },
      transferDeed: { amount: 5, currency: 'HKD', label: '转手纸印花税', chargedBy: '香港政府', note: '每张' },
    },
    custody: {
      fee: { rate: 0.15, per: '手/半年', min: 100, max: 2500, currency: 'HKD', label: '托管费', note: '每年5月31日及11月30日收取，半年交易额≥20万可豁免' },
      depositCCASS: { amount: 0, label: 'CCASS存入', note: '免费' },
      depositPhysical: { amount: 30, currency: 'HKD', label: '实物存入', note: '每股每笔' },
      withdrawCCASS: { amount: 3.5, per: '手', min: 30, max: 2500, currency: 'HKD', label: 'CCASS提取' },
      withdrawPhysical: { amount: 5, per: '手', min: 30, currency: 'HKD', label: '实物提取' },
      confirmation: { amount: 70, currency: 'HKD', label: '持仓确认函' },
    },
    corporateActions: {
      cashDividend: { rate: 0.005, min: 20, max: 2500, currency: 'HKD', label: '现金股息代收' },
      scripDividend: { amount: 2.5, per: '手', currency: 'HKD', label: '以股代息' },
      rightsHandling: { amount: 2, per: '手', min: 30, max: 2500, currency: 'HKD', label: '红股/供股权处理' },
    },
    ipo: {
      online: { amount: 50, currency: 'HKD', label: '网上认购', note: '现金≥100万可豁免' },
      offline: { amount: 100, currency: 'HKD', label: '电话/柜台认购', note: '现金≥100万可豁免' },
    },
  },

  stockConnect: {
    title: '沪/深港通（北向交易）',
    commission: {
      online: { rate: 0.00125, min: 88, currency: 'RMB', label: '网上交易佣金' },
      phone: { rate: 0.002, min: 100, currency: 'RMB', label: '电话交易佣金' },
      large: { rate: 0.001, threshold: 1000000, currency: 'RMB', label: '大额交易佣金(≥100万)' },
    },
    statutory: {
      handlingFee: { rate: 0.0000341, label: '经手费', chargedBy: '上交所/深交所' },
      managementFee: { rate: 0.00002, label: '证管费', chargedBy: '中国证监会' },
      transferFee: { rate: 0.00003, label: '过户费', chargedBy: 'ChinaClear+HKSCC', note: '0.001%+0.002%' },
      stampDuty: { rate: 0.0005, label: '印花税(卖方)', chargedBy: '中国国家税务总局', note: '仅卖方' },
    },
  },

  usStocks: {
    title: '美股交易',
    commission: {
      online: { rate: 0.0015, min: 15, currency: 'USD', label: '网上交易佣金' },
      phone: { rate: 0.0025, min: 25, currency: 'USD', label: '电话交易佣金' },
    },
    statutory: {
      withholdingTax: { rate: 0.30, label: '美国预扣税', note: '股息的30%，W-8BEN可享优惠' },
    },
  },

  otcDerivatives: {
    title: '场外衍生品（OTC期权）',
    premiumMarkup: { rate: 0.003, label: '权利金加点(默认)', note: 'CRM可按客户调整' },
    exerciseFee: { amount: 0, label: '行权结算费', note: '免费' },
    accountFee: { amount: 0, label: '账户管理费', note: '免费' },
  },

  funds: {
    title: '资金服务',
    deposit: { amount: 0, label: '入金', note: '免费' },
    withdrawHKD: { amount: 50, currency: 'HKD', label: '出金(HKD)' },
    withdrawOther: { amount: 100, currency: 'HKD', label: '出金(CNY/USD)' },
    marginRate: { label: '融资利率', note: 'Prime Rate + 2% p.a.' },
    overdueRate: { label: '逾期利息', note: 'Prime Rate + 5% p.a.' },
  },

  other: {
    title: '其他服务',
    reprintStatement1Y: { amount: 30, currency: 'HKD', label: '补打日结单(1年内)' },
    reprintStatementOver1Y: { amount: 60, currency: 'HKD', label: '补打日结单(超1年)' },
    transactionCopy: { amount: 250, currency: 'HKD', label: '交易记录副本' },
    realtimeQuote: { amount: 200, currency: 'HKD', label: '实时行情(月)', note: '月交易额≥100万可豁免' },
    smsAlert: { amount: 1, currency: 'HKD', label: 'SMS股价提醒', note: '每条，最低5元/月' },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { section } = req.query;
    if (section && typeof section === 'string' && section in FEE_SCHEDULE) {
      return res.json({ success: true, data: (FEE_SCHEDULE as any)[section] });
    }
    return res.json({ success: true, data: FEE_SCHEDULE });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

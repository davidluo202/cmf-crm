import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface StatementData {
  client: {
    id: number
    code: string
    name: string
    nameEn: string
    email: string
    rm?: string
    segment?: string
  }
  period: {
    type: string
    label: string
    start: string
    end: string
  }
  transactions: Array<{
    id: number
    tx_code: string
    type: string
    amount: string
    currency: string
    bank_name: string
    bank_account: string
    status: string
    remarks: string
    created_at: string
    settle_date?: string
  }>
  openingBalance: Record<string, number>
  closingBalance: Record<string, number>
}

// Fixed exchange rates (HKD base)
const EXCHANGE_RATES: Record<string, number> = {
  HKD: 1,
  USD: 7.78,
  CNY: 1.07,
  EUR: 8.55,
  GBP: 9.95,
}

function fmtAmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtDrCr(n: number, decimals = 2): string {
  if (n < 0) return `(${fmtAmt(Math.abs(n), decimals)})`
  return fmtAmt(n, decimals)
}

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US DOLLARS 美元',
  HKD: 'HONG KONG DOLLARS 港元',
  CNY: 'CHINESE YUAN 人民幣',
  EUR: 'EUROS 歐元',
  GBP: 'BRITISH POUNDS 英鎊',
}

export default function ClientStatement() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type') || 'monthly'
  const month = searchParams.get('month') || ''
  const date = searchParams.get('date') || ''

  const [data, setData] = useState<StatementData | null>(null)
  const [clientExtra, setClientExtra] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const params = new URLSearchParams({ clientId: id, type })
    if (type === 'monthly' && month) params.set('month', month)
    if (type === 'daily' && date) params.set('date', date)

    Promise.all([
      fetch(`${API_BASE}/api/client-statement?${params}`).then(r => r.json()),
      fetch(`${API_BASE}/api/clients?id=${id}`).then(r => r.json()),
    ])
      .then(([stmtData, clientData]) => {
        if (!stmtData.success) { setError(stmtData.error || '加载失败'); return }
        setData(stmtData.data)
        if (clientData.success && clientData.data) setClientExtra(clientData.data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, type, month, date])

  useEffect(() => {
    if (data) {
      const label = type === 'monthly' ? `月结单 ${data.period.label}` : `日结单 ${data.period.label}`
      document.title = `${data.client.name || data.client.nameEn} — ${label}`
    }
  }, [data, type])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial' }}>Loading...</div>
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: 'red', fontFamily: 'Arial' }}>Error: {error}</div>
  if (!data) return null

  const today = new Date()
  const printDate = today.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })

  // Determine statement date label
  let stmtDateLabel = ''
  let stmtRef = ''
  if (type === 'monthly') {
    const [yr, mo] = data.period.label.split('-')
    stmtDateLabel = `${yr}年${mo}月`
    const seq = String(data.client.id).padStart(4, '0')
    stmtRef = `MS-${data.period.label.replace('-', '')}-${seq}`
  } else {
    stmtDateLabel = data.period.label
    const seq = String(data.client.id).padStart(4, '0')
    stmtRef = `DS-${data.period.label.replace(/-/g, '')}-${seq}`
  }

  const clientName = clientExtra?.nameCn || data.client.name || '—'
  const clientNameEn = clientExtra?.nameEn || data.client.nameEn || '—'
  const displayName = clientNameEn !== '—' ? `${clientName} / ${clientNameEn}` : clientName
  const accountType = clientExtra?.segment === 'Corporate' ? '公司帳戶 Corporate' : clientExtra?.segment === 'Institutional' ? '機構帳戶 Institutional' : '個人帳戶 Individual'

  // Group transactions by currency
  const currencies = [...new Set([
    ...Object.keys(data.openingBalance),
    ...Object.keys(data.closingBalance),
    ...data.transactions.map(t => t.currency || 'HKD'),
  ])].filter(c => c)
  if (currencies.length === 0) currencies.push('HKD')

  // Compute running balances per currency
  function buildLedger(currency: string) {
    let balance = data!.openingBalance[currency] || 0
    const rows: Array<{ tx: any; drCrAmount: number; balance: number }> = []
    // Opening row
    rows.push({ tx: null, drCrAmount: 0, balance })
    for (const tx of data!.transactions.filter(t => (t.currency || 'HKD') === currency)) {
      const amt = Number(tx.amount)
      let drCrAmount = 0
      if (tx.type === 'deposit' || tx.type === 'deposit_and_transfer') { drCrAmount = amt; balance += amt }
      else if (tx.type === 'withdrawal') { drCrAmount = -amt; balance -= amt }
      else if (tx.type === 'transfer_otc') { drCrAmount = -amt; balance -= amt }
      else { drCrAmount = amt; balance += amt }
      rows.push({ tx, drCrAmount, balance })
    }
    return rows
  }

  // Totals for portfolio summary
  const totalCashHkd = Object.entries(data.closingBalance).reduce((sum, [cur, bal]) => {
    const rate = EXCHANGE_RATES[cur] || 1
    return sum + bal * rate
  }, 0)

  // Count total pages (1 base + 1 per currency with transactions)
  const totalPages = 1 + currencies.length

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #f0f0f0; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; margin: 0; }
          @page { margin: 5mm 12.7mm; size: A4; }
          .page-break { page-break-before: always; }
        }
        .stmt-page {
          max-width: 210mm;
          min-height: 297mm;
          margin: 0 auto 10px;
          padding: 20px 24px;
          font-family: "Arial", "PingFang TC", "Microsoft JhengHei", sans-serif;
          color: #1a1a1a;
          font-size: 12px;
          background: #fff;
          line-height: 1.4;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
        }
        .stmt-content { flex: 1; }

        /* Section title - simple text with bottom border */
        .section-title {
          font-size: 12px;
          font-weight: bold;
          color: #2c3e50;
          border-bottom: 1px solid #ccc;
          margin: 8px 0 4px;
          padding-bottom: 3px;
        }

        /* Client info */
        .client-info {
          display: flex;
          margin: 8px 0 12px;
          font-size: 13px;
          line-height: 1.8;
        }
        .client-info-left { flex: 0 0 60%; }
        .client-info-right { flex: 0 0 40%; }
        .client-info-label { color: #555; }
        .client-info-value { font-weight: 700; color: #1a1a1a; }

        /* Tables */
        .stmt-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin-bottom: 6px;
        }
        .stmt-table th {
          background: #2c3e50;
          color: #fff;
          padding: 5px 6px;
          font-size: 10.5px;
          font-weight: 600;
          text-align: left;
          border-bottom: 1px solid #fff;
        }
        .stmt-table th.num { text-align: right; }
        .stmt-table td {
          padding: 5px 6px;
          border-bottom: 1px solid #e0e0e0;
          vertical-align: top;
        }
        .stmt-table td.num {
          text-align: right;
          font-family: "Courier New", monospace;
        }
        .stmt-table .total-row td {
          background: #ecf0f1;
          font-weight: bold;
        }
        .stmt-table .opening-row td {
          color: #555;
          font-style: italic;
        }
        .stmt-table .closing-row td {
          background: #ecf0f1;
          font-weight: bold;
        }

        /* Footer */
        .stmt-footer {
          margin-top: auto;
          border-top: 1px solid #ccc;
          padding-top: 6px;
          page-break-inside: avoid;
        }
        .stmt-footer-body {
          font-size: 8px;
          color: #555;
          text-align: left;
          line-height: 1.6;
        }
        .stmt-footer-body .company-name {
          font-weight: bold;
          color: #2c3e50;
          font-size: 9px;
        }
        .stmt-page-num {
          text-align: center;
          font-size: 6pt;
          color: #999;
          margin-top: 2px;
        }

        /* Notes */
        .stmt-notes {
          font-size: 8px;
          color: #666;
          line-height: 1.5;
          margin-top: 8px;
        }
        .stmt-notes div { margin-bottom: 2px; }

        /* Currency label below table */
        .currency-label {
          font-size: 10px;
          color: #888;
          margin-bottom: 8px;
        }

        /* Tx ref line */
        .tx-ref {
          font-size: 10px;
          color: #888;
          font-family: monospace;
          margin-top: 1px;
        }
        .tx-remarks {
          font-size: 10px;
          color: #555;
          margin-top: 1px;
        }
      `}</style>

      {/* Floating action buttons */}
      <div className="no-print" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={() => navigate(`/crm/clients/${id}?tab=Accounts`)}
          style={{ background: '#6b7280', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        >
          返回
        </button>
        <button
          onClick={() => window.print()}
          style={{ background: '#2c3e50', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        >
          列印
        </button>
        <button
          onClick={async () => {
            const html2pdf = (await import('html2pdf.js')).default
            const el = document.querySelector('.stmt-page') as HTMLElement | null
            if (!el) return
            html2pdf().set({
              margin: [3, 3, 3, 3],
              filename: `${stmtRef}.pdf`,
              image: { type: 'jpeg', quality: 0.95 },
              html2canvas: { scale: 1.2, useCORS: true, windowWidth: 794 },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            } as any).from(el).save()
          }}
          style={{ background: '#4caf50', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        >
          下載PDF
        </button>
      </div>

      {/* ══ PAGE 1: Header + Portfolio Summary ══ */}
      <div className="stmt-page">
        <div className="stmt-content">

        {/* Logo */}
        <div style={{ marginBottom: 4 }}>
          <img src="/logo-zh-official.jpg" alt="誠港金融" style={{ height: 50 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', margin: '6px 0 10px' }}>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#2c3e50' }}>Daily Combined Statement of Account</div>
          <div style={{ fontSize: 16, color: '#2c3e50', marginTop: 2 }}>帳戶綜合日結單</div>
        </div>

        {/* Client Info - two column */}
        <div className="client-info">
          <div className="client-info-left">
            <div><span className="client-info-label">A/C Name 帳戶名稱：</span> <span className="client-info-value">{displayName}</span></div>
            <div><span className="client-info-label">A/C Number 帳戶號碼：</span> <span className="client-info-value">{data.client.code}</span></div>
            <div><span className="client-info-label">Account Type 帳戶類型：</span> <span className="client-info-value">{accountType}</span></div>
          </div>
          <div className="client-info-right">
            <div><span className="client-info-label">Statement Date 結單日期：</span> <span className="client-info-value">{stmtDateLabel}</span></div>
            <div><span className="client-info-label">Print Date 印製日期：</span> <span className="client-info-value">{printDate}</span></div>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="section-title">Portfolio Summary 投資組合總覽</div>
        <table className="stmt-table">
          <thead>
            <tr>
              <th></th>
              {currencies.map(c => <th key={c} className="num">{c} {c === 'USD' ? '美元' : c === 'HKD' ? '港元' : c === 'CNY' ? '人民幣' : c}</th>)}
              <th className="num">HKD Equivalent 港元等值</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bonds/Stocks</td>
              {currencies.map(c => <td key={c} className="num">0.00</td>)}
              <td className="num">0.00</td>
            </tr>
            <tr>
              <td>Cash Balance [1]</td>
              {currencies.map(c => <td key={c} className="num">{fmtAmt(data.closingBalance[c] || 0)}</td>)}
              <td className="num">{fmtAmt(totalCashHkd)}</td>
            </tr>
            <tr className="total-row">
              <td>Total</td>
              {currencies.map(c => <td key={c} className="num">{fmtAmt(data.closingBalance[c] || 0)}</td>)}
              <td className="num">{fmtAmt(totalCashHkd)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>
          * Exchange Rate 匯率: {currencies.filter(c => c !== 'HKD').map(c => `${c}/HKD = ${(EXCHANGE_RATES[c] || 1).toFixed(4)}`).join('  |  ')}
        </div>

        {/* Cash & Portfolio Movements per currency */}
        {currencies.map((currency, ci) => {
          const ledger = buildLedger(currency)
          const txRows = ledger.slice(1)
          const closingBal = data.closingBalance[currency] || 0
          return (
            <div key={currency} style={ci > 0 ? { marginTop: 8 } : undefined}>
              <div className="section-title">Cash & Portfolio Movements 現金及庫存異動{currencies.length > 1 ? ` (${currency})` : ''}</div>
              <table className="stmt-table">
                <thead>
                  <tr>
                    <th style={{ width: '11%', whiteSpace: 'nowrap' }}>Trade Date<br/>交易日</th>
                    <th style={{ width: '11%', whiteSpace: 'nowrap' }}>Sett. Date<br/>交收日</th>
                    <th style={{ width: '9%' }}>Txn. Type<br/>交易類別</th>
                    <th style={{ width: '25%' }}>Description 項目說明</th>
                    <th className="num" style={{ width: '8%' }}>Quantity<br/>庫存</th>
                    <th className="num" style={{ width: '10%' }}>Unit Price<br/>單位價格</th>
                    <th className="num" style={{ width: '13%' }}>(Dr)/Cr Amount<br/>(借)/存金額</th>
                    <th className="num" style={{ width: '13%' }}>(Dr)/Cr Balance<br/>(借欠)/結餘</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening row */}
                  <tr className="opening-row">
                    <td colSpan={7}>Opening Available Balance 期初可用結餘</td>
                    <td className="num">{fmtDrCr(ledger[0].balance)}</td>
                  </tr>
                  {txRows.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: '#999', padding: 12, fontStyle: 'italic' }}>本期無交易記錄 No transactions in this period</td></tr>
                  ) : txRows.map(({ tx, drCrAmount, balance }) => {
                    const tradeDate = tx.created_at?.slice(0, 10) || '—'
                    const settleDate = tx.settle_date?.slice(0, 10) || tradeDate
                    const typeMap: Record<string, [string, string]> = {
                      deposit: ['Deposit', 'FUND DEPOSIT 客戶入金'],
                      withdrawal: ['Withdrawal', 'Client Withdrawal 客戶出金'],
                      transfer_otc: ['Transfer', 'Fund Deposit-Collateral-LONGTREND'],
                      deposit_and_transfer: ['Deposit', 'FUND DEPOSIT 客戶入金'],
                    }
                    let [txnType, desc] = typeMap[tx.type] || [tx.type, tx.type]
                    // Detect fee transactions
                    if (tx.remarks?.startsWith('[FEE]') || tx.remarks?.toLowerCase().includes('wire fee') || tx.remarks?.toLowerCase().includes('手續費') || tx.remarks?.toLowerCase().includes('手续费')) {
                      txnType = 'Fee'
                      desc = tx.remarks.replace('[FEE] ', '')
                    } else if (tx.remarks?.startsWith('[BUY]') || tx.remarks?.toLowerCase().includes('buy ')) {
                      txnType = 'Buy'
                      desc = tx.remarks.replace('[BUY] ', '')
                    } else if (tx.remarks?.includes('全额划转')) { desc = 'Fund Deposit-Collateral-LONGTREND'; txnType = 'Transfer' }
                    else if (tx.remarks?.includes('Option Premium')) { desc = 'Fund Deposit-Option Premium-LONGTREND-OPT'; txnType = 'Transfer' }
                    else if (tx.remarks?.includes('本地汇款') || (tx.type === 'deposit' && !tx.remarks?.startsWith('['))) { desc = tx.bank_name ? `存款 - 本地匯款 ${tx.bank_name}` : 'FUND DEPOSIT 客戶入金' }
                    else if (tx.type === 'transfer_otc') { desc = 'Fund Deposit-Collateral-LONGTREND'; txnType = 'Transfer' }
                    const detailedRemarks = tx.remarks && !tx.remarks.startsWith('[FEE]') && !tx.remarks.startsWith('[BUY]') && !tx.remarks.includes('客户入金') && !tx.remarks.includes('全额划转') && !tx.remarks.includes('Client fund deposit') ? tx.remarks : ''
                    const statusPending = tx.status === 'pending' ? ' (待確認)' : ''
                    return (
                      <tr key={tx.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{tradeDate}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{settleDate}</td>
                        <td>{txnType}</td>
                        <td>
                          <div>{desc}{statusPending}</div>
                          <div className="tx-ref">Ref: {tx.tx_code}</div>
                          {detailedRemarks && <div className="tx-remarks">{detailedRemarks}</div>}
                        </td>
                        <td className="num">—</td>
                        <td className="num">—</td>
                        <td className="num">{fmtDrCr(drCrAmount)}</td>
                        <td className="num">{fmtDrCr(balance)}</td>
                      </tr>
                    )
                  })}
                  {/* Closing / Ledger Balance row */}
                  <tr className="closing-row">
                    <td colSpan={7} style={{ textAlign: 'right' }}>Ledger Balance as at 賬面結存 {stmtDateLabel}</td>
                    <td className="num">{fmtDrCr(closingBal)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="currency-label">Currency: {CURRENCY_NAMES[currency] || currency}</div>
            </div>
          )
        })}

        {/* Important Notes */}
        <div className="section-title" style={{ marginTop: 12 }}>Important Notes 重要備註:</div>
        <div className="stmt-notes">
          <div>[1] Cash Balance includes all settled and unsettled amounts. 現金結餘包括所有已結算及未結算之金額。</div>
          <div>[2] Market prices are indicative only and sourced from third-party data providers. 市場價格僅供參考，數據來自第三方供應商。</div>
          <div>[3] This statement should be read in conjunction with the terms and conditions of your account agreement. 本結單應與閣下之帳戶協議條款一併閱讀。</div>
          <div>[4] Please report any discrepancies within 30 days of the statement date. 如有任何差異，請於結單日期後30天內通知本公司。</div>
          <div>[5] Past performance is not indicative of future results. Investment involves risks. 過往表現並不代表將來表現。投資涉及風險。</div>
        </div>

        </div>{/* end stmt-content */}

        {/* Footer */}
        <div className="stmt-footer">
          <div className="stmt-footer-body">
            <div className="company-name">誠港金融股份有限公司</div>
            <div>電話: (852) 2598 1700 | 傳真: (852) 2561 7028 | 郵箱: customer-services@cmfinancial.com | 網址: www.cmfinancial.com</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>地址: 香港上環德輔道中 308 號 23 樓 2304-5 室</span>
              <span>CE No. BSU667</span>
            </div>
            <div className="stmt-page-num">Page 1 of {totalPages}</div>
          </div>
        </div>
      </div>
    </>
  )
}

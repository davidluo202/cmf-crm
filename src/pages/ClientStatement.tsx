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
  let stmtTitle = ''
  let stmtRef = ''
  if (type === 'monthly') {
    const [yr, mo] = data.period.label.split('-')
    stmtDateLabel = `${yr}年${mo}月`
    stmtTitle = 'Monthly Combined Statement of Account / 帳戶綜合月結單'
    // MS-YYYYMM-XXXX
    const seq = String(data.client.id).padStart(4, '0')
    stmtRef = `MS-${data.period.label.replace('-', '')}-${seq}`
  } else {
    stmtDateLabel = data.period.label
    stmtTitle = 'Daily Combined Statement of Account / 帳戶綜合日結單'
    const seq = String(data.client.id).padStart(4, '0')
    stmtRef = `DS-${data.period.label.replace(/-/g, '')}-${seq}`
  }

  const clientName = clientExtra?.nameCn || data.client.name || '—'
  const clientNameEn = clientExtra?.nameEn || data.client.nameEn || '—'
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
    const rows: Array<{ tx: any; credit: number; debit: number; balance: number }> = []
    // Opening row
    rows.push({ tx: null, credit: 0, debit: 0, balance })
    for (const tx of data!.transactions.filter(t => (t.currency || 'HKD') === currency)) {
      const amt = Number(tx.amount)
      let credit = 0, debit = 0
      if (tx.type === 'deposit') { credit = amt; balance += amt }
      else if (tx.type === 'withdrawal') { debit = amt; balance -= amt }
      rows.push({ tx, credit, debit, balance })
    }
    return rows
  }

  // Totals for summary section
  const totalHkd = Object.entries(data.closingBalance).reduce((sum, [cur, bal]) => {
    const rate = EXCHANGE_RATES[cur] || 1
    return sum + bal * rate
  }, 0)

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
          margin: 0 auto;
          padding: 20px 24px;
          font-family: "Arial", "PingFang TC", "Microsoft JhengHei", sans-serif;
          color: #1a1a1a;
          font-size: 9pt;
          background: #fff;
          line-height: 1.4;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
        }
        .stmt-content {
          flex: 1;
        }

        /* Header */
        .stmt-header {
          display: flex;
          align-items: flex-start;
          padding-bottom: 6px;
          margin-bottom: 6px;
        }

        /* Title block */
        .stmt-title-block {
          text-align: center;
          margin: 4px 0 6px;
          padding-bottom: 4px;
        }
        .stmt-title-main {
          font-size: 12pt;
          font-weight: bold;
          color: #2c3e50;
          letter-spacing: 1px;
        }
        .stmt-title-ref {
          font-size: 7.5pt;
          color: #888;
          margin-top: 2px;
        }

        /* Client info box */
        .stmt-client-box {
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 8px 12px;
          margin-bottom: 12px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 24px;
        }
        .stmt-field {
          display: flex;
          gap: 4px;
          font-size: 8pt;
          padding: 1px 0;
          border-bottom: 1px dotted #e0e0e0;
        }
        .stmt-field-label {
          color: #666;
          white-space: nowrap;
          min-width: 80px;
        }
        .stmt-field-value {
          font-weight: 600;
          color: #1a1a1a;
        }

        /* Section headers */
        .stmt-section-hdr {
          background: #2c3e50;
          color: #fff;
          font-size: 8pt;
          font-weight: bold;
          padding: 5px 8px 4px;
          margin: 6px 0 0;
          border-radius: 2px 2px 0 0;
        }
        .stmt-section {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        /* Summary table */
        .stmt-summary-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 4px;
          font-size: 8.5pt;
        }
        .stmt-summary-table th {
          background: #2c3e50;
          color: #fff;
          padding: 5px 8px;
          text-align: left;
          border: 1px solid #d0d8e4;
          font-weight: 600;
        }
        .stmt-summary-table td {
          padding: 5px 8px;
          border: 1px solid #e4e4e4;
          vertical-align: top;
        }
        .stmt-summary-table tr:nth-child(even) td { background: #f8f9fc; }
        .stmt-num { text-align: right; font-family: "Courier New", monospace; }
        .stmt-total-row td { background: #f0f4f9 !important; font-weight: bold; }

        /* Ledger table */
        .stmt-ledger-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8pt;
          margin-bottom: 4px;
        }
        .stmt-ledger-table th {
          background: #2c3e50;
          color: #fff;
          padding: 4px 6px;
          border: 1px solid #c8d0dc;
          font-size: 7.5pt;
          white-space: nowrap;
        }
        .stmt-ledger-table td {
          padding: 4px 6px;
          border: 1px solid #e4e8f0;
          vertical-align: middle;
        }
        .stmt-ledger-table tr:nth-child(even) td { background: #f7f9fc; }
        .stmt-opening-row td { background: #fafbfd !important; color: #555; font-style: italic; }
        .stmt-credit { color: #1a7a3c; }
        .stmt-debit { color: #c0392b; }
        .stmt-balance-col { font-family: "Courier New", monospace; font-weight: 600; }

        /* Cash balance table */
        .stmt-cashbal-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8pt;
          margin-bottom: 4px;
        }
        .stmt-cashbal-table th {
          background: #2c3e50;
          color: #fff;
          padding: 4px 8px;
          border: 1px solid #c8d0dc;
          font-size: 7.5pt;
        }
        .stmt-cashbal-table td {
          padding: 4px 8px;
          border: 1px solid #e4e8f0;
        }
        .stmt-cashbal-table .total-row td {
          background: #eef2f8;
          font-weight: bold;
        }

        /* Assets overview */
        .stmt-assets-box {
          border: 1px solid #c8d0dc;
          border-radius: 4px;
          padding: 10px 12px;
          margin: 4px 0;
        }
        .stmt-assets-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px dotted #e0e0e0;
          font-size: 8.5pt;
        }
        .stmt-assets-row:last-child { border-bottom: none; }
        .stmt-assets-total {
          display: flex;
          justify-content: space-between;
          padding: 6px 0 4px;
          font-weight: bold;
          font-size: 10pt;
          color: #2c3e50;
          border-top: 2px solid #2c3e50;
          margin-top: 4px;
        }

        /* Footer */
        .stmt-footer {
          margin-top: auto;
          border-top: 1px solid #ccc;
          padding-top: 6px;
        }
        .stmt-footer-letterhead {
          font-size: 8px;
          color: #555;
          text-align: center;
          line-height: 1.6;
        }
        .stmt-footer-letterhead .company-name {
          font-weight: bold;
          color: #2c3e50;
          font-size: 9px;
        }
        .stmt-footer-ce {
          text-align: right;
          font-size: 8px;
          color: #555;
          margin-top: 2px;
        }
        .stmt-warnings {
          display: flex;
          gap: 3px;
          margin-top: 6px;
          margin-bottom: 2px;
        }
        .stmt-warning-box {
          flex: 1;
          border: 1px solid #ddd;
          background: #fafafa;
          border-radius: 2px;
          padding: 2px 3px;
          font-size: 4.5pt;
          color: #777;
          line-height: 1.15;
        }
        .stmt-warning-title {
          font-weight: bold;
          color: #555;
          font-size: 4.5pt;
          margin-bottom: 0;
        }
        .stmt-page-num {
          text-align: center;
          font-size: 6pt;
          color: #999;
          margin-top: 1px;
        }
        .stmt-currency-hdr {
          background: #2c3e50;
          color: #fff;
          font-size: 8pt;
          padding: 4px 10px 3px;
          font-weight: bold;
          margin: 6px 0 0;
        }
        .no-data-row td {
          text-align: center;
          color: #999;
          padding: 12px;
          font-style: italic;
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

      <div className="stmt-page">
        <div className="stmt-content">

        {/* ── HEADER ── */}
        <div className="stmt-header">
          <div>
            <img src="/logo-zh-official.jpg" alt="誠港金融" style={{ height: 50 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        </div>

        {/* ── TITLE ── */}
        <div className="stmt-title-block">
          <div className="stmt-title-main">{stmtTitle}</div>
          <div className="stmt-title-ref">{stmtRef}</div>
        </div>

        {/* ── CLIENT INFO BOX ── */}
        <div className="stmt-client-box">
          {/* Left column */}
          <div className="stmt-field">
            <span className="stmt-field-label">帳戶名稱 A/C Name</span>
            <span className="stmt-field-value">{clientName} {clientNameEn !== '—' ? `/ ${clientNameEn}` : ''}</span>
          </div>
          {/* Right column */}
          <div className="stmt-field">
            <span className="stmt-field-label">結單日期 Statement Date</span>
            <span className="stmt-field-value">{stmtDateLabel}</span>
          </div>
          <div className="stmt-field">
            <span className="stmt-field-label">帳戶號碼 A/C Number</span>
            <span className="stmt-field-value">{data.client.code}</span>
          </div>
          <div className="stmt-field">
            <span className="stmt-field-label">列印日期 Print Date</span>
            <span className="stmt-field-value">{printDate}</span>
          </div>
          <div className="stmt-field">
            <span className="stmt-field-label">帳戶類型 Account Type</span>
            <span className="stmt-field-value">{accountType}</span>
          </div>
          <div style={{ /* empty cell for alignment */ }} />
        </div>

        {/* ── SECTION 1: Summary ── */}
        <div className="stmt-section-hdr">第一節 綜合結單概覽 Consolidated Statement Summary (HKD)</div>
        <table className="stmt-summary-table">
          <thead>
            <tr>
              <th>可用結餘<br/><span style={{ fontWeight: 'normal', fontSize: '7pt' }}>Available Balance</span></th>
              <th>賬面結餘<br/><span style={{ fontWeight: 'normal', fontSize: '7pt' }}>Ledger Balance</span></th>
              <th>投資組合市值<br/><span style={{ fontWeight: 'normal', fontSize: '7pt' }}>Portfolio Value</span></th>
              <th>賬戶淨值<br/><span style={{ fontWeight: 'normal', fontSize: '7pt' }}>Net Equity</span></th>
            </tr>
          </thead>
          <tbody>
            <tr className="stmt-total-row">
              <td className="stmt-num">{fmtAmt(totalHkd)}</td>
              <td className="stmt-num">{fmtAmt(totalHkd)}</td>
              <td className="stmt-num">0.00</td>
              <td className="stmt-num">{fmtAmt(totalHkd)}</td>
            </tr>
          </tbody>
        </table>

        {/* ── SECTION 2: Cash Ledger per currency ── */}
        <div className="stmt-section-hdr">第二節 資金賬戶結單 Cash Statement of Account</div>
        {currencies.map(currency => {
          const ledger = buildLedger(currency)
          const txRows = ledger.slice(1)
          return (
            <div key={currency}>
              <div className="stmt-currency-hdr">{currency}</div>
              <table className="stmt-ledger-table">
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>交易日期<br/>Trade Date</th>
                    <th style={{ width: '10%' }}>結算日期<br/>Sett. Date</th>
                    <th style={{ width: '40%' }}>說明<br/>Description</th>
                    <th style={{ width: '13%', textAlign: 'right' }}>借記<br/>Debit</th>
                    <th style={{ width: '13%', textAlign: 'right' }}>貸記<br/>Credit</th>
                    <th style={{ width: '14%', textAlign: 'right' }}>結餘<br/>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening row */}
                  <tr className="stmt-opening-row">
                    <td>{type === 'monthly' ? `${data.period.label}-01` : data.period.label}</td>
                    <td>—</td>
                    <td>期初結餘 Opening Balance</td>
                    <td className="stmt-num">—</td>
                    <td className="stmt-num">—</td>
                    <td className="stmt-num stmt-balance-col">{fmtAmt(ledger[0].balance)}</td>
                  </tr>
                  {txRows.length === 0 ? (
                    <tr className="no-data-row"><td colSpan={6}>本期無交易記錄 No transactions in this period</td></tr>
                  ) : txRows.map(({ tx, credit, debit, balance }) => {
                    const tradeDate = tx.created_at?.slice(0, 10) || '—'
                    const settleDate = tx.settle_date?.slice(0, 10) || tradeDate
                    const typeMap: Record<string, string> = {
                      deposit: 'FUND DEPOSIT 客戶入金',
                      withdrawal: 'Client Withdrawal 客戶出金',
                      transfer_otc: 'Fund Deposit-Collateral-LONGTREND',
                      deposit_and_transfer: 'FUND DEPOSIT 客戶入金',
                    }
                    let desc = typeMap[tx.type] || tx.type
                    if (tx.remarks?.includes('全额划转')) desc = 'Fund Deposit-Collateral-LONGTREND'
                    if (tx.remarks?.includes('Option Premium')) desc = 'Fund Deposit-Option Premium-LONGTREND-OPT'
                    if (tx.remarks?.includes('本地汇款') || tx.type === 'deposit') desc = tx.bank_name ? `存款 - 本地匯款 ${tx.bank_name}` : 'FUND DEPOSIT 客戶入金'
                    if (tx.type === 'transfer_otc') desc = 'Fund Deposit-Collateral-LONGTREND'
                    const detailedRemarks = tx.remarks && !tx.remarks.includes('客户入金') && !tx.remarks.includes('全额划转') ? tx.remarks : ''
                    const statusPending = tx.status === 'pending' ? ' (待確認)' : ''
                    return (
                      <tr key={tx.id}>
                        <td>{tradeDate}</td>
                        <td>{settleDate}</td>
                        <td>
                          <div>{desc}{statusPending}</div>
                          <div style={{ fontSize: '7pt', color: '#888', fontFamily: 'monospace', marginTop: 1 }}>Ref: {tx.tx_code}</div>
                          {detailedRemarks && <div style={{ fontSize: '7pt', color: '#555', marginTop: 1 }}>{detailedRemarks}</div>}
                        </td>
                        <td className={`stmt-num ${debit > 0 ? 'stmt-debit' : ''}`}>
                          {debit > 0 ? `(${fmtAmt(debit)})` : '—'}
                        </td>
                        <td className={`stmt-num ${credit > 0 ? 'stmt-credit' : ''}`}>
                          {credit > 0 ? fmtAmt(credit) : '—'}
                        </td>
                        <td className="stmt-num stmt-balance-col">{fmtAmt(balance)}</td>
                      </tr>
                    )
                  })}
                  {/* Closing row */}
                  <tr className="stmt-total-row">
                    <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold' }}>期末結餘 Closing Balance</td>
                    <td className="stmt-num stmt-balance-col">{fmtAmt(data.closingBalance[currency] || 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })}

        {/* ── SECTION 3: Cash Balance Summary ── */}
        <div className="stmt-section-hdr">第三節 現金結餘 Cash Balance</div>
        <table className="stmt-cashbal-table">
          <thead>
            <tr>
              <th>幣種<br/>Currency</th>
              <th style={{ textAlign: 'right' }}>可用結餘<br/>Available Balance</th>
              <th style={{ textAlign: 'right' }}>應計未結<br/>Net of Unsettle</th>
              <th style={{ textAlign: 'right' }}>賬面結餘<br/>Ledger Balance</th>
              <th style={{ textAlign: 'right' }}>匯率<br/>Exch Rate</th>
              <th style={{ textAlign: 'right' }}>港元等值<br/>Balance (HKD)</th>
            </tr>
          </thead>
          <tbody>
            {currencies.map(currency => {
              const bal = data.closingBalance[currency] || 0
              const rate = EXCHANGE_RATES[currency] || 1
              const hkdEq = bal * rate
              return (
                <tr key={currency}>
                  <td style={{ fontWeight: 600 }}>{currency}</td>
                  <td className="stmt-num">{fmtAmt(bal)}</td>
                  <td className="stmt-num">0.00</td>
                  <td className="stmt-num">{fmtAmt(bal)}</td>
                  <td className="stmt-num">{fmtAmt(rate, 4)}</td>
                  <td className="stmt-num" style={{ fontWeight: 600 }}>{fmtAmt(hkdEq)}</td>
                </tr>
              )
            })}
            <tr className="total-row">
              <td style={{ fontWeight: 'bold' }}>合計 Total</td>
              <td className="stmt-num">—</td>
              <td className="stmt-num">—</td>
              <td className="stmt-num">—</td>
              <td className="stmt-num">—</td>
              <td className="stmt-num" style={{ fontWeight: 'bold', color: '#2c3e50' }}>{fmtAmt(totalHkd)}</td>
            </tr>
          </tbody>
        </table>

        {/* ── SECTION 4: Month-End Total Assets ── */}
        <div className="stmt-section-hdr">第四節 {type === 'monthly' ? '月末' : ''}總資產概覽 {type === 'monthly' ? 'Month-End ' : ''}Total Assets (HKD)</div>
        <div className="stmt-assets-box">
          <div className="stmt-assets-row">
            <span>現金結餘 Fund Balance (HKD)</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmtAmt(totalHkd)}</span>
          </div>
          <div className="stmt-assets-row">
            <span>投資組合市值 Portfolio Value (HKD)</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>0.00</span>
          </div>
          <div className="stmt-assets-total">
            <span>總資產 Total Assets (HKD)</span>
            <span style={{ fontFamily: 'monospace' }}>{fmtAmt(totalHkd)}</span>
          </div>
          {currencies.length > 1 || currencies[0] !== 'HKD' ? (
            <div style={{ marginTop: 8, fontSize: '7.5pt', color: '#666' }}>
              <span style={{ fontWeight: 'bold' }}>匯率參考 Conversion Rates: </span>
              {currencies.filter(c => c !== 'HKD').map(c => `${c}/HKD = ${(EXCHANGE_RATES[c] || 1).toFixed(4)}`).join('  |  ')}
            </div>
          ) : null}
        </div>

        </div>{/* end stmt-content */}

        {/* ── FOOTER ── */}
        <div className="stmt-footer">
          <div className="stmt-footer-letterhead">
            <div className="company-name">誠港金融股份有限公司</div>
            <div>電話: (852) 2598 1700 | 傳真: (852) 2561 7028 | 郵箱: customer-services@cmfinancial.com | 網址: www.cmfinancial.com</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>地址: 香港上環德輔道中 308 號 23 樓 2304-5 室</span>
              <span>CE No. BSU667</span>
            </div>
          </div>
          <div className="stmt-warnings">
            <div className="stmt-warning-box">
              <div className="stmt-warning-title">防詐騙警示 Anti-Fraud Warning</div>
              請勿將帳戶資料或密碼透露予任何人。如有任何疑問，請立即致電 +852 2598 1700 聯絡本公司。<br/>
              Never disclose your account information or password to anyone. Contact us immediately if in doubt.
            </div>
            <div className="stmt-warning-box">
              <div className="stmt-warning-title">投資風險警示 Investment Risk Warning</div>
              投資涉及風險，產品價格可升可跌。過往表現並不代表將來表現。本結單不構成投資建議。<br/>
              Investment involves risks. Past performance is not indicative of future results. This statement is not investment advice.
            </div>
            <div className="stmt-warning-box">
              <div className="stmt-warning-title">結單查詢期 Statement Dispute Period</div>
              如對本結單有任何疑問，請於收到後30日內以書面形式通知本公司。<br/>
              If you disagree with this statement, please notify us in writing within 30 days of receipt.
            </div>
          </div>
        </div>

      </div>
    </>
  )
}

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface ClientData {
  id: number; code: string; nameCn: string; nameEn: string
  email: string; phone: string; onboardedDate: string | null; createdAt: string
  idType: string; idNumber: string
}

export default function BcanConsentPrint() {
  const { id } = useParams()
  const [client, setClient] = useState<ClientData | null>(null)

  useEffect(() => {
    if (id) {
      fetch(`${API_BASE}/api/clients?id=${id}`)
        .then(r => r.json())
        .then(d => { if (d.success && d.data) setClient(d.data) })
    }
  }, [id])

  useEffect(() => {
    if (client) document.title = `BCAN Consent - ${client.nameCn || client.nameEn}`
  }, [client])

  if (!client) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

  const bcan = `BSU667.${client.code.replace(/^668/, '').padStart(6, '0')}`
  const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 20mm 15mm; size: A4; }
        }
        .consent-page {
          max-width: 210mm;
          margin: 0 auto;
          padding: 40px 50px;
          font-family: "Times New Roman", "Songti SC", "SimSun", serif;
          color: #000;
          line-height: 1.6;
          font-size: 11pt;
        }
        .consent-page .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #1a3a5c;
          padding-bottom: 12px;
          margin-bottom: 24px;
        }
        .consent-page .company-info {
          text-align: right;
          font-size: 8.5pt;
          color: #333;
          font-family: Arial, sans-serif;
          line-height: 1.5;
        }
        .consent-page .logo-text {
          font-family: Arial, sans-serif;
          font-size: 18pt;
          font-weight: bold;
          color: #1a3a5c;
        }
        .consent-page h1 {
          text-align: center;
          font-size: 14pt;
          margin: 20px 0 4px;
          color: #1a3a5c;
        }
        .consent-page h2 {
          text-align: center;
          font-size: 12pt;
          margin: 0 0 20px;
          color: #1a3a5c;
          font-family: Arial, sans-serif;
        }
        .consent-page .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 30px;
          margin-bottom: 20px;
          font-size: 10.5pt;
        }
        .consent-page .info-grid .field {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid #ccc;
          padding-bottom: 3px;
        }
        .consent-page .info-grid .label {
          white-space: nowrap;
          color: #555;
        }
        .consent-page .info-grid .value {
          font-weight: bold;
        }
        .consent-page .section-title {
          font-size: 11pt;
          font-weight: bold;
          color: #1a3a5c;
          margin: 18px 0 8px;
        }
        .consent-page .clause { margin: 8px 0; text-align: justify; }
        .consent-page .clause-indent { margin-left: 20px; }
        .consent-page .note {
          font-size: 8.5pt;
          color: #555;
          font-style: italic;
          margin: 16px 0;
          border-top: 1px solid #ddd;
          padding-top: 8px;
        }
        .consent-page .sig-section {
          margin-top: 28px;
          border-top: 1px solid #ddd;
          padding-top: 16px;
        }
        .consent-page .sig-row {
          display: flex;
          justify-content: space-between;
          margin: 20px 0;
        }
        .consent-page .sig-field {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }
        .consent-page .sig-line {
          display: inline-block;
          width: 200px;
          border-bottom: 1px solid #999;
          height: 1px;
        }
        .consent-page .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 7.5pt;
          color: #999;
          font-family: Arial, sans-serif;
        }
      `}</style>

      {/* Floating action buttons */}
      <div className="no-print" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: '#6b7280', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        >
          返回
        </button>
        <button
          onClick={() => window.print()}
          style={{ background: '#1a3a5c', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        >
          列印
        </button>
        <button
          onClick={async () => {
            const html2pdf = (await import('html2pdf.js')).default
            const el = document.querySelector('.consent-page') as HTMLElement | null
            if (!el) return
            html2pdf().set({
              margin: [5, 5, 5, 5],
              filename: `BCAN_Consent_${client.code}.pdf`,
              image: { type: 'jpeg', quality: 0.95 },
              html2canvas: { scale: 1.5, useCORS: true },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            } as any).from(el).save()
          }}
          style={{ background: '#4caf50', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        >
          下載PDF
        </button>
      </div>

      <div className="consent-page">
        {/* Letterhead */}
        <div className="header">
          <div className="logo-text">CMFinancial</div>
          <div className="company-info">
            Canton Mutual Financial Limited<br/>
            Units 2304-05, 23/F, 308 Des Voeux Road Central, Hong Kong<br/>
            Tel: +852 2598 1700 &nbsp;|&nbsp; SFC CE No.: BSU667<br/>
            Type 1 | Type 4 | Type 9
          </div>
        </div>

        <h1>客戶BCAN碼分配及上報同意書</h1>
        <h2>Client Consent for BCAN Assignment and Reporting</h2>

        {/* Client Info */}
        <div className="info-grid">
          <div className="field"><span className="label">Client Name (English):</span> <span className="value">{client.nameEn || '—'}</span></div>
          <div className="field"><span className="label">Date:</span> <span className="value">{today}</span></div>
          <div className="field"><span className="label">客戶姓名（中文）:</span> <span className="value">{client.nameCn}</span></div>
          <div className="field"><span className="label">Account No.:</span> <span className="value">{client.code}</span></div>
          <div className="field"><span className="label">ID/Passport No.:</span> <span className="value">{client.idNumber || '________________'}</span></div>
          <div className="field"><span className="label">BCAN:</span> <span className="value">{bcan}</span></div>
        </div>

        {/* Chinese Consent */}
        <div className="section-title">一、同意聲明</div>
        <div className="clause">
          本人確認並同意，Canton Mutual Financial Limited（「誠港金融」，證監會中央編號：BSU667）可按以下目的收集、儲存、處理、使用、披露及轉移與本人有關的個人資料（包括本人的客戶識別信息（「CID」）及券商客戶編碼（「BCAN」））：
        </div>
        <div className="clause clause-indent">
          (a) 按照香港聯合交易所有限公司（「聯交所」）及證券及期貨事務監察委員會（「證監會」）不時生效的規則及規定，向聯交所及/或證監會披露及轉移本人的個人資料（包括CID、BCAN及BCAN-CID映射文件）；
        </div>
        <div className="clause clause-indent">
          (b) 允許聯交所：(i) 為市場監察及監控目的以及執行《聯交所規則》而收集、儲存、處理及使用本人的個人資料（包括CID、BCAN及BCAN-CID映射文件）；(ii) 向香港有關監管機構及執法機構（包括但不限於證監會）披露及轉移該等信息，以便其履行與香港金融市場相關的法定職能；及 (iii) 將該等信息用於進行市場監督分析；及
        </div>
        <div className="clause clause-indent">
          (c) 允許證監會：(i) 為履行其法定職能（包括與香港金融市場相關的監控、監察及執法職能）而收集、儲存、處理及使用本人的個人資料（包括CID、BCAN及BCAN-CID映射文件）；及 (ii) 根據適用法律或監管規定，向香港有關監管機構及執法機構披露及轉移該等信息。
        </div>
        <div className="clause">
          本人亦同意，即使本人其後聲稱撤回同意，本人的個人資料仍可繼續按上述目的被儲存、處理、使用、披露或轉移。
        </div>
        <div className="clause">
          如本人未能向誠港金融提供上述個人資料或同意，誠港金融可能無法或不再能夠（視情況而定）執行本人的交易指令或向本人提供證券相關服務（除出售、轉出或提取本人現有的證券持倉（如有）外）。
        </div>

        {/* English Consent */}
        <div className="section-title">II. Consent Statement</div>
        <div className="clause">
          I acknowledge and agree that Canton Mutual Financial Limited ("CMF", SFC CE No.: BSU667) may collect, store, process, use, disclose and transfer personal data relating to me (including my Client Identification Data ("CID") and Broker-to-Client Assigned Number(s) ("BCAN(s)")) as required for CMF to provide services to me in relation to securities listed or traded on The Stock Exchange of Hong Kong Limited ("SEHK") and for complying with the rules and requirements of SEHK and the Securities and Futures Commission ("SFC") in effect from time to time. Without limiting the foregoing, this includes:
        </div>
        <div className="clause clause-indent">
          (a) disclosing and transferring my personal data (including CID, BCANs and BCAN-CID Mapping Files) to SEHK and/or the SFC in accordance with the rules and requirements of SEHK and the SFC in effect from time to time;
        </div>
        <div className="clause clause-indent">
          (b) allowing SEHK to: (i) collect, store, process and use my personal data (including CID, BCANs and BCAN-CID Mapping Files) for market surveillance and monitoring purposes and enforcement of the Rules of the Exchange; (ii) disclose and transfer such information to the relevant regulators and law enforcement agencies in Hong Kong (including, but not limited to, the SFC) so as to facilitate the performance of their statutory functions with respect to the Hong Kong financial markets; and (iii) use such information for conducting analysis for the purposes of market oversight; and
        </div>
        <div className="clause clause-indent">
          (c) allowing the SFC to: (i) collect, store, process and use my personal data (including CID, BCANs and BCAN-CID Mapping Files) for the performance of its statutory functions including monitoring, surveillance and enforcement functions with respect to the Hong Kong financial markets; and (ii) disclose and transfer such information to the relevant regulators and law enforcement agencies in Hong Kong in accordance with applicable laws or regulatory requirements.
        </div>
        <div className="clause">
          I also agree that despite any subsequent purported withdrawal of consent by me, my personal data may continue to be stored, processed, used, disclosed or transferred for the above purposes after such purported withdrawal of consent.
        </div>
        <div className="clause">
          Failure to provide CMF with my personal data or consent as described above may mean that CMF will not, or will no longer be able to, as the case may be, carry out my trading instructions or provide me with securities related services (other than to sell, transfer out or withdraw my existing holdings of securities, if any).
        </div>

        {/* Notes */}
        <div className="note">
          Note: The terms "BCAN", "CID" and "BCAN-CID Mapping File" used herein shall bear the meanings as defined in paragraph 5.6 of the Code of Conduct for Persons Licensed by or Registered with the Securities and Futures Commission, and the Rules of the Exchange of The Stock Exchange of Hong Kong Limited.<br/>
          註：本同意書中使用的「BCAN」、「CID」及「BCAN-CID映射文件」等術語的含義以證監會《操守準則》第5.6段及《聯交所規則》中的定義為準。
        </div>

        {/* Signature */}
        <div className="sig-section">
          <div className="section-title">三、客戶簽署 / III. Client Signature</div>
          <div className="clause" style={{ fontWeight: 'bold' }}>
            本人已閱讀並理解上述全部內容，並自願作出上述同意。<br/>
            I have read and understood all of the above, and voluntarily give the above consent.
          </div>
          <div className="sig-row">
            <div className="sig-field">客戶簽署 / Client Signature: <span className="sig-line"></span></div>
            <div className="sig-field">日期 / Date: <span className="sig-line" style={{ width: 140 }}></span></div>
          </div>
          <div className="sig-row">
            <div className="sig-field">見證人 / Witnessed by: <span className="sig-line"></span></div>
            <div className="sig-field">職位 / Title: <span className="sig-line" style={{ width: 140 }}></span></div>
          </div>
        </div>

        <div className="footer">
          本同意書依據證監會通函21EC35號及香港聯合交易所HKIDR規則制定。<br/>
          This consent form is prepared in accordance with SFC Circular 21EC35 and HKEX HKIDR Rules.<br/>
          Ref: CMF/BCAN/CONSENT/v1.0
        </div>
      </div>
    </>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface ClientData {
  id: number; code: string; nameCn: string; nameEn: string; segment: string; tier: string
  status: string; rm: string; email: string; phone: string; address: string
  bankName: string; bankAccount: string; bankAccountType: string; bankCurrency: string
  markupPercent: number; aum: number; onboardedDate: string | null; createdAt: string
  idType: string; idNumber: string; idExpiry: string; idIssuingCountry: string
  dateOfBirth: string; gender: string
}

interface BankAccount {
  id: number
  client_id: number
  bank_name: string
  bank_account: string
  bank_currency: string
  bank_account_type: string
  is_primary: boolean
}

interface FundTransaction {
  id: number
  tx_code: string
  client_id: number
  type: string
  amount: string
  currency: string
  bank_name: string
  bank_account: string
  status: string
  remarks: string
  created_at: string
}

const EMPTY_BANK = { bankName: '', bankAccount: '', branchCode: '', bankCurrency: 'HKD', bankAccountType: 'saving', accountHolderName: '' }

// Hong Kong banks list (from account opening system)
const HK_BANKS = [
  { code: "003", name: "渣打銀行（香港）有限公司" },
  { code: "004", name: "香港上海滙豐銀行有限公司" },
  { code: "006", name: "花旗銀行" },
  { code: "009", name: "中國建設銀行（亞洲）股份有限公司" },
  { code: "012", name: "中國銀行（香港）有限公司" },
  { code: "015", name: "東亞銀行有限公司" },
  { code: "016", name: "星展銀行（香港）有限公司" },
  { code: "018", name: "中信銀行國際有限公司" },
  { code: "020", name: "招商永隆銀行有限公司" },
  { code: "024", name: "恒生銀行有限公司" },
  { code: "025", name: "上海商業銀行有限公司" },
  { code: "027", name: "交通銀行股份有限公司" },
  { code: "035", name: "華僑銀行（香港）有限公司" },
  { code: "039", name: "集友銀行有限公司" },
  { code: "040", name: "大新銀行有限公司" },
  { code: "041", name: "創興銀行有限公司" },
  { code: "043", name: "南洋商業銀行有限公司" },
  { code: "072", name: "中國工商銀行（亞洲）有限公司" },
  { code: "128", name: "富邦銀行(香港)有限公司" },
  { code: "185", name: "星展銀行香港分行" },
  { code: "214", name: "中國工商銀行股份有限公司" },
  { code: "221", name: "中國建設銀行股份有限公司" },
  { code: "222", name: "中國農業銀行股份有限公司" },
  { code: "238", name: "招商銀行股份有限公司" },
  { code: "353", name: "中國民生銀行股份有限公司" },
]
const EMPTY_TX = { type: 'deposit', amount: '', currency: 'HKD', bankName: '', bankAccount: '', remarks: '', tradeDate: new Date().toISOString().slice(0, 10), authType: 'written_direction', authRef: '' }

const tabList = ['Profile', 'Accounts', 'Revenue', 'Credit', 'Interactions'] as const

const segmentColor: Record<string, string> = {
  Individual: 'bg-blue-100 text-blue-600',
  HNWI: 'bg-purple-100 text-purple-600',
  Corporate: 'bg-emerald-100 text-emerald-600',
  Institutional: 'bg-amber-100 text-amber-600',
}

const tierColor: Record<string, string> = {
  Platinum: 'bg-slate-200 text-slate-700',
  Gold: 'bg-yellow-100 text-yellow-700',
  Silver: 'bg-gray-100 text-gray-600',
  Bronze: 'bg-orange-100 text-orange-700',
}

function AccountsStatementBar({ clientId }: { clientId: string }) {
  const prevMonth = (() => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const todayStr = new Date().toISOString().slice(0, 10)

  const [stmtMonth, setStmtMonth] = useState(prevMonth)
  const [stmtDate, setStmtDate] = useState(todayStr)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <input
          type="month"
          value={stmtMonth}
          onChange={e => setStmtMonth(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
          style={{ maxWidth: 160 }}
        />
        <button
          onClick={() => window.open(`/crm/clients/${clientId}/statement?type=monthly&month=${stmtMonth}`, '_blank')}
          disabled={!stmtMonth}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
        >
          生成月结单
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={stmtDate}
          onChange={e => setStmtDate(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
          style={{ maxWidth: 160 }}
        />
        <button
          onClick={() => window.open(`/crm/clients/${clientId}/statement?type=daily&date=${stmtDate}`, '_blank')}
          disabled={!stmtDate}
          className="px-4 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
        >
          生成日结单
        </button>
      </div>
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<typeof tabList[number]>('Profile')
  const [client, setClient] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<ClientData>>({})
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [showAddBank, setShowAddBank] = useState(false)
  const [newBank, setNewBank] = useState(EMPTY_BANK)
  const [bankSaving, setBankSaving] = useState(false)
  const [editingBankId, setEditingBankId] = useState<number | null>(null)
  const [editBank, setEditBank] = useState(EMPTY_BANK)
  const [fundTxs, setFundTxs] = useState<FundTransaction[]>([])
  const [showAddTx, setShowAddTx] = useState(false)
  const [newTx, setNewTx] = useState(EMPTY_TX)
  const [txSaving, setTxSaving] = useState(false)

  useEffect(() => {
    if (id) {
      loadClient(id)
      loadBankAccounts(id)
      loadFundTxs(id)
      loadAmlStatus(id)
    }
  }, [id])

  const loadAmlStatus = async (clientId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/sanctions-check?clientId=${clientId}`)
      const data = await res.json()
      if (data.success && data.data && data.data.length > 0) {
        const latest = data.data[0]
        setAmlStatus({ hitCount: latest.hit_count, checked: true })
      } else {
        setAmlStatus({ hitCount: 0, checked: false })
      }
    } catch { /* non-critical */ }
  }

  const handleAmlCheck = async () => {
    if (!id || amlLoading) return
    setAmlLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/sanctions-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: id, trigger: 'onboarding' }),
      })
      const data = await res.json()
      if (data.success) {
        setAmlStatus({ hitCount: data.hitCount, checked: true })
        if (data.clear) {
          alert('AML筛查完成：无命中，客户通过制裁名单筛查。')
        } else {
          alert(`AML筛查警告：发现 ${data.hitCount} 个命中！请人工复核。`)
        }
      } else {
        alert('AML筛查失败: ' + (data.error || '未知错误'))
      }
    } catch (err: any) {
      alert('AML筛查失败: ' + err.message)
    } finally {
      setAmlLoading(false)
    }
  }

  const loadClient = async (clientId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/clients?id=${clientId}`)
      const data = await res.json()
      if (data.success && data.data) {
        setClient(data.data)
        setForm(data.data)
      }
    } catch (err) {
      console.error('Failed to load client:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadBankAccounts = async (clientId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/client-banks?clientId=${clientId}`)
      const data = await res.json()
      if (data.success) setBankAccounts(data.data || [])
    } catch { /* non-critical */ }
  }

  const loadFundTxs = async (clientId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/fund-transactions?clientId=${clientId}`)
      const data = await res.json()
      if (data.success) setFundTxs(data.data || [])
    } catch { /* non-critical */ }
  }

  const handleAddTx = async () => {
    if (!id || txSaving) return
    if (!newTx.amount || Number(newTx.amount) <= 0) { alert('请填写有效金额'); return }
    if ((newTx.type === 'transfer_otc' || newTx.type === 'deposit_and_transfer') && !newTx.authRef) {
      if (!confirm('未填写授权编号，确认继续？')) return
    }
    setTxSaving(true)
    try {
      if (newTx.type === 'deposit_and_transfer') {
        // Create two transactions: deposit + transfer_otc
        const authInfo = newTx.authType ? ` [授权:${newTx.authType}${newTx.authRef ? ' ' + newTx.authRef : ''}]` : ''
        const depRes = await fetch(`${API_BASE}/api/fund-transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: id, type: 'deposit', amount: newTx.amount, currency: newTx.currency, bankName: newTx.bankName, bankAccount: newTx.bankAccount, tradeDate: newTx.tradeDate, remarks: '客户入金' + (newTx.remarks ? ' - ' + newTx.remarks : '') }),
        })
        const depData = await depRes.json()
        if (!depData.success) { alert('入金失败: ' + (depData.error || '')); return }

        const trfRes = await fetch(`${API_BASE}/api/fund-transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: id, type: 'transfer_otc', amount: newTx.amount, currency: newTx.currency, bankName: '', bankAccount: '', tradeDate: newTx.tradeDate, remarks: '全额划转OTC保证金' + authInfo }),
        })
        const trfData = await trfRes.json()
        if (trfData.success) {
          setNewTx({ ...EMPTY_TX, tradeDate: newTx.tradeDate })
          setShowAddTx(false)
          loadFundTxs(id)
        } else {
          alert('划转失败: ' + (trfData.error || ''))
        }
      } else {
        const authInfo = (newTx.type === 'transfer_otc' && newTx.authType) ? ` [授权:${newTx.authType}${newTx.authRef ? ' ' + newTx.authRef : ''}]` : ''
        const res = await fetch(`${API_BASE}/api/fund-transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: id, ...newTx, remarks: (newTx.remarks || '') + authInfo }),
        })
        const data = await res.json()
        if (data.success) {
          setNewTx({ ...EMPTY_TX, tradeDate: newTx.tradeDate })
          setShowAddTx(false)
          loadFundTxs(id)
        } else {
          alert('添加失败: ' + (data.error || '未知错误'))
        }
      }
    } catch (err: any) {
      alert('添加失败: ' + err.message)
    } finally {
      setTxSaving(false)
    }
  }

  const handleUpdateTxStatus = async (txId: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/fund-transactions?id=${txId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (data.success && id) loadFundTxs(id)
      else alert('更新失败: ' + (data.error || '未知错误'))
    } catch (err: any) {
      alert('更新失败: ' + err.message)
    }
  }

  const handleAddBank = async () => {
    if (!id || bankSaving) return
    if (!newBank.bankName && !newBank.bankAccount) {
      alert('请填写银行名称或账号')
      return
    }
    setBankSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/client-banks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: id, ...newBank }),
      })
      const data = await res.json()
      if (data.success) {
        setNewBank(EMPTY_BANK)
        setShowAddBank(false)
        loadBankAccounts(id)
      } else {
        alert('添加失败: ' + (data.error || '未知错误'))
      }
    } catch (err: any) {
      alert('添加失败: ' + err.message)
    } finally {
      setBankSaving(false)
    }
  }

  const handleDeleteBank = async (bankId: number) => {
    if (!confirm('确认删除此银行账户？')) return
    try {
      const res = await fetch(`${API_BASE}/api/client-banks?id=${bankId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success && id) loadBankAccounts(id)
    } catch (err: any) {
      alert('删除失败: ' + err.message)
    }
  }

  const [amlStatus, setAmlStatus] = useState<{ hitCount: number; checked: boolean } | null>(null)
  const [amlLoading, setAmlLoading] = useState(false)
  const [amlDetail, setAmlDetail] = useState<any[] | null>(null)
  const [showAmlDetail, setShowAmlDetail] = useState(false)

  const loadAmlDetail = async () => {
    if (!id) return
    try {
      const res = await fetch(`${API_BASE}/api/sanctions-check?clientId=${id}`)
      const data = await res.json()
      if (data.success) {
        setAmlDetail(data.data || [])
        setShowAmlDetail(true)
      }
    } catch {}
  }

  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!id || saving) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/clients?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success && data.data) {
        setClient(data.data)
        setForm(data.data)
        setEditing(false)
        if (data.data.code && String(data.data.code) !== String(id)) {
          navigate(`/crm/clients/${data.data.code}`, { replace: true })
        }
      } else {
        alert('保存失败: ' + (data.error || '未知错误'))
      }
    } catch (err: any) {
      alert('保存失败: ' + (err.message || '网络错误'))
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-12 text-center text-slate-500">加载中...</div>
  if (!client) {
    return (
      <div className="p-8 text-center text-slate-500">
        Client not found.{' '}
        <button onClick={() => navigate('/crm/clients')} className="text-blue-600 underline">Back to list</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/crm/clients')} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
        &larr; 返回客户列表
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{client.nameCn}</h1>
          {client.nameEn && <span className="text-lg text-slate-500">{client.nameEn}</span>}
          <span className={`text-xs px-2 py-1 rounded-full ${segmentColor[client.segment] || 'bg-slate-200 text-slate-600'}`}>{client.segment}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${tierColor[client.tier] || ''}`}>{client.tier}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${client.status === '活跃' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{client.status}</span>
          {amlStatus === null ? null : amlStatus.checked === false ? (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">未筛查</span>
          ) : amlStatus.hitCount === 0 ? (
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 cursor-pointer" onClick={loadAmlDetail}>AML Clear</span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 cursor-pointer" onClick={loadAmlDetail}>AML Alert ({amlStatus.hitCount})</span>
          )}
        </div>
        <div className="text-sm text-slate-500 mt-2">
          RM: {client.rm || '未分配'} · 账户号: {client.code} · AUM: {client.aum > 0 ? `HK$ ${(client.aum / 1000000).toFixed(1)}M` : '—'}
        </div>
      </div>

      {/* AML Detail Modal */}
      {showAmlDetail && amlDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowAmlDetail(false)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">AML筛查记录</h2>
              <button onClick={() => setShowAmlDetail(false)} className="text-slate-400 hover:text-slate-700 text-xl">&times;</button>
            </div>
            {amlDetail.length === 0 ? (
              <p className="text-sm text-slate-400">暂无筛查记录</p>
            ) : (
              <div className="space-y-4">
                {amlDetail.map((check: any) => {
                  const hits = typeof check.hits === 'string' ? JSON.parse(check.hits) : (check.hits || [])
                  return (
                    <div key={check.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-sm font-semibold text-slate-800">{check.client_name}</span>
                          <span className="ml-2 text-xs text-slate-400">{check.trigger_type}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${check.status === 'clear' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {check.status === 'clear' ? '通过' : `命中 ${check.hit_count} 条`}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mb-2">筛查时间：{new Date(check.checked_at).toLocaleString('zh-CN')}</div>
                      {hits.length > 0 && (
                        <div className="space-y-2">
                          {hits.map((h: any, i: number) => (
                            <div key={i} className="bg-red-50 border border-red-100 rounded p-3 text-sm">
                              <div className="flex justify-between">
                                <span className="font-medium text-red-800">{h.name}</span>
                                <span className="text-xs text-red-600">置信度：{((h.confidence_score || 0) * 100).toFixed(0)}%</span>
                              </div>
                              {h.entity_type && <div className="text-xs text-red-600 mt-1">类型：{h.entity_type}</div>}
                              {h.data_source && <div className="text-xs text-red-600">来源：{h.data_source}</div>}
                              {h.address && <div className="text-xs text-red-600">地址：{h.address}</div>}
                              {h.alt_names && h.alt_names.length > 0 && <div className="text-xs text-red-600">别名：{h.alt_names.join(', ')}</div>}
                            </div>
                          ))}
                          <div className="flex gap-2 mt-3">
                            <button className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                              onClick={() => { alert('已标记为误报，客户通过复核。'); setAmlStatus({ hitCount: 0, checked: true }); setShowAmlDetail(false); }}>
                              确认误报 / 通过
                            </button>
                            <button className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
                              onClick={() => { alert('已标记为高风险客户。'); setShowAmlDetail(false); }}>
                              标记高风险
                            </button>
                          </div>
                        </div>
                      )}
                      {hits.length === 0 && <div className="text-xs text-green-600">无命中记录</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        {tabList.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === t ? 'bg-white text-slate-900 border border-slate-200 border-b-white -mb-px' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'Profile' && !editing && (
        <div className="space-y-6">
          <div className="flex justify-end mb-4 gap-2">
            <button
              onClick={handleAmlCheck}
              disabled={amlLoading}
              className="px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              {amlLoading ? '筛查中...' : 'AML筛查'}
            </button>
            <button
              onClick={() => window.open(`/crm/clients/${id}/bcan-consent`, '_blank')}
              className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
            >
              BCAN同意书
            </button>
            <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">编辑</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              ['客户账户号', client.code],
              ['中文名', client.nameCn],
              ['英文名', client.nameEn || '—'],
              ...(client.segment === 'Corporate' || client.segment === 'Institutional' ? [
                ['公司类型', (client as any).entityType || '—'],
                ['业务性质', (client as any).businessNature || '—'],
                ['注册国家', (client as any).countryOfIncorporation || '—'],
                ['注册日期', (client as any).dateOfIncorporation?.slice(0, 10) || '—'],
                ['注册证书号', (client as any).certOfIncorporationNo || '—'],
                ['商业登记号', (client as any).businessRegistrationNo || '—'],
                ['注册地址', (client as any).registeredAddress || '—'],
                ['营业地址', (client as any).businessAddress || '—'],
                ['办公电话', (client as any).officePhone || '—'],
                ['传真', (client as any).fax || '—'],
                ['网站', (client as any).website || '—'],
                ['联系人', (client as any).contactName || '—'],
                ['联系人职位', (client as any).contactTitle || '—'],
                ['联系人电话', (client as any).contactPhone || '—'],
                ['联系人邮箱', (client as any).contactEmail || '—'],
              ] as [string, string][] : [
                ['证件类型', client.idType || '—'],
                ['证件号码', client.idNumber || '—'],
                ['证件有效期', client.idExpiry?.startsWith('9999') ? '长期有效' : (client.idExpiry?.slice(0, 10) || '—')],
                ['签发国家/地区', client.idIssuingCountry || '—'],
                ['出生日期', client.dateOfBirth?.slice(0, 10) || '—'],
                ['性别', client.gender === 'male' ? '男' : client.gender === 'female' ? '女' : (client.gender || '—')],
              ] as [string, string][]),
              ['邮箱', client.email || '—'],
              ['电话', client.phone || '—'],
              ['地址', client.address || '—'],
              ['分类', client.segment],
              ['等级', client.tier],
              ['专业投资者', (client as any).isProfessionalInvestor === false ? '否' : '是'],
              ['加点(%)', client.markupPercent != null ? `${client.markupPercent}%` : '—'],
              ['开户日期', client.onboardedDate?.slice(0, 10) || client.createdAt?.slice(0, 10) || '—'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-sm text-slate-900 mt-1">{value}</div>
              </div>
            ))}
          </div>

          {/* Bank Accounts Section */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">银行账户</h3>
              <button
                onClick={() => setShowAddBank(v => !v)}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
              >
                {showAddBank ? '取消' : '新增银行账户'}
              </button>
            </div>

            {/* Existing bank accounts */}
            {bankAccounts.length === 0 && !showAddBank && (
              <div className="text-sm text-slate-400">
                {(client.bankName || client.bankAccount)
                  ? `${client.bankName || ''}${client.bankCurrency ? ` (${client.bankCurrency})` : ''} · ${client.bankAccount || ''}（旧数据）`
                  : '暂无银行账户'}
              </div>
            )}
            {bankAccounts.length > 0 && (
              <div className="space-y-2">
                {bankAccounts.map((b) => (
                  <div key={b.id} className="py-3 border-b border-slate-100 last:border-0">
                    {editingBankId === b.id ? (
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-slate-400">银行名称</div>
                          <select value={editBank.branchCode ? `${editBank.branchCode}|${editBank.bankName}` : ''} onChange={e => {
                            if (e.target.value === '_custom') { const n = prompt('请输入银行名称：') || ''; setEditBank({...editBank, bankName: n, branchCode: ''}) }
                            else if (e.target.value) { const [c,...np] = e.target.value.split('|'); setEditBank({...editBank, bankName: np.join('|'), branchCode: c}) }
                            else setEditBank({...editBank, bankName: '', branchCode: ''})
                          }} className="w-full px-2 py-1 border border-slate-300 rounded text-xs mt-0.5">
                            <option value="">请选择</option>
                            {HK_BANKS.map(bk => <option key={bk.code} value={`${bk.code}|${bk.name}`}>{bk.code} - {bk.name}</option>)}
                            <option value="_custom">其他</option>
                          </select>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">分行代码</div>
                          <input value={editBank.branchCode} onChange={e => setEditBank({...editBank, branchCode: e.target.value.replace(/[^0-9]/g,'').slice(0,3)})} className="w-full px-2 py-1 border border-slate-300 rounded text-xs mt-0.5 font-mono" maxLength={3} />
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">账号</div>
                          <input value={editBank.bankAccount} onChange={e => setEditBank({...editBank, bankAccount: e.target.value})} className="w-full px-2 py-1 border border-slate-300 rounded text-xs mt-0.5 font-mono" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">账户名称</div>
                          <input value={editBank.accountHolderName} onChange={e => setEditBank({...editBank, accountHolderName: e.target.value})} placeholder="持有人姓名" className="w-full px-2 py-1 border border-slate-300 rounded text-xs mt-0.5" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">币种</div>
                          <select value={editBank.bankCurrency} onChange={e => setEditBank({...editBank, bankCurrency: e.target.value})} className="w-full px-2 py-1 border border-slate-300 rounded text-xs mt-0.5">
                            {['HKD','USD','CNY','EUR','GBP'].map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="flex items-end gap-1">
                          <button onClick={async () => {
                            try {
                              await fetch(`${API_BASE}/api/client-banks?id=${b.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(editBank) })
                              setEditingBankId(null)
                              if (id) loadBankAccounts(id)
                            } catch { alert('保存失败') }
                          }} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">保存</button>
                          <button onClick={() => setEditingBankId(null)} className="text-xs text-slate-500 px-2 py-1">取消</button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-slate-400">银行名称</div>
                          <div className="text-slate-800 font-medium mt-0.5">{b.bank_name || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">分行代码</div>
                          <div className="text-slate-800 font-mono mt-0.5">{(b as any).branch_code || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">账号</div>
                          <div className="text-slate-800 font-mono mt-0.5">{b.bank_account || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">账户名称</div>
                          <div className="text-slate-800 mt-0.5">{(b as any).account_holder_name || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">币种</div>
                          <div className="text-slate-800 mt-0.5">{b.bank_currency || '—'}</div>
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-xs text-slate-400">账户类型</div>
                            <div className="text-slate-800 mt-0.5">{b.bank_account_type || '—'}{b.is_primary ? <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">主账户</span> : null}</div>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => { setEditingBankId(b.id); setEditBank({ bankName: b.bank_name, bankAccount: b.bank_account, branchCode: (b as any).branch_code || '', bankCurrency: b.bank_currency, bankAccountType: b.bank_account_type, accountHolderName: (b as any).account_holder_name || '' }) }} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1">编辑</button>
                            <button onClick={() => handleDeleteBank(b.id)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">删除</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add bank form */}
            {showAddBank && (
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">银行名称</label>
                  <select
                    value={newBank.branchCode ? `${newBank.branchCode}|${newBank.bankName}` : ''}
                    onChange={e => {
                      if (e.target.value === '_custom') {
                        const name = prompt('请输入银行名称：') || ''
                        setNewBank({ ...newBank, bankName: name, branchCode: '' })
                      } else if (e.target.value) {
                        const [code, ...nameParts] = e.target.value.split('|')
                        setNewBank({ ...newBank, bankName: nameParts.join('|'), branchCode: code })
                      } else {
                        setNewBank({ ...newBank, bankName: '', branchCode: '' })
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    style={{ maxWidth: 320 }}
                  >
                    <option value="">请选择银行</option>
                    {HK_BANKS.map(b => (
                      <option key={b.code} value={`${b.code}|${b.name}`}>{b.code} - {b.name}</option>
                    ))}
                    <option value="_custom">其他（手动输入）</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">分行代码（3位）</label>
                  <input
                    type="text"
                    value={newBank.branchCode}
                    onChange={e => setNewBank({ ...newBank, branchCode: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })}
                    placeholder="如：024"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    style={{ maxWidth: 100 }}
                    maxLength={3}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">银行账号</label>
                  <input
                    type="text"
                    value={newBank.bankAccount}
                    onChange={e => setNewBank({ ...newBank, bankAccount: e.target.value })}
                    placeholder="账号"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    style={{ maxWidth: 320 }}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">账户名称</label>
                  <input
                    type="text"
                    value={newBank.accountHolderName}
                    onChange={e => setNewBank({ ...newBank, accountHolderName: e.target.value })}
                    placeholder="账户持有人姓名"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    style={{ maxWidth: 320 }}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">币种</label>
                  <select
                    value={newBank.bankCurrency}
                    onChange={e => setNewBank({ ...newBank, bankCurrency: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    style={{ minWidth: 100 }}
                  >
                    {['HKD', 'USD', 'CNY', 'EUR', 'GBP'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">账户类型</label>
                  <select
                    value={newBank.bankAccountType}
                    onChange={e => setNewBank({ ...newBank, bankAccountType: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    style={{ minWidth: 120 }}
                  >
                    {['saving', 'checking', 'current'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2 flex gap-2">
                  <button
                    onClick={handleAddBank}
                    disabled={bankSaving}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {bankSaving ? '保存中...' : '确认添加'}
                  </button>
                  <button
                    onClick={() => { setShowAddBank(false); setNewBank(EMPTY_BANK) }}
                    className="px-4 py-2 bg-white text-slate-600 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Edit Mode */}
      {activeTab === 'Profile' && editing && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              { key: 'code', label: '客户账户号', type: 'text' },
              { key: 'nameCn', label: '中文名', type: 'text' },
              { key: 'nameEn', label: '英文名', type: 'text' },
              { key: 'segment', label: '分类', type: 'select', options: ['Individual', 'HNWI', 'Corporate', 'Institutional'] },
              ...((form.segment === 'Corporate' || form.segment === 'Institutional') ? [
                { key: 'entityType', label: '公司类型', type: 'select', options: ['', 'Limited', 'Unlimited', 'Sole Proprietorship', 'Partnership', 'Trust', 'Other'] },
                { key: 'businessNature', label: '业务性质', type: 'text' },
                { key: 'countryOfIncorporation', label: '注册国家', type: 'text' },
                { key: 'dateOfIncorporation', label: '注册日期', type: 'date' },
                { key: 'certOfIncorporationNo', label: '注册证书号', type: 'text' },
                { key: 'businessRegistrationNo', label: '商业登记号', type: 'text' },
                { key: 'registeredAddress', label: '注册地址', type: 'text' },
                { key: 'businessAddress', label: '营业地址', type: 'text' },
                { key: 'officePhone', label: '办公电话', type: 'phone' },
                { key: 'fax', label: '传真', type: 'text' },
                { key: 'website', label: '网站', type: 'text' },
                { key: 'contactName', label: '联系人', type: 'text' },
                { key: 'contactTitle', label: '联系人职位', type: 'text' },
                { key: 'contactPhone', label: '联系人电话', type: 'text' },
                { key: 'contactEmail', label: '联系人邮箱', type: 'text' },
              ] : [
                { key: 'idType', label: '证件类型', type: 'select', options: ['', 'HKID', 'Mainland ID', 'Passport', 'Home Return Permit'] },
                { key: 'idNumber', label: '证件号码', type: 'text' },
                { key: 'idExpiry', label: '证件有效期', type: 'date_or_permanent' },
                { key: 'idIssuingCountry', label: '签发国家/地区', type: 'text' },
                { key: 'dateOfBirth', label: '出生日期', type: 'date' },
                { key: 'gender', label: '性别', type: 'select', options: ['', 'male', 'female'] },
              ]),
              { key: 'email', label: '邮箱', type: 'text' },
              { key: 'phone', label: '电话', type: 'phone' },
              { key: 'address', label: '地址', type: 'text' },
              { key: 'tier', label: '等级', type: 'select', options: ['Platinum', 'Gold', 'Silver', 'Bronze'] },
              { key: 'rm', label: '客户经理(RM)', type: 'text' },
              { key: 'aum', label: 'AUM (HKD)', type: 'number' },
              { key: 'isProfessionalInvestor', label: '专业投资者', type: 'select', options: ['true', 'false'] },
              { key: 'markupPercent', label: '加点(%)', type: 'number' },
              { key: 'status', label: '状态', type: 'select', options: ['活跃', '活躍', '冻结', '注销'] },
              { key: 'onboardedDate', label: '开户日期', type: 'date' },
            ] as { key: string; label: string; type: string; options?: string[] }[]).map((field) => (
              <div key={field.key}>
                <label className="text-xs text-slate-500 block mb-1">{field.label}</label>
                {field.type === 'select' ? (
                  <select value={(form as any)[field.key] || ''} onChange={e => setForm({ ...form, [field.key]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    {field.options!.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : field.type === 'phone' ? (
                  <div className="flex gap-1">
                    <select
                      value={((form as any)[field.key] || '').match(/^\+\d+/)?.[0] || '+852'}
                      onChange={e => {
                        const cur = (form as any)[field.key] || ''
                        const num = cur.replace(/^\+\d+\s*/, '')
                        setForm({ ...form, [field.key]: e.target.value + ' ' + num })
                      }}
                      className="px-2 py-2 border border-slate-300 rounded-lg text-sm"
                      style={{ width: 110 }}
                    >
                      <option value="+852">+852 (香港)</option>
                      <option value="+86">+86 (中国)</option>
                      <option value="+853">+853 (澳门)</option>
                      <option value="+886">+886 (台湾)</option>
                      <option value="+65">+65 (新加坡)</option>
                      <option value="+1">+1 (美国)</option>
                      <option value="+44">+44 (英国)</option>
                      <option value="+81">+81 (日本)</option>
                    </select>
                    <input
                      type="text"
                      value={((form as any)[field.key] || '').replace(/^\+\d+\s*/, '')}
                      onChange={e => {
                        const code = ((form as any)[field.key] || '').match(/^\+\d+/)?.[0] || '+852'
                        setForm({ ...form, [field.key]: code + ' ' + e.target.value })
                      }}
                      placeholder="电话号码"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                ) : field.type === 'date_or_permanent' ? (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <input type="checkbox" id="idExpiry_permanent" checked={String((form as any)[field.key] || '').startsWith('9999')} onChange={e => setForm({ ...form, [field.key]: e.target.checked ? '9999-12-31' : '' })} />
                      <label htmlFor="idExpiry_permanent" className="text-xs text-slate-600 cursor-pointer">长期有效</label>
                    </div>
                    {(form as any)[field.key] !== '9999-12-31' && (
                      <input type="date" value={((form as any)[field.key] || '').slice(0, 10)} onChange={e => setForm({ ...form, [field.key]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    )}
                  </div>
                ) : (
                  <input type={field.type === 'date' ? 'date' : field.type} value={field.type === 'date' ? ((form as any)[field.key] || '').slice(0, 10) : ((form as any)[field.key] ?? '')} onChange={e => setForm({ ...form, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-4">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
            <button onClick={() => { setEditing(false); setForm(client); }} className="px-4 py-2 bg-white text-slate-600 text-sm rounded-lg border border-slate-300 hover:bg-slate-50">取消</button>
          </div>
        </div>
      )}

      {activeTab === 'Accounts' && (
        <div className="space-y-4">
          {/* Statement Buttons */}
          <AccountsStatementBar clientId={id!} />

          {/* Balance Summary */}
          {(() => {
            const totalIn: Record<string, number> = {}
            const totalOut: Record<string, number> = {}
            for (const tx of fundTxs) {
              const cur = tx.currency || 'HKD'
              if (tx.type === 'deposit') totalIn[cur] = (totalIn[cur] || 0) + Number(tx.amount)
              else if (tx.type === 'withdrawal') totalOut[cur] = (totalOut[cur] || 0) + Number(tx.amount)
            }
            const currencies = [...new Set([...Object.keys(totalIn), ...Object.keys(totalOut)])]
            if (currencies.length === 0) return null
            return (
              <div className="grid grid-cols-3 gap-4">
                {currencies.map(cur => (
                  <div key={cur} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                    <div className="text-xs text-slate-500 mb-2">{cur} 资金汇总</div>
                    <div className="text-sm text-green-600">总入金：{(totalIn[cur] || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <div className="text-sm text-red-500">总出金：{(totalOut[cur] || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <div className="text-base font-semibold text-slate-800 mt-1">
                      当前结余：{((totalIn[cur] || 0) - (totalOut[cur] || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Transaction List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">资金流水</h3>
              <button
                onClick={() => setShowAddTx(v => !v)}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
              >
                {showAddTx ? '取消' : '新增交易'}
              </button>
            </div>

            {/* Add Transaction Form */}
            {showAddTx && (
              <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">类型</label>
                    <select
                      value={newTx.type}
                      onChange={e => setNewTx({ ...newTx, type: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="deposit">入金 (Deposit)</option>
                      <option value="withdrawal">出金 (Withdrawal)</option>
                      <option value="transfer_otc">划转OTC (Transfer)</option>
                      <option value="deposit_and_transfer">入金并划转OTC</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">交易日期</label>
                    <input type="date" value={newTx.tradeDate} onChange={e => setNewTx({ ...newTx, tradeDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">币种</label>
                    <select value={newTx.currency} onChange={e => setNewTx({ ...newTx, currency: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      {['HKD', 'USD', 'CNY', 'EUR', 'GBP'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">金额</label>
                    <input type="number" min="0" step="0.01" value={newTx.amount}
                      onChange={e => setNewTx({ ...newTx, amount: e.target.value })}
                      placeholder="0.00" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">银行名称</label>
                    <input type="text" value={newTx.bankName}
                      onChange={e => setNewTx({ ...newTx, bankName: e.target.value })}
                      placeholder="如：汇丰银行" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">银行账号</label>
                    <input type="text" value={newTx.bankAccount}
                      onChange={e => setNewTx({ ...newTx, bankAccount: e.target.value })}
                      placeholder="账号" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                </div>
                {/* Authorization fields for transfer_otc */}
                {(newTx.type === 'transfer_otc' || newTx.type === 'deposit_and_transfer') && (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div>
                      <label className="text-xs text-amber-700 block mb-1">授权类型 *</label>
                      <select value={newTx.authType} onChange={e => setNewTx({ ...newTx, authType: e.target.value })}
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm">
                        <option value="written_direction">Written Direction (书面指示)</option>
                        <option value="standing_authority">Standing Authority (常设授权)</option>
                        <option value="client_agreement">Client Agreement (客户协议)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-amber-700 block mb-1">授权编号/参考</label>
                      <input type="text" value={newTx.authRef}
                        onChange={e => setNewTx({ ...newTx, authRef: e.target.value })}
                        placeholder="WD-20260804-001" className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm" />
                    </div>
                    <div className="flex items-end">
                      <p className="text-xs text-amber-600">划转OTC需要客户授权指令</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 block mb-1">备注</label>
                    <input type="text" value={newTx.remarks}
                      onChange={e => setNewTx({ ...newTx, remarks: e.target.value })}
                      placeholder="选填" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      style={{ maxWidth: 320 }}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      onClick={handleAddTx}
                      disabled={txSaving}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {txSaving ? '提交中...' : '确认提交'}
                    </button>
                    <button
                      onClick={() => { setShowAddTx(false); setNewTx(EMPTY_TX) }}
                      className="px-4 py-2 bg-white text-slate-600 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            {fundTxs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">暂无资金记录</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-slate-100">
                      <th className="px-4 py-3 text-left font-medium">日期</th>
                      <th className="px-4 py-3 text-left font-medium">参考编号</th>
                      <th className="px-4 py-3 text-left font-medium">类型</th>
                      <th className="px-4 py-3 text-right font-medium">金额</th>
                      <th className="px-4 py-3 text-left font-medium">币种</th>
                      <th className="px-4 py-3 text-left font-medium">状态</th>
                      <th className="px-4 py-3 text-left font-medium">备注</th>
                      <th className="px-4 py-3 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundTxs.map(tx => {
                      const typeLabel = tx.type === 'deposit' ? '入金' : tx.type === 'withdrawal' ? '出金' : '划转OTC'
                      const typeColor = tx.type === 'deposit' ? 'text-green-600' : tx.type === 'withdrawal' ? 'text-red-500' : 'text-blue-600'
                      const statusColor = tx.status === 'completed' ? 'bg-green-100 text-green-700' : tx.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                      const statusLabel = tx.status === 'completed' ? '已完成' : tx.status === 'confirmed' ? '已确认' : '待处理'
                      const nextStatus = tx.status === 'pending' ? 'confirmed' : tx.status === 'confirmed' ? 'completed' : null
                      const nextLabel = tx.status === 'pending' ? '确认' : tx.status === 'confirmed' ? '完成' : null
                      return (
                        <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{tx.created_at?.slice(0, 10)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-700">{tx.tx_code}</td>
                          <td className={`px-4 py-3 font-medium ${typeColor}`}>{typeLabel}</td>
                          <td className={`px-4 py-3 text-right font-mono font-medium ${typeColor}`}>
                            {tx.type === 'withdrawal' ? '-' : ''}{Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{tx.currency}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate">{tx.remarks || '—'}</td>
                          <td className="px-4 py-3">
                            {nextStatus && (
                              <button
                                onClick={() => handleUpdateTxStatus(tx.id, nextStatus)}
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                {nextLabel}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {(activeTab === 'Revenue' || activeTab === 'Credit' || activeTab === 'Interactions') && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center text-slate-500">
          {activeTab} - Coming Soon
        </div>
      )}
    </div>
  )
}

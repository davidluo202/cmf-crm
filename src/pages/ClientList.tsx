import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface Client {
  id: number
  code: string
  nameCn: string
  nameEn: string
  email: string
  phone: string
  segment: string
  tier: string
  rm: string
  aum: number
  status: string
  lastContact: string | null
  createdAt: string
}

const tabs = ['All', '活跃', '冻结'] as const

const segmentColor: Record<string, string> = {
  Individual: 'bg-blue-500/20 text-blue-600',
  HNWI: 'bg-purple-500/20 text-purple-600',
  Corporate: 'bg-emerald-500/20 text-emerald-600',
  Institutional: 'bg-amber-500/20 text-amber-600',
}

const tierColor: Record<string, string> = {
  Platinum: 'bg-slate-200 text-slate-700',
  Gold: 'bg-yellow-100 text-yellow-700',
  Silver: 'bg-gray-100 text-gray-600',
  Bronze: 'bg-orange-100 text-orange-700',
}

export default function ClientList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<typeof tabs[number]>('All')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    code: '', accountNumber: '', nameCn: '', nameEn: '', phone: '', phoneCode: '+852', email: '',
    clientType: '10', channel: '1', segment: 'Individual', isManual: true,
  })
  const [adding, setAdding] = useState(false)

  useEffect(() => { loadClients() }, [])

  const loadClients = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/clients`)
      const data = await res.json()
      if (data.success) setClients(data.data || [])
    } catch (err) {
      console.error('Failed to load clients:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddClient = async () => {
    setAdding(true)
    try {
      const body: any = {
        nameCn: addForm.nameCn, nameEn: addForm.nameEn,
        phone: addForm.phone ? `${addForm.phoneCode || '+852'} ${addForm.phone}` : '', email: addForm.email,
        clientType: addForm.clientType, channel: addForm.channel,
        segment: addForm.segment, status: '活跃',
      }
      if (addForm.isManual && addForm.code) {
        body.code = addForm.code
        if (addForm.accountNumber) body.accountNumber = addForm.accountNumber
      }
      const res = await fetch(`${API_BASE}/api/clients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setShowAdd(false)
        setAddForm({ code: '', accountNumber: '', nameCn: '', nameEn: '', phone: '', phoneCode: '+852', email: '', clientType: '10', channel: '1', segment: 'Individual', isManual: true })
        loadClients()
      } else {
        alert(data.error || '创建失败')
      }
    } catch (err) { alert('创建失败') }
    finally { setAdding(false) }
  }

  const filtered = clients.filter((c) => {
    if (tab !== 'All' && c.status !== tab) return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.nameCn.toLowerCase().includes(q) && !c.nameEn.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Clients / 客户列表</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{clients.length} 位客户</span>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + 手工补录客户
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="搜索客户名称、编号或邮箱..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-blue-500"
        />
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:text-slate-900'
              }`}
            >
              {t === 'All' ? '全部' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">加载中...</div>
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left p-4 text-slate-600 font-medium">编号</th>
              <th className="text-left p-4 text-slate-600 font-medium">客户名称</th>
              <th className="text-left p-4 text-slate-600 font-medium">联系方式</th>
              <th className="text-left p-4 text-slate-600 font-medium">分类</th>
              <th className="text-left p-4 text-slate-600 font-medium">等级</th>
              <th className="text-left p-4 text-slate-600 font-medium">客户经理</th>
              <th className="text-right p-4 text-slate-600 font-medium">AUM</th>
              <th className="text-left p-4 text-slate-600 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr
                key={client.id}
                onClick={() => navigate(`/crm/clients/${client.id}`)}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="p-4 text-slate-500 font-mono text-xs">{client.code}</td>
                <td className="p-4">
                  <div className="text-slate-900 font-medium">{client.nameCn}</div>
                  {client.nameEn && <div className="text-xs text-slate-400">{client.nameEn}</div>}
                </td>
                <td className="p-4">
                  <div className="text-slate-700 text-xs">{client.email}</div>
                  {client.phone && <div className="text-xs text-slate-400">{client.phone}</div>}
                </td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${segmentColor[client.segment] || 'bg-gray-100 text-gray-600'}`}>
                    {client.segment}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${tierColor[client.tier] || 'bg-gray-100 text-gray-600'}`}>
                    {client.tier}
                  </span>
                </td>
                <td className="p-4 text-slate-700 text-xs">{client.rm || '—'}</td>
                <td className="p-4 text-right text-slate-700 font-mono text-xs">
                  {client.aum > 0 ? `HK$ ${(client.aum / 1000000).toFixed(1)}M` : '—'}
                </td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${client.status === '活跃' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {client.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        {!loading && filtered.length === 0 && (
          <div className="p-8 text-center text-slate-500">暂无符合条件的客户</div>
        )}
      </div>

      {/* 手工补录弹窗 */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">手工补录客户</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700 text-xl">&times;</button>
            </div>
            <p className="text-xs text-slate-500">用于补录线下已开户且已分配编号的存量客户。</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">客户编号（已有）</label>
                <input value={addForm.code} onChange={e => setAddForm({...addForm, code: e.target.value})} placeholder="如 C0001" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">14位账户号（如有）</label>
                <input value={addForm.accountNumber} onChange={e => setAddForm({...addForm, accountNumber: e.target.value})} placeholder="如 10012026000001" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">客户类型</label>
                <select value={addForm.clientType} onChange={e => setAddForm({...addForm, clientType: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="10">10 - 零售个人</option>
                  <option value="20">20 - 企业</option>
                  <option value="30">30 - 机构</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">开户渠道</label>
                <select value={addForm.channel} onChange={e => setAddForm({...addForm, channel: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="1">1 - 线下</option>
                  <option value="0">0 - 线上</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">中文名称 *</label>
              <input value={addForm.nameCn} onChange={e => setAddForm({...addForm, nameCn: e.target.value})} placeholder="客户中文名" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">英文名称</label>
              <input value={addForm.nameEn} onChange={e => setAddForm({...addForm, nameEn: e.target.value})} placeholder="Client English Name" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">电话</label>
                <div className="flex gap-1">
                  <select value={addForm.phoneCode || '+852'} onChange={e => setAddForm({...addForm, phoneCode: e.target.value})} className="w-24 px-2 py-2 border border-slate-300 rounded-lg text-sm shrink-0">
                    <option value="+852">+852</option>
                    <option value="+86">+86</option>
                    <option value="+853">+853</option>
                    <option value="+886">+886</option>
                    <option value="+65">+65</option>
                    <option value="+1">+1</option>
                    <option value="+44">+44</option>
                    <option value="+81">+81</option>
                    <option value="+61">+61</option>
                  </select>
                  <input value={addForm.phone} onChange={e => setAddForm({...addForm, phone: e.target.value})} placeholder="电话号码" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">邮箱</label>
                <input value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} placeholder="email@..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">分类</label>
              <select value={addForm.segment} onChange={e => setAddForm({...addForm, segment: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="Individual">Individual (个人)</option>
                <option value="HNWI">HNWI (高净值)</option>
                <option value="Corporate">Corporate (企业)</option>
                <option value="Institutional">Institutional (机构)</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleAddClient} disabled={adding || !addForm.nameCn} className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {adding ? '创建中...' : '创建客户'}
              </button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 bg-white text-slate-600 text-sm rounded-lg border border-slate-300 hover:bg-slate-50">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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
        <span className="text-sm text-slate-500">{clients.length} 位客户</span>
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
    </div>
  )
}

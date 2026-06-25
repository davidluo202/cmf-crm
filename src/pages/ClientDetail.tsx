import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface ClientData {
  id: number; code: string; nameCn: string; nameEn: string; segment: string; tier: string
  status: string; rm: string; email: string; phone: string; address: string
  bankName: string; bankAccount: string; bankAccountType: string; bankCurrency: string
  markupPercent: number; aum: number; onboardedDate: string | null; createdAt: string
}

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

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<typeof tabList[number]>('Profile')
  const [client, setClient] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<ClientData>>({})

  useEffect(() => {
    if (id) loadClient(id)
  }, [id])

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

  const handleSave = async () => {
    if (!id) return
    try {
      const res = await fetch(`${API_BASE}/api/clients?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        setClient(data.data)
        setEditing(false)
      }
    } catch (err) {
      console.error('Failed to save:', err)
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
        </div>
        <div className="text-sm text-slate-500 mt-2">
          RM: {client.rm || '未分配'} · 编号: {client.code} · AUM: {client.aum > 0 ? `HK$ ${(client.aum / 1000000).toFixed(1)}M` : '—'}
        </div>
      </div>

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
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">编辑</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              ['客户编号', client.code],
              ['中文名', client.nameCn],
              ['英文名', client.nameEn || '—'],
              ['邮箱', client.email || '—'],
              ['电话', client.phone || '—'],
              ['地址', client.address || '—'],
              ['银行', `${client.bankName || '—'} (${client.bankCurrency})`],
              ['银行账号', client.bankAccount || '—'],
              ['分类', client.segment],
              ['等级', client.tier],
              ['加点(%)', `${client.markupPercent}%`],
              ['开户日期', client.onboardedDate || client.createdAt?.slice(0, 10) || '—'],
            ] as const).map(([label, value]) => (
              <div key={label} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-sm text-slate-900 mt-1">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Edit Mode */}
      {activeTab === 'Profile' && editing && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'segment', label: '分类', type: 'select', options: ['Individual', 'HNWI', 'Corporate', 'Institutional'] },
              { key: 'tier', label: '等级', type: 'select', options: ['Platinum', 'Gold', 'Silver', 'Bronze'] },
              { key: 'rm', label: '客户经理(RM)', type: 'text' },
              { key: 'aum', label: 'AUM (HKD)', type: 'number' },
              { key: 'markupPercent', label: '加点(%)', type: 'number' },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-xs text-slate-500 block mb-1">{field.label}</label>
                {field.type === 'select' ? (
                  <select value={(form as any)[field.key] || ''} onChange={e => setForm({ ...form, [field.key]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    {field.options!.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={field.type} value={(form as any)[field.key] || ''} onChange={e => setForm({ ...form, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">保存</button>
            <button onClick={() => { setEditing(false); setForm(client); }} className="px-4 py-2 bg-white text-slate-600 text-sm rounded-lg border border-slate-300 hover:bg-slate-50">取消</button>
          </div>
        </div>
      )}

      {activeTab !== 'Profile' && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center text-slate-500">
          {activeTab} - Coming Soon
        </div>
      )}
    </div>
  )
}

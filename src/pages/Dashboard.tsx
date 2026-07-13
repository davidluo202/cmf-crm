import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface DashboardStats {
  totalClients: number
  activeClients: number
  frozenClients: number
  totalAum: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({ totalClients: 0, activeClients: 0, frozenClients: 0, totalAum: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/clients`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          const clients = data.data
          setStats({
            totalClients: clients.length,
            activeClients: clients.filter((c: any) => c.status === '活跃').length,
            frozenClients: clients.filter((c: any) => c.status === '冻结').length,
            totalAum: clients.reduce((sum: number, c: any) => sum + (Number(c.aum) || 0), 0),
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    { title: '客户总数', value: String(stats.totalClients), sub: `活跃 ${stats.activeClients} / 冻结 ${stats.frozenClients}` },
    { title: '管理资产 (AUM)', value: stats.totalAum > 0 ? `HK$ ${(stats.totalAum / 1000000).toFixed(1)}M` : '--', sub: '' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">仪表盘 / Dashboard</h1>

      {loading ? (
        <div className="p-12 text-center text-slate-500">加载中...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => (
              <div key={card.title} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="text-sm text-slate-500">{card.title}</div>
                <div className="text-2xl font-bold text-slate-900 mt-2">{card.value}</div>
                {card.sub && <div className="text-xs text-slate-400 mt-1">{card.sub}</div>}
              </div>
            ))}
          </div>

          {stats.totalClients === 0 && (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center text-slate-500">
              暂无客户数据，请前往「客户管理」手工补录客户
            </div>
          )}
        </>
      )}
    </div>
  )
}

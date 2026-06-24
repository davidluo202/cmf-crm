import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const mockClientData: Record<string, {
  ref: string; name: string; segment: string; tier: string; status: string; rm: string
  email: string; phone: string; company: string; address: string; onboarded: string; aum: string
}> = {
  '1': { ref: 'CL-001', name: 'Chen Wei Holdings', segment: 'Corporate', tier: 'Gold', status: 'Active', rm: 'Alice Wong', email: 'info@chenwei.hk', phone: '+852 2888 1001', company: 'Chen Wei Holdings Ltd', address: 'Central, Hong Kong', onboarded: '2024-03-15', aum: 'HK$ 85M' },
  '2': { ref: 'CL-002', name: 'Pacific Dragon Ltd', segment: 'Institutional', tier: 'Platinum', status: 'Active', rm: 'Alice Wong', email: 'ops@pacificdragon.com', phone: '+852 2888 2002', company: 'Pacific Dragon Limited', address: 'Admiralty, Hong Kong', onboarded: '2023-11-20', aum: 'HK$ 120M' },
  '3': { ref: 'CL-003', name: 'Golden Harvest Corp', segment: 'Corporate', tier: 'Silver', status: 'Active', rm: 'Bob Chen', email: 'finance@goldenharvest.hk', phone: '+852 2888 3003', company: 'Golden Harvest Corporation', address: 'Wan Chai, Hong Kong', onboarded: '2025-01-10', aum: 'HK$ 45M' },
  '4': { ref: 'CL-004', name: 'Jade Mountain Capital', segment: 'HNWI', tier: 'Gold', status: 'Prospect', rm: 'Alice Wong', email: 'contact@jademountain.com', phone: '+852 2888 4004', company: 'Jade Mountain Capital Ltd', address: 'Tsim Sha Tsui, Hong Kong', onboarded: '—', aum: 'HK$ 30M' },
  '5': { ref: 'CL-005', name: 'Silver Wave Trading', segment: 'Corporate', tier: 'Bronze', status: 'Dormant', rm: 'Bob Chen', email: 'admin@silverwave.hk', phone: '+852 2888 5005', company: 'Silver Wave Trading Ltd', address: 'Kwun Tong, Hong Kong', onboarded: '2024-06-01', aum: 'HK$ 0' },
}

const tabList = ['Profile', 'Accounts', 'Revenue', 'Credit', 'Interactions'] as const

const segmentColor: Record<string, string> = {
  HNWI: 'bg-purple-500/20 text-purple-400',
  Corporate: 'bg-blue-500/20 text-blue-400',
  Institutional: 'bg-emerald-500/20 text-emerald-400',
}

const tierColor: Record<string, string> = {
  Platinum: 'bg-cyan-500/20 text-cyan-400',
  Gold: 'bg-yellow-500/20 text-yellow-400',
  Silver: 'bg-gray-400/20 text-gray-300',
  Bronze: 'bg-orange-500/20 text-orange-400',
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<typeof tabList[number]>('Profile')

  const client = mockClientData[id || '']
  if (!client) {
    return (
      <div className="p-8 text-center text-gray-400">
        Client not found.{' '}
        <button onClick={() => navigate('/crm/clients')} className="text-blue-400 underline">Back to list</button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/crm/clients')} className="text-sm text-gray-400 hover:text-white transition-colors">
        &larr; Back to Clients
      </button>

      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-800">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{client.name}</h1>
          <span className={`text-xs px-2 py-1 rounded-full ${segmentColor[client.segment] || 'bg-gray-600 text-gray-300'}`}>{client.segment}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${tierColor[client.tier] || ''}`}>{client.tier}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${client.status === 'Active' ? 'bg-green-500/20 text-green-400' : client.status === 'Prospect' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>{client.status}</span>
        </div>
        <div className="text-sm text-gray-400 mt-2">RM: {client.rm} &middot; Ref: {client.ref} &middot; AUM: {client.aum}</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-1">
        {tabList.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === t ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            ['Company / 公司', client.company],
            ['Email / 邮箱', client.email],
            ['Phone / 电话', client.phone],
            ['Address / 地址', client.address],
            ['Onboarded / 开户日期', client.onboarded],
            ['AUM / 管理资产', client.aum],
          ] as const).map(([label, value]) => (
            <div key={label} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-sm text-white mt-1">{value}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab !== 'Profile' && (
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center text-gray-500">
          {activeTab} - Coming Soon
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Client {
  id: string
  ref: string
  name: string
  segment: 'HNWI' | 'Corporate' | 'Institutional'
  rm: string
  aum: string
  status: 'Active' | 'Prospect' | 'Dormant'
  lastContact: string
}

const mockClients: Client[] = [
  { id: '1', ref: 'CL-001', name: 'Chen Wei Holdings', segment: 'Corporate', rm: 'Alice Wong', aum: 'HK$ 85M', status: 'Active', lastContact: '2026-06-18' },
  { id: '2', ref: 'CL-002', name: 'Pacific Dragon Ltd', segment: 'Institutional', rm: 'Alice Wong', aum: 'HK$ 120M', status: 'Active', lastContact: '2026-06-15' },
  { id: '3', ref: 'CL-003', name: 'Golden Harvest Corp', segment: 'Corporate', rm: 'Bob Chen', aum: 'HK$ 45M', status: 'Active', lastContact: '2026-06-20' },
  { id: '4', ref: 'CL-004', name: 'Jade Mountain Capital', segment: 'HNWI', rm: 'Alice Wong', aum: 'HK$ 30M', status: 'Prospect', lastContact: '2026-06-10' },
  { id: '5', ref: 'CL-005', name: 'Silver Wave Trading', segment: 'Corporate', rm: 'Bob Chen', aum: 'HK$ 0', status: 'Dormant', lastContact: '2026-03-01' },
]

const tabs = ['All', 'Active', 'Prospect', 'Dormant'] as const

const segmentColor: Record<string, string> = {
  HNWI: 'bg-purple-500/20 text-purple-400',
  Corporate: 'bg-blue-500/20 text-blue-400',
  Institutional: 'bg-emerald-500/20 text-emerald-400',
}

const statusColor: Record<string, string> = {
  Active: 'bg-green-500/20 text-green-400',
  Prospect: 'bg-yellow-500/20 text-yellow-400',
  Dormant: 'bg-gray-500/20 text-gray-400',
}

export default function ClientList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<typeof tabs[number]>('All')

  const filtered = mockClients.filter((c) => {
    if (tab !== 'All' && c.status !== tab) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.ref.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Clients / 客户列表</h1>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by name or ref..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        />
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left p-4 text-gray-400 font-medium">Ref</th>
              <th className="text-left p-4 text-gray-400 font-medium">Name / 名称</th>
              <th className="text-left p-4 text-gray-400 font-medium">Segment</th>
              <th className="text-left p-4 text-gray-400 font-medium">RM</th>
              <th className="text-left p-4 text-gray-400 font-medium">AUM</th>
              <th className="text-left p-4 text-gray-400 font-medium">Status</th>
              <th className="text-left p-4 text-gray-400 font-medium">Last Contact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr
                key={client.id}
                onClick={() => navigate(`/crm/clients/${client.id}`)}
                className="border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <td className="p-4 text-gray-500 font-mono">{client.ref}</td>
                <td className="p-4 text-white font-medium">{client.name}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${segmentColor[client.segment]}`}>
                    {client.segment}
                  </span>
                </td>
                <td className="p-4 text-gray-300">{client.rm}</td>
                <td className="p-4 text-gray-300">{client.aum}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColor[client.status]}`}>
                    {client.status}
                  </span>
                </td>
                <td className="p-4 text-gray-500">{client.lastContact}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-500">No clients found</div>
        )}
      </div>
    </div>
  )
}

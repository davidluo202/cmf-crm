import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const summaryCards = [
  { title: 'YTD Revenue / 年度收入', value: 'HK$ 6.3M', sub: 'Target: HK$ 12M' },
  { title: 'MTD Revenue / 本月收入', value: 'HK$ 1.2M', sub: '+15% vs prev month' },
  { title: 'OTC Products / 场外产品', value: 'HK$ 3.8M', sub: '60% of total' },
  { title: 'Securities / 证券', value: 'HK$ 2.5M', sub: '40% of total' },
]

const monthlyData = [
  { month: 'Jan', otc: 520, securities: 330 },
  { month: 'Feb', otc: 580, securities: 340 },
  { month: 'Mar', otc: 700, securities: 400 },
  { month: 'Apr', otc: 620, securities: 360 },
  { month: 'May', otc: 780, securities: 470 },
  { month: 'Jun', otc: 750, securities: 450 },
]

export default function Revenue() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Revenue Overview / 收入概览</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.title}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 border border-gray-800"
          >
            <div className="text-sm text-gray-400">{card.title}</div>
            <div className="text-2xl font-bold text-white mt-2">{card.value}</div>
            <div className="text-xs text-gray-500 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Revenue by Product (HK$ '000) / 产品收入</h2>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#fff' }}
            />
            <Bar dataKey="otc" name="OTC Products" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="securities" name="Securities" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

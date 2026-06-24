import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const summaryCards = [
  { title: 'My Clients / 我的客户', value: '42', change: '+3 this month' },
  { title: 'MTD Revenue / 本月收入', value: 'HK$ 1.2M', change: '+15% vs last month' },
  { title: 'Follow-ups Due / 待跟进', value: '7', change: '3 overdue' },
  { title: 'AUM / 管理资产', value: 'HK$ 380M', change: '+2.1% MoM' },
]

const overdueFollowups = [
  { client: 'Chen Wei Holdings', days: 5, reason: 'Quarterly review' },
  { client: 'Pacific Dragon Ltd', days: 3, reason: 'Product maturity notice' },
  { client: 'Golden Harvest Corp', days: 2, reason: 'Margin call follow-up' },
]

const recentActivity = [
  { time: '10:30', action: 'Call with Chen Wei Holdings - discussed Q2 outlook' },
  { time: '09:15', action: 'Email sent to Pacific Dragon re: new OTC product' },
  { time: 'Yesterday', action: 'Meeting with Golden Harvest - credit review completed' },
  { time: 'Yesterday', action: 'Onboarding docs received from Jade Mountain Capital' },
]

const revenueData = [
  { month: 'Jan', revenue: 850 },
  { month: 'Feb', revenue: 920 },
  { month: 'Mar', revenue: 1100 },
  { month: 'Apr', revenue: 980 },
  { month: 'May', revenue: 1250 },
  { month: 'Jun', revenue: 1200 },
]

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">RM Dashboard / 客户经理仪表盘</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.title}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 border border-gray-800"
          >
            <div className="text-sm text-gray-400">{card.title}</div>
            <div className="text-2xl font-bold text-white mt-2">{card.value}</div>
            <div className="text-xs text-gray-500 mt-1">{card.change}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Follow-ups */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Overdue Follow-ups / 逾期跟进</h2>
          <div className="space-y-3">
            {overdueFollowups.map((item) => (
              <div key={item.client} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
                <div>
                  <div className="text-sm text-white">{item.client}</div>
                  <div className="text-xs text-gray-500">{item.reason}</div>
                </div>
                <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded-full">
                  {item.days}d overdue
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity / 近期活动</h2>
          <div className="space-y-3">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex gap-3 p-3 bg-gray-800/50 rounded-xl">
                <span className="text-xs text-gray-500 whitespace-nowrap mt-0.5">{item.time}</span>
                <span className="text-sm text-gray-300">{item.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Monthly Revenue (HK$ '000) / 月度收入</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#fff' }}
            />
            <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

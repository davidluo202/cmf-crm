import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const VERSION = '260624.005'

const navItems = [
  { path: '/crm/dashboard', label: 'Dashboard', labelZh: '仪表盘', icon: '📊' },
  { path: '/crm/clients', label: 'Clients', labelZh: '客户', icon: '👥' },
  { path: '/crm/revenue', label: 'Revenue', labelZh: '收入', icon: '💰' },
  { path: '/crm/credit', label: 'Credit', labelZh: '信贷', icon: '🏦' },
  { path: '/crm/interactions', label: 'Interactions', labelZh: '互动', icon: '💬' },
  { path: '/crm/fee-schedule', label: 'Fee Schedule', labelZh: '收费表', icon: '💲' },
  { path: '/crm/reports', label: 'Reports', labelZh: '报告', icon: '📄' },
  { path: '/crm/settings', label: 'Settings', labelZh: '设置', icon: '⚙️' },
]

function getGreeting(hour: number) {
  if (hour < 12) return '早上好'
  if (hour < 14) return '午安'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export default function CrmLayout() {
  const navigate = useNavigate()
  const [clock, setClock] = useState(dayjs().format('HH:mm:ss'))
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD dddd'))
  const [greeting, setGreeting] = useState(getGreeting(dayjs().hour()))
  const [weather, setWeather] = useState({ icon: '🌤️', temp: '--°C' })
  const [userName] = useState(() => {
    // 1. Check crm-user-name in localStorage
    const stored = localStorage.getItem('crm-user-name')
    if (stored) return stored
    // 2. Try to decode JWT token payload
    try {
      const token = localStorage.getItem('token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.name) return payload.name
      }
    } catch { /* ignore */ }
    // 3. Fallback
    return 'User'
  })

  useEffect(() => {
    const timer = setInterval(() => {
      const now = dayjs()
      setClock(now.format('HH:mm:ss'))
      setDate(now.format('YYYY-MM-DD dddd'))
      setGreeting(getGreeting(now.hour()))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.json())
      .then(data => setWeather({ icon: data.icon || '🌤️', temp: data.temp || '--°C' }))
      .catch(() => {})
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="flex h-screen text-white">
      {/* Sidebar */}
      <aside className="w-72 flex flex-col" style={{ backgroundColor: '#0f172a' }}>
        {/* Logo */}
        <div className="mx-3 mt-3 mb-1 bg-white rounded-xl p-3">
          <img src="/logo-zh.jpg" alt="CMF" className="w-full h-auto" />
        </div>

        {/* Clock + Greeting + Weather */}
        <div className="px-4 py-3 text-center">
          <div className="text-2xl font-mono font-bold text-white">{clock}</div>
          <div className="text-sm text-gray-400 mt-1">{date}</div>
          <div className="text-base text-gray-200 mt-2">
            {weather.icon} {greeting}，{userName}！ {weather.temp}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <div>
                <div className="text-lg font-semibold">{item.labelZh}</div>
                <div className="text-sm text-gray-500">{item.label}</div>
              </div>
            </NavLink>
          ))}
        </nav>

        {/* Version + Logout */}
        <div className="p-4 border-t border-gray-800">
          <div className="text-center mb-3">
            <span className="text-yellow-400 font-bold text-sm">v{VERSION}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-3 text-base font-bold rounded-lg border border-gray-600 text-white hover:bg-red-600 hover:border-red-600 hover:text-white transition-colors"
          >
            🚪 Logout / 登出
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header bar */}
        <header className="bg-[#0f172a] text-white px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold tracking-wide">誠港金融客戶關係管理系統</h1>
            <p className="text-sm text-slate-300 font-medium">Canton Mutual Financial — Customer Relationship Management (CRM)</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">v{VERSION}</span>
        </header>
        <main className="flex-1 overflow-y-auto text-base p-6 bg-slate-50 text-slate-800" style={{ fontSize: '16px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

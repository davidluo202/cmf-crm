import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const VERSION = '260624.001'

const navItems = [
  { path: '/crm/dashboard', label: 'Dashboard', labelZh: '仪表盘', icon: '📊' },
  { path: '/crm/clients', label: 'Clients', labelZh: '客户', icon: '👥' },
  { path: '/crm/revenue', label: 'Revenue', labelZh: '收入', icon: '💰' },
  { path: '/crm/credit', label: 'Credit', labelZh: '信贷', icon: '🏦' },
  { path: '/crm/interactions', label: 'Interactions', labelZh: '互动', icon: '💬' },
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
  const [userName] = useState(() => localStorage.getItem('userName') || 'David先生')

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
    <div className="flex h-screen bg-gray-950 text-white">
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
      <main className="flex-1 overflow-y-auto text-base" style={{ fontSize: '16px' }}>
        <Outlet />
      </main>
    </div>
  )
}

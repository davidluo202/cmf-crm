import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const navItems = [
  { path: '/crm/dashboard', label: 'Dashboard', labelZh: '仪表盘', icon: '📊' },
  { path: '/crm/clients', label: 'Clients', labelZh: '客户', icon: '👥' },
  { path: '/crm/revenue', label: 'Revenue', labelZh: '收入', icon: '💰' },
  { path: '/crm/credit', label: 'Credit', labelZh: '信贷', icon: '🏦' },
  { path: '/crm/interactions', label: 'Interactions', labelZh: '互动', icon: '💬' },
  { path: '/crm/reports', label: 'Reports', labelZh: '报告', icon: '📄' },
  { path: '/crm/settings', label: 'Settings', labelZh: '设置', icon: '⚙️' },
]

export default function CrmLayout() {
  const navigate = useNavigate()
  const [clock, setClock] = useState(dayjs().format('HH:mm:ss'))

  useEffect(() => {
    const timer = setInterval(() => setClock(dayjs().format('HH:mm:ss')), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col" style={{ backgroundColor: '#0f172a' }}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <img src="/logo-zh.jpg" alt="CMF" className="h-10 object-contain" />
          <div className="text-xs text-gray-400 mt-1">CRM System</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mx-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              <div>
                <div>{item.label}</div>
                <div className="text-xs text-gray-500">{item.labelZh}</div>
              </div>
            </NavLink>
          ))}
        </nav>

        {/* User / Clock / Logout */}
        <div className="p-4 border-t border-gray-800">
          <div className="text-sm text-gray-300">Welcome, RM</div>
          <div className="text-xs text-gray-500 font-mono mt-1">{clock}</div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full py-2 text-sm rounded-lg bg-gray-800 hover:bg-red-600/30 text-gray-400 hover:text-red-400 transition-colors"
          >
            Logout / 登出
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

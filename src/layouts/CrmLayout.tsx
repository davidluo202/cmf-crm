import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'

const VERSION = 'v260713.001'

const NAV_ITEMS = [
  { path: '/crm/dashboard', label: '仪表盘', key: 'dashboard' },
  { path: '/crm/clients', label: '客户管理', key: 'clients' },
  { path: '/crm/revenue', label: '收入', key: 'revenue' },
  { path: '/crm/fee-schedule', label: '收费表', key: 'fee-schedule' },
]

const MORE_ITEMS = [
  { path: '/crm/credit', label: '信贷', key: 'credit' },
  { path: '/crm/interactions', label: '互动', key: 'interactions' },
  { path: '/crm/reports', label: '报告', key: 'reports' },
  { path: '/crm/admin-users', label: '内部用户管理', key: 'admin-users' },
  { path: '/crm/settings', label: '系统设置', key: 'settings' },
]

export default function CrmLayout() {
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [userName] = useState(() => {
    const stored = localStorage.getItem('crm-user-name')
    if (stored) return stored
    try {
      const token = localStorage.getItem('token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.name) return payload.name
      }
    } catch { /* ignore */ }
    return 'User'
  })

  const [userEmail] = useState(() => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.email) return payload.email
      }
    } catch { /* ignore */ }
    return ''
  })

  const activeKey = (() => {
    const path = location.pathname
    const all = [...NAV_ITEMS, ...MORE_ITEMS]
    const match = all.find(i => path.startsWith(i.path))
    return match?.key || 'dashboard'
  })()

  const isMoreActive = MORE_ITEMS.some(i => i.key === activeKey)

  const handleNav = (path: string) => {
    navigate(path)
    setShowMore(false)
    setMobileMenuOpen(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('crm-user-name')
    navigate('/login')
  }

  const handleChangePwd = async () => {
    if (!newPwd || newPwd.length < 8) { setPwdMsg('密码至少8位'); return }
    setPwdMsg('修改中...')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin-users?action=change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPwd }),
      })
      const data = await res.json()
      if (data.success) {
        setPwdMsg('密码修改成功')
        setTimeout(() => { setShowChangePwd(false); setPwdMsg(''); setNewPwd('') }, 1500)
      } else {
        setPwdMsg(data.error || '修改失败')
      }
    } catch {
      setPwdMsg('网络错误')
    }
  }

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('.user-menu-area')) setShowUserMenu(false)
      if (!t.closest('.more-menu-area')) setShowMore(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const allMenuItems = [...NAV_ITEMS, ...MORE_ITEMS]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <style>{`
        @media (max-width: 1024px) { .desktop-nav { display: none !important; } .mobile-hamburger { display: flex !important; } }
        @media (min-width: 1025px) { .mobile-hamburger { display: none !important; } .mobile-menu-overlay { display: none !important; } }
        @media (max-width: 480px) { .logo-text-detail .full-name { display: none !important; } .logo-text-detail .short-name { display: block !important; } }
      `}</style>

      {/* Fixed Header */}
      <header style={{
        backgroundColor: '#1e293b',
        padding: '0 16px',
        position: 'fixed', top: 0, left: 0, right: 0, height: 48, zIndex: 1000,
        borderBottom: '2px solid #334155',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 48, gap: 12, maxWidth: 1600, margin: '0 auto' }}>
          {/* Logo */}
          <button onClick={() => handleNav('/crm/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: 0 }}>
            <div style={{ backgroundColor: '#fff', borderRadius: 10, padding: '4px 10px', display: 'flex', alignItems: 'center' }}>
              <img src="/logo-zh.jpg" alt="CMF" style={{ height: 36 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
            <div className="logo-text-detail" style={{ textAlign: 'left', lineHeight: 1.3 }}>
              <div className="full-name" style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>诚港金融 CRM</div>
              <div className="full-name" style={{ fontSize: 12, color: '#94a3b8' }}>客户关系管理系统 {VERSION}</div>
              <div className="short-name" style={{ display: 'none', fontSize: 13, fontWeight: 700, color: '#fff' }}>CMF CRM</div>
              <div className="short-name" style={{ display: 'none', fontSize: 10, color: '#94a3b8' }}>{VERSION}</div>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="desktop-nav" style={{ display: 'flex', gap: 2, marginLeft: 24 }}>
            {NAV_ITEMS.map(item => (
              <button key={item.key} onClick={() => handleNav(item.path)}
                style={{
                  padding: '8px 14px', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500,
                  backgroundColor: activeKey === item.key ? '#334155' : 'transparent',
                  color: activeKey === item.key ? '#fff' : '#94a3b8',
                }}>
                {item.label}
              </button>
            ))}
            <div className="more-menu-area" style={{ position: 'relative' }}>
              <button onClick={(e) => { e.stopPropagation(); setShowMore(!showMore) }}
                style={{
                  padding: '8px 14px', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500,
                  backgroundColor: isMoreActive ? '#334155' : 'transparent',
                  color: isMoreActive ? '#fff' : '#94a3b8',
                }}>
                更多 ▾
              </button>
              {showMore && (
                <div style={{ position: 'absolute', top: 40, right: 0, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 4, minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1100 }}>
                  {MORE_ITEMS.map(item => (
                    <button key={item.key} onClick={() => handleNav(item.path)}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer', textAlign: 'left', backgroundColor: activeKey === item.key ? '#334155' : 'transparent', color: activeKey === item.key ? '#fff' : '#94a3b8' }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Right side: user menu */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
            <div className="user-menu-area" style={{ position: 'relative' }}>
              <button className="desktop-nav" onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu) }}
                style={{ background: 'none', border: '1px solid #475569', borderRadius: 6, padding: '4px 12px', fontSize: 13, color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                👤 {userName} ▾
              </button>
              {showUserMenu && (
                <div className="desktop-nav" style={{ position: 'absolute', top: 40, right: 0, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 4, minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1100 }}>
                  <div style={{ padding: '8px 12px', fontSize: 12, color: '#94a3b8', borderBottom: '1px solid #334155' }}>{userEmail}</div>
                  <button onClick={() => { setShowChangePwd(true); setShowUserMenu(false) }}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer', textAlign: 'left', backgroundColor: 'transparent', color: '#e2e8f0' }}>
                    修改密码
                  </button>
                  <button onClick={handleLogout}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer', textAlign: 'left', backgroundColor: 'transparent', color: '#f87171' }}>
                    退出登录
                  </button>
                </div>
              )}
            </div>
            {/* Mobile hamburger */}
            <button className="mobile-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: 'none', border: '2px solid #475569', borderRadius: 8, cursor: 'pointer', fontSize: 32, color: '#fff', padding: '2px 14px', display: 'none', alignItems: 'center', lineHeight: 1 }}>
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay">
          <div onClick={() => setMobileMenuOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1001 }} />
          <div style={{
            position: 'fixed', top: 48, right: 0, bottom: 0, width: 260, backgroundColor: '#1e293b',
            zIndex: 1002, overflowY: 'auto', borderLeft: '1px solid #334155',
            boxShadow: '-4px 0 16px rgba(0,0,0,0.3)',
          }}>
            <div style={{ padding: '12px 8px' }}>
              <div style={{ padding: '8px 12px', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>菜单</div>
              {allMenuItems.map(item => (
                <button key={item.key} onClick={() => handleNav(item.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px',
                    border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', textAlign: 'left', marginBottom: 2,
                    backgroundColor: activeKey === item.key ? '#334155' : 'transparent',
                    color: activeKey === item.key ? '#fff' : '#cbd5e1', fontWeight: activeKey === item.key ? 600 : 400,
                  }}>
                  <span>{item.label}</span>
                </button>
              ))}
              <div style={{ borderTop: '1px solid #334155', margin: '12px 0' }} />
              <div style={{ padding: '8px 14px', fontSize: 12, color: '#64748b' }}>👤 {userName}</div>
              <div style={{ padding: '4px 14px', fontSize: 11, color: '#475569' }}>{userEmail}</div>
              <button onClick={() => { setShowChangePwd(true); setMobileMenuOpen(false) }}
                style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', textAlign: 'left', backgroundColor: 'transparent', color: '#cbd5e1', marginTop: 8 }}>
                修改密码
              </button>
              <button onClick={handleLogout}
                style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', textAlign: 'left', backgroundColor: 'transparent', color: '#f87171' }}>
                退出登录
              </button>
              <div style={{ padding: '12px 14px', fontSize: 11, color: '#475569' }}>{VERSION}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={{ paddingTop: 60, minHeight: 'calc(100vh - 100px)', maxWidth: 1600, margin: '0 auto', padding: '60px 16px 16px', boxSizing: 'border-box', width: '100%' }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{ padding: '12px 20px', backgroundColor: '#1e293b', borderTop: '1px solid #334155', marginTop: 24, textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>© 2026 誠港金融 Canton Mutual Financial · 客户关系管理系统 {VERSION}</span>
      </footer>

      {/* Change Password Modal */}
      {showChangePwd && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>修改密码</h3>
            <input type="password" placeholder="输入新密码（至少8位）" value={newPwd} onChange={e => setNewPwd(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d8e0', borderRadius: 6, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }} />
            {pwdMsg && <div style={{ fontSize: 13, color: pwdMsg.includes('成功') ? '#16a34a' : '#dc2626', marginBottom: 8 }}>{pwdMsg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleChangePwd}
                style={{ flex: 1, padding: '10px', backgroundColor: '#1a6cb9', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>确认修改</button>
              <button onClick={() => { setShowChangePwd(false); setPwdMsg(''); setNewPwd('') }}
                style={{ padding: '10px 16px', backgroundColor: '#fff', border: '1px solid #d0d8e0', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

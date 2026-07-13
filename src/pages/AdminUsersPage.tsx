import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface AdminUser {
  id: number
  email: string
  name: string
  role: string
  lastLogin: string | null
  createdAt: string
}

const ROLES = ['admin', 'manager', 'staff']

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ email: '', name: '', password: '', role: 'staff' })
  const [adding, setAdding] = useState(false)
  const [showResetPwd, setShowResetPwd] = useState<AdminUser | null>(null)
  const [resetPwd, setResetPwd] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/admin-users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setUsers(data.data || [])
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!addForm.email || !addForm.name || !addForm.password) { alert('请填写完整'); return }
    setAdding(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/admin-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (data.success) {
        setShowAdd(false)
        setAddForm({ email: '', name: '', password: '', role: 'staff' })
        loadUsers()
      } else {
        alert(data.error || '创建失败')
      }
    } catch { alert('创建失败') }
    finally { setAdding(false) }
  }

  const handleResetPassword = async () => {
    if (!showResetPwd || !resetPwd || resetPwd.length < 8) { setMsg('密码至少8位'); return }
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/admin-users?action=reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: showResetPwd.id, password: resetPwd }),
      })
      const data = await res.json()
      if (data.success) {
        setMsg('密码重置成功')
        setTimeout(() => { setShowResetPwd(null); setResetPwd(''); setMsg('') }, 1500)
      } else {
        setMsg(data.error || '重置失败')
      }
    } catch { setMsg('网络错误') }
  }

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/admin-users?action=update-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, role: newRole }),
      })
      const data = await res.json()
      if (data.success) loadUsers()
      else alert(data.error || '更新失败')
    } catch { alert('网络错误') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">内部用户管理</h1>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          + 新增用户
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">加载中...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-4 text-slate-600 font-medium">ID</th>
                <th className="text-left p-4 text-slate-600 font-medium">邮箱</th>
                <th className="text-left p-4 text-slate-600 font-medium">姓名</th>
                <th className="text-left p-4 text-slate-600 font-medium">角色</th>
                <th className="text-left p-4 text-slate-600 font-medium">最后登录</th>
                <th className="text-left p-4 text-slate-600 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 text-slate-500 font-mono text-xs">{u.id}</td>
                  <td className="p-4 text-slate-700 text-xs">{u.email}</td>
                  <td className="p-4 text-slate-900">{u.name}</td>
                  <td className="p-4">
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="px-2 py-1 border border-slate-300 rounded text-xs">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="p-4 text-slate-500 text-xs">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '从未'}</td>
                  <td className="p-4">
                    <button onClick={() => { setShowResetPwd(u); setResetPwd(''); setMsg('') }}
                      className="text-xs text-blue-600 hover:text-blue-800">重置密码</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && users.length === 0 && (
          <div className="p-8 text-center text-slate-500">暂无用户</div>
        )}
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">新增用户</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700 text-xl">&times;</button>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">邮箱 *</label>
              <input value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})}
                placeholder="user@cmfinancial.com" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">姓名 *</label>
              <input value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})}
                placeholder="姓名" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">初始密码 *</label>
              <input type="password" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})}
                placeholder="至少8位" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">角色</label>
              <select value={addForm.role} onChange={e => setAddForm({...addForm, role: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleAdd} disabled={adding}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {adding ? '创建中...' : '创建用户'}
              </button>
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2.5 bg-white text-slate-600 text-sm rounded-lg border border-slate-300 hover:bg-slate-50">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPwd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">重置密码</h2>
            <p className="text-sm text-slate-500">用户: {showResetPwd.name} ({showResetPwd.email})</p>
            <input type="password" placeholder="输入新密码（至少8位）" value={resetPwd} onChange={e => setResetPwd(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            {msg && <div className={`text-sm ${msg.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>{msg}</div>}
            <div className="flex gap-2">
              <button onClick={handleResetPassword}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">确认重置</button>
              <button onClick={() => { setShowResetPwd(null); setMsg('') }}
                className="px-4 py-2.5 bg-white text-slate-600 text-sm rounded-lg border border-slate-300">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

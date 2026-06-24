import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter email and password')
      return
    }
    // Mock login
    localStorage.setItem('token', 'mock-jwt-token')
    navigate('/crm')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img src="/logo-zh.jpg" alt="CMF" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">CRM System</h1>
          <p className="text-gray-400 text-sm mt-1">Canton Mutual Financial Limited</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 space-y-4 border border-gray-800">
          {error && (
            <div className="text-red-400 text-sm bg-red-400/10 rounded-lg p-3">{error}</div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="user@cmfinancial.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Sign In / 登录
          </button>
        </form>
      </div>
    </div>
  )
}

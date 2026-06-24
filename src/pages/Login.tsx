import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

type Tab = 'login' | 'register'
type RegStep = 1 | 2 | 3

export default function Login() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')

  // Register fields
  const [regStep, setRegStep] = useState<RegStep>(1)
  const [regEmail, setRegEmail] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [verifiedToken, setVerifiedToken] = useState('')
  const [regName, setRegName] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPassword2, setRegPassword2] = useState('')

  const fetchCaptcha = useCallback(async () => {
    try {
      const res = await fetch('/api/captcha')
      const data = await res.json()
      setCaptchaImage(data.image)
      setCaptchaToken(data.captchaToken)
      setCaptchaCode('')
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchCaptcha()
  }, [fetchCaptcha])

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!loginEmail || !loginPassword) {
      setError('請填寫郵箱和密碼')
      return
    }
    if (!loginEmail.toLowerCase().endsWith('@cmfinancial.com')) {
      setError('僅限 @cmfinancial.com 郵箱登入')
      return
    }
    if (!captchaCode) {
      setError('請輸入驗證碼')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          captchaToken,
          captchaCode,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '登入失敗')
        fetchCaptcha()
        return
      }
      localStorage.setItem('token', data.token)
      // Try to decode JWT to get user name
      try {
        const payload = JSON.parse(atob(data.token.split('.')[1]))
        if (payload.name) localStorage.setItem('crm-user-name', payload.name)
      } catch { /* ignore */ }
      navigate('/crm')
    } catch {
      setError('網絡錯誤，請重試')
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async () => {
    setError('')
    if (!regEmail) {
      setError('請輸入郵箱')
      return
    }
    if (!regEmail.toLowerCase().endsWith('@cmfinancial.com')) {
      setError('僅限 @cmfinancial.com 郵箱註冊')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '發送失敗')
        return
      }
      setOtpToken(data.token)
      setRegStep(2)
    } catch {
      setError('網絡錯誤，請重試')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    setError('')
    if (!otpCode || otpCode.length !== 6) {
      setError('請輸入6位驗證碼')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: otpToken, code: otpCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '驗證失敗')
        return
      }
      setVerifiedToken(data.verifiedToken)
      setRegStep(3)
    } catch {
      setError('網絡錯誤，請重試')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!regName.trim()) {
      setError('請輸入姓名')
      return
    }
    if (!regPassword || regPassword.length < 8) {
      setError('密碼長度至少8位')
      return
    }
    if (regPassword !== regPassword2) {
      setError('兩次密碼不一致')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          name: regName,
          verifiedToken,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '註冊失敗')
        return
      }
      localStorage.setItem('token', data.token)
      // Save user name from registration
      localStorage.setItem('crm-user-name', regName.trim())
      navigate('/crm')
    } catch {
      setError('網絡錯誤，請重試')
    } finally {
      setLoading(false)
    }
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    setError('')
    setRegStep(1)
    if (t === 'login') fetchCaptcha()
  }

  const inputClass = 'w-full text-base py-3.5 px-4 bg-white border-2 border-gray-500 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600 placeholder-gray-400'
  const btnClass = 'w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-base rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="w-full max-w-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo-zh.jpg" alt="CMF" className="h-20 mx-auto mb-5" />
          <h1 className="text-3xl font-bold text-slate-900">CRM System</h1>
          <p className="text-slate-600 text-base mt-2 font-medium">Canton Mutual Financial Limited</p>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 bg-slate-200 rounded-xl p-1">
          <button
            onClick={() => switchTab('login')}
            className={`flex-1 py-3 text-base font-bold rounded-lg transition-colors ${
              tab === 'login' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            登入 / Login
          </button>
          <button
            onClick={() => switchTab('register')}
            className={`flex-1 py-3 text-base font-bold rounded-lg transition-colors ${
              tab === 'register' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            註冊 / Register
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-700 text-base font-medium bg-red-100 border border-red-300 rounded-lg p-4 mb-4">{error}</div>
        )}

        {/* Login Form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="bg-white rounded-2xl p-8 space-y-5 shadow-xl border border-slate-200">
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">郵箱 / Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className={inputClass}
                placeholder="user@cmfinancial.com"
              />
            </div>

            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">密碼 / Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className={inputClass}
                placeholder="請輸入密碼"
              />
            </div>

            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">驗證碼 / Captcha</label>
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value)}
                  className={`${inputClass} flex-1`}
                  placeholder="輸入右側驗證碼"
                  maxLength={4}
                />
                {captchaImage ? (
                  <img
                    src={captchaImage}
                    alt="captcha"
                    className="h-14 rounded-lg cursor-pointer border-2 border-gray-400"
                    onClick={fetchCaptcha}
                    title="點擊刷新"
                  />
                ) : (
                  <div
                    className="h-14 w-[130px] bg-slate-100 rounded-lg border-2 border-gray-400 flex items-center justify-center text-slate-500 text-sm cursor-pointer"
                    onClick={fetchCaptcha}
                  >
                    載入中...
                  </div>
                )}
              </div>
            </div>

            <button type="submit" className={btnClass} disabled={loading}>
              {loading ? '登入中...' : '登入 / Sign In'}
            </button>
          </form>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <div className="bg-white rounded-2xl p-8 space-y-5 shadow-xl border border-slate-200">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-3 mb-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold ${
                    regStep >= s ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {s}
                  </div>
                  {s < 3 && <div className={`w-10 h-1 rounded ${regStep > s ? 'bg-blue-600' : 'bg-slate-200'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Email */}
            {regStep === 1 && (
              <div className="space-y-5">
                <p className="text-slate-600 text-base text-center font-medium">輸入公司郵箱以接收驗證碼</p>
                <div>
                  <label className="block text-base font-bold text-slate-700 mb-2">公司郵箱</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className={inputClass}
                    placeholder="user@cmfinancial.com"
                  />
                </div>
                <button onClick={handleSendCode} className={btnClass} disabled={loading}>
                  {loading ? '發送中...' : '發送驗證碼'}
                </button>
              </div>
            )}

            {/* Step 2: OTP */}
            {regStep === 2 && (
              <div className="space-y-5">
                <p className="text-slate-600 text-base text-center font-medium">
                  驗證碼已發送至 <span className="text-slate-900 font-bold">{regEmail}</span>
                </p>
                <div>
                  <label className="block text-base font-bold text-slate-700 mb-2">6位驗證碼</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={`${inputClass} text-center tracking-[0.5em] text-xl`}
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
                <button onClick={handleVerifyCode} className={btnClass} disabled={loading}>
                  {loading ? '驗證中...' : '驗證'}
                </button>
                <button
                  onClick={() => { setRegStep(1); setError('') }}
                  className="w-full py-2.5 text-base text-slate-500 hover:text-slate-900 transition-colors"
                >
                  返回上一步
                </button>
              </div>
            )}

            {/* Step 3: Name + Password */}
            {regStep === 3 && (
              <form onSubmit={handleRegister} className="space-y-5">
                <p className="text-slate-600 text-base text-center font-medium">設置帳號信息完成註冊</p>
                <div>
                  <label className="block text-base font-bold text-slate-700 mb-2">姓名 / Name</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className={inputClass}
                    placeholder="請輸入姓名"
                  />
                </div>
                <div>
                  <label className="block text-base font-bold text-slate-700 mb-2">密碼 / Password</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className={inputClass}
                    placeholder="至少8位"
                  />
                </div>
                <div>
                  <label className="block text-base font-bold text-slate-700 mb-2">確認密碼 / Confirm</label>
                  <input
                    type="password"
                    value={regPassword2}
                    onChange={(e) => setRegPassword2(e.target.value)}
                    className={inputClass}
                    placeholder="再次輸入密碼"
                  />
                </div>
                <button type="submit" className={btnClass} disabled={loading}>
                  {loading ? '註冊中...' : '完成註冊'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Security notice */}
        <div className="mt-6 bg-yellow-50 border border-yellow-300 rounded-xl p-4 text-center">
          <p className="text-yellow-800 text-sm font-semibold leading-6">
            本系統僅限誠港金融員工使用<br />
            This system is for CMF employees only
          </p>
        </div>
      </div>
    </div>
  )
}

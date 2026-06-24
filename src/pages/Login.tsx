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

  const inputClass = 'w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 placeholder-gray-500'
  const btnClass = 'w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo-zh.jpg" alt="CMF" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">CRM System</h1>
          <p className="text-gray-400 text-sm mt-1">Canton Mutual Financial Limited</p>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 bg-gray-900 rounded-xl p-1 border border-gray-800">
          <button
            onClick={() => switchTab('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'login' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            登入 / Login
          </button>
          <button
            onClick={() => switchTab('register')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'register' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            註冊 / Register
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 rounded-lg p-3 mb-4">{error}</div>
        )}

        {/* Login Form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="bg-gray-900 rounded-2xl p-6 space-y-4 border border-gray-800">
            <div>
              <label className="block text-sm text-gray-400 mb-1">郵箱 / Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className={inputClass}
                placeholder="user@cmfinancial.com"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">密碼 / Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className={inputClass}
                placeholder="請輸入密碼"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">驗證碼 / Captcha</label>
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
                    className="h-10 rounded-lg cursor-pointer border border-gray-700"
                    onClick={fetchCaptcha}
                    title="點擊刷新"
                  />
                ) : (
                  <div
                    className="h-10 w-[120px] bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center text-gray-500 text-xs cursor-pointer"
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
          <div className="bg-gray-900 rounded-2xl p-6 space-y-4 border border-gray-800">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    regStep >= s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {s}
                  </div>
                  {s < 3 && <div className={`w-8 h-0.5 ${regStep > s ? 'bg-blue-600' : 'bg-gray-700'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Email */}
            {regStep === 1 && (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm text-center">輸入公司郵箱以接收驗證碼</p>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">公司郵箱</label>
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
              <div className="space-y-4">
                <p className="text-gray-400 text-sm text-center">
                  驗證碼已發送至 <span className="text-white">{regEmail}</span>
                </p>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">6位驗證碼</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={`${inputClass} text-center tracking-[0.5em] text-lg`}
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
                <button onClick={handleVerifyCode} className={btnClass} disabled={loading}>
                  {loading ? '驗證中...' : '驗證'}
                </button>
                <button
                  onClick={() => { setRegStep(1); setError('') }}
                  className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  返回上一步
                </button>
              </div>
            )}

            {/* Step 3: Name + Password */}
            {regStep === 3 && (
              <form onSubmit={handleRegister} className="space-y-4">
                <p className="text-gray-400 text-sm text-center">設置帳號信息完成註冊</p>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">姓名 / Name</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className={inputClass}
                    placeholder="請輸入姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">密碼 / Password</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className={inputClass}
                    placeholder="至少8位"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">確認密碼 / Confirm</label>
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
        <p className="text-center text-gray-600 text-xs mt-6 leading-5">
          本系統僅限誠港金融員工使用<br />
          This system is for CMF employees only
        </p>
      </div>
    </div>
  )
}

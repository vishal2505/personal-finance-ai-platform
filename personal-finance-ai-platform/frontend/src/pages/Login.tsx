import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AuthShell from '../components/AuthShell'
import { KeyRound, Mail } from 'lucide-react'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#f4eee8] text-[#cc735d] ring-1 ring-black/5">
        <KeyRound className="h-6 w-6" />
      </div>

      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-[#2b2521]">Welcome Back</h1>
        <p className="mt-2 text-sm text-[#9a8678]">Sign in to manage your AI-driven finances.</p>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-semibold text-[#4b3d34]">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b8a79c]" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-full bg-[#f7f3ef] py-3 pl-12 pr-5 text-sm text-[#2b2521] placeholder:text-[#b8a79c] ring-1 ring-black/5 transition focus:outline-none focus:ring-2 focus:ring-[#d07a63]/30"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-semibold text-[#4b3d34]">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-full bg-[#f7f3ef] px-5 py-3 text-sm text-[#2b2521] placeholder:text-[#b8a79c] ring-1 ring-black/5 transition focus:outline-none focus:ring-2 focus:ring-[#d07a63]/30"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-full bg-[#d07a63] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(208,122,99,0.35)] transition hover:bg-[#c96f58] focus:outline-none focus:ring-2 focus:ring-[#d07a63]/40 disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="pt-2 text-center text-sm">
          <button
            type="button"
            onClick={() => setError('Password reset is not implemented yet.')}
            className="font-semibold text-[#cc735d] hover:text-[#b85f4a]"
          >
            Forgot Password?
          </button>
        </div>

        <div className="text-center text-sm text-[#9a8678]">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-[#cc735d] hover:text-[#b85f4a]">
            Sign Up
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}

export default Login

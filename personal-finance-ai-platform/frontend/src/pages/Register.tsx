import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import SpendWiseLogo from '../components/SpendWiseLogo'
import { Mail, UserPlus } from 'lucide-react'

const Register = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await register(email, password, fullName)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-[#fbf8f4]">
      {/* Left Side: Design & Branding */}
      <div className="relative hidden w-1/2 flex-col bg-[#2b2521] p-12 text-white lg:flex">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80"
            alt="Financial growth and savings"
            className="h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2b2521] via-transparent to-transparent" />
        </div>

        <div className="relative z-10 text-white">
          <SpendWiseLogo light />
        </div>

        <div className="relative z-10 mt-auto">
          <blockquote className="space-y-4">
            <p className="text-xl font-medium leading-relaxed">
              &ldquo;The best decision I made for my financial future. SpendWise helped me save for my dream home in record time.&rdquo;
            </p>
            <footer className="flex items-center gap-4">
              <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white/20">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100"
                  alt="User"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="text-sm">
                <div className="font-semibold text-white">Michael Chen</div>
                <div className="text-white/60">Software Engineer</div>
              </div>
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="flex w-full flex-col items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#2b2521]">Create Account</h1>
            <p className="mt-2 text-sm text-[#6f6158]">
              Join SpendWise to master your finances with AI.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="full-name" className="text-sm font-semibold text-[#4b3d34]">
                  Full Name
                </label>
                <div className="relative">
                  <UserPlus className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#b8a79c]" />
                  <input
                    id="full-name"
                    name="full-name"
                    type="text"
                    autoComplete="name"
                    className="w-full rounded-2xl border-0 bg-white py-4 pl-12 pr-4 text-[#2b2521] ring-1 ring-[#e8e4df] placeholder:text-[#b8a79c] focus:ring-2 focus:ring-[#d07a63] sm:text-sm sm:leading-6"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-semibold text-[#4b3d34]">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#b8a79c]" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full rounded-2xl border-0 bg-white py-4 pl-12 pr-4 text-[#2b2521] ring-1 ring-[#e8e4df] placeholder:text-[#b8a79c] focus:ring-2 focus:ring-[#d07a63] sm:text-sm sm:leading-6"
                    placeholder="john@example.com"
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
                  autoComplete="new-password"
                  required
                  className="w-full rounded-2xl border-0 bg-white py-4 pl-12 pr-4 text-[#2b2521] ring-1 ring-[#e8e4df] placeholder:text-[#b8a79c] focus:ring-2 focus:ring-[#d07a63] sm:text-sm sm:leading-6"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-2xl bg-[#d07a63] py-4 text-sm font-semibold text-white shadow-xl transition hover:bg-[#c96f58] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d07a63] disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <p className="text-center text-sm text-[#6f6158]">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#d07a63] hover:text-[#b85f4a]">
                Log In
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Register

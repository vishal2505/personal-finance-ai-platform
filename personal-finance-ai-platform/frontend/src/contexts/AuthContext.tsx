import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

interface User {
  id: number
  email: string
  full_name: string | null
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName?: string) => Promise<void>
  logout: () => void
  verifyTwoFactor: (code: string) => Promise<void>
  loading: boolean
  needs2FA: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [needs2FA, setNeeds2FA] = useState(false)
  // We can't use useNavigate here directly as AuthProvider might be outside Router
  // But usually it is inside. Let's assume user handles navigation in the components.

  const navigate = useNavigate()

  // Ensure every API request includes the token, including absolute URLs like http://localhost:8000/api/...
  useEffect(() => {
    const interceptor = axios.interceptors.request.use((config) => {
      const url = config.url ?? ''
      const isApiRequest = url.startsWith('/api') || url.includes('/api/')
      if (isApiRequest) {
        // Use tempToken if we are verifying 2FA, otherwise use stored token
        const t = url.includes('/verify-2fa') ? tempToken : localStorage.getItem('token')
        if (t) {
          config.headers = config.headers ?? {}
          // Axios v1 may expose headers as AxiosHeaders with set()
          if (typeof (config.headers as any).set === 'function') {
            ; (config.headers as any).set('Authorization', `Bearer ${t}`)
          } else {
            ; (config.headers as any).Authorization = `Bearer ${t}`
          }
        }
      }
      return config
    })
    return () => axios.interceptors.request.eject(interceptor)
  }, [tempToken]) // Re-create interceptor if tempToken changes

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      setToken(storedToken)
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
      fetchUser(storedToken)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchUser = async (authToken: string) => {
    try {
      const response = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      setUser(response.data)
    } catch (error) {
      localStorage.removeItem('token')
      setToken(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const formData = new URLSearchParams()
    formData.append('username', email)
    formData.append('password', password)

    const response = await axios.post('/api/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const { access_token, status } = response.data

    if (status === '2fa_required') {
      setTempToken(access_token)
      setNeeds2FA(true)
      navigate('/verify-2fa')
      return
    }

    // Fallback for normal login if 2FA is meant to be optional in future
    setToken(access_token)
    localStorage.setItem('token', access_token)
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

    await fetchUser(access_token)
    navigate('/dashboard')
  }

  const verifyTwoFactor = async (code: string) => {
    if (!tempToken) throw new Error("No pending authentication found")

    const response = await axios.post('/api/auth/verify-2fa', { code })
    const { access_token, status } = response.data

    if (status === 'success') {
      setToken(access_token)
      localStorage.setItem('token', access_token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
      setTempToken(null)
      setNeeds2FA(false)
      await fetchUser(access_token)
      navigate('/dashboard')
    }
  }

  const register = async (email: string, password: string, fullName?: string) => {
    await axios.post('/api/auth/register', {
      email,
      password,
      full_name: fullName
    })

    await login(email, password)
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    setTempToken(null)
    setNeeds2FA(false)
    localStorage.removeItem('token')
    delete axios.defaults.headers.common['Authorization']
    navigate('/')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, verifyTwoFactor, loading, needs2FA }}>
      {children}
    </AuthContext.Provider>
  )
}

import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'

interface PrivateRouteProps {
  children: React.ReactNode
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { token, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f3eee8]">
        <div className="rounded-2xl bg-white/80 px-6 py-4 text-sm font-semibold text-[#6f6158] shadow ring-1 ring-black/5">
          Loading...
        </div>
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default PrivateRoute

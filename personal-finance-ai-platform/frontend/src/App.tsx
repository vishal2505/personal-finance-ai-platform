import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import LandingPage from './pages/LandingPage'
import UploadStatement from './pages/UploadStatement'
import ImportReview from './pages/ImportReview'
import Transactions from './pages/Transactions'
import Budgets from './pages/Budgets'
import Insights from './pages/Insights'
import Anomalies from './pages/Anomalies'
import Categories from './pages/Categories'
import Settings from './pages/Settings'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/upload" element={<UploadStatement />} />
                    <Route path="/import-review" element={<ImportReview />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/budgets" element={<Budgets />} />
                    <Route path="/insights" element={<Insights />} />
                    <Route path="/anomalies" element={<Anomalies />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

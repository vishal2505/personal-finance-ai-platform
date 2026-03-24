import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.tsx'
import './index.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
if (apiBaseUrl) {
  axios.defaults.baseURL = apiBaseUrl
}
if (import.meta.env.PROD) {
  console.log('[SpendWise] API base URL:', axios.defaults.baseURL || '(relative /api)')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

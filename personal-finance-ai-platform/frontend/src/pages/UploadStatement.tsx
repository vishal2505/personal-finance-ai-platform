import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Upload, FileText, File } from 'lucide-react'

const UploadStatement = () => {
  const [file, setFile] = useState<File | null>(null)
  const [bankName, setBankName] = useState('')
  const [cardLastFour, setCardLastFour] = useState('')
  const [statementPeriod, setStatementPeriod] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (bankName) formData.append('bank_name', bankName)
      if (cardLastFour) formData.append('card_last_four', cardLastFour)
      if (statementPeriod) formData.append('statement_period', statementPeriod)

      const endpoint = file.name.endsWith('.pdf') ? '/api/upload/pdf' : '/api/upload/csv'
      const response = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (response.data && response.data.length > 0) {
        setSuccess(true)
        setTimeout(() => {
          navigate('/import-review', { state: { transactions: response.data } })
        }, 1500)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Upload Statement</h1>
        <p className="mt-2 text-sm text-gray-600">Upload your credit card or bank statement (PDF or CSV)</p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">File uploaded successfully! Redirecting to review...</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statement File (PDF or CSV)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition">
              <div className="space-y-1 text-center">
                {file ? (
                  <div className="flex items-center justify-center space-x-2">
                    {file.name.endsWith('.pdf') ? (
                      <FileText className="h-8 w-8 text-blue-500" />
                    ) : (
                      <File className="h-8 w-8 text-green-500" />
                    )}
                    <span className="text-sm text-gray-600">{file.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                        <span>Upload a file</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf,.csv"
                          onChange={handleFileChange}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PDF or CSV up to 10MB</p>
                  </>
                )}
              </div>
            </div>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="mt-2 text-sm text-red-600 hover:text-red-800"
              >
                Remove file
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="bank-name" className="block text-sm font-medium text-gray-700">
                Bank Name (optional)
              </label>
              <input
                type="text"
                id="bank-name"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="e.g., DBS, OCBC, UOB"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="card-last-four" className="block text-sm font-medium text-gray-700">
                Card Last 4 Digits (optional)
              </label>
              <input
                type="text"
                id="card-last-four"
                maxLength={4}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="1234"
                value={cardLastFour}
                onChange={(e) => setCardLastFour(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          <div>
            <label htmlFor="statement-period" className="block text-sm font-medium text-gray-700">
              Statement Period (optional)
            </label>
            <input
              type="text"
              id="statement-period"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="e.g., January 2024"
              value={statementPeriod}
              onChange={(e) => setStatementPeriod(e.target.value)}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !file}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Uploading...' : 'Upload Statement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UploadStatement

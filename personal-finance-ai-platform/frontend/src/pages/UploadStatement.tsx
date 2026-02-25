import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Upload, FileText, File, X, Sparkles } from 'lucide-react'
import Card from '../components/Card'
import clsx from 'clsx'


const UploadStatement = () => {
  const [file, setFile] = useState<File | null>(null)
  const [bankName, setBankName] = useState('')
  const [cardLastFour, setCardLastFour] = useState('')
  const [statementPeriod, setStatementPeriod] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [dragging, setDragging] = useState(false)
  const navigate = useNavigate()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      const extension = droppedFile.name.split('.').pop()?.toLowerCase()
      if (extension === 'pdf' || extension === 'csv') {
        setFile(droppedFile)
        setError('')
      } else {
        setError('Only PDF and CSV files are allowed')
      }
    }
  }

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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2b2521]">Upload Statement</h1>
        <p className="mt-1 text-sm text-[#9a8678]">
          Upload your bank statement (PDF or CSV) to automatically categorize transactions.
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl bg-green-50 p-4 text-sm text-green-800 ring-1 ring-green-200">
                File uploaded successfully! Redirecting to review...
              </div>
            )}

            <div>
              <label className="mb-3 block text-sm font-bold uppercase tracking-wider text-[#b8a79c]">
                Statement File
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={clsx(
                  'relative flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed transition',
                  dragging || file
                    ? 'border-[#d07a63] bg-[#fff7f4]'
                    : 'border-[#e8e4df] bg-[#fbf8f4] hover:border-[#d07a63] hover:bg-white'
                )}
              >
                <div className="space-y-4 text-center">
                  {file ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="grid h-16 w-16 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                        {file.name.endsWith('.pdf') ? (
                          <FileText className="h-8 w-8 text-[#d07a63]" />
                        ) : (
                          <File className="h-8 w-8 text-[#2b2521]" />
                        )}
                      </div>
                      <div className="font-semibold text-[#2b2521]">{file.name}</div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          setFile(null)
                        }}
                        className="flex items-center gap-1.5 rounded-full bg-[#f4ebe6] px-3 py-1 text-xs font-bold text-[#cc735d] transition hover:bg-[#ebd5ce]"
                      >
                        <X className="h-3 w-3" />
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                        <Upload className="h-8 w-8 text-[#9a8678]" />
                      </div>
                      <div className="text-sm">
                        <label className="relative cursor-pointer rounded-md font-bold text-[#d07a63] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#d07a63] focus-within:ring-offset-2 hover:text-[#b85f4a]">
                          <span>Upload a file</span>
                          <input
                            type="file"
                            className="sr-only"
                            accept=".pdf,.csv"
                            onChange={handleFileChange}
                          />
                        </label>
                        <span className="pl-1 text-[#9a8678]">or drag and drop</span>
                      </div>
                      <p className="text-xs text-[#b8a79c]">PDF or CSV up to 10MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="bank-name" className="text-xs font-bold uppercase tracking-wider text-[#b8a79c]">
                  Bank Name <span className="text-[#e8e4df]">(Optional)</span>
                </label>
                <input
                  type="text"
                  id="bank-name"
                  className="w-full rounded-xl border-0 bg-[#fbf8f4] py-3 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] placeholder:text-[#b8a79c] focus:ring-2 focus:ring-[#d07a63]"
                  placeholder="e.g. Chase"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="card-last-four" className="text-xs font-bold uppercase tracking-wider text-[#b8a79c]">
                  Card Last 4 <span className="text-[#e8e4df]">(Optional)</span>
                </label>
                <input
                  type="text"
                  id="card-last-four"
                  maxLength={4}
                  className="w-full rounded-xl border-0 bg-[#fbf8f4] py-3 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] placeholder:text-[#b8a79c] focus:ring-2 focus:ring-[#d07a63]"
                  placeholder="1234"
                  value={cardLastFour}
                  onChange={(e) => setCardLastFour(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="statement-period" className="text-xs font-bold uppercase tracking-wider text-[#b8a79c]">
                Period <span className="text-[#e8e4df]">(Optional)</span>
              </label>
              <input
                type="text"
                id="statement-period"
                className="w-full rounded-xl border-0 bg-[#fbf8f4] py-3 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] placeholder:text-[#b8a79c] focus:ring-2 focus:ring-[#d07a63]"
                placeholder="e.g. October 2023"
                value={statementPeriod}
                onChange={(e) => setStatementPeriod(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !file}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#2b2521] py-4 text-sm font-bold text-white shadow-xl transition hover:bg-[#4a403a] disabled:opacity-50"
            >
              {loading ? (
                'Processing...'
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-[#d07a63] transition group-hover:text-white" />
                  Process Statement with AI
                </>
              )}
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}

export default UploadStatement

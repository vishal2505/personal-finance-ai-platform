/**
 * Component tests for UploadStatement drag-and-drop behavior.
 *
 * Tests cover:
 *   - Dropzone renders the upload prompt initially
 *   - Dropping a PDF file shows the filename
 *   - Dropping a CSV file shows the filename
 *   - Clicking "Remove" clears the file and restores the upload prompt
 *   - Dropping an unsupported file type shows an error and does not
 *     show a filename
 *   - Selecting a file via the hidden input shows the filename
 *   - The submit button is disabled when no file is selected
 *   - The submit button is enabled once a file is selected
 *   - Submitting calls axios.post with the correct endpoint and FormData
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import axios from 'axios'
import UploadStatement from '../UploadStatement'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('axios')
const mockedAxios = axios as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

// useNavigate is called at component top-level; wrap with MemoryRouter or mock.
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

// Stub out lucide-react icons so tests don't fail on SVG rendering in jsdom.
vi.mock('lucide-react', () => ({
  Upload: (props: Record<string, unknown>) => <span data-testid="icon-upload" {...props} />,
  FileText: (props: Record<string, unknown>) => <span data-testid="icon-file-text" {...props} />,
  File: (props: Record<string, unknown>) => <span data-testid="icon-file" {...props} />,
  X: (props: Record<string, unknown>) => <span data-testid="icon-x" {...props} />,
  Sparkles: (props: Record<string, unknown>) => <span data-testid="icon-sparkles" {...props} />,
  CheckCircle: (props: Record<string, unknown>) => <span data-testid="icon-check" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <span data-testid="icon-alert" {...props} />,
  Clock: (props: Record<string, unknown>) => <span data-testid="icon-clock" {...props} />,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PDF_FILE = new File([new Uint8Array([37, 80, 68, 70])], 'bank-statement.pdf', {
  type: 'application/pdf',
})

const CSV_FILE = new File(['date,amount\n2024-01-01,42.50'], 'transactions.csv', {
  type: 'text/csv',
})

const TXT_FILE = new File(['plain text content'], 'readme.txt', {
  type: 'text/plain',
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UploadStatement', () => {
  beforeEach(() => {
    // Suppress the import history fetch that runs on mount.
    mockedAxios.get = vi.fn().mockResolvedValue({ data: [] })
    mockedAxios.post = vi.fn()
  })

  // -------------------------------------------------------------------------
  // Initial render
  // -------------------------------------------------------------------------

  it('renders the dropzone with the upload prompt', () => {
    render(<UploadStatement />)
    expect(screen.getByText(/upload a file/i)).toBeInTheDocument()
    expect(screen.getByText(/or drag and drop/i)).toBeInTheDocument()
    expect(screen.getByText(/pdf or csv up to 10mb/i)).toBeInTheDocument()
  })

  it('disables the submit button when no file has been selected', () => {
    render(<UploadStatement />)
    const button = screen.getByRole('button', { name: /process statement with ai/i })
    expect(button).toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // Drag and drop – accepted file types
  // -------------------------------------------------------------------------

  it('shows the PDF filename after dropping a PDF file', () => {
    render(<UploadStatement />)
    const dropzone = screen.getByTestId('statement-dropzone')

    fireEvent.dragOver(dropzone)
    fireEvent.drop(dropzone, { dataTransfer: { files: [PDF_FILE] } })

    expect(screen.getByText('bank-statement.pdf')).toBeInTheDocument()
  })

  it('shows the CSV filename after dropping a CSV file', () => {
    render(<UploadStatement />)
    const dropzone = screen.getByTestId('statement-dropzone')

    fireEvent.drop(dropzone, { dataTransfer: { files: [CSV_FILE] } })

    expect(screen.getByText('transactions.csv')).toBeInTheDocument()
  })

  it('enables the submit button once a file has been dropped', () => {
    render(<UploadStatement />)
    const dropzone = screen.getByTestId('statement-dropzone')

    fireEvent.drop(dropzone, { dataTransfer: { files: [PDF_FILE] } })

    const button = screen.getByRole('button', { name: /process statement with ai/i })
    expect(button).not.toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // Remove file
  // -------------------------------------------------------------------------

  it('clears the filename and restores the upload prompt after Remove is clicked', () => {
    render(<UploadStatement />)
    const dropzone = screen.getByTestId('statement-dropzone')

    fireEvent.drop(dropzone, { dataTransfer: { files: [PDF_FILE] } })
    expect(screen.getByText('bank-statement.pdf')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    expect(screen.queryByText('bank-statement.pdf')).not.toBeInTheDocument()
    expect(screen.getByText(/upload a file/i)).toBeInTheDocument()
  })

  it('disables the submit button again after Remove is clicked', () => {
    render(<UploadStatement />)
    const dropzone = screen.getByTestId('statement-dropzone')

    fireEvent.drop(dropzone, { dataTransfer: { files: [PDF_FILE] } })
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    const button = screen.getByRole('button', { name: /process statement with ai/i })
    expect(button).toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // Unsupported file type
  // -------------------------------------------------------------------------

  it('shows an error message when an unsupported file type is dropped', () => {
    render(<UploadStatement />)
    const dropzone = screen.getByTestId('statement-dropzone')

    fireEvent.drop(dropzone, { dataTransfer: { files: [TXT_FILE] } })

    expect(screen.getByText(/only pdf and csv files are allowed/i)).toBeInTheDocument()
    expect(screen.queryByText('readme.txt')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // File input (click-to-browse)
  // -------------------------------------------------------------------------

  it('shows the filename after selecting a PDF via the file input', () => {
    render(<UploadStatement />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [PDF_FILE] } })

    expect(screen.getByText('bank-statement.pdf')).toBeInTheDocument()
  })

  it('shows an error when an unsupported file is chosen via the file input', () => {
    render(<UploadStatement />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [TXT_FILE] } })

    expect(screen.getByText(/only pdf and csv files are allowed/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Form submission
  // -------------------------------------------------------------------------

  it('calls axios.post with /api/imports/upload and FormData on submit', async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { transactions: [] } })

    render(<UploadStatement />)
    const dropzone = screen.getByTestId('statement-dropzone')
    fireEvent.drop(dropzone, { dataTransfer: { files: [PDF_FILE] } })

    const form = screen.getByRole('button', { name: /process statement with ai/i }).closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/imports/upload',
        expect.any(FormData),
        expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
      )
    })
  })
})

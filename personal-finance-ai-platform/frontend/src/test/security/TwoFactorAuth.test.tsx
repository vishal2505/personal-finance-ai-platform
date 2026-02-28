/**
 * Frontend component tests for the Two-Factor Authentication (2FA) page.
 *
 * Tests cover:
 *   - Rendering of 6 digit inputs
 *   - Auto-focus on first input at mount
 *   - Typing a digit moves focus to next input
 *   - Backspace on empty input moves focus to previous
 *   - Pasting a 6-digit code fills all inputs
 *   - Non-numeric input is rejected
 *   - Submit button disabled when code is incomplete
 *   - Submit button enabled when 6 digits entered
 *   - Submitting calls verifyTwoFactor with the joined code
 *   - Error message shown on verification failure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TwoFactorAuth from '../../pages/TwoFactorAuth'

// ---------------------------------------------------------------------------
// Mock the AuthContext so we don't need a real provider / router
// ---------------------------------------------------------------------------
const mockVerifyTwoFactor = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    verifyTwoFactor: mockVerifyTwoFactor,
  }),
}))

// Mock lucide-react icons to simple spans to avoid SVG rendering issues
vi.mock('lucide-react', () => ({
  ShieldCheck: (props: any) => <span data-testid="icon-shield" {...props} />,
  ArrowRight: (props: any) => <span data-testid="icon-arrow" {...props} />,
  Loader2: (props: any) => <span data-testid="icon-loader" {...props} />,
  Lock: (props: any) => <span data-testid="icon-lock" {...props} />,
}))

// Mock the SpendWiseLogo component
vi.mock('../../components/SpendWiseLogo', () => ({
  default: () => <div data-testid="logo">SpendWise</div>,
}))

// ---------------------------------------------------------------------------
// Helper: get all 6 digit input boxes
// ---------------------------------------------------------------------------
function getCodeInputs(): HTMLInputElement[] {
  // The inputs have inputMode="numeric" and maxLength=1
  const inputs = screen.getAllByRole('textbox')
  return inputs as HTMLInputElement[]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TwoFactorAuth Page', () => {
  beforeEach(() => {
    mockVerifyTwoFactor.mockReset()
  })

  // 1. Renders 6 digit inputs
  it('renders 6 code input boxes', () => {
    render(<TwoFactorAuth />)
    const inputs = getCodeInputs()
    expect(inputs).toHaveLength(6)
  })

  // 2. Renders headings and text
  it('shows the verification heading', () => {
    render(<TwoFactorAuth />)
    expect(screen.getByText('Verification Required')).toBeInTheDocument()
  })

  // 3. First input is focused on mount
  it('auto-focuses the first input on mount', () => {
    render(<TwoFactorAuth />)
    const inputs = getCodeInputs()
    expect(inputs[0]).toHaveFocus()
  })

  // 4. Typing a digit auto-advances focus to next input
  it('moves focus to next input when a digit is typed', async () => {
    render(<TwoFactorAuth />)
    const inputs = getCodeInputs()
    const user = userEvent.setup()

    await user.click(inputs[0])
    await user.keyboard('1')

    expect(inputs[0].value).toBe('1')
    expect(inputs[1]).toHaveFocus()
  })

  // 5. Backspace on empty input moves focus backward
  it('moves focus to previous input on backspace when current is empty', async () => {
    render(<TwoFactorAuth />)
    const inputs = getCodeInputs()

    // Manually set focus on second input (empty)
    fireEvent.focus(inputs[1])
    fireEvent.keyDown(inputs[1], { key: 'Backspace' })

    expect(inputs[0]).toHaveFocus()
  })

  // 6. Non-numeric characters are rejected
  it('ignores non-numeric input', async () => {
    render(<TwoFactorAuth />)
    const inputs = getCodeInputs()

    fireEvent.change(inputs[0], { target: { value: 'a' } })
    expect(inputs[0].value).toBe('')
  })

  // 7. Paste fills all 6 inputs
  it('fills all inputs when pasting a 6-digit code', () => {
    render(<TwoFactorAuth />)
    const inputs = getCodeInputs()

    const pasteData = new DataTransfer()
    pasteData.setData('text', '123456')

    fireEvent.paste(inputs[0], {
      clipboardData: pasteData,
    })

    expect(inputs[0].value).toBe('1')
    expect(inputs[1].value).toBe('2')
    expect(inputs[2].value).toBe('3')
    expect(inputs[3].value).toBe('4')
    expect(inputs[4].value).toBe('5')
    expect(inputs[5].value).toBe('6')
  })

  // 8. Paste rejects non-numeric content
  it('rejects paste with non-numeric characters', () => {
    render(<TwoFactorAuth />)
    const inputs = getCodeInputs()

    const pasteData = new DataTransfer()
    pasteData.setData('text', '12ab56')

    fireEvent.paste(inputs[0], {
      clipboardData: pasteData,
    })

    // Should remain empty since 'a' and 'b' are not numeric
    expect(inputs[0].value).toBe('')
  })

  // 9. Submit button is disabled when code is incomplete
  it('disables the submit button when fewer than 6 digits entered', () => {
    render(<TwoFactorAuth />)
    const button = screen.getByRole('button', { name: /verify access/i })
    expect(button).toBeDisabled()
  })

  // 10. Submit button enabled after entering 6 digits
  it('enables the submit button when all 6 digits are entered', () => {
    render(<TwoFactorAuth />)
    const inputs = getCodeInputs()

    // Fill all 6 inputs
    '123456'.split('').forEach((digit, i) => {
      fireEvent.change(inputs[i], { target: { value: digit } })
    })

    const button = screen.getByRole('button', { name: /verify access/i })
    expect(button).not.toBeDisabled()
  })

  // 11. Submitting the form calls verifyTwoFactor with the correct code
  it('calls verifyTwoFactor with the joined 6-digit code on submit', async () => {
    mockVerifyTwoFactor.mockResolvedValueOnce(undefined)
    render(<TwoFactorAuth />)
    const inputs = getCodeInputs()

    '123456'.split('').forEach((digit, i) => {
      fireEvent.change(inputs[i], { target: { value: digit } })
    })

    const button = screen.getByRole('button', { name: /verify access/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockVerifyTwoFactor).toHaveBeenCalledWith('123456')
    })
  })

  // 12. Shows error message when verification fails
  it('displays an error message when verifyTwoFactor throws', async () => {
    mockVerifyTwoFactor.mockRejectedValueOnce(new Error('Invalid code'))
    render(<TwoFactorAuth />)
    const inputs = getCodeInputs()

    '000000'.split('').forEach((digit, i) => {
      fireEvent.change(inputs[i], { target: { value: digit } })
    })

    const button = screen.getByRole('button', { name: /verify access/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(
        screen.getByText(/invalid verification code/i)
      ).toBeInTheDocument()
    })
  })

  // 13. verifyTwoFactor is only called once per submission
  it('does not call verifyTwoFactor multiple times on rapid clicks', async () => {
    // Make verifyTwoFactor hang so the button stays in "verifying" state
    mockVerifyTwoFactor.mockImplementation(
      () => new Promise(() => {}) // never resolves
    )
    render(<TwoFactorAuth />)
    const inputs = getCodeInputs()

    '123456'.split('').forEach((digit, i) => {
      fireEvent.change(inputs[i], { target: { value: digit } })
    })

    const button = screen.getByRole('button', { name: /verify access/i })
    fireEvent.click(button)
    fireEvent.click(button) // second rapid click

    // Wait a tick so the first click's state update takes effect
    await waitFor(() => {
      expect(mockVerifyTwoFactor).toHaveBeenCalledTimes(1)
    })
  })
})

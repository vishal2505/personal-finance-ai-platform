/**
 * Frontend component tests for the AI Insights page.
 *
 * Tests cover:
 *   - Loading state shown on initial render
 *   - Insights rendered after successful fetch
 *   - Empty state when no insights returned
 *   - Error state when API call fails
 *   - AI toggle button present and functional
 *   - Toggle refetches insights with updated use_ai param
 *   - Rule-based insights show "Rule-Based Analysis" label
 *   - AI insights show "Powered by GPT" label and OpenAI badge
 *   - Section headers for rule vs AI insights
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import axios from 'axios'
import Insights from '../pages/Insights'

// ---------------------------------------------------------------------------
// Mock axios
// ---------------------------------------------------------------------------
vi.mock('axios', () => {
  const mockAxios: any = {
    get: vi.fn(),
    defaults: { baseURL: '', headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  }
  return { default: mockAxios }
})

// Mock lucide-react icons to simple spans
vi.mock('lucide-react', () => ({
  Lightbulb: (props: any) => <span data-testid="icon-lightbulb" {...props} />,
  TrendingDown: (props: any) => <span data-testid="icon-trending-down" {...props} />,
  TrendingUp: (props: any) => <span data-testid="icon-trending-up" {...props} />,
  AlertTriangle: (props: any) => <span data-testid="icon-alert" {...props} />,
  DollarSign: (props: any) => <span data-testid="icon-dollar" {...props} />,
  Sparkles: (props: any) => <span data-testid="icon-sparkles" {...props} />,
  BarChart3: (props: any) => <span data-testid="icon-barchart" {...props} />,
}))

// Mock Card component to a simple wrapper
vi.mock('../components/Card', () => ({
  default: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}))

// Mock clsx to just join class names
vi.mock('clsx', () => ({
  default: (...args: any[]) => args.filter(Boolean).join(' '),
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const mockRuleInsights = [
  {
    type: 'trend',
    title: 'Spending Increased by 25.0%',
    description: 'Your spending in 2025-02 was 25.0% higher than the previous month.',
    data: { change_percent: 25.0, current: 500, previous: 400 },
    source: 'rule',
  },
  {
    type: 'category',
    title: 'Top Spending: Groceries',
    description: 'You spent $350.50 on Groceries this period.',
    data: { name: 'Groceries', amount: 350.5 },
    source: 'rule',
  },
]

const mockAiInsights = [
  {
    type: 'tip',
    title: 'Cut subscriptions',
    description: 'You can save $50/month by reviewing subscriptions.',
    data: {},
    source: 'ai',
  },
]

const mockAllInsights = [...mockRuleInsights, ...mockAiInsights]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Insights Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Loading state
  it('shows loading state on initial render', () => {
    // Make axios.get return a never-resolving promise to keep loading state
    ;(axios.get as any).mockReturnValue(new Promise(() => {}))
    render(<Insights />)
    expect(screen.getByText('Analyzing finances...')).toBeInTheDocument()
  })

  // 2. Renders insights after fetch
  it('renders insight cards after successful fetch', async () => {
    ;(axios.get as any).mockResolvedValueOnce({ data: mockAllInsights })
    render(<Insights />)

    await waitFor(() => {
      expect(screen.getByText('Spending Increased by 25.0%')).toBeInTheDocument()
    })
    expect(screen.getByText('Top Spending: Groceries')).toBeInTheDocument()
    expect(screen.getByText('Cut subscriptions')).toBeInTheDocument()
  })

  // 3. Empty state
  it('shows empty state when no insights returned', async () => {
    ;(axios.get as any).mockResolvedValueOnce({ data: [] })
    render(<Insights />)

    await waitFor(() => {
      expect(
        screen.getByText('No insights available yet. Add more transactions to generate analysis.')
      ).toBeInTheDocument()
    })
  })

  // 4. Error state
  it('shows error message when API call fails', async () => {
    ;(axios.get as any).mockRejectedValueOnce({
      response: { data: { detail: 'Server error' } },
    })
    render(<Insights />)

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  // 5. Error state with generic message
  it('shows fallback error message when no detail provided', async () => {
    ;(axios.get as any).mockRejectedValueOnce(new Error('Network Error'))
    render(<Insights />)

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load insights. Please try again.')
      ).toBeInTheDocument()
    })
  })

  // 6. AI toggle button present
  it('renders the AI toggle button', async () => {
    ;(axios.get as any).mockResolvedValueOnce({ data: [] })
    render(<Insights />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ai enhanced/i })).toBeInTheDocument()
    })
  })

  // 7. Toggle refetches with updated param
  it('refetches insights when AI toggle is clicked', async () => {
    ;(axios.get as any).mockResolvedValue({ data: [] })
    render(<Insights />)

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/insights/?use_ai=true')
    })

    const toggleBtn = screen.getByRole('button', { name: /ai enhanced/i })
    fireEvent.click(toggleBtn)

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/insights/?use_ai=false')
    })
  })

  // 8. Rule-based insights show correct label
  it('shows "Rule-Based Analysis" label for rule insights', async () => {
    ;(axios.get as any).mockResolvedValueOnce({ data: mockRuleInsights })
    render(<Insights />)

    await waitFor(() => {
      const labels = screen.getAllByText('Rule-Based Analysis')
      expect(labels.length).toBeGreaterThanOrEqual(1)
    })
  })

  // 9. AI insights show correct label and badge
  it('shows "Powered by GPT" label and "OpenAI" badge for AI insights', async () => {
    ;(axios.get as any).mockResolvedValueOnce({ data: mockAiInsights })
    render(<Insights />)

    await waitFor(() => {
      expect(screen.getByText('Powered by GPT')).toBeInTheDocument()
      expect(screen.getByText('OpenAI')).toBeInTheDocument()
    })
  })

  // 10. Section headers
  it('shows section headers for rule and AI insights', async () => {
    ;(axios.get as any).mockResolvedValueOnce({ data: mockAllInsights })
    render(<Insights />)

    await waitFor(() => {
      expect(screen.getByText('Data Analysis')).toBeInTheDocument()
      expect(screen.getByText('AI-Powered Recommendations')).toBeInTheDocument()
    })
  })

  // 11. Only rule section shown when no AI insights
  it('does not show AI section when only rule insights exist', async () => {
    ;(axios.get as any).mockResolvedValueOnce({ data: mockRuleInsights })
    render(<Insights />)

    await waitFor(() => {
      expect(screen.getByText('Data Analysis')).toBeInTheDocument()
    })
    expect(screen.queryByText('AI-Powered Recommendations')).not.toBeInTheDocument()
  })

  // 12. Page title renders
  it('renders the page title', async () => {
    ;(axios.get as any).mockResolvedValueOnce({ data: [] })
    render(<Insights />)

    expect(screen.getByText('AI Insights')).toBeInTheDocument()
  })
})

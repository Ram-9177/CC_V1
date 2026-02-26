import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'

/**
 * ErrorBoundary Component Tests
 * Tests error handling and fallback UI
 */

describe('ErrorBoundary Component', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    // Suppress console.error for error boundary tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const TestComponent = () => <div>Test Content</div>
  const ThrowingComponent = () => {
    throw new Error('Test error')
  }

  it('renders children when there is no error', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary>
            <TestComponent />
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    )

    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('displays error fallback UI when error occurs', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary>
            <ThrowingComponent />
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows error message in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary>
            <ThrowingComponent />
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    )

    expect(screen.getByText('Test error')).toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('provides reset button to recover from error', () => {
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary>
            <ThrowingComponent />
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    )

    rerender(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary>
            <TestComponent />
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    )

    const resetButton = screen.getByText('Try Again')
    expect(resetButton).toBeInTheDocument()

    fireEvent.click(resetButton)

    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('handles custom fallback UI', () => {
    const customFallback = (error: Error) => (
      <div>Custom Error: {error.message}</div>
    )

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary fallback={customFallback}>
            <ThrowingComponent />
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    )

    expect(screen.getByText('Custom Error: Test error')).toBeInTheDocument()
  })
})

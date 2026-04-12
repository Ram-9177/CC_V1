import React, { ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorStateIllustration } from '@/components/illustrations'

// Extend window type for Sentry
declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: Record<string, unknown>) => void
    }
  }
}

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary Component
 * Catches errors in child components and displays fallback UI
 * Logs errors to console and Sentry in production
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('❌ Error caught by boundary:', error)
      console.error('Error Info:', errorInfo)
    }

    // Log to Sentry in production
    if (import.meta.env.PROD && window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      })
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset)
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-muted/30 px-4 py-12">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card/90 dark:bg-card/80 p-8 text-center shadow-sm">
            <ErrorStateIllustration
              className="mb-4 mx-auto"
              decorative={false}
              aria-label="Error"
            />
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
              <h1 className="text-lg font-semibold text-destructive sm:text-xl">
                Something went wrong
              </h1>
            </div>

            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              An unexpected error occurred. Please try again.
            </p>

            {import.meta.env.DEV && (
              <div className="mb-6 rounded-xl border border-border bg-muted/50 p-4 text-left">
                <p className="text-xs font-mono text-foreground/80 break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3 justify-center">
              <Button onClick={this.handleReset} size="sm" className="rounded-xl">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={() => (window.location.href = '/')}
                variant="outline"
                size="sm"
                className="rounded-xl border-border/80"
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

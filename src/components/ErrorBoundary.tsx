import React, { ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Extend window type for Sentry
declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: any) => void
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
        <div className="flex items-center justify-center min-h-screen bg-destructive/5">
          <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg border border-destructive/20">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
              <h1 className="text-xl font-bold text-destructive">
                Something went wrong
              </h1>
            </div>

            <p className="text-gray-600 mb-4">
              An unexpected error occurred. Please try again.
            </p>

            {import.meta.env.DEV && (
              <div className="bg-gray-100 p-4 rounded mb-6 border border-gray-200">
                <p className="text-xs font-mono text-gray-700 break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={this.handleReset}
                className="flex-1"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={() => (window.location.href = '/')}
                variant="outline"
                size="sm"
                className="flex-1"
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

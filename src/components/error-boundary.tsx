import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-lg text-white/80">Something went wrong.</p>
          <p className="max-w-md text-sm text-white/40">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.href = "/moderator"
            }}
            className="mt-4 rounded-md bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

import { Component } from 'react'
import { reportError } from '@shared/lib/report'
import { CrashNotice } from './CrashNotice'

/**
 * Catches a crash in the part of the app it wraps, logs it, and shows what happened instead of
 * a blank window. `whole` is the app's outermost boundary: its only way out is a reload. Inner
 * boundaries (a pane, the sidebar) also offer to try that part again.
 */
export class ErrorBoundary extends Component<
  { scope: string; whole?: boolean; children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportError(this.props.scope, `${error.stack ?? error.message}\n${info.componentStack ?? ''}`)
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <CrashNotice
        error={error}
        whole={this.props.whole ?? false}
        retry={() => this.setState({ error: null })}
      />
    )
  }
}

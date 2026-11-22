import type { ProvidersBackend } from './providers'
import { useUsageView } from './store'
import { usageOver } from './usage'

let latest = 0

/** Loads the report for the picked period; a newer load wins over an older one still running. */
export async function loadUsageView(backend: ProvidersBackend): Promise<void> {
  const request = ++latest
  const { days } = useUsageView.getState()
  useUsageView.setState({ loading: true, problem: null })
  try {
    const report = await usageOver(backend, days)
    if (request === latest) useUsageView.setState({ shown: { report, days }, loading: false })
  } catch (problem) {
    if (request === latest) useUsageView.setState({ problem, loading: false })
  }
}

import { Bot } from 'lucide-react'
import { PageHeader } from '@shared/ui/page-header'
import { EmptyState } from '@shared/ui/empty-state'
import { useLanguage } from '@app/providers/useLanguage'

export function AgentsPage(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('nav.agents')} />
      <EmptyState icon={Bot} title={t('agents.empty')} />
    </div>
  )
}

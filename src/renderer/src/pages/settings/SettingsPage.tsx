import { Sun, Moon, Monitor } from 'lucide-react'
import { Card, CardContent } from '@shared/ui/card'
import { PageHeader } from '@shared/ui/page-header'
import { cn } from '@shared/lib/utils'
import { useTheme } from '@shared/hooks/useTheme'
import { useLanguage } from '@app/providers/useLanguage'
import type { ProvidersBackend } from '@features/providers/providers'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { ProvidersSection } from '@widgets/providers'

export function SettingsPage({
  providers,
  models
}: {
  providers: ProvidersBackend | null
  models: ((profile: string) => Promise<ModelOptionProvider[]>) | null
}): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const t = useLanguage((s) => s.t)

  const themes = [
    { value: 'light' as const, label: t('settings.light'), Icon: Sun },
    { value: 'dark' as const, label: t('settings.dark'), Icon: Moon },
    { value: 'system' as const, label: t('settings.system'), Icon: Monitor }
  ]

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('nav.settings')} />
      <div className="mx-auto w-full max-w-2xl space-y-4 overflow-y-auto p-6">
        {providers && <ProvidersSection backend={providers} models={models} />}
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">{t('settings.appearance')}</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('settings.theme')}</label>
              <p className="text-xs text-muted-foreground">{t('settings.themeDesc')}</p>
              <div className="mt-2 flex gap-2">
                {themes.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    aria-pressed={theme === value}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                      theme === value
                        ? 'bg-foreground text-background'
                        : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

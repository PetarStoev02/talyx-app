import { Sun, Moon, Monitor } from 'lucide-react'
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
      {/* The whole page scrolls, so the scrollbar sits at the window's edge, not the column's. */}
      <div className="scroll-y-stable min-h-0 flex-1">
        <div className="mx-auto w-full max-w-2xl space-y-10 p-6">
          {providers && <ProvidersSection backend={providers} models={models} />}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">{t('settings.appearance')}</h2>
            <div role="group" aria-labelledby="settings-theme" className="space-y-2">
              <h3 id="settings-theme" className="text-base font-medium text-foreground">
                {t('settings.theme')}
              </h3>
              <p className="text-base">{t('settings.themeDesc')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {themes.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    aria-pressed={theme === value}
                    className={cn(
                      'flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
                      theme === value
                        ? 'bg-foreground text-background'
                        : 'bg-secondary text-muted-foreground hover:bg-foreground/10 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

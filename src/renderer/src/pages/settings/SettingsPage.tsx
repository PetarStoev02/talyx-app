import { Sun, Moon, Monitor } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@shared/ui/page-header'
import { Button } from '@shared/ui/button'
import { cn } from '@shared/lib/utils'
import { reportError } from '@shared/lib/report'
import { useTheme } from '@shared/hooks/useTheme'
import { useLanguage } from '@app/providers/useLanguage'
import type { ProvidersBackend } from '@features/providers/providers'
import type { ModelLists } from '@features/chat/chat'
import { reportProvider, useSetup } from '@features/setup/store'
import { ProvidersSection } from '@widgets/providers'
import { EngineSection } from '@widgets/settings-engine'

export function SettingsPage({
  providers,
  chat
}: {
  providers: ProvidersBackend | null
  chat: ModelLists | null
}): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const t = useLanguage((s) => s.t)

  const themes = [
    { value: 'light' as const, label: t('settings.light'), Icon: Sun },
    { value: 'dark' as const, label: t('settings.dark'), Icon: Moon },
    { value: 'system' as const, label: t('settings.system'), Icon: Monitor }
  ]

  function runSetupAgain(): void {
    useSetup
      .getState()
      .restart()
      .catch((error: unknown) => {
        reportError('setup', error)
        toast.error(t('settings.errorRunSetup'))
      })
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('nav.settings')} />
      {/* The whole page scrolls, so the scrollbar sits at the window's edge, not the column's. */}
      <div className="scroll-y-stable min-h-0 flex-1">
        <div className="mx-auto w-full max-w-2xl space-y-10 p-6">
          <EngineSection />
          {providers && (
            <ProvidersSection backend={providers} chat={chat} onOverview={reportProvider} />
          )}
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
          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">{t('settings.setup')}</h2>
            <p className="text-base">{t('settings.setupDesc')}</p>
            <Button
              variant="secondary"
              className="mt-2 bg-secondary hover:bg-foreground/10"
              onClick={runSetupAgain}
            >
              {t('settings.runSetup')}
            </Button>
          </section>
        </div>
      </div>
    </div>
  )
}

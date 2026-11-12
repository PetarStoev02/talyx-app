import { useEffect } from 'react'
import { ArrowLeft, Sun, Moon, Monitor } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@shared/ui/button'
import { cn } from '@shared/lib/utils'
import { reportError } from '@shared/lib/report'
import { useTheme } from '@shared/hooks/useTheme'
import { useLanguage } from '@app/providers/useLanguage'
import { useNavigation } from '@app/providers/useNavigation'
import type { ProvidersBackend } from '@features/providers/providers'
import type { ModelLists } from '@features/chat/chat'
import { reportProvider, useSetup } from '@features/setup/store'
import { ProvidersSection } from '@widgets/providers'
import { EngineGate } from '@widgets/engine-gate'
import { DebugConsole, EngineSection } from '@widgets/settings-engine'
import { StartupSection } from '@widgets/settings-startup'
import { SoundSection } from '@widgets/settings-sound'
import { AboutSection } from '@widgets/settings-about'
import { ModulesSection } from '@widgets/modules'
import {
  SETTINGS_SECTIONS,
  type SettingsSection,
  shownPage,
  useSettingsSection
} from '@features/settings/sections'
import { useModules } from '@features/modules/store'

// One column for the header and the page: wide enough to use a big window, narrow enough to read.
const COLUMN = 'mx-auto w-full max-w-4xl px-8'

export function SettingsPage({
  providers,
  chat
}: {
  providers: ProvidersBackend | null
  chat: ModelLists | null
}): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const t = useLanguage((s) => s.t)
  const closeSettings = useNavigation((s) => s.closeSettings)
  const licensed = useModules((s) => s.state.license !== null)
  // The chosen page, or General once it is gone (the license removed while on Modules).
  const section = shownPage(
    useSettingsSection((s) => s.section),
    licensed
  )

  const themes = [
    { value: 'light' as const, label: t('settings.light'), Icon: Sun },
    { value: 'dark' as const, label: t('settings.dark'), Icon: Moon },
    { value: 'system' as const, label: t('settings.system'), Icon: Monitor }
  ]

  // Escape leaves Settings, unless a dialog or menu already took it (they mark it handled).
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      void closeSettings()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeSettings])

  function runSetupAgain(): void {
    useSetup
      .getState()
      .restart()
      .catch((error: unknown) => {
        reportError('setup', error)
        toast.error(t('settings.errorRunSetup'))
      })
  }

  // Each section is its own page now; the sidebar picks which one is open.
  const pages: Record<SettingsSection, React.ReactNode> = {
    general: (
      <>
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
        <SoundSection />
        <StartupSection />
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
      </>
    ),
    // Providers live in the engine: without it attached, say why and how to fix it.
    providers: (
      <EngineGate>
        {providers && (
          <ProvidersSection backend={providers} chat={chat} onOverview={reportProvider} />
        )}
      </EngineGate>
    ),
    engine: (
      <EngineSection
        debugConsole={
          <EngineGate>
            <DebugConsole />
          </EngineGate>
        }
      />
    ),
    modules: <ModulesSection />,
    about: <AboutSection />
  }
  const current = SETTINGS_SECTIONS.find((item) => item.key === section)

  return (
    <div className="flex h-full flex-col">
      {/* The header row stays as the window's drag strip, with Back on it; the title is only for
          screen readers, since the sidebar already shows which page is open. */}
      <header className="h-14 shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <h1 className="sr-only">{`${t('nav.settings')}: ${current ? t(current.title) : ''}`}</h1>
        {/* In the page's column, so Back lines up with the page under it. */}
        <div className={cn(COLUMN, 'flex h-full items-center')}>
          <Button
            variant="ghost"
            onClick={() => void closeSettings()}
            className="-ml-3 gap-1.5 text-muted-foreground hover:text-foreground"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <ArrowLeft />
            {t('settings.back')}
          </Button>
        </div>
      </header>
      {/* The whole page scrolls, so the scrollbar sits at the window's edge, not the column's. */}
      <div className="scroll-y-stable min-h-0 flex-1">
        <div key={section} className={cn(COLUMN, 'animate-arrive space-y-10 py-6')}>
          {pages[section]}
        </div>
      </div>
    </div>
  )
}

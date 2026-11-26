import { useCallback } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@shared/ui/button'
import { cn } from '@shared/lib/utils'
import { reportError } from '@shared/lib/report'
import { settingsApi, themeApi } from '@shared/api/ipc'
import { useEscape } from '@shared/hooks/useEscape'
import { useLanguage } from '@shared/lib/i18n'
import { useNavigation } from '@features/modules/store'
import { pickTheme } from '@features/settings/theme'
import { useLayoutPick, useThemePick } from '@features/settings/store'
import { pickLayout } from '@features/settings/layout'
import type { ProvidersBackend } from '@features/providers/providers'
import type { ModelLists } from '@features/chat/chat'
import type { RosterBackend } from '@features/bots/data'
import { reportProvider, useSetup } from '@features/setup/store'
import { ProvidersSection } from '@widgets/providers'
import { DebugConsole, EngineSection } from '@widgets/settings-engine'
import { StartupSection } from '@widgets/settings-startup'
import { SoundSection } from '@widgets/settings-sound'
import { AboutSection } from '@widgets/settings-about'
import { ModulesSection } from '@widgets/modules'
import { SETTINGS_SECTIONS, type SettingsSection, shownPage } from '@features/settings/sections'
import { useSettingsSection } from '@features/settings/store'
import { useModules } from '@features/modules/store'

// One column for the header and the page: wide enough to use a big window, narrow enough to read.
const COLUMN = 'mx-auto w-full max-w-4xl px-8'

export function SettingsPage({
  providers,
  roster,
  chat
}: {
  providers: ProvidersBackend | null
  roster: RosterBackend | null
  chat: ModelLists | null
}): React.JSX.Element {
  const theme = useThemePick((s) => s.theme)
  const t = useLanguage((s) => s.t)
  const goBack = useNavigation((s) => s.goBack)
  const leave = useCallback((): void => void goBack(), [goBack])
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

  // Escape leaves the page, unless a dialog or menu already took it.
  useEscape(leave)

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
                  onClick={() => pickTheme(themeApi, value)}
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
          <LayoutPicker />
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
    // Providers live in the engine, which is attached whenever Settings shows (EngineWindowGate).
    providers: (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        {providers && (
          <ProvidersSection
            backend={providers}
            roster={roster}
            chat={chat}
            onOverview={reportProvider}
          />
        )}
      </div>
    ),
    engine: (
      <EngineSection
        debugConsole={
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <DebugConsole />
          </div>
        }
      />
    ),
    modules: <ModulesSection />,
    about: <AboutSection />
  }
  const current = SETTINGS_SECTIONS.find((item) => item.key === section)

  return (
    <div className="flex h-full flex-col">
      {/* The header row stays as the window's drag strip; Back is in the sidebar. The title is
          only for screen readers, since the sidebar already shows which page is open. */}
      <header className="h-14 shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <h1 className="sr-only">{`${t('nav.settings')}: ${current ? t(current.title) : ''}`}</h1>
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

/** Dock or Layered, each shown as a small picture of the window. */
export function LayoutPicker(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const layout = useLayoutPick((s) => s.layout)
  const layouts = [
    { value: 'dock' as const, label: t('settings.layoutDock'), Picture: DockPicture },
    { value: 'layered' as const, label: t('settings.layoutLayered'), Picture: LayeredPicture }
  ]
  return (
    <div role="group" aria-labelledby="settings-layout" className="space-y-2">
      <h3 id="settings-layout" className="text-base font-medium text-foreground">
        {t('settings.layout')}
      </h3>
      <p className="text-base">{t('settings.layoutDesc')}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {layouts.map(({ value, label, Picture }) => (
          <button
            key={value}
            onClick={() => pickLayout(settingsApi, value)}
            aria-pressed={layout === value}
            className="group flex flex-col items-start gap-2 rounded-xl text-sm font-medium text-muted-foreground aria-pressed:text-foreground"
          >
            <span
              aria-hidden="true"
              className="block h-24 w-40 overflow-hidden rounded-xl border border-border transition-[border-color,box-shadow] group-hover:border-foreground/40 group-aria-pressed:border-foreground group-aria-pressed:ring-1 group-aria-pressed:ring-foreground"
            >
              <Picture />
            </span>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// A few bars standing for the roster's rows.
function Rows(): React.JSX.Element {
  return (
    <span className="flex flex-col gap-1.5 px-2 pt-3">
      <span className="h-1.5 w-4/5 rounded-full bg-foreground/15" />
      <span className="h-1.5 w-3/5 rounded-full bg-foreground/15" />
      <span className="h-1.5 w-2/3 rounded-full bg-foreground/15" />
    </span>
  )
}

function DockPicture(): React.JSX.Element {
  return (
    <span className="flex h-full bg-background">
      <span className="tone-step flex w-2/5 flex-col justify-between pb-2">
        <Rows />
        <span className="flex justify-center gap-1">
          <span className="size-2 rounded-full bg-foreground/40" />
          <span className="size-2 rounded-full bg-foreground/15" />
          <span className="size-2 rounded-full bg-foreground/15" />
        </span>
      </span>
    </span>
  )
}

function LayeredPicture(): React.JSX.Element {
  return (
    <span className="flex h-full bg-muted">
      <span className="flex w-5 flex-col items-center gap-1 bg-background pt-3">
        <span className="size-2 rounded-full bg-foreground/40" />
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="size-2 rounded-full bg-foreground/15" />
      </span>
      <span className="w-1/3">
        <Rows />
      </span>
      <span className="my-1 mr-1 flex-1 rounded-md bg-background shadow-xs" />
    </span>
  )
}

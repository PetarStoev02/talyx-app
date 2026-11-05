import { useState } from 'react'
import { useEngine } from '@app/providers/useEngine'
import type { RosterBackend } from '@features/bots/data'
import type { ModelLists } from '@features/chat/chat'
import type { SetupBackend } from '@features/setup/install'
import { InstallEngine } from '@features/setup/InstallEngine'
import { knownFirstStep, stepAfter, type SetupStep } from '@features/setup/steps'
import { useSetup } from '@features/setup/store'
import { BotStep } from './BotStep'
import { ProviderStep, type ProvidersForm } from './ProviderStep'
import { StepBar } from './StepBar'
import { WelcomeScreen } from './WelcomeScreen'

// No sidebar during setup: the title row alone drags the window.
const dragRegion = { WebkitAppRegion: 'drag' } as React.CSSProperties

/** First-run setup: Welcome, then each step not already done, then `onDone` opens the app. */
export function SetupFlow({
  providersForm,
  roster,
  chat,
  setup,
  onDone
}: {
  /** The providers form from Settings (a widget this one may not import), filled in by the app. */
  providersForm: ProvidersForm
  roster: RosterBackend | null
  chat: ModelLists | null
  setup: SetupBackend
  onDone: () => void
}): React.JSX.Element {
  const [screen, setScreen] = useState<'welcome' | SetupStep>('welcome')
  const engine = useEngine((s) => s.status)
  const hasProvider = useSetup((s) => s.hasProvider)
  const hasOwnBot = useSetup((s) => s.hasOwnBot)
  // Get started waits until it knows which steps are done (after Run setup again they are re-read).
  const factsKnown =
    engine !== null && knownFirstStep({ engine, hasProvider, hasOwnBot }) !== undefined

  function next(after: SetupStep | null): void {
    // A fact not read yet counts as not done: its step shows, and every step can be skipped.
    const step = engine
      ? stepAfter(after, { engine, hasProvider: !!hasProvider, hasOwnBot: !!hasOwnBot })
      : 'engine'
    if (step === null) return onDone()
    // Screen 2: look for the engine again, it may have been installed while Welcome was open.
    if (step === 'engine') void useEngine.getState().check()
    setScreen(step)
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex h-14 shrink-0 items-center justify-center px-4" style={dragRegion}>
        {screen !== 'welcome' && <StepBar current={screen} />}
      </div>
      <main className="scroll-y-stable min-h-0 flex-1">
        <div key={screen} className="animate-arrive flex min-h-full justify-center px-6 py-8">
          <div className="flex w-full flex-col items-center justify-center">
            {screen === 'welcome' && (
              <WelcomeScreen onStart={factsKnown ? () => next(null) : null} />
            )}
            {screen === 'engine' && (
              <InstallEngine backend={setup} onReady={() => next('engine')} onCancel={null} />
            )}
            {screen === 'provider' && (
              <ProviderStep providersForm={providersForm} onNext={() => next('provider')} />
            )}
            {screen === 'bot' && <BotStep roster={roster} chat={chat} onNext={() => next('bot')} />}
          </div>
        </div>
      </main>
    </div>
  )
}

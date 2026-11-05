import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useEngine } from '@app/providers/useEngine'
import { useLanguage } from '@app/providers/useLanguage'
import { reportError } from '@shared/lib/report'
import { engineScreen } from './engineScreen'
import { AttachError, EngineOlder, EngineReady, StepsFailed } from './EngineScreens'
import { useInstall, type SetupBackend } from './install'
import { InstallCommands } from './InstallCommands'
import { InstallRunning, InstallStopped } from './InstallOutput'
import { Waiting } from './ScreenParts'

/**
 * Finding, installing and checking the engine (the setup's screens 2 to 6b), in the setup flow
 * and in the engine gate. `onReady` is Continue once an engine is found.
 */
export function InstallEngine({
  backend,
  onReady
}: {
  backend: SetupBackend
  onReady: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const status = useEngine((s) => s.status)
  const checking = useEngine((s) => s.checking)
  const steps = useInstall((s) => s.steps)
  const output = useInstall((s) => s.output)
  const running = useInstall((s) => s.running)
  const exit = useInstall((s) => s.exit)
  const [wantsInstall, setWantsInstall] = useState(false)
  // Update (screen 6b) runs the install as soon as the steps are there.
  const installWhenReady = useRef(false)
  const screen = engineScreen({ status, checking, wantsInstall, steps, running, exit })

  // The install store outlives this screen: an earlier visit's result must not decide this one.
  useLayoutEffect(() => {
    if (!useInstall.getState().running) useInstall.setState({ exit: null })
  }, [])

  // Before paint, so a finished install never flashes "cannot find the engine" before the check.
  useLayoutEffect(() => {
    if (exit?.kind === 'ok') void useEngine.getState().check()
  }, [exit])

  useEffect(() => {
    if (screen.kind === 'fetching')
      useInstall
        .getState()
        .loadSteps(backend)
        .catch((error: unknown) => reportError('setup', error))
    if (screen.kind === 'commands' && installWhenReady.current) startInstall(backend)
    if (screen.kind !== 'fetching') installWhenReady.current = false
  }, [screen.kind, backend])

  const install = (): void => startInstall(backend)

  function chooseFile(): void {
    // What the chosen file turns out to be decides the next screen, not the install.
    setWantsInstall(false)
    useInstall.setState({ exit: null })
    void useEngine.getState().pickPath()
  }

  function showCommands(): void {
    useInstall.setState({ exit: null })
    setWantsInstall(true)
  }

  switch (screen.kind) {
    case 'checking':
      return <Waiting label={t('engine.checking')} />
    case 'fetching':
      return <Waiting label={t('setup.fetching')} />
    case 'attachError':
      return (
        <AttachError
          message={screen.message}
          actions={{
            recheck: () => void useEngine.getState().check(),
            install: () => setWantsInstall(true),
            chooseFile
          }}
        />
      )
    case 'commands':
      return <InstallCommands steps={screen.steps} onInstall={install} onChooseFile={chooseFile} />
    case 'stepsFailed':
    case 'unsupported':
      return (
        <StepsFailed
          reason={screen.kind === 'unsupported' ? 'unsupported' : screen.reason}
          releaseUrl={screen.releaseUrl}
          actions={{ retry: () => useInstall.setState({ steps: null }), chooseFile }}
        />
      )
    case 'running':
      return (
        <InstallRunning
          output={output}
          onCancel={() =>
            void useInstall
              .getState()
              .cancel(backend)
              .catch((error: unknown) => reportError('setup', error))
          }
        />
      )
    case 'stopped':
    case 'notFound':
      return (
        <InstallStopped
          output={output}
          failed={screen.kind === 'stopped' ? screen : null}
          actions={{ retry: install, showCommands, chooseFile }}
        />
      )
    case 'ready':
      return <EngineReady screen={screen} onContinue={onReady} />
    case 'older':
      return (
        <EngineOlder
          version={screen.version}
          actions={{
            update: () => {
              installWhenReady.current = true
              setWantsInstall(true)
            },
            continueAnyway: onReady
          }}
        />
      )
  }
}

function startInstall(backend: SetupBackend): void {
  useInstall
    .getState()
    .start(backend)
    .catch((error: unknown) => {
      // Main refuses a second run or a run before the steps loaded; say so rather than hang.
      reportError('setup', error)
      toast.error(error instanceof Error ? error.message : String(error))
    })
}

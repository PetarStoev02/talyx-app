import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useEngine } from '@app/providers/useEngine'
import { useLanguage } from '@app/providers/useLanguage'
import { reportError } from '@shared/lib/report'
import { engineScreen, watchRun } from './engineScreen'
import {
  AttachError,
  EngineOlder,
  EngineReady,
  EngineStillOlder,
  ProtocolMismatch,
  StepsFailed
} from './EngineScreens'
import { useInstall, type SetupBackend } from './install'
import { InstallCommands } from './InstallCommands'
import { InstallRunning, InstallStopped } from './InstallOutput'
import { Waiting } from './ScreenParts'

/**
 * Finding, installing and checking the engine (the setup's screens 2 to 6b), in the setup flow
 * and in the engine gate. `onReady` is Continue once an engine is found; `onCancel`, when given,
 * runs once an install started here is cancelled (the gate then shows what it showed before).
 */
export function InstallEngine({
  backend,
  onReady,
  onCancel
}: {
  backend: SetupBackend
  onReady: () => void
  onCancel: (() => void) | null
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
  const sawRun = useRef(false)
  const screen = engineScreen({ status, checking, wantsInstall, steps, running, exit })
  const engineName = steps?.kind === 'ready' ? steps.engineName : null

  // The install store outlives this screen: an earlier visit's result must not decide this one.
  useLayoutEffect(() => {
    if (!useInstall.getState().running) useInstall.setState({ exit: null })
  }, [])

  useEffect(() => {
    if (screen.kind === 'fetching')
      useInstall
        .getState()
        .loadSteps(backend)
        .catch((error: unknown) => reportError('setup', error))
    if (screen.kind === 'commands' && installWhenReady.current) startInstall(backend)
    if (screen.kind !== 'fetching') installWhenReady.current = false
  }, [screen.kind, backend])

  // The engine may change outside Talyx (installed from a terminal): look again on return.
  useEffect(() => {
    const refresh = (): void => {
      if (!useInstall.getState().running) void useEngine.getState().refresh()
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  useEffect(() => {
    const watch = watchRun(sawRun.current, running, exit)
    sawRun.current = watch.sawRun
    if (watch.cancelled) onCancel?.()
  }, [running, exit, onCancel])

  const install = (): void => startInstall(backend)
  const recheck = (): void => void useEngine.getState().check()

  function chooseFile(): void {
    // What the chosen file turns out to be decides the next screen, not the install.
    setWantsInstall(false)
    useInstall.setState({ exit: null })
    void useEngine.getState().pickPath()
  }

  function runInstalled(): void {
    // Rejects when the user bin has no engine; the screen and the status stay as they were.
    useEngine
      .getState()
      .useInstalled()
      .catch((error: unknown) => {
        reportError('setup', error)
        toast.error(t('setup.noInstalledEngine'))
      })
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
            recheck,
            install: () => setWantsInstall(true),
            chooseFile
          }}
        />
      )
    case 'protocol':
      return <ProtocolMismatch fit={screen.fit} actions={{ recheck }} />
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
          engineName={engineName}
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
          engineName={engineName}
          failed={screen.kind === 'stopped' ? screen : null}
          actions={{ retry: install, showCommands, chooseFile }}
        />
      )
    case 'ready':
      return (
        <EngineReady
          screen={screen}
          install={{ output, engineName }}
          actions={{ recheck, continue: onReady }}
        />
      )
    case 'still-older':
      return (
        <EngineStillOlder
          path={screen.path}
          version={screen.version}
          actions={{ useInstalled: runInstalled, chooseFile, continueAnyway: onReady }}
        />
      )
    case 'older':
      return (
        <EngineOlder
          version={screen.version}
          actions={{
            update: () => {
              installWhenReady.current = true
              setWantsInstall(true)
            },
            continueAnyway: screen.attached ? onReady : null
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

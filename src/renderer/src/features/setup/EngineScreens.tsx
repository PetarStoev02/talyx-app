import { Check } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { Button } from '@shared/ui/button'
import { TalyxLogo } from '@shared/ui/TalyxLogo'
import { EXPECTED_ENGINE_VERSION } from '../../../../shared/engine'
import { restartCommand } from './engineScreen'
import { CopyButton, ScreenTitle } from './ScreenParts'
import { centeredPanelClass, linkClass, rowClass } from './screenStyles'

// The command `engine.stale` names, for a gateway Talyx could not attach to (no resolved path).
// Talyx never restarts the gateway itself: main does not own it.
const RESTART_COMMAND = 'talyx-engine gateway restart'

// Where a newer engine's user finds a Talyx that speaks its protocol.
const LATEST_RELEASE_URL = 'https://github.com/PetarStoev02/talyx-app/releases/latest'

const logo = <TalyxLogo size={40} className="text-foreground" />

/** Found but cannot attach: the engine gate's error, plus a way on to the install. */
export function AttachError({
  message,
  actions
}: {
  message: string
  actions: { recheck: () => void; install: () => void; chooseFile: () => void }
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={centeredPanelClass}>
      {logo}
      <ScreenTitle level={2}>{t('engine.errorTitle')}</ScreenTitle>
      <div>
        <p className="text-base text-foreground">{t('engine.errorNext')}</p>
        <p className="text-sm text-muted-foreground wrap-anywhere">{message}</p>
      </div>
      <div className={`${rowClass} justify-center`}>
        <Button className="px-5" onClick={actions.recheck}>
          {t('action.tryAgain')}
        </Button>
        <button className={linkClass} onClick={actions.install}>
          {t('setup.installEngine')}
        </button>
        <button className={linkClass} onClick={actions.chooseFile}>
          {t('engine.chooseFile')}
        </button>
      </div>
    </div>
  )
}

/** Screen 4b, and the Windows note: no steps to run, so the release page and Choose file. */
export function StepsFailed({
  reason,
  releaseUrl,
  actions
}: {
  reason: 'unavailable' | 'mismatch' | 'unsupported'
  releaseUrl: string
  actions: { retry: () => void; chooseFile: () => void }
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const body = {
    unavailable: t('setup.stepsFailedBody'),
    mismatch: t('setup.stepsMismatch'),
    unsupported: t('setup.unsupported')
  }[reason]
  return (
    <div className={centeredPanelClass}>
      {logo}
      <ScreenTitle level={2}>
        {reason === 'unsupported' ? t('setup.installEngine') : t('setup.stepsFailedTitle')}
      </ScreenTitle>
      <p className="max-w-md text-base text-foreground">{body}</p>
      <div className={`${rowClass} justify-center`}>
        {reason !== 'unsupported' && (
          <Button className="px-5" onClick={actions.retry}>
            {t('action.tryAgain')}
          </Button>
        )}
        <Button
          variant="ghost"
          className="bg-secondary px-5"
          // The window guard opens https links in the browser.
          onClick={() => window.open(releaseUrl)}
        >
          {t('setup.openRelease')}
        </Button>
        <button className={linkClass} onClick={actions.chooseFile}>
          {t('engine.chooseFile')}
        </button>
      </div>
    </div>
  )
}

/**
 * The gateway outlived an update. With the engine's resolved `path` the hint shows the exact
 * command: an older copy earlier on PATH would otherwise be the one restarted. Without one (Talyx
 * could not attach) it names the bare command. `recheck` is null where the screen has its own.
 */
export function RestartHint({
  path,
  recheck
}: {
  path: string | null
  recheck: (() => void) | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const command = path === null ? RESTART_COMMAND : restartCommand(path)
  return (
    <div className="flex max-w-md flex-col items-center gap-2 rounded-xl bg-warning-subtle px-4 py-3">
      <p className="text-base text-foreground">
        {t(path === null ? 'engine.stale' : 'engine.staleRestartBelow')}
      </p>
      {path !== null && (
        <code className="font-mono text-sm break-all whitespace-pre-wrap select-text">
          {command}
        </code>
      )}
      <div className={`${rowClass} justify-center`}>
        <CopyButton text={command} label={t('providers.copy')} name={null} />
        {recheck && (
          <button className={linkClass} onClick={recheck}>
            {t('action.tryAgain')}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * The engine's gateway and this Talyx speak different protocols. A newer engine needs a newer Talyx;
 * otherwise a gateway left on old code is the likely cause, so the restart hint shows instead.
 */
export function ProtocolMismatch({
  fit,
  actions
}: {
  fit: 'newer' | 'same'
  actions: { recheck: () => void }
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={centeredPanelClass}>
      {logo}
      <ScreenTitle level={2}>{t('engine.protocolTitle')}</ScreenTitle>
      {fit === 'same' && <RestartHint path={null} recheck={null} />}
      <div className={`${rowClass} justify-center`}>
        {fit === 'newer' && (
          <Button
            className="px-5"
            // The window guard opens https links in the browser. Never the running app's own tag:
            // a newer engine needs a newer Talyx than this one.
            onClick={() => window.open(LATEST_RELEASE_URL)}
          >
            {t('engine.getLatest')}
          </Button>
        )}
        <Button
          variant={fit === 'newer' ? 'ghost' : 'default'}
          className={fit === 'newer' ? 'bg-secondary px-5' : 'px-5'}
          onClick={actions.recheck}
        >
          {t('action.tryAgain')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Screen 6: the engine attached, where it was found, and notes for a newer engine or a gateway left
 * on old code (an update over a running gateway): restart it, then Try again.
 */
export function EngineReady({
  screen,
  actions
}: {
  screen: { version: string; path: string; newer: boolean; stale: boolean }
  actions: { recheck: () => void; continue: () => void }
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={centeredPanelClass}>
      {logo}
      <ScreenTitle level={2}>{t('setup.readyTitle')}</ScreenTitle>
      <p className="flex items-center gap-1.5 rounded-full bg-success-subtle px-3 py-0.5 text-sm font-medium text-success">
        <Check size={14} aria-hidden="true" />
        {t('setup.readyBadge').replace('{version}', screen.version)}
      </p>
      <div>
        <p className="text-base text-muted-foreground">{t('setup.readyBody')}</p>
        <p className="text-sm text-muted-foreground wrap-anywhere">
          {t('setup.foundAt').replace('{path}', screen.path)}
        </p>
      </div>
      {screen.newer && <p className="text-base text-foreground">{t('setup.newer')}</p>}
      {screen.stale && <RestartHint path={screen.path} recheck={actions.recheck} />}
      <Button className="px-5" onClick={actions.continue}>
        {t('setup.continue')}
      </Button>
    </div>
  )
}

/**
 * Screen 6b: an engine older than the one Talyx is built for. `continueAnyway` is null when the old
 * engine cannot attach: the steps after this one need it attached.
 */
export function EngineOlder({
  version,
  actions
}: {
  version: string
  actions: { update: () => void; continueAnyway: (() => void) | null }
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={centeredPanelClass}>
      {logo}
      <ScreenTitle level={2}>{t('setup.olderTitle')}</ScreenTitle>
      <p className="max-w-md rounded-xl bg-warning-subtle px-4 py-3 text-base text-foreground">
        {t('setup.olderBody')
          .replace('{version}', version)
          .replace('{expected}', EXPECTED_ENGINE_VERSION)}
      </p>
      <div className={`${rowClass} justify-center`}>
        <Button className="px-5" onClick={actions.update}>
          {t('setup.update').replace('{version}', EXPECTED_ENGINE_VERSION)}
        </Button>
        {actions.continueAnyway && (
          <button className={linkClass} onClick={actions.continueAnyway}>
            {t('setup.continueAnyway')}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * An install finished, but the engine Talyx runs is still the older one: another copy comes first
 * (a chosen file, or one earlier on PATH). Talyx can switch to the copy the install linked.
 */
export function EngineStillOlder({
  path,
  version,
  actions
}: {
  path: string
  version: string
  actions: { useInstalled: () => void; chooseFile: () => void; continueAnyway: () => void }
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={centeredPanelClass}>
      {logo}
      <ScreenTitle level={2}>{t('setup.olderTitle')}</ScreenTitle>
      <p className="max-w-md rounded-xl bg-warning-subtle px-4 py-3 text-base text-foreground wrap-anywhere">
        {t('setup.stillOlder').replace('{path}', path).replace('{version}', version)}
      </p>
      <div className={`${rowClass} justify-center`}>
        <Button className="px-5" onClick={actions.useInstalled}>
          {t('setup.useInstalled')}
        </Button>
        <button className={linkClass} onClick={actions.chooseFile}>
          {t('engine.chooseFile')}
        </button>
        <button className={linkClass} onClick={actions.continueAnyway}>
          {t('setup.continueAnyway')}
        </button>
      </div>
    </div>
  )
}

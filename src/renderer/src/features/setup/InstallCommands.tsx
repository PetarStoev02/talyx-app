import { useLanguage } from '@app/providers/useLanguage'
import { cn } from '@shared/lib/utils'
import { Button } from '@shared/ui/button'
import type { InstallSteps } from '../../../../shared/setup'
import { CopyButton, ScreenTitle } from './ScreenParts'
import { linkClass, panelClass, rowClass } from './screenStyles'

/** Screen 4: the verified commands, to run here (Install) or copy into a terminal. */
export function InstallCommands({
  steps,
  onInstall,
  onChooseFile
}: {
  steps: Extract<InstallSteps, { kind: 'ready' }>
  onInstall: () => void
  onChooseFile: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const release = steps.releaseUrl.split('/').pop() ?? steps.releaseUrl

  return (
    <div className={panelClass}>
      <ScreenTitle level={2}>{t('setup.installEngine')}</ScreenTitle>
      <p className="text-base text-foreground">
        {t('setup.installBody').replace('{version}', steps.engineVersion)}
      </p>
      <ol aria-label={t('setup.commands')} className="rounded-xl border border-border">
        {steps.commands.map((command, index) => (
          <li
            key={index}
            className="flex items-center gap-3 border-t border-border px-3 py-2.5 first:border-t-0"
          >
            <span className="w-4 shrink-0 text-sm text-muted-foreground" aria-hidden="true">
              {index + 1}
            </span>
            <code className="min-w-0 flex-1 font-mono text-sm break-all whitespace-pre-wrap select-text">
              {command}
            </code>
            <CopyButton
              text={command}
              label={t('providers.copy')}
              name={t('setup.copyCommand').replace('{number}', String(index + 1))}
            />
          </li>
        ))}
      </ol>
      <div className={rowClass}>
        <Button className="px-5" onClick={onInstall}>
          {t('setup.install')}
        </Button>
        <CopyButton text={steps.commands.join('\n')} label={t('setup.copyAll')} name={null} />
        <span className="ml-auto text-sm text-muted-foreground">
          {t('setup.installedAlready')}{' '}
          <button className={cn(linkClass, 'text-sm')} onClick={onChooseFile}>
            {t('engine.chooseFile')}
          </button>
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('setup.stepsFrom').replace('{release}', release)}
      </p>
    </div>
  )
}

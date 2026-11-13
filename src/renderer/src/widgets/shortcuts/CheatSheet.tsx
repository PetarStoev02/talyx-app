import { useLanguage } from '@app/providers/useLanguage'
import { SHORTCUT_GROUPS, keyLabels, platformOf } from '@features/shortcuts/shortcuts'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { useCheatSheet } from './useCheatSheet'

const platform = platformOf(navigator.platform)

/** Every shortcut, from the same list the keys are bound from. */
export function CheatSheet(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const open = useCheatSheet((s) => s.open)
  const setOpen = useCheatSheet((s) => s.setOpen)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>{t('shortcuts.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('shortcuts.description')}</DialogDescription>
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.label} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{t(group.label)}</h3>
            <dl className="space-y-1.5">
              {group.shortcuts.map((shortcut) => (
                <div key={shortcut.id} className="flex items-center justify-between gap-4 text-sm">
                  <dt>{t(shortcut.label)}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {keyLabels(shortcut.keys, platform).map((label) => (
                      <kbd
                        key={label}
                        className="min-w-6 rounded-md bg-secondary px-1.5 py-0.5 text-center font-sans text-xs text-muted-foreground"
                      >
                        {label}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  )
}

import { useMemo, useState } from 'react'
import {
  Clock,
  Eye,
  FolderSync,
  Search,
  Settings,
  Sparkle,
  Square,
  type LucideIcon
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@shared/ui/dialog'
import { Kbd } from '@shared/ui/kbd'
import { cn } from '@shared/lib/utils'
import type { TranslationKey } from '@shared/lib/i18n'
import { useShell } from '@app/providers/useShell'
import { useNavigation, type AppView } from '@app/providers/useNavigation'
import { useLanguage } from '@app/providers/useLanguage'
import { useAgent } from '@features/assistant/useAgent'

interface Action {
  id: string
  label: string
  icon: LucideIcon
  /** The user's own words, shown after the label for the ask row. */
  detail: string | null
  run: () => void
}

const PAGES: { view: AppView; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { view: 'ask', labelKey: 'nav.ask', icon: Sparkle },
  { view: 'sort', labelKey: 'nav.sort', icon: FolderSync },
  { view: 'watch', labelKey: 'nav.watch', icon: Eye },
  { view: 'history', labelKey: 'nav.history', icon: Clock },
  { view: 'search', labelKey: 'nav.search', icon: Search },
  { view: 'settings', labelKey: 'nav.settings', icon: Settings }
]

/** ⌘K palette: anything typed goes to the assistant, page names jump there. */
export function QuickActions(): React.JSX.Element {
  const open = useShell((s) => s.quickActionsOpen)
  const close = useShell((s) => s.closeQuickActions)
  const navigate = useNavigation((s) => s.navigate)
  const t = useLanguage((s) => s.t)
  const run = useAgent((s) => s.run)
  const abort = useAgent((s) => s.abort)
  const phase = useAgent((s) => s.phase)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const actions = useMemo<Action[]>(() => {
    const text = query.trim()
    const needle = text.toLowerCase()
    const list: Action[] = []
    if (text) {
      list.push({
        id: 'ask',
        label: t('quickActions.ask'),
        icon: Sparkle,
        detail: text,
        run: () => {
          navigate('ask')
          void run(text)
        }
      })
    }
    for (const page of PAGES) {
      const label = t(page.labelKey)
      if (!needle || label.toLowerCase().includes(needle)) {
        list.push({
          id: page.view,
          label,
          icon: page.icon,
          detail: null,
          run: () => navigate(page.view)
        })
      }
    }
    if (phase === 'working' || phase === 'approval') {
      list.push({
        id: 'stop',
        label: t('quickActions.stop'),
        icon: Square,
        detail: null,
        run: () => void abort()
      })
    }
    return list
  }, [query, phase, t, navigate, run, abort])

  function handleClose(): void {
    setQuery('')
    setActive(0)
    close()
  }

  function choose(action: Action): void {
    action.run()
    handleClose()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, actions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && actions[active]) {
      e.preventDefault()
      choose(actions[active])
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">{t('sidebar.quickActions')}</DialogTitle>
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('quickActions.placeholder')}
          className="h-12 w-full border-b border-border/60 bg-transparent px-4 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70"
        />
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {actions.map((action, i) => (
            <li key={action.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(action)}
                className={cn(
                  'flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors',
                  i === active ? 'bg-accent text-foreground' : 'text-muted-foreground'
                )}
              >
                <action.icon className="size-4 shrink-0" />
                <span className="shrink-0">{action.label}</span>
                {action.detail && (
                  <span className="truncate text-foreground">&ldquo;{action.detail}&rdquo;</span>
                )}
                {i === active && <Kbd className="ml-auto">↵</Kbd>}
              </button>
            </li>
          ))}
          {actions.length === 0 && (
            <li className="px-2.5 py-6 text-center text-xs text-muted-foreground">
              {t('quickActions.empty')}
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

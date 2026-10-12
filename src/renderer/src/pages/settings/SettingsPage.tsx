import { useState, useEffect, useCallback } from 'react'
import {
  Copy,
  Scissors,
  FolderOutput,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  Plus,
  X,
  Keyboard,
  Clock,
  Play,
  Trash2,
  Settings,
  Palette,
  FolderTree,
  MessageSquarePlus,
  Sparkle
} from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { Separator } from '@shared/ui/separator'
import { PageHeader } from '@shared/ui/page-header'
import { cn } from '@shared/lib/utils'
import {
  folderApi,
  settingsApi,
  contextMenuApi,
  scheduleApi,
  type ClassificationRule,
  type ScheduledSort,
  type ScheduleFrequency,
  type AppSettings
} from '@shared/api/ipc'
import { toast } from 'sonner'
import { brainReady, type AgentStatus } from '@shared/api/agent'
import { voiceApi, type VoiceModelStatus, type TtsStatus, type TtsEngine } from '@shared/api/voice'
import { VOICE_HOTKEYS, type VoiceHotkey } from '@features/assistant/voice/hotkey'
import { FeedbackSection } from '@features/feedback/FeedbackSection'
import { ConnectClaude } from '@features/assistant/ConnectClaude'
import { conversationApi } from '@shared/api/conversation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@shared/ui/dialog'
import { NoticesSection } from './NoticesSection'
import { useAutoUpdater } from '@shared/hooks/useAutoUpdater'
import { useTheme } from '@shared/hooks/useTheme'
import { SHORTCUTS } from '@shared/hooks/useKeyboardShortcuts'
import { APP_LANGUAGES } from '@shared/lib/i18n'
import type { TranslationKey } from '@shared/lib/i18n'
import { useLanguage } from '@app/providers/useLanguage'
import type { SettingsSectionId } from '@app/providers/useNavigation'
import { useTour } from '@app/providers/useTour'

type SectionId = SettingsSectionId

type SorterSource = AppSettings['sorterSource']

interface SettingsSection {
  id: SectionId
  labelKey: TranslationKey
  icon: React.ComponentType<{ className?: string }>
  element: React.ReactNode
}

export function SettingsPage(): React.JSX.Element {
  const [defaultMode, setDefaultMode] = useState<'copy' | 'move'>('copy')
  const [defaultOutputDir, setDefaultOutputDir] = useState<string | null>(null)
  const { checkForUpdates } = useAutoUpdater()
  const { theme, setTheme } = useTheme()
  const [checking, setChecking] = useState(false)
  const [rules, setRules] = useState<ClassificationRule[]>([])
  const [newExt, setNewExt] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [updateFrequency, setUpdateFrequency] = useState<'daily' | 'weekly' | 'manual'>('daily')

  const appLanguage = useLanguage((s) => s.language)
  const setGlobalLanguage = useLanguage((s) => s.setLanguage)
  const t = useLanguage((s) => s.t)
  const startTour = useTour((s) => s.start)

  const [activeSection, setActiveSection] = useState<SectionId>('general')

  // Scheduled sorts
  const [schedules, setSchedules] = useState<ScheduledSort[]>([])
  const [showNewSchedule, setShowNewSchedule] = useState(false)
  const [newScheduleName, setNewScheduleName] = useState('')
  const [newScheduleSource, setNewScheduleSource] = useState('')
  const [newScheduleOutput, setNewScheduleOutput] = useState('')
  const [newScheduleMode, setNewScheduleMode] = useState<'copy' | 'move'>('copy')
  const [newScheduleFrequency, setNewScheduleFrequency] = useState<ScheduleFrequency>('weekly')
  const [assistantHotkeyEnabled, setAssistantHotkeyEnabled] = useState(true)

  // Held here, not fetched twice: the sorter chooser has to enable the moment
  // the connect block above it reports a Claude, without a remount.
  const [claudeStatus, setClaudeStatus] = useState<AgentStatus | null>(null)

  async function handleCheckUpdates(): Promise<void> {
    setChecking(true)
    await checkForUpdates()
    setChecking(false)
  }

  useEffect(() => {
    settingsApi.get().then((settings) => {
      setDefaultMode(settings.defaultSortMode)
      setDefaultOutputDir(settings.defaultOutputDir)
      setRules(settings.classificationRules ?? [])
      setUpdateFrequency(settings.updateFrequency ?? 'daily')
      setAssistantHotkeyEnabled(settings.assistantHotkeyEnabled ?? true)
    })
    // Auto-install context menu on startup
    contextMenuApi.install().catch(() => {})
    scheduleApi.list().then(setSchedules)
  }, [])

  async function handleModeChange(mode: 'copy' | 'move'): Promise<void> {
    setDefaultMode(mode)
    await settingsApi.set({ defaultSortMode: mode })
    toast.success(`Default mode set to ${mode}`)
  }

  async function handleSelectOutput(): Promise<void> {
    const path = await folderApi.select()
    if (path) {
      setDefaultOutputDir(path)
      await settingsApi.set({ defaultOutputDir: path })
      toast.success('Output directory updated')
    }
  }

  const SECTIONS: SettingsSection[] = [
    {
      id: 'assistant',
      labelKey: 'settings.section.assistant',
      icon: Sparkle,
      element: (
        <>
          <YourAiSection onStatusChange={setClaudeStatus} />
          <SorterSourceSection claudeStatus={claudeStatus} />
          <Card>
            <CardContent className="pt-6">
              <NoticesSection />
            </CardContent>
          </Card>
        </>
      )
    },
    {
      id: 'general',
      labelKey: 'settings.general',
      icon: Settings,
      element: (
        <>
          {/* General Settings */}
          <Card>
            <CardContent className="space-y-6 pt-6">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                {t('settings.general')}
              </h2>

              {/* Default sort mode */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('settings.defaultSortMode')}
                </label>
                <p className="text-xs text-muted-foreground">{t('settings.defaultSortModeDesc')}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleModeChange('copy')}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      defaultMode === 'copy'
                        ? 'bg-foreground text-background'
                        : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    <Copy className="h-4 w-4" />
                    {t('sort.copy')}
                  </button>
                  <button
                    onClick={() => handleModeChange('move')}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      defaultMode === 'move'
                        ? 'bg-foreground text-background'
                        : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    <Scissors className="h-4 w-4" />
                    {t('sort.move')}
                  </button>
                </div>
              </div>

              <Separator />

              {/* Default output directory */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('settings.defaultOutput')}
                </label>
                <p className="text-xs text-muted-foreground">{t('settings.defaultOutputDesc')}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Button variant="outline" size="sm" onClick={handleSelectOutput}>
                    <FolderOutput className="h-4 w-4 mr-2" />
                    {defaultOutputDir ? t('settings.change') : t('sort.selectFolder')}
                  </Button>
                  {defaultOutputDir && (
                    <span className="text-sm text-muted-foreground truncate">
                      {defaultOutputDir}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Keyboard Shortcuts */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-foreground" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  {t('settings.keyboardShortcuts')}
                </h2>
              </div>
              <div className="space-y-2">
                {SHORTCUTS.map(({ keys, description }) => (
                  <div key={keys} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{description}</span>
                    <kbd className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-foreground">
                      {keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Assistant hotkey */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-foreground" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  {t('assistant.hotkey')}
                </h2>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('assistant.hotkey')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('assistant.hotkeyDesc')}</p>
                </div>
                <button
                  onClick={async () => {
                    const next = !assistantHotkeyEnabled
                    setAssistantHotkeyEnabled(next)
                    await settingsApi.set({ assistantHotkeyEnabled: next })
                    toast.success(t(next ? 'assistant.hotkeyOn' : 'assistant.hotkeyOff'))
                  }}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                    assistantHotkeyEnabled ? 'bg-foreground' : 'bg-secondary'
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200',
                      assistantHotkeyEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Updates */}
          <Card>
            <CardContent className="space-y-6 pt-6">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                {t('settings.updates')}
              </h2>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('settings.updatesLabel')}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {t('settings.updatesDesc')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckUpdates}
                  disabled={checking}
                >
                  <RefreshCw className={cn('h-4 w-4 mr-2', checking && 'animate-spin')} />
                  {checking ? t('settings.checking') : t('settings.checkForUpdates')}
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('settings.autoCheckFrequency')}
                </label>
                <p className="text-xs text-muted-foreground">
                  {t('settings.autoCheckFrequencyDesc')}
                </p>
                <div className="flex gap-2 mt-2">
                  {[
                    { value: 'daily' as const, label: t('settings.daily') },
                    { value: 'weekly' as const, label: t('settings.weekly') },
                    { value: 'manual' as const, label: t('settings.manual') }
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={async () => {
                        setUpdateFrequency(value)
                        await settingsApi.set({ updateFrequency: value })
                        toast.success(`Update check frequency set to ${label.toLowerCase()}`)
                      }}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        updateFrequency === value
                          ? 'bg-foreground text-background'
                          : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                {t('settings.about')}
              </h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('settings.application')}</span>
                  <span className="text-sm font-medium text-foreground">Talyx</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('settings.version')}</span>
                  <span className="text-sm font-medium text-foreground">{__APP_VERSION__}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('settings.website')}</span>
                  <span className="text-sm font-medium text-foreground underline">talyx.app</span>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    {t('settings.showTour')}
                  </label>
                  <p className="text-xs text-muted-foreground">{t('settings.showTourDesc')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => startTour()}>
                  {t('settings.showTour')}
                </Button>
              </div>

              <Separator />

              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('settings.aboutDesc')}
              </p>
            </CardContent>
          </Card>
        </>
      )
    },
    {
      id: 'appearance',
      labelKey: 'settings.appearance',
      icon: Palette,
      element: (
        <>
          {/* Appearance */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                {t('settings.appearance')}
              </h2>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('settings.theme')}</label>
                <p className="text-xs text-muted-foreground">{t('settings.themeDesc')}</p>
                <div className="flex gap-2 mt-2">
                  {[
                    { value: 'light' as const, label: t('settings.light'), Icon: Sun },
                    { value: 'dark' as const, label: t('settings.dark'), Icon: Moon },
                    { value: 'system' as const, label: t('settings.system'), Icon: Monitor }
                  ].map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        theme === value
                          ? 'bg-foreground text-background'
                          : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Language & Appearance */}
          <Card>
            <CardContent className="space-y-5 pt-6">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Preferences
              </h2>

              {/* Language */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('settings.language')}
                </label>
                <p className="text-xs text-muted-foreground">{t('settings.languageDesc')}</p>
                <select
                  value={appLanguage}
                  onChange={async (e) => {
                    const lang = e.target.value
                    setGlobalLanguage(lang)
                    await settingsApi.set({ appLanguage: lang })
                    toast.success(
                      `Language set to ${APP_LANGUAGES.find((l) => l.code === lang)?.name ?? lang}`
                    )
                  }}
                  className="mt-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
                >
                  {APP_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        </>
      )
    },
    {
      id: 'classification',
      labelKey: 'settings.section.classification',
      icon: FolderTree,
      element: (
        <>
          {/* Classification Rules */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                {t('settings.classificationRules')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('settings.classificationRulesDesc')}
              </p>

              {rules.length > 0 && (
                <div className="space-y-2">
                  {rules.map((rule, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm"
                    >
                      <code className="text-xs font-mono text-foreground font-semibold">
                        .{rule.extension}
                      </code>
                      <span className="text-muted-foreground">&rarr;</span>
                      <span className="text-foreground">{rule.category}</span>
                      {rule.subcategory && (
                        <span className="text-muted-foreground text-xs">/ {rule.subcategory}</span>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={async () => {
                          const updated = rules.filter((_, idx) => idx !== i)
                          setRules(updated)
                          await settingsApi.set({ classificationRules: updated })
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder={t('settings.extPlaceholder')}
                  value={newExt}
                  onChange={(e) => setNewExt(e.target.value.replace(/^\./, ''))}
                  className="w-24 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <span className="text-muted-foreground">&rarr;</span>
                <input
                  type="text"
                  placeholder={t('settings.categoryPlaceholder')}
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!newExt.trim() || !newCategory.trim()}
                  onClick={async () => {
                    const rule: ClassificationRule = {
                      extension: newExt.trim().toLowerCase(),
                      category: newCategory.trim(),
                      subcategory: null
                    }
                    const updated = [...rules, rule]
                    setRules(updated)
                    setNewExt('')
                    setNewCategory('')
                    await settingsApi.set({ classificationRules: updated })
                    toast.success(`Rule added: .${rule.extension} → ${rule.category}`)
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scheduled Sorts */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-foreground" />
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    {t('settings.scheduledSorts')}
                  </h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewSchedule(!showNewSchedule)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">{t('settings.scheduledSortsDesc')}</p>

              {showNewSchedule && (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <input
                    type="text"
                    placeholder={t('settings.scheduleName')}
                    value={newScheduleName}
                    onChange={(e) => setNewScheduleName(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const path = await folderApi.select()
                        if (path) setNewScheduleSource(path)
                      }}
                    >
                      {t('sort.source')}
                    </Button>
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {newScheduleSource || t('settings.selectSourceFolder')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const path = await folderApi.select()
                        if (path) setNewScheduleOutput(path)
                      }}
                    >
                      {t('sort.output')}
                    </Button>
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {newScheduleOutput || t('settings.selectOutputFolder')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={newScheduleMode}
                      onChange={(e) => setNewScheduleMode(e.target.value as 'copy' | 'move')}
                      className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
                    >
                      <option value="copy">{t('sort.copy')}</option>
                      <option value="move">{t('sort.move')}</option>
                    </select>
                    <select
                      value={newScheduleFrequency}
                      onChange={(e) => setNewScheduleFrequency(e.target.value as ScheduleFrequency)}
                      className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
                    >
                      <option value="daily">{t('settings.daily')}</option>
                      <option value="weekly">{t('settings.weekly')}</option>
                      <option value="monthly">{t('settings.monthly')}</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowNewSchedule(false)
                        setNewScheduleName('')
                        setNewScheduleSource('')
                        setNewScheduleOutput('')
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!newScheduleName.trim() || !newScheduleSource || !newScheduleOutput}
                      onClick={async () => {
                        const schedule = await scheduleApi.create({
                          name: newScheduleName.trim(),
                          sourcePath: newScheduleSource,
                          outputPath: newScheduleOutput,
                          mode: newScheduleMode,
                          frequency: newScheduleFrequency
                        })
                        setSchedules([...schedules, schedule])
                        setShowNewSchedule(false)
                        setNewScheduleName('')
                        setNewScheduleSource('')
                        setNewScheduleOutput('')
                        toast.success(`Schedule "${schedule.name}" created`)
                      }}
                    >
                      {t('settings.create')}
                    </Button>
                  </div>
                </div>
              )}

              {schedules.length > 0 && (
                <div className="space-y-2">
                  {schedules.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.frequency} &middot; {s.mode} &middot;{' '}
                          {s.lastRunAt
                            ? `Last: ${new Date(s.lastRunAt).toLocaleDateString()}`
                            : 'Never run'}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const next = !s.enabled
                          await scheduleApi.toggle(s.id, next)
                          setSchedules(
                            schedules.map((x) => (x.id === s.id ? { ...x, enabled: next } : x))
                          )
                        }}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                          s.enabled ? 'bg-foreground' : 'bg-secondary'
                        )}
                      >
                        <span
                          className={cn(
                            'pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-background shadow-sm transition-transform duration-200',
                            s.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                          )}
                        />
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={async () => {
                          await scheduleApi.runNow(s.id)
                          toast.success(`Running "${s.name}" now...`)
                          scheduleApi.list().then(setSchedules)
                        }}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          await scheduleApi.remove(s.id)
                          setSchedules(schedules.filter((x) => x.id !== s.id))
                          toast.success('Schedule removed')
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {schedules.length === 0 && !showNewSchedule && (
                <p className="text-xs text-muted-foreground italic">{t('settings.noSchedules')}</p>
              )}
            </CardContent>
          </Card>
        </>
      )
    },
    {
      id: 'feedback',
      labelKey: 'settings.section.feedback',
      icon: MessageSquarePlus,
      element: <FeedbackSection />
    }
  ]

  const activeSectionData = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0]

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('settings.title')} />
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[150px] shrink-0 flex-col gap-0.5 border-r border-border/60 p-3">
          {SECTIONS.map((section) => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors',
                  activeSection === section.id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate text-left">{t(section.labelKey)}</span>
              </button>
            )
          })}
        </nav>
        <div className="min-h-0 flex-1 space-y-6 overflow-auto p-6">
          {activeSectionData.element}
        </div>
      </div>
    </div>
  )
}

/** Runs a mutation and surfaces a rejection as a toast instead of an unhandled promise. */
async function attempt(action: () => Promise<void>, failure: string): Promise<void> {
  try {
    await action()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : failure)
  }
}

function YourAiSection({
  onStatusChange
}: {
  onStatusChange: (status: AgentStatus) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [projectsRoot, setProjectsRoot] = useState('')
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false)

  function handleStatusChange(s: AgentStatus): void {
    setStatus(s)
    setProjectsRoot(s.projectsRoot)
    onStatusChange(s)
  }

  async function deleteAllConversations(): Promise<void> {
    setConfirmingDeleteAll(false)
    await attempt(async () => {
      await conversationApi.removeAll()
      toast.success(t('conversations.deletedAll'))
    }, 'Could not delete the conversations')
  }

  async function pickProjectsRoot(): Promise<void> {
    const picked = await folderApi.select()
    if (!picked) return
    await attempt(async () => {
      await settingsApi.set({ projectsRoot: picked })
      setProjectsRoot(picked)
    }, 'Could not save the projects folder')
  }

  return (
    <div className="space-y-6">
      <ConnectClaude onStatusChange={handleStatusChange} />

      {status?.hasProjects && (
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            {t('settings.assistant.projectsRoot')}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('settings.assistant.projectsRootHelp')}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-border bg-card px-3 py-2 text-xs">
              {projectsRoot}
            </code>
            <Button variant="outline" size="sm" onClick={pickProjectsRoot}>
              {t('settings.assistant.change')}
            </Button>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          {t('conversations.title')}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('conversations.retention')}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => setConfirmingDeleteAll(true)}
        >
          {t('conversations.deleteAll')}
        </Button>

        <Dialog open={confirmingDeleteAll} onOpenChange={setConfirmingDeleteAll}>
          <DialogContent className="max-w-sm" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle className="text-sm">
                {t('conversations.deleteAllConfirmTitle')}
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                {t('conversations.deleteAllConfirmDesc')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  {t('common.cancel')}
                </Button>
              </DialogClose>
              <Button size="sm" variant="destructive" onClick={deleteAllConversations}>
                {t('conversations.deleteAll')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <VoiceSettings />
    </div>
  )
}

/**
 * Whoever reads a file before it is sorted, chosen once here rather than
 * inferred: Smart Local never opens a file's contents; Claude sorts the
 * whole batch when connected.
 */
function SorterSourceSection({
  claudeStatus
}: {
  claudeStatus: AgentStatus | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [sorterSource, setSorterSource] = useState<SorterSource | null>(null)

  useEffect(() => {
    settingsApi.get().then((settings) => setSorterSource(settings.sorterSource))
  }, [])

  async function choose(next: SorterSource): Promise<void> {
    setSorterSource(next)
    await attempt(async () => {
      await settingsApi.set({ sorterSource: next })
    }, 'Could not save that choice')
  }

  const claudeConnected = claudeStatus !== null && brainReady(claudeStatus)

  if (sorterSource === null) return <></>

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
        {t('settings.sorter.title')}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('settings.sorter.help')}</p>

      <div className="mt-3 space-y-2">
        <SorterOptionRow
          selected={sorterSource === 'smart-local'}
          onSelect={() => choose('smart-local')}
          label={t('settings.sorter.smartLocal.label')}
          detail={t('settings.sorter.smartLocal.detail')}
          sentLine={t('settings.sorter.smartLocal.sent')}
        />
        <SorterOptionRow
          selected={sorterSource === 'claude'}
          onSelect={() => choose('claude')}
          disabled={!claudeConnected}
          disabledReason={t('settings.sorter.claude.disabled')}
          label={t('settings.sorter.claude.label')}
          detail={t('settings.sorter.claude.detail')}
          sentLine={t('settings.sorter.claude.sent')}
        />
      </div>
    </div>
  )
}

/** One selectable row in the "who reads your files" chooser. */
function SorterOptionRow(props: {
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  disabledReason?: string
  label: string
  detail: string
  sentLine: string | null
}): React.JSX.Element {
  const { selected, onSelect, disabled, disabledReason, label, detail, sentLine } = props
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-colors',
        selected ? 'border-foreground bg-accent' : 'border-border hover:bg-accent/40',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent'
      )}
    >
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      {disabled && disabledReason && <p className="mt-1 text-xs text-warning">{disabledReason}</p>}
      {selected && sentLine && (
        <p className="mt-1.5 text-xs text-muted-foreground/80">{sentLine}</p>
      )}
    </button>
  )
}

function VoiceSettings(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [enabled, setEnabled] = useState(true)
  const [hotkey, setHotkey] = useState<VoiceHotkey>('Alt+Space')
  const [speak, setSpeak] = useState(true)
  const [voiceMode, setVoiceMode] = useState(false)
  const [model, setModel] = useState<VoiceModelStatus | null>(null)
  const [tts, setTts] = useState<TtsStatus | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const isMac = window.electron?.platform === 'darwin'

  const refresh = useCallback(async () => {
    const [settings, status, ttsStatus] = await Promise.all([
      settingsApi.get(),
      voiceApi.modelStatus(),
      voiceApi.ttsStatus()
    ])
    setEnabled(settings.voiceEnabled !== false)
    setHotkey(settings.voiceHotkey ?? 'Alt+Space')
    setSpeak(settings.voiceSpeakReplies !== false)
    setVoiceMode(settings.voiceMode === true)
    setModel(status)
    setTts(ttsStatus)
  }, [])

  useEffect(() => {
    // refresh() only sets state after awaiting IPC — never synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    return voiceApi.onDownloadProgress((progress) => setPercent(progress.percent))
  }, [refresh])

  async function install(): Promise<void> {
    if (!model) return
    setPercent(0)
    const result = await voiceApi.downloadModel(model.choice)
    setPercent(null)
    if (!result.success) toast.error(t('settings.voice.installFailed'))
    await refresh()
  }

  async function installTts(): Promise<void> {
    setPercent(0)
    const result = await voiceApi.downloadTts()
    setPercent(null)
    if (!result.success) toast.error(t('settings.voice.installFailed'))
    await refresh()
  }

  async function previewVoice(): Promise<void> {
    if (!tts) return
    try {
      await voiceApi.previewVoice(tts.voice)
    } catch {
      toast.error(t('settings.voice.previewFailed'))
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
        {t('settings.voice.title')}
      </h2>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{t('settings.voice.enable')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('settings.voice.enableHelp')}</p>
        </div>
        <button
          onClick={async () => {
            const next = !enabled
            setEnabled(next)
            await settingsApi.set({ voiceEnabled: next })
          }}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
            enabled ? 'bg-foreground' : 'bg-secondary'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200',
              enabled ? 'translate-x-5.5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      <div className="mt-4">
        <p className="text-xs text-muted-foreground">{t('settings.voice.hotkey')}</p>
        <select
          value={hotkey}
          onChange={async (e) => {
            const next = e.target.value as VoiceHotkey
            setHotkey(next)
            await settingsApi.set({ voiceHotkey: next })
          }}
          className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          {VOICE_HOTKEYS.map((choice) => (
            <option key={choice} value={choice}>
              {choice.replace('Alt', '⌥').replace('Control', '⌃').replace('Shift', '⇧')}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <p className="text-xs text-muted-foreground">{t('settings.voice.model')}</p>
        <select
          value={model?.choice ?? 'fast'}
          onChange={async (e) => {
            await settingsApi.set({ voiceSttModel: e.target.value as 'fast' | 'accurate' })
            await refresh()
          }}
          className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="fast">{t('settings.voice.modelFast')}</option>
          <option value="accurate">{t('settings.voice.modelAccurate')}</option>
        </select>

        {model?.needsAccurateForBulgarian && (
          <p className="mt-1 text-xs text-warning">{t('settings.voice.bulgarianHint')}</p>
        )}

        <div className="mt-2">
          {model?.installed ? (
            <span className="text-xs text-muted-foreground">{t('settings.voice.installed')}</span>
          ) : percent === null ? (
            <Button variant="outline" size="sm" onClick={() => void install()}>
              {t('settings.voice.install')}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t('settings.voice.installing').replace('{percent}', String(percent))}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{t('settings.voice.speak')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isMac ? t('settings.voice.speakHelp') : t('settings.voice.macOnly')}
          </p>
        </div>
        <button
          onClick={async () => {
            const next = !speak
            setSpeak(next)
            await settingsApi.set({ voiceSpeakReplies: next })
          }}
          disabled={!isMac}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
            speak && isMac ? 'bg-foreground' : 'bg-secondary'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200',
              speak && isMac ? 'translate-x-5.5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{t('settings.voice.mode')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isMac ? t('settings.voice.modeHelp') : t('settings.voice.macOnly')}
          </p>
        </div>
        <button
          onClick={async () => {
            const next = !voiceMode
            setVoiceMode(next)
            await settingsApi.set({ voiceMode: next })
          }}
          disabled={!isMac}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
            voiceMode && isMac ? 'bg-foreground' : 'bg-secondary'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200',
              voiceMode && isMac ? 'translate-x-5.5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      {isMac && tts && (
        <>
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">{t('settings.voice.engine')}</p>
            <select
              value={tts.engine}
              onChange={async (e) => {
                await settingsApi.set({ voiceTtsEngine: e.target.value as TtsEngine })
                await refresh()
              }}
              className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            >
              <option value="kokoro">{t('settings.voice.engineKokoro')}</option>
              <option value="system">{t('settings.voice.engineSystem')}</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">{t('settings.voice.engineHelp')}</p>
          </div>

          <div className="mt-4">
            <p className="text-xs text-muted-foreground">{t('settings.voice.ttsModel')}</p>
            <div className="mt-2">
              {tts.modelInstalled ? (
                <span className="text-xs text-muted-foreground">
                  {t('settings.voice.ttsInstalled')}
                </span>
              ) : percent === null ? (
                <Button variant="outline" size="sm" onClick={() => void installTts()}>
                  {t('settings.voice.ttsInstall')}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t('settings.voice.installing').replace('{percent}', String(percent))}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-end gap-2">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{t('settings.voice.voice')}</p>
              <select
                value={tts.voice}
                onChange={async (e) => {
                  await settingsApi.set({ voiceTtsVoice: e.target.value })
                  await refresh()
                }}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {tts.voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {`${voice.label} · ${
                      voice.accent === 'British'
                        ? t('settings.voice.accentBritish')
                        : t('settings.voice.accentAmerican')
                    } ${
                      voice.gender === 'male'
                        ? t('settings.voice.genderMale')
                        : t('settings.voice.genderFemale')
                    }`}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!tts.modelInstalled}
              onClick={() => void previewVoice()}
            >
              {t('settings.voice.preview')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

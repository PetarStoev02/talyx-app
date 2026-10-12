import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  CalendarDays,
  HardDrive,
  Mail,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { folderApi } from '@shared/api/ipc'
import type { CalendarEvent, MailMessage, PathEntry, ResultCard as Card } from '@shared/api/agent'

const NEARLY_FULL_RATIO = 0.1
const GIGABYTE = 1024 ** 3

/** A structured answer: clickable paths or a disk gauge. Prose stays with the markdown entry. */
export function ResultCard({ card }: { card: Card }): React.JSX.Element {
  switch (card.kind) {
    case 'disk':
      return <DiskCard card={card} />
    case 'agenda':
      return <AgendaCard events={card.events} byDay={card.day === 'week'} />
    case 'mail':
      return <MailCard messages={card.messages} />
    case 'paths':
      return <PathsCard entries={card.entries} />
  }
}

function AgendaCard({
  events,
  byDay
}: {
  events: CalendarEvent[]
  /** A multi-day span needs a date above each day's events. */
  byDay: boolean
}): React.JSX.Element {
  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
        <CalendarDays className="size-4" /> Free
      </div>
    )
  }
  const days = events.map((e) => dayOf(e.start))
  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card">
      {events.map((e, i) => (
        <li key={`${e.start}-${e.title}`} className="flex flex-wrap gap-3 px-3 py-2">
          {byDay && days[i] !== days[i - 1] && (
            <span className="basis-full text-xs font-medium text-foreground">{days[i]}</span>
          )}
          <span className="w-[5.5rem] shrink-0 pt-px font-mono text-xs text-muted-foreground">
            {e.allDay ? 'All day' : `${clock(e.start)}–${clock(e.end)}`}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-foreground">{e.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {[e.location, e.calendar].filter(Boolean).join(' · ')}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function MailCard({ messages }: { messages: MailMessage[] }): React.JSX.Element {
  if (messages.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
        <Mail className="size-4" /> Inbox clear
      </div>
    )
  }
  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card">
      {messages.map((m) => (
        <li key={`${m.receivedAt}-${m.subject}`} className="px-3 py-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] font-medium text-foreground">
              {m.from.replace(/\s*<[^>]+>/, '')}
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {clock(m.receivedAt)}
            </span>
          </div>
          <span className="block truncate text-[13px] text-foreground/90">{m.subject}</span>
          {m.preview && (
            <span className="block truncate text-xs text-muted-foreground">{m.preview}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function dayOf(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
}

function clock(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function PathsCard({ entries }: { entries: PathEntry[] }): React.JSX.Element {
  const foldersOnly = entries.every((e) => e.isDirectory && e.snippet === null)
  if (foldersOnly) {
    return (
      <ul className="flex flex-wrap gap-2">
        {entries.map((e) => (
          <li key={e.path}>
            <PathButton
              entry={e}
              className="gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] hover:bg-accent"
            >
              <Folder className="size-3.5 text-muted-foreground" />
              {e.label}
            </PathButton>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border bg-card">
      {entries.map((e) => {
        const Icon = iconFor(e)
        return (
          <li key={e.path}>
            <PathButton entry={e} className="w-full gap-3 px-3 py-2 text-left hover:bg-accent/60">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-foreground">{e.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {parentOf(e.path)}
                </span>
                {e.snippet && (
                  <span className="mt-1 block text-xs text-foreground/70">{e.snippet}</span>
                )}
              </span>
            </PathButton>
          </li>
        )
      })}
    </ul>
  )
}

/** Click reveals in Finder; ⌘-click opens the item itself. */
function PathButton({
  entry,
  className,
  children
}: {
  entry: PathEntry
  className: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={entry.path}
      onClick={(event) =>
        void (event.metaKey ? folderApi.open(entry.path) : folderApi.showInExplorer(entry.path))
      }
      className={cn('flex items-start transition-colors', className)}
    >
      {children}
    </button>
  )
}

function DiskCard({
  card
}: {
  card: { freeBytes: number; totalBytes: number }
}): React.JSX.Element {
  const usedRatio = card.totalBytes > 0 ? 1 - card.freeBytes / card.totalBytes : 0
  const nearlyFull = 1 - usedRatio < NEARLY_FULL_RATIO
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-[13px] text-foreground">
        <HardDrive className="size-4 text-muted-foreground" />
        {gigabytes(card.freeBytes)} free of {gigabytes(card.totalBytes)}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', nearlyFull ? 'bg-destructive' : 'bg-foreground/70')}
          style={{ width: `${Math.round(usedRatio * 100)}%` }}
        />
      </div>
    </div>
  )
}

function gigabytes(bytes: number): string {
  return `${Math.round(bytes / GIGABYTE)} GB`
}

function parentOf(path: string): string {
  return path.replace(/[\\/][^\\/]*$/, '') || path
}

const ICONS: Record<string, LucideIcon> = {
  jpg: FileImage,
  jpeg: FileImage,
  png: FileImage,
  gif: FileImage,
  heic: FileImage,
  webp: FileImage,
  svg: FileImage,
  mp4: FileVideo,
  mov: FileVideo,
  mkv: FileVideo,
  mp3: FileAudio,
  wav: FileAudio,
  m4a: FileAudio,
  zip: FileArchive,
  dmg: FileArchive,
  tar: FileArchive,
  gz: FileArchive,
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  md: FileText,
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  json: FileCode,
  py: FileCode
}

function iconFor(entry: PathEntry): LucideIcon {
  if (entry.isDirectory) return Folder
  const ext = entry.label.split('.').pop()?.toLowerCase() ?? ''
  return ICONS[ext] ?? File
}

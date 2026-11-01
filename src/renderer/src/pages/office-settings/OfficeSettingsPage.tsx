import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useNavigation } from '@app/providers/useNavigation'
import { useOffice } from '@app/providers/useOffice'
import { Button } from '@shared/ui/button'
import type { Bot, Group, OfficeSnapshot, Project, Room } from '../../../../shared/office'
import { BotEditor } from './BotEditor'
import { EndpointSection } from './EndpointSection'
import { Field, Section, inputClass, outlineClass, primaryClass } from './settingsUi'
import { attempt, copyText } from './settingsActions'

const NEW_BOT_COLOR = '#9a9a9a'
const STALE_MIN = 1
const STALE_MAX = 240
const WINDOW_VIEWS: Project['windowView'][] = ['none', 'city', 'fields']

export function OfficeSettingsPage(): React.JSX.Element {
  const navigate = useNavigation((s) => s.navigate)
  const { snapshot, load, subscribe } = useOffice()

  useEffect(() => {
    const unsubscribe = subscribe()
    void attempt(() => load(null), 'Could not load the office')
    return unsubscribe
  }, [load, subscribe])

  return (
    <div className="h-screen w-screen overflow-y-auto bg-black font-sans text-white">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-10">
        <div className="flex items-center gap-3">
          <Button size="sm" className={outlineClass} onClick={() => navigate('office')}>
            ← Office
          </Button>
          <h1 className="text-base font-semibold">Settings</h1>
        </div>
        {snapshot && (
          <>
            <ProjectSection key={snapshot.project.id} project={snapshot.project} />
            <GroupsSection snapshot={snapshot} />
            <BotsSection snapshot={snapshot} />
            <EndpointSection funnel={snapshot.funnel} />
            <InstructionsSection snapshot={snapshot} />
            <GeneralSection />
          </>
        )}
      </div>
    </div>
  )
}

function ProjectSection({ project }: { project: OfficeSnapshot['project'] }): React.JSX.Element {
  const load = useOffice((s) => s.load)
  const [name, setName] = useState(project.name)

  async function save(patch: Partial<Project>, success: string): Promise<void> {
    const next: Project = {
      id: project.id,
      name: name.trim(),
      logoPath: project.logoPath,
      windowView: project.windowView,
      ...patch
    }
    if (await attempt(() => window.api.rosterSaveProject(next), 'Could not save the project')) {
      toast.success(success)
    }
  }

  async function handlePickLogo(): Promise<void> {
    const path = await window.api.rosterPickLogo()
    if (path) await save({ logoPath: path }, 'Logo saved')
  }

  async function handleNewProject(): Promise<void> {
    const projectName = window.prompt('New project name')?.trim()
    if (!projectName) return
    const id = crypto.randomUUID()
    const created = await attempt(async () => {
      await window.api.rosterSaveProject({
        id,
        name: projectName,
        logoPath: null,
        windowView: 'none'
      })
      await window.api.updateSettings({ currentProjectId: id })
      await load(id)
    }, 'Could not create the project')
    if (created) toast.success(`${projectName} created`)
  }

  return (
    <Section title="Project">
      <Field label="Name">
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            size="sm"
            className={primaryClass}
            disabled={!name.trim() || name.trim() === project.name}
            onClick={() => save({}, 'Project renamed')}
          >
            Rename
          </Button>
        </div>
      </Field>
      <div className="flex items-center gap-3 text-xs text-[#949494]">
        {project.logoDataUrl ? (
          <img src={project.logoDataUrl} alt="Project logo" className="size-8 object-contain" />
        ) : (
          <span>No logo</span>
        )}
        <Button size="sm" className={outlineClass} onClick={handlePickLogo}>
          Choose logo…
        </Button>
        <span>png, jpeg or svg, up to 256 KB</span>
      </div>
      <Field label="Window view">
        <select
          className={inputClass}
          value={project.windowView}
          onChange={(e) =>
            save({ windowView: e.target.value as Project['windowView'] }, 'Window view saved')
          }
        >
          {WINDOW_VIEWS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <div>
        <Button size="sm" className={outlineClass} onClick={handleNewProject}>
          New project
        </Button>
      </div>
    </Section>
  )
}

function GroupsSection({ snapshot }: { snapshot: OfficeSnapshot }): React.JSX.Element {
  const projectId = snapshot.project.id
  const [newGroup, setNewGroup] = useState('')
  const [roomName, setRoomName] = useState('')
  const [roomKind, setRoomKind] = useState<Room['kind']>('work')

  async function handleAddGroup(): Promise<void> {
    const group = { id: crypto.randomUUID(), projectId, name: newGroup.trim(), relayBotId: null }
    if (await attempt(() => window.api.rosterSaveGroup(group), 'Could not add the group')) {
      setNewGroup('')
    }
  }

  async function handleRename(id: string, name: string): Promise<void> {
    const trimmed = name.trim()
    const current = snapshot.groups.find((g) => g.id === id)
    if (!current || !trimmed || trimmed === current.name) return
    await attempt(
      () => window.api.rosterSaveGroup({ ...current, name: trimmed }),
      'Could not rename the group'
    )
  }

  async function handleRelay(group: Group, relayBotId: string | null): Promise<void> {
    await attempt(
      () => window.api.rosterSaveGroup({ ...group, relayBotId }),
      'Could not set the relay bot'
    )
  }

  async function handleAddRoom(): Promise<void> {
    const room: Room = {
      id: crypto.randomUUID(),
      projectId,
      name: roomName.trim(),
      kind: roomKind,
      groupId: null
    }
    if (await attempt(() => window.api.rosterSaveRoom(room), 'Could not add the room')) {
      setRoomName('')
    }
  }

  return (
    <Section title="Groups and rooms">
      {snapshot.groups.map((g) => (
        <div key={g.id} className="flex gap-2">
          <input
            key={g.name}
            aria-label={`Group ${g.name}`}
            className={inputClass}
            defaultValue={g.name}
            maxLength={100}
            onBlur={(e) => handleRename(g.id, e.target.value)}
          />
          <select
            aria-label={`Relay bot for ${g.name}`}
            title="Relay bot: the member that posts your group messages into the Grok chat"
            className={`${inputClass} w-44`}
            value={g.relayBotId ?? ''}
            onChange={(e) => handleRelay(g, e.target.value || null)}
          >
            <option value="">Relay bot: none</option>
            {snapshot.bots
              .filter((b) => b.groupIds.includes(g.id) && b.webhookUrl)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  Relay: {b.name}
                </option>
              ))}
          </select>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          className={inputClass}
          placeholder="New group (gets its own conference room)"
          value={newGroup}
          maxLength={100}
          onChange={(e) => setNewGroup(e.target.value)}
        />
        <Button
          size="sm"
          className={outlineClass}
          disabled={!newGroup.trim()}
          onClick={handleAddGroup}
        >
          Add group
        </Button>
      </div>
      <p className="text-xs text-[#949494]">
        Rooms: {snapshot.rooms.map((r) => `${r.name} (${r.kind})`).join(', ')}
      </p>
      <div className="flex gap-2">
        <input
          className={inputClass}
          placeholder="Extra room name"
          value={roomName}
          maxLength={100}
          onChange={(e) => setRoomName(e.target.value)}
        />
        <select
          aria-label="Room kind"
          className={`${inputClass} w-36`}
          value={roomKind}
          onChange={(e) => setRoomKind(e.target.value as Room['kind'])}
        >
          <option value="work">work</option>
          <option value="chill">chill</option>
          <option value="conference">conference</option>
        </select>
        <Button
          size="sm"
          className={outlineClass}
          disabled={!roomName.trim()}
          onClick={handleAddRoom}
        >
          Add room
        </Button>
      </div>
    </Section>
  )
}

function BotsSection({ snapshot }: { snapshot: OfficeSnapshot }): React.JSX.Element {
  const [editing, setEditing] = useState<{ bot: Bot; saved: boolean } | null>(null)

  function handleAdd(): void {
    setEditing({
      saved: false,
      bot: {
        id: crypto.randomUUID(),
        projectId: snapshot.project.id,
        name: '',
        color: NEW_BOT_COLOR,
        groupIds: [],
        webhookUrl: null,
        t3ProjectIds: [],
        grokLink: null
      }
    })
  }

  return (
    <Section title="Bots">
      {editing && (
        <BotEditor
          key={editing.bot.id}
          bot={editing.bot}
          saved={editing.saved}
          webhookReady={snapshot.bots.find((b) => b.id === editing.bot.id)?.webhookReady ?? false}
          groups={snapshot.groups}
          t3Projects={snapshot.t3Projects}
          onDone={() => setEditing(null)}
        />
      )}
      <ul className="flex flex-col">
        {snapshot.bots.map((bot) => (
          <li key={bot.id} className="flex items-center gap-2 border-b border-[#1e1e1e] py-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: bot.color }} />
            <span className="text-[13px]">{bot.name}</span>
            <span className="text-xs text-[#949494]">
              {bot.webhookReady ? 'webhook ready' : ''}
            </span>
            <Button
              size="xs"
              className={`${outlineClass} ml-auto`}
              onClick={() => setEditing({ bot, saved: true })}
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button size="sm" className={outlineClass} onClick={handleAdd}>
          Add bot
        </Button>
      </div>
    </Section>
  )
}

function InstructionsSection({ snapshot }: { snapshot: OfficeSnapshot }): React.JSX.Element {
  const [chosenId, setChosenId] = useState(snapshot.bots[0]?.id ?? '')
  const [text, setText] = useState('')
  // A deleted bot falls back to the first one.
  const botId = snapshot.bots.some((b) => b.id === chosenId)
    ? chosenId
    : (snapshot.bots[0]?.id ?? '')
  // Everything the block is built from: re-fetch when any of it changes.
  const bot = snapshot.bots.find((b) => b.id === botId)
  const sourceKey = JSON.stringify([
    botId,
    bot?.name,
    bot?.groupIds,
    snapshot.groups,
    snapshot.funnel.url
  ])

  useEffect(() => {
    if (!botId) return
    void attempt(
      async () => setText(await window.api.rosterBotInstructions(botId)),
      'Could not build the instructions'
    )
  }, [botId, sourceKey])

  return (
    <Section title="Bot instructions">
      <div className="flex gap-2">
        <select
          aria-label="Bot"
          className={inputClass}
          value={botId}
          onChange={(e) => setChosenId(e.target.value)}
        >
          {snapshot.bots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <Button size="sm" className={primaryClass} disabled={!text} onClick={() => copyText(text)}>
          Copy
        </Button>
      </div>
      <textarea
        readOnly
        aria-label="Instructions"
        value={text}
        rows={12}
        className="resize-y rounded-md border border-[#444] bg-black p-2 font-mono text-[11px] text-[#b4b4b4]"
      />
    </Section>
  )
}

interface GeneralSettings {
  staleMinutes: number
  launchAtLogin: boolean
}

function GeneralSection(): React.JSX.Element {
  const [settings, setSettings] = useState<GeneralSettings | null>(null)
  const [stale, setStale] = useState('')

  useEffect(() => {
    void attempt(async () => {
      const loaded = (await window.api.getSettings()) as GeneralSettings
      setSettings(loaded)
      setStale(String(loaded.staleMinutes))
    }, 'Could not load settings')
  }, [])

  async function update(patch: Partial<GeneralSettings>): Promise<void> {
    await attempt(async () => {
      setSettings((await window.api.updateSettings(patch)) as GeneralSettings)
    }, 'Could not save the setting')
  }

  function handleStaleBlur(): void {
    const minutes = Number(stale)
    if (Number.isInteger(minutes) && minutes >= STALE_MIN && minutes <= STALE_MAX) {
      if (minutes !== settings?.staleMinutes) void update({ staleMinutes: minutes })
      return
    }
    toast.error(`Stale minutes must be a whole number from ${STALE_MIN} to ${STALE_MAX}`)
    setStale(String(settings?.staleMinutes ?? ''))
  }

  return (
    <Section title="General">
      <Field label={`Minutes without news before a bot shows as stale (${STALE_MIN}–${STALE_MAX})`}>
        <input
          type="number"
          min={STALE_MIN}
          max={STALE_MAX}
          className={`${inputClass} w-24`}
          value={stale}
          disabled={!settings}
          onChange={(e) => setStale(e.target.value)}
          onBlur={handleStaleBlur}
        />
      </Field>
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={settings?.launchAtLogin ?? false}
          disabled={!settings}
          onChange={(e) => update({ launchAtLogin: e.target.checked })}
        />
        Launch Talyx at login
      </label>
    </Section>
  )
}

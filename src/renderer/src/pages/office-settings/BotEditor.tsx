import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@shared/ui/button'
import type { Bot, OfficeSnapshot } from '../../../../shared/office'
import { Field, inputClass, outlineClass, primaryClass } from './settingsUi'
import { attempt } from './settingsActions'

interface BotEditorProps {
  bot: Bot
  /** False for a bot that has not been saved yet. */
  saved: boolean
  webhookReady: boolean
  groups: OfficeSnapshot['groups']
  t3Projects: OfficeSnapshot['t3Projects']
  onDone: () => void
}

const toggle = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]

export function BotEditor(props: BotEditorProps): React.JSX.Element {
  const { saved, webhookReady, groups, onDone } = props
  const [bot, setBot] = useState(props.bot)
  const [webhookUrl, setWebhookUrl] = useState(props.bot.webhookUrl ?? '')
  const [grokLink, setGrokLink] = useState(props.bot.grokLink ?? '')
  // Write-only: never filled from a stored key.
  const [webhookKey, setWebhookKey] = useState('')
  // Mapped ids T3 no longer lists stay choosable, so saving never drops them silently.
  const t3Choices = [
    ...props.t3Projects,
    ...bot.t3ProjectIds
      .filter((id) => !props.t3Projects.some((p) => p.id === id))
      .map((id) => ({ id, name: id }))
  ]

  async function handleSave(): Promise<void> {
    // Listed field by field: the snapshot bot passed in also carries placement data.
    const next: Bot = {
      id: bot.id,
      projectId: bot.projectId,
      color: bot.color,
      groupIds: bot.groupIds,
      t3ProjectIds: bot.t3ProjectIds,
      name: bot.name.trim(),
      webhookUrl: webhookUrl.trim() || null,
      grokLink: grokLink.trim() || null
    }
    const done = await attempt(async () => {
      await window.api.rosterSaveBot(next)
      if (webhookKey) await window.api.rosterSetWebhookKey({ botId: next.id, key: webhookKey })
    }, 'Could not save the bot')
    if (done) {
      toast.success(`${next.name} saved`)
      onDone()
    }
  }

  async function handleDelete(): Promise<void> {
    if (!window.confirm(`Delete ${bot.name}? Its webhook key is removed too.`)) return
    if (await attempt(() => window.api.rosterDeleteBot(bot.id), 'Could not delete the bot')) {
      onDone()
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[#2e2e2e] p-3">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Name">
          <input
            className={inputClass}
            value={bot.name}
            maxLength={100}
            onChange={(e) => setBot({ ...bot, name: e.target.value })}
          />
        </Field>
        <Field label="Colour">
          <input
            type="color"
            className="h-8 w-12 cursor-pointer rounded-md border border-[#444] bg-black"
            value={bot.color}
            onChange={(e) => setBot({ ...bot, color: e.target.value })}
          />
        </Field>
      </div>
      <Checklist
        label="Groups"
        empty="No groups yet."
        options={groups}
        chosen={bot.groupIds}
        onToggle={(id) => setBot({ ...bot, groupIds: toggle(bot.groupIds, id) })}
      />
      <Checklist
        label="T3 projects"
        empty="No T3 projects found."
        options={t3Choices}
        chosen={bot.t3ProjectIds}
        onToggle={(id) => setBot({ ...bot, t3ProjectIds: toggle(bot.t3ProjectIds, id) })}
      />
      <Field label="Webhook URL (https)">
        <input
          className={inputClass}
          value={webhookUrl}
          placeholder="https://"
          onChange={(e) => setWebhookUrl(e.target.value)}
        />
      </Field>
      <Field label={webhookReady ? 'Webhook key: Key saved (type to replace)' : 'Webhook key'}>
        <input
          type="password"
          autoComplete="off"
          className={inputClass}
          value={webhookKey}
          onChange={(e) => setWebhookKey(e.target.value)}
        />
      </Field>
      <Field label="Grok chat link (https)">
        <input
          className={inputClass}
          value={grokLink}
          placeholder="https://"
          onChange={(e) => setGrokLink(e.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" className={primaryClass} disabled={!bot.name.trim()} onClick={handleSave}>
          Save
        </Button>
        <Button size="sm" className={outlineClass} onClick={onDone}>
          Cancel
        </Button>
        {saved && (
          <Button size="sm" className={`${outlineClass} ml-auto`} onClick={handleDelete}>
            Delete bot
          </Button>
        )}
      </div>
    </div>
  )
}

interface ChecklistProps {
  label: string
  empty: string
  options: { id: string; name: string }[]
  chosen: string[]
  onToggle: (id: string) => void
}

function Checklist({ label, empty, options, chosen, onToggle }: ChecklistProps): React.JSX.Element {
  return (
    <fieldset className="flex flex-col gap-1 text-xs text-[#949494]">
      <legend className="mb-1">{label}</legend>
      {options.length === 0 && <span>{empty}</span>}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-1.5 text-[13px] text-white">
            <input
              type="checkbox"
              checked={chosen.includes(o.id)}
              onChange={() => onToggle(o.id)}
            />
            {o.name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

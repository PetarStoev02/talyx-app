import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@shared/ui/button'
import type { OfficeSnapshot } from '../../../../shared/office'
import { Field, Section, inputClass, outlineClass } from './settingsUi'
import { attempt, copyText } from './settingsActions'

interface EndpointSectionProps {
  funnel: OfficeSnapshot['funnel']
}

// The revealed token lives only in this component's state, so leaving the page forgets it.
export function EndpointSection({ funnel }: EndpointSectionProps): React.JSX.Element {
  const [tokenHint, setTokenHint] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void attempt(
      async () => setTokenHint((await window.api.rosterEndpoint()).tokenHint),
      'Could not read the endpoint'
    )
  }, [])

  async function handleFunnel(): Promise<void> {
    setBusy(true)
    await attempt(
      () => window.api.rosterFunnel(funnel.on ? 'off' : 'on'),
      'Could not change Funnel'
    )
    setBusy(false)
  }

  async function handleReveal(): Promise<void> {
    await attempt(async () => setRevealed(await window.api.rosterRevealToken()), 'Could not reveal')
  }

  async function handleRotate(): Promise<void> {
    if (!window.confirm('Rotate the token? Every bot needs the new one.')) return
    const done = await attempt(async () => {
      await window.api.rosterRotateToken()
      setTokenHint((await window.api.rosterEndpoint()).tokenHint)
    }, 'Could not rotate the token')
    if (done) {
      setRevealed(null)
      toast.success('Token rotated')
    }
  }

  return (
    <Section title="Endpoint">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <div>
          <div>Tailscale Funnel: {funnel.on ? 'on' : 'off'}</div>
          <div className="text-xs break-all text-[#949494]">
            {funnel.url ?? 'Turn Funnel on to get a public URL for bots.'}
          </div>
        </div>
        <Button size="sm" className={outlineClass} disabled={busy} onClick={handleFunnel}>
          {busy ? 'Working…' : funnel.on ? 'Turn off' : 'Turn on'}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span>
          Token <span className="text-[#949494]">ends in …{tokenHint}</span>
        </span>
        <div className="flex gap-2">
          <Button size="sm" className={outlineClass} onClick={handleReveal}>
            Reveal once
          </Button>
          <Button size="sm" className={outlineClass} onClick={handleRotate}>
            Rotate
          </Button>
        </div>
      </div>
      {revealed && (
        <Field label="Token (hidden again when you leave Settings)">
          <div className="flex gap-2">
            <input readOnly value={revealed} className={inputClass} aria-label="Token" />
            <Button size="sm" className={outlineClass} onClick={() => copyText(revealed)}>
              Copy
            </Button>
          </div>
        </Field>
      )}
    </Section>
  )
}

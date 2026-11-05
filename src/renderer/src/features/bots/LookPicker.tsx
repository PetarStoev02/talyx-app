import { useLanguage } from '@app/providers/useLanguage'
import { cn } from '@shared/lib/utils'
import { BlockAvatar } from '@shared/ui/BlockAvatar'
import { BLOCK_HUES, BLOCK_SHAPES, blockTones } from '@shared/ui/blockGeometry'
import { Switch } from '@shared/ui/switch'
import { matchName } from './look'
import type { Look } from './look'

const PREVIEW_SIZE = 64
const CHOICE_SIZE = 28

/** The Look tab and the create dialog's look: shape, hue, "Match the name" and the face. */
export function LookPicker({
  look,
  profile,
  onChange
}: {
  look: Look
  // The profile id "Match the name" hashes; Talyx's (`default`) is always the logo.
  profile: string
  onChange: (look: Look) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const manager = profile === 'default'
  const named = matchName(profile)
  return (
    <div className="space-y-4 text-base">
      <div className="flex justify-center rounded-xl bg-secondary py-4">
        {/* A new key per look restarts the crossfade and the turn. */}
        <span key={`${look.shape}:${look.hue}`} className="block-look inline-flex">
          <BlockAvatar
            shape={manager ? 'talyx' : look.shape}
            hue={look.hue}
            size={PREVIEW_SIZE}
            face={look.faces}
            animated
          />
        </span>
      </div>
      {manager ? (
        <p className="text-muted-foreground">{t('look.manager')}</p>
      ) : (
        <>
          <fieldset>
            <legend>{t('look.shape')}</legend>
            <div className="mt-2 flex flex-wrap gap-1">
              {BLOCK_SHAPES.map((shape) => (
                <button
                  key={shape}
                  type="button"
                  aria-pressed={look.shape === shape}
                  aria-label={t(`look.shape.${shape}`)}
                  title={t(`look.shape.${shape}`)}
                  onClick={() => onChange({ ...look, shape })}
                  className={cn(
                    'rounded-lg p-1',
                    look.shape === shape
                      ? 'bg-foreground/10 outline-2 outline-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  <BlockAvatar shape={shape} hue={look.hue} size={CHOICE_SIZE} />
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t('look.color')}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {BLOCK_HUES.map((_, hue) => (
                <button
                  key={hue}
                  type="button"
                  aria-pressed={look.hue === hue}
                  aria-label={t('look.colorN').replace('{n}', String(hue + 1))}
                  onClick={() => onChange({ ...look, hue })}
                  style={{ background: blockTones(hue, false).left }}
                  className={cn(
                    'size-6 rounded-md',
                    look.hue === hue && 'outline-2 outline-offset-2 outline-foreground'
                  )}
                />
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={look.shape === named.shape && look.hue === named.hue}
              onClick={() => onChange({ ...look, ...named })}
              className="h-9 rounded-full bg-secondary px-3 text-sm font-medium hover:bg-foreground/10 aria-pressed:bg-foreground aria-pressed:text-background"
            >
              {t('look.match')}
            </button>
            <span className="text-base text-muted-foreground">{t('look.matchHint')}</span>
          </div>
        </>
      )}
      <label className="flex items-center justify-between gap-4">
        {t('look.faces')}
        <Switch checked={look.faces} onCheckedChange={(faces) => onChange({ ...look, faces })} />
      </label>
    </div>
  )
}

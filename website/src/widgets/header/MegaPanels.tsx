import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { features, INSTALLER_LINKS, resources, type FeatureNav } from '../../shared/data/navigation'
import { MIN_MACOS } from '../../shared/data/offer'
import { PRIVACY_LEDGER } from '../../shared/data/privacy'
import { APP_VERSION } from '../../shared/data/release'
import { NavAnchor } from '../../shared/ui/NavAnchor'
import { Wallpaper } from '../../shared/ui/page'

const MENU_LEDGER = PRIVACY_LEDGER.flatMap(({ figure, menuCaption }) =>
  menuCaption ? [{ figure, caption: menuCaption }] : []
)

const ITEM =
  'block rounded-xl px-4 py-3 transition-colors duration-150 data-[active=true]:bg-[var(--color-bg-secondary)] focus-visible:bg-[var(--color-bg-secondary)] focus-visible:outline-none'

function ItemText({ title, description }: { title: string; description: string }) {
  return (
    <>
      <span className="block text-[17px] font-semibold text-[var(--color-text-primary)]">
        {title}
      </span>
      <span className="mt-0.5 block text-[15px] text-[var(--color-text-secondary)]">
        {description}
      </span>
    </>
  )
}

/** The panel's two halves: what you can open on the left, what it looks like on the right. */
function PanelGrid({ list, preview }: { list: React.ReactNode; preview: React.ReactNode }) {
  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <ul className="space-y-1 lg:col-span-5">{list}</ul>
      <div className="hidden lg:col-span-7 lg:block">{preview}</div>
    </div>
  )
}

export function ProductPanel() {
  const [active, setActive] = useState<FeatureNav>(features[0])

  return (
    <PanelGrid
      list={features.map((feature) => (
        <li key={feature.slug}>
          <Link
            to="/features/$slug"
            params={{ slug: feature.slug }}
            data-active={feature.slug === active.slug}
            onMouseEnter={() => setActive(feature)}
            onFocus={() => setActive(feature)}
            className={ITEM}
          >
            <ItemText title={feature.title} description={feature.shortDescription} />
          </Link>
        </li>
      ))}
      preview={
        <figure className="relative isolate overflow-hidden rounded-2xl p-6">
          <Wallpaper />
          {active.preview ? (
            <img
              key={active.preview}
              src={active.preview}
              alt={`Talyx: ${active.title}`}
              width={1100}
              height={720}
              className="card-swap w-full rounded-xl"
            />
          ) : (
            <dl
              key={active.slug}
              className="card-swap grid aspect-[1100/720] content-center gap-8 rounded-xl bg-[var(--color-bg)] p-10 text-[var(--color-text-primary)]"
            >
              {MENU_LEDGER.map(({ figure, caption }) => (
                <div key={caption} className="grid grid-cols-[4rem_1fr] items-baseline gap-5">
                  <dt className="text-right text-[44px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
                    {figure}
                  </dt>
                  <dd className="text-[17px]">{caption}</dd>
                </div>
              ))}
            </dl>
          )}
          <figcaption className="mt-4 text-[15px] text-white">{active.shortDescription}</figcaption>
        </figure>
      }
    />
  )
}

export function ResourcesPanel() {
  return (
    <PanelGrid
      list={resources.map((resource) => (
        <li key={resource.to}>
          <Link to={resource.to} className={`${ITEM} hover:bg-[var(--color-bg-secondary)]`}>
            <ItemText title={resource.title} description={resource.shortDescription} />
          </Link>
        </li>
      ))}
      preview={
        <div className="rounded-2xl bg-[var(--color-text-primary)] p-10 text-[var(--color-bg)]">
          <p className="text-[44px] leading-none font-semibold tracking-[-0.03em]">
            Download Talyx.
          </p>
          <p className="mt-4 text-[17px]">
            Free and open source. Version {APP_VERSION}, for {MIN_MACOS} or newer and Linux x64.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-3">
            {INSTALLER_LINKS.map((link) => (
              <li key={link.label}>
                <NavAnchor
                  link={link}
                  className="flex min-h-12 items-center rounded-full bg-[var(--color-bg)] px-6 text-[17px] font-semibold text-[var(--color-text-primary)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 active:translate-y-0"
                />
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[15px] opacity-75">Windows comes later.</p>
        </div>
      }
    />
  )
}

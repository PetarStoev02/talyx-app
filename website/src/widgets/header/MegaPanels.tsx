import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { features, resources } from '../../shared/data/navigation'
import { Wallpaper } from '../../shared/ui/page'
import { REPO_URL } from '../../shared/data/release'

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
  const [active, setActive] = useState(features[0])

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
            <div
              key={active.slug}
              className="card-swap grid aspect-[1100/720] content-center rounded-xl bg-[var(--color-bg)] p-10 text-[44px] leading-[1.02] font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]"
            >
              {active.title}
            </div>
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
      list={
        <>
          {resources.map((resource) => (
            <li key={resource.to}>
              <Link to={resource.to} className={`${ITEM} hover:bg-[var(--color-bg-secondary)]`}>
                <ItemText title={resource.title} description={resource.shortDescription} />
              </Link>
            </li>
          ))}
          <li>
            <a href={REPO_URL} className={`${ITEM} hover:bg-[var(--color-bg-secondary)]`}>
              <ItemText title="Source on GitHub" description="Every line, MIT licensed." />
            </a>
          </li>
        </>
      }
      preview={null}
    />
  )
}

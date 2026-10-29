import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { features, resources, useCases } from '../../shared/data/navigation'
import { posts } from '../../shared/data/posts'
import { ApprovalCard } from '../../shared/ui/ApprovalCard'
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
          <img
            src="/hero-wallpaper.jpg"
            alt=""
            width={2200}
            height={1238}
            className="absolute inset-0 -z-10 size-full object-cover"
          />
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
              className="card-swap grid aspect-[1100/720] content-center gap-6 rounded-xl bg-[var(--color-bg)] p-10 text-[var(--color-text-primary)]"
            >
              {[
                ['0', 'bytes leave your Mac when Smart Local sorts'],
                ['0', 'Talyx servers, accounts or analytics'],
                ['1', 'update check, to GitHub']
              ].map(([figure, caption]) => (
                <div key={caption} className="grid grid-cols-[4rem_1fr] items-baseline gap-4">
                  <dt className="text-right text-[44px] leading-none font-semibold tabular-nums">
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

export function UseCasesPanel() {
  const [active, setActive] = useState(useCases[0])

  return (
    <PanelGrid
      list={useCases.map((useCase) => (
        <li key={useCase.slug}>
          <Link
            to="/use-cases/$slug"
            params={{ slug: useCase.slug }}
            data-active={useCase.slug === active.slug}
            onMouseEnter={() => setActive(useCase)}
            onFocus={() => setActive(useCase)}
            className={ITEM}
          >
            <ItemText title={useCase.title} description={useCase.shortDescription} />
          </Link>
        </li>
      ))}
      preview={
        <figure className="relative isolate flex aspect-[16/10] flex-col items-center justify-center overflow-hidden rounded-2xl p-8">
          <img
            src="/hero-wallpaper.jpg"
            alt=""
            width={2200}
            height={1238}
            className="absolute inset-0 -z-10 size-full object-cover object-right"
          />
          <ApprovalCard key={active.slug} plan={active.plan} />
          <figcaption className="mt-5 text-[15px] text-white">
            A card Talyx might show {active.title.toLowerCase()}. Nothing moves until you approve.
          </figcaption>
        </figure>
      }
    />
  )
}

export function ResourcesPanel() {
  const latest = posts.find((post) => !post.draft)

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
      preview={
        latest ? (
          <Link
            to="/blog/$slug"
            params={{ slug: latest.slug }}
            className="group flex aspect-[16/10] flex-col justify-between rounded-2xl bg-[var(--color-text-primary)] p-10 text-[var(--color-bg)]"
          >
            <span className="text-[15px] opacity-75">Latest on the blog · {latest.readTime}</span>
            <span>
              <span className="block text-[44px] leading-[1.02] font-semibold tracking-[-0.03em] transition-transform duration-300 group-hover:-translate-y-1">
                {latest.title}
              </span>
              <span className="mt-4 block max-w-[44ch] text-[17px] opacity-85">
                {latest.excerpt}
              </span>
            </span>
          </Link>
        ) : null
      }
    />
  )
}

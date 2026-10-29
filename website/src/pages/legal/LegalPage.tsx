import { useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { GUTTER, STEP } from '@/shared/ui/page'

import privacyMd from './content/privacy.md?raw'
import termsMd from './content/terms.md?raw'

const pages: Record<string, { content: string; lead: string }> = {
  privacy: {
    content: privacyMd,
    lead: 'What Talyx keeps on your Mac, and exactly what leaves it.'
  },
  terms: {
    content: termsMd,
    lead: 'The terms for using Talyx, free and open source under the MIT licence.'
  }
}

/** Generate a slug ID from heading text. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/** Extract headings from markdown for ToC. */
function extractHeadings(markdown: string): { text: string; level: number; id: string }[] {
  const headings: { text: string; level: number; id: string }[] = []
  const lines = markdown.split('\n')
  for (const line of lines) {
    const match = line.match(/^(#{2,4})\s+(.+)/)
    if (match) {
      const level = match[1].length
      const text = match[2].replace(/\*\*/g, '').trim()
      headings.push({ text, level, id: slugify(text) })
    }
  }
  return headings
}

export function LegalPage() {
  const { slug } = useParams({ strict: false }) as { slug?: string }
  const page = pages[slug ?? '']
  const [activeId, setActiveId] = useState<string | null>(null)

  const headings = page ? extractHeadings(page.content) : []

  // Track active heading on scroll
  useEffect(() => {
    if (!headings.length) return

    let ticking = false
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const scrollY = window.scrollY + window.innerHeight / 3
        let current: string | null = null
        for (const h of headings) {
          const el = document.getElementById(h.id)
          if (el && el.offsetTop <= scrollY) current = h.id
        }
        setActiveId(current)
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll)
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [headings])

  if (!page) {
    return (
      <section className={`${GUTTER} pt-20 pb-32 md:pt-32 md:pb-48`}>
        <h1
          className="leading-none font-semibold tracking-[-0.035em] text-[var(--color-text-primary)]"
          style={STEP.heading}
        >
          Page not found
        </h1>
      </section>
    )
  }

  function handleTocClick(e: React.MouseEvent, id: string) {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' })
      setActiveId(id)
    }
  }

  return (
    <div className={`${GUTTER} grid gap-12 pt-20 pb-32 md:pt-32 md:pb-48 lg:grid-cols-12`}>
      {headings.length > 0 && (
        <nav
          aria-label="Contents"
          className="hidden lg:sticky lg:top-28 lg:col-span-3 lg:block lg:max-h-[calc(100svh-8rem)] lg:self-start lg:overflow-y-auto"
          style={STEP.small}
        >
          {headings.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              onClick={(e) => handleTocClick(e, h.id)}
              className={`block py-1 leading-snug transition-colors ${
                h.level === 3 ? 'pl-4' : h.level === 4 ? 'pl-8' : ''
              } ${
                activeId === h.id
                  ? 'font-medium text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {h.text}
            </a>
          ))}
        </nav>
      )}

      <div
        className="max-w-[65ch] min-w-0 leading-[1.7] text-[var(--color-text-primary)] lg:col-span-9 lg:col-start-4"
        style={STEP.body}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <>
                <h1
                  data-reveal
                  className="leading-none font-semibold tracking-[-0.035em]"
                  style={STEP.heading}
                >
                  {children}
                </h1>
                <p data-reveal className="mt-6 mb-10 leading-snug" style={STEP.lead}>
                  {page.lead}
                </p>
              </>
            ),
            h2: ({ children }) => (
              <h2
                id={slugify(String(children))}
                data-reveal
                className="mt-20 mb-6 scroll-mt-28 leading-tight font-semibold"
                style={STEP.lead}
              >
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 id={slugify(String(children))} className="mt-10 mb-4 scroll-mt-28 font-semibold">
                {children}
              </h3>
            ),
            p: ({ children }) => <p className="mb-5">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            a: ({ href, children }) => (
              <a
                href={href}
                className="underline underline-offset-4 transition-opacity hover:opacity-70"
              >
                {children}
              </a>
            ),
            ul: ({ children }) => <ul className="mb-5 list-disc space-y-2 pl-6">{children}</ul>,
            ol: ({ children }) => <ol className="mb-5 list-decimal space-y-2 pl-6">{children}</ol>,
            hr: () => null,
            table: ({ children }) => (
              <div className="my-8 overflow-x-auto">
                <table className="w-full" style={STEP.small}>
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border-b-2 border-[var(--color-text-primary)] py-2 pr-4 text-left font-semibold">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border-b border-[var(--color-border)] py-2 pr-4 align-top">
                {children}
              </td>
            ),
            blockquote: ({ children }) => <blockquote className="my-6 pl-8">{children}</blockquote>
          }}
        >
          {page.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

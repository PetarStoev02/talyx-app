import { useEffect, useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import privacyMd from './content/privacy.md?raw'
import termsMd from './content/terms.md?raw'

const pages: Record<string, { title: string; content: string }> = {
  privacy: { title: 'Privacy Policy', content: privacyMd },
  terms: { title: 'Terms of Service', content: termsMd }
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
  const tocRef = useRef<HTMLDivElement>(null)

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
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-[var(--color-text-secondary)]">Page not found.</p>
      </div>
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
    <div className="mx-auto flex max-w-[1100px] gap-8 px-4 py-16 sm:px-6 sm:py-24">
      {/* Table of Contents — desktop sidebar */}
      {headings.length > 0 && (
        <div className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24" ref={tocRef}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Contents
            </p>
            <nav className="space-y-1">
              {headings.map((h) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  onClick={(e) => handleTocClick(e, h.id)}
                  className={`block text-[13px] leading-relaxed transition-colors ${
                    h.level === 3 ? 'pl-3' : h.level === 4 ? 'pl-6' : ''
                  } ${
                    activeId === h.id
                      ? 'text-[var(--color-text-primary)] font-medium'
                      : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  {h.text}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-[32px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[40px] mb-6">
                {children}
              </h1>
            ),
            h2: ({ children }) => {
              const text = String(children)
              const id = slugify(text)
              return (
                <h2
                  id={id}
                  className={`text-xl font-semibold mt-10 mb-4 transition-colors ${
                    activeId === id
                      ? 'text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-primary)]'
                  }`}
                >
                  {children}
                </h2>
              )
            },
            h3: ({ children }) => {
              const text = String(children)
              const id = slugify(text)
              return (
                <h3
                  id={id}
                  className="text-base font-semibold mt-6 mb-3 text-[var(--color-text-primary)]"
                >
                  {children}
                </h3>
              )
            },
            p: ({ children }) => (
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] mb-4">
                {children}
              </p>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-[var(--color-text-primary)] underline underline-offset-4 hover:text-[var(--color-text-secondary)]"
              >
                {children}
              </a>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside mb-4 space-y-1 text-sm text-[var(--color-text-secondary)]">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside mb-4 space-y-1 text-sm text-[var(--color-text-secondary)]">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-sm text-[var(--color-text-secondary)] ml-2">{children}</li>
            ),
            hr: () => <hr className="my-8 border-t border-[var(--color-border)]" />,
            table: ({ children }) => (
              <div className="overflow-x-auto my-4 rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                {children}
              </thead>
            ),
            th: ({ children }) => (
              <th className="px-4 py-2 text-left font-medium text-[var(--color-text-primary)]">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-4 py-2 text-[var(--color-text-secondary)]">{children}</td>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-[var(--color-border)] pl-4 my-4 italic text-[var(--color-text-tertiary)]">
                {children}
              </blockquote>
            )
          }}
        >
          {page.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

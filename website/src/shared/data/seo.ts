export interface PageMeta {
  title: string
  description: string
  ogTitle?: string
  ogDescription?: string
  canonical: string
  jsonLd?: object[]
}

import { DOWNLOADS, REPO_URL } from './release'

const BASE_URL = 'https://talyx.app'
const PRODUCT_IMAGE = `${BASE_URL}/og-image.png`

const brand = { '@type': 'Brand', name: 'Talyx' }

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Talyx',
  url: BASE_URL,
  logo: `${BASE_URL}/talyx-logo.svg`,
  sameAs: [REPO_URL]
}

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Talyx',
  image: PRODUCT_IMAGE,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'macOS',
  brand,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock'
  },
  isAccessibleForFree: true,
  license: 'https://opensource.org/license/mit',
  codeRepository: REPO_URL,
  description:
    'Personal AI assistant for macOS powered by your own Claude. Asks before it changes anything; file sorting defaults to on-device, with your own Claude as an optional upgrade. Free and open source.',
  downloadUrl: DOWNLOADS.appleSilicon
}

/**
 * The five objections that stop a download, answered in the order they come
 * up. Rendered on the landing page and emitted as FAQ JSON-LD, so the markup
 * and the visible page can never disagree.
 */
export const faqEntries = [
  {
    q: 'Will it move my files somewhere I can\u2019t find them?',
    a: 'When you sort files, Talyx shows the exact plan \u2014 how many files, into which folders \u2014 and nothing moves until you confirm. Watch folders and scheduled sorts you set up yourself are the exceptions: they sort on their own. Reads run without asking, and everything else the assistant changes shows a card first. Every batch is recorded, and one click puts all of it back exactly where it was. You can also choose Copy instead of Move, which leaves the originals untouched.'
  },
  {
    q: 'Do I need an AI subscription or API key?',
    a: 'No. Sorting works on first launch from filenames and metadata, with no account, no key and no download. One optional upgrade reads file contents and powers the assistant: your own Claude \u2014 your existing Anthropic API key or Claude Code subscription. Talyx never resells it and hosts no model of its own.'
  },
  {
    q: 'Does my data leave my Mac?',
    a: 'Your files don\u2019t, by default. Smart Local sorting classifies on-device and makes zero network calls. These things do use the network: the update check to GitHub (on by default; set it to manual in Settings), voice models downloaded from Hugging Face when you turn voice on, and everything Your Claude and the assistant send when you use them \u2014 to your own Anthropic account: the conversation and tool results for the assistant, the first 2000 characters of files that need reading for sorting (currency amounts, dates and company names ending in a legal suffix masked first, best-effort), and a screenshot only when you ask it to look at the screen. Talyx collects no telemetry and no analytics from the app.'
  },
  {
    q: 'Is it free?',
    a: 'Yes. Talyx is free and open source under the MIT licence; the source is on GitHub. There is no trial, licence or account.'
  },
  {
    q: 'Can it click and type for me?',
    a: 'Yes, as a last resort. When no built-in ability covers what you asked, Talyx takes a screenshot and works from that. Every click, keystroke and scroll shows a card first \u2014 even after you have approved the rest of a task \u2014 and \u2318\u21e7Esc stops it mid-way. It needs the Screen Recording and Accessibility permissions, which macOS asks for the first time.'
  },
  {
    q: 'Will it run on my Mac?',
    a: 'Talyx is macOS only, for both Apple Silicon and Intel Macs. Voice dictation and spoken replies need Apple Silicon. The app is not notarized, so macOS blocks it the first time you open it; the install steps on the download section show how to allow it.'
  }
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqEntries.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.a
    }
  }))
}

function blogArticle(headline: string, datePublished: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    datePublished,
    author: { '@type': 'Organization', name: 'Talyx' },
    publisher: { '@type': 'Organization', name: 'Talyx', logo: `${BASE_URL}/talyx-logo.svg` },
    description
  }
}

function breadcrumb(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url
    }))
  }
}

export const seoData: Record<string, PageMeta> = {
  '/': {
    title: 'Talyx — Tell your Mac what to do | Free and open source',
    description:
      'Press \u2318\u21e7Space and say it in your own words. Your own Claude plans it, shows you a card before it changes anything. Sorting runs on-device by default. Free and open source (MIT).',
    ogTitle: 'Talyx \u2014 Tell your Mac what to do',
    ogDescription:
      'One shortcut, your own Claude, approval before anything changes. Free and open source.',
    canonical: '/',
    jsonLd: [orgJsonLd, softwareJsonLd, faqJsonLd]
  },
  '/blog': {
    title: 'Blog — Talyx | Free, open-source Mac assistant',
    description:
      'News about Talyx, the free and open-source Mac assistant: the project, its own Claude-powered assistant, and what changes in each release.',
    canonical: '/blog'
  },
  '/blog/talyx-is-now-free-and-open-source': {
    title: 'Talyx is now free and open source — Talyx Blog',
    description:
      'Why Talyx is free and open source under the MIT licence from version 0.11, and what changes and what stays the same for you.',
    canonical: '/blog/talyx-is-now-free-and-open-source',
    jsonLd: [
      blogArticle(
        'Talyx is now free and open source',
        '2026-10-12',
        'Why Talyx is free and open source under the MIT licence, and what changes for you.'
      )
    ]
  },
  '/blog/meet-the-assistant': {
    title: 'Meet the Assistant — Your Own Claude Runs Your Mac',
    description:
      'Talyx 0.9.0 adds a hotkey overlay where your own Claude plans what you ask, shows a card, and acts when you approve. Files, calendar, mail, music, code — and voice.',
    canonical: '/blog/meet-the-assistant',
    jsonLd: [
      blogArticle(
        'Meet the Assistant: Your Own Claude Runs Your Mac',
        '2026-09-17',
        'What the Talyx assistant does, how the approval gate works, and why it runs on your own Claude.'
      )
    ]
  },
  '/roadmap': {
    title: 'Roadmap — Talyx | What Is Shipped and What Is Next',
    description:
      'What Talyx has shipped and what comes next. Free and open source; suggest changes with a GitHub issue.',
    canonical: '/roadmap'
  },
  '/contact': {
    title: 'Contact — Talyx | Issues, Questions and Security Reports',
    description:
      'Report a bug or ask a question in a public GitHub issue, or send a private security report. Talyx has no accounts and no support desk.',
    canonical: '/contact'
  },
  '/legal/terms': {
    title: 'Terms of Use — Talyx | MIT Licence, No Warranty',
    description:
      'Talyx is free software under the MIT licence, provided as is. What the licence lets you do, and what the website and the app do not promise.',
    canonical: '/legal/terms'
  },
  '/legal/privacy': {
    title: 'Privacy Policy — Talyx | No Accounts, No Analytics',
    description:
      'What Talyx sends and where: nothing for Smart Local sorting, your own Anthropic account for the assistant, GitHub for update checks, Hugging Face for voice models.',
    canonical: '/legal/privacy'
  },
  '/press': {
    title: 'Press Kit — Talyx | Logo, Icon and Facts',
    description:
      'Talyx press kit: logo (SVG), app icon (PNG), short and long descriptions, and key facts for covering Talyx in your publication.',
    canonical: '/press'
  },

  // Features
  '/features/ai-classification': {
    title: 'AI Classification — Talyx | Smart Local or Your Claude',
    description:
      'Sort with Smart Local on this Mac (nothing sent), or Your Claude for the whole batch when connected. Talyx is the harness — you bring the brain. No Talyx-hosted classification downloads.',
    canonical: '/features/ai-classification',
    jsonLd: [
      breadcrumb([
        { name: 'Home', url: BASE_URL },
        { name: 'Features', url: `${BASE_URL}/features/ai-classification` },
        { name: 'AI Classification', url: `${BASE_URL}/features/ai-classification` }
      ])
    ]
  },
  '/features/assistant': {
    title: 'The Assistant — Talyx | Your Own Claude Runs Your Mac',
    description:
      'Press Cmd+Shift+Space and say what you want: sort files, check your calendar, run a command, add a reminder. Your own Claude plans it, you approve any change, Talyx does it. Voice in and out.',
    canonical: '/features/assistant',
    jsonLd: [
      breadcrumb([
        { name: 'Home', url: BASE_URL },
        { name: 'Features', url: `${BASE_URL}/features/ai-classification` },
        { name: 'The Assistant', url: `${BASE_URL}/features/assistant` }
      ])
    ]
  },
  '/features/watch-folders': {
    title: 'Watch Folders — Talyx | Auto-Sort Files as They Arrive',
    description:
      'Set up watch folders that automatically sort new files the moment they appear. Talyx monitors directories and classifies incoming files in real-time.',
    canonical: '/features/watch-folders',
    jsonLd: [
      breadcrumb([
        { name: 'Home', url: BASE_URL },
        { name: 'Features', url: `${BASE_URL}/features/ai-classification` },
        { name: 'Watch Folders', url: `${BASE_URL}/features/watch-folders` }
      ])
    ]
  },
  '/features/smart-rename': {
    title: 'Smart Rename — Talyx | Harvard Naming',
    description:
      'AI-powered smart renaming following Harvard file naming conventions. Your own Claude reads your file content and suggests meaningful names. Turn scan_001.pdf into Tax-Return-2024-Q4.pdf automatically.',
    canonical: '/features/smart-rename',
    jsonLd: [
      breadcrumb([
        { name: 'Home', url: BASE_URL },
        { name: 'Features', url: `${BASE_URL}/features/ai-classification` },
        { name: 'Smart Rename', url: `${BASE_URL}/features/smart-rename` }
      ])
    ]
  },
  '/features/sort-history': {
    title: 'Sort History & Undo — Talyx | Every Move, Reversible',
    description:
      'Every file sort in Talyx is logged with full history. Undo a whole sort batch; Talyx restores what it safely can and tells you what it left. Never lose track of your files.',
    canonical: '/features/sort-history',
    jsonLd: [
      breadcrumb([
        { name: 'Home', url: BASE_URL },
        { name: 'Features', url: `${BASE_URL}/features/ai-classification` },
        { name: 'Sort History', url: `${BASE_URL}/features/sort-history` }
      ])
    ]
  },
  '/features/drag-and-drop': {
    title: 'Drag & Drop Sorting — Talyx | Drop a Folder, Sort in Seconds',
    description:
      'Simply drag and drop any folder onto Talyx to instantly classify and sort all files inside. The fastest way to organize files on your desktop.',
    canonical: '/features/drag-and-drop',
    jsonLd: [
      breadcrumb([
        { name: 'Home', url: BASE_URL },
        { name: 'Features', url: `${BASE_URL}/features/ai-classification` },
        { name: 'Drag & Drop', url: `${BASE_URL}/features/drag-and-drop` }
      ])
    ]
  },
  '/features/privacy-offline': {
    title: 'Privacy & Offline — Talyx | Files Stay on Your Mac by Default',
    description:
      'Smart sorting classifies on your machine with zero network calls. Turn on Your Claude and only files that need reading are sent to your own Claude account, with currency amounts, dates and company names ending in a legal suffix masked first, best-effort.',
    canonical: '/features/privacy-offline',
    jsonLd: [
      breadcrumb([
        { name: 'Home', url: BASE_URL },
        { name: 'Features', url: `${BASE_URL}/features/ai-classification` },
        { name: 'Privacy & Offline', url: `${BASE_URL}/features/privacy-offline` }
      ])
    ]
  },

  // Use Cases
  '/use-cases/knowledge-workers': {
    title: 'File Organizer for Knowledge Workers — Talyx',
    description:
      'Organize your Downloads folder in seconds. Sorts on-device by default, with your own Claude as an optional upgrade. Free and open source.',
    canonical: '/use-cases/knowledge-workers',
    jsonLd: [
      breadcrumb([
        { name: 'Home', url: BASE_URL },
        { name: 'Use Cases', url: `${BASE_URL}/use-cases/knowledge-workers` },
        { name: 'Knowledge Workers', url: `${BASE_URL}/use-cases/knowledge-workers` }
      ])
    ]
  },
  '/use-cases/freelancers': {
    title: 'File Organizer for Freelancers — Talyx',
    description:
      'Keep client files, project assets, and deliverables organized automatically. Smart Local sorts by file type on your Mac; grouping by client or project needs Your Claude, which reads what\u2019s inside.',
    canonical: '/use-cases/freelancers',
    jsonLd: [
      breadcrumb([
        { name: 'Home', url: BASE_URL },
        { name: 'Use Cases', url: `${BASE_URL}/use-cases/knowledge-workers` },
        { name: 'Freelancers & Creatives', url: `${BASE_URL}/use-cases/freelancers` }
      ])
    ]
  },
  '/use-cases/students': {
    title: 'File Organizer for Students — Talyx',
    description:
      'Organize research papers, lecture notes, datasets, and assignments automatically. Smart Local sorts by file type on your Mac; sorting by course and topic needs Your Claude, which reads what\u2019s inside.',
    canonical: '/use-cases/students',
    jsonLd: [
      breadcrumb([
        { name: 'Home', url: BASE_URL },
        { name: 'Use Cases', url: `${BASE_URL}/use-cases/knowledge-workers` },
        { name: 'Students & Researchers', url: `${BASE_URL}/use-cases/students` }
      ])
    ]
  },
  '/use-cases/legal': {
    title: 'Legal Document Organizer — Talyx | Sorts On-Device by Default',
    description:
      'Organize legal documents, contracts, and case files. Smart Local sorting classifies entirely on your machine, no file content leaving your device. Your Claude is a separate, optional mode. Perfect for law firms.',
    canonical: '/use-cases/legal',
    jsonLd: [
      breadcrumb([
        { name: 'Home', url: BASE_URL },
        { name: 'Use Cases', url: `${BASE_URL}/use-cases/knowledge-workers` },
        { name: 'Legal & Compliance', url: `${BASE_URL}/use-cases/legal` }
      ])
    ]
  },
  '/use-cases/medical': {
    title: 'Medical File Organizer — Talyx | Sorts On-Device by Default',
    description:
      'Organize medical records, patient files, and healthcare documents. Smart Local sorting classifies entirely on your machine, no file content leaving your device. Your Claude is a separate, optional mode — review your data policy before using it for patient records.',
    canonical: '/use-cases/medical',
    jsonLd: [
      breadcrumb([
        { name: 'Home', url: BASE_URL },
        { name: 'Use Cases', url: `${BASE_URL}/use-cases/knowledge-workers` },
        { name: 'Medical & Healthcare', url: `${BASE_URL}/use-cases/medical` }
      ])
    ]
  }
}

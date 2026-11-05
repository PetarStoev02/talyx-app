export interface PageMeta {
  title: string
  description: string
  ogTitle?: string
  ogDescription?: string
  canonical: string
  jsonLd?: object[]
}

import { features } from './navigation'
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
    a: 'When you sort files, Talyx shows the exact plan (how many files, into which folders) and nothing moves until you confirm. Watch folders and scheduled sorts you set up yourself are the exceptions: they sort on their own. Reads run without asking, and everything else the assistant changes shows a card first. Every batch is recorded, and one click puts all of it back exactly where it was. You can also choose Copy instead of Move, which leaves the originals untouched.'
  },
  {
    q: 'Do I need an AI subscription or API key?',
    a: 'No. Sorting works on first launch from filenames and metadata, with no account, no key and no download. One optional upgrade reads file contents and powers the assistant: your own Claude: your existing Anthropic API key or Claude Code subscription. Talyx never resells it and hosts no model of its own.'
  },
  {
    q: 'Does my data leave my Mac?',
    a: 'Your files don\u2019t, by default. Smart Local sorting classifies on-device and makes zero network calls. These things do use the network: the update check to GitHub (on by default; set it to manual in Settings), voice models downloaded from Hugging Face when you turn voice on, and everything Your Claude and the assistant send, when you use them, to your own Anthropic account: the conversation and tool results for the assistant, the first 2000 characters of files that need reading for sorting (currency amounts, dates and company names ending in a legal suffix masked first, best-effort), and a screenshot only when you ask it to look at the screen. Talyx collects no telemetry and no analytics from the app.'
  },
  {
    q: 'Is it free?',
    a: 'Yes. Talyx is free and open source under the MIT licence; the source is on GitHub. There is no trial, licence or account.'
  },
  {
    q: 'Can it click and type for me?',
    a: 'Yes, as a last resort. When no built-in ability covers what you asked, Talyx takes a screenshot and works from that. Every click, keystroke and scroll shows a card first, even after you have approved the rest of a task, and \u2318\u21e7Esc stops it mid-way. It needs the Screen Recording and Accessibility permissions, which macOS asks for the first time.'
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

export const seoData: Record<string, PageMeta> = {
  '/': {
    title: 'Talyx: Tell your Mac what to do | Free and open source',
    description:
      'Press \u2318\u21e7Space and say it in your own words. Your own Claude plans it, shows you a card before it changes anything. Sorting runs on-device by default. Free and open source (MIT).',
    ogTitle: 'Talyx: Tell your Mac what to do',
    ogDescription:
      'One shortcut, your own Claude, approval before anything changes. Free and open source.',
    canonical: '/',
    jsonLd: [orgJsonLd, softwareJsonLd, faqJsonLd]
  },
  '/roadmap': {
    title: 'Roadmap: Talyx | What Is Shipped and What Is Next',
    description:
      'What Talyx has shipped and what comes next. Free and open source; suggest changes with a GitHub issue.',
    canonical: '/roadmap'
  },
  '/contact': {
    title: 'Contact: Talyx | Issues, Questions and Security Reports',
    description:
      'Report a bug or ask a question in a public GitHub issue, or send a private security report. Talyx has no accounts and no support desk.',
    canonical: '/contact'
  },
  '/legal/terms': {
    title: 'Terms of Use: Talyx | MIT Licence, No Warranty',
    description:
      'Talyx is free software under the MIT licence, provided as is. What the licence lets you do, and what the website and the app do not promise.',
    canonical: '/legal/terms'
  },
  '/legal/privacy': {
    title: 'Privacy Policy: Talyx | No Accounts, No Analytics',
    description:
      'What Talyx sends and where: nothing for Smart Local sorting, your own Anthropic account for the assistant, GitHub for update checks, Hugging Face for voice models.',
    canonical: '/legal/privacy'
  },
  '/press': {
    title: 'Press Kit: Talyx | Logo, Icon and Facts',
    description:
      'Talyx press kit: logo (SVG), app icon (PNG), short and long descriptions, and key facts for covering Talyx in your publication.',
    canonical: '/press'
  },

  ...Object.fromEntries(
    features.map(({ slug, title, shortDescription }) => [
      `/features/${slug}`,
      {
        title: `${title}: Talyx`,
        description: shortDescription,
        canonical: `/features/${slug}`
      }
    ])
  )
}

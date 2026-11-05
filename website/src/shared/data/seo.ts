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
 * The objections that stop a download, answered in the order they come up. Rendered on the
 * landing page and emitted as FAQ JSON-LD, so the markup and the visible page can never disagree.
 */
export const faqEntries = [
  {
    q: 'What is the engine?',
    a: 'The engine is the agent backend your bots run on. It runs on your computer, separate from the app, and Talyx\u2019s first-run setup installs it for your user only, with no admin password. Talyx is the window onto it.'
  },
  {
    q: 'Do I need an account or an API key?',
    a: 'You need no Talyx account. Your bots need a model, so setup asks for one: an API key, a sign-in with an account you already have, or a custom endpoint.'
  },
  {
    q: 'Which model providers work?',
    a: 'Any provider the engine supports. In Settings, add each one with an API key, by signing in with your account, or as a custom endpoint with its base URL. Each bot then picks its model from what you added.'
  },
  {
    q: 'Is it free?',
    a: 'Yes. Talyx is free and open source under the MIT licence, with no account and no card. Your model provider bills you for what your bots use, if it charges.'
  },
  {
    q: 'Can Talyx see my chats?',
    a: 'No. Talyx has no server, so your chats never reach us. They pass between the app and the engine on your computer, and each bot sends them on to the model provider you chose, under that provider\u2019s terms.'
  },
  {
    q: 'Which computers does it run on?',
    a: 'Macs with macOS 13 or newer, Apple Silicon or Intel, and Linux x64, as an AppImage or a deb. Windows comes later.'
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

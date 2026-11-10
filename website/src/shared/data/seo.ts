export interface PageMeta {
  title: string
  description: string
  ogTitle?: string
  ogDescription?: string
  canonical: string
  jsonLd?: object[]
}

import { MIN_MACOS } from './offer'
import { features, type FeatureSlug } from './navigation'
import { APP_VERSION, REPO_URL } from './release'

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
  applicationCategory: 'DeveloperApplication',
  operatingSystem: `${MIN_MACOS} or later, Linux`,
  softwareVersion: APP_VERSION,
  brand,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock'
  },
  isAccessibleForFree: true,
  license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  codeRepository: REPO_URL,
  description:
    'A free, open-source desktop app for your AI bots: one roster, one chat, and a manager bot that hands work to the other bots and briefs you. The bots run on the engine, which first-run setup installs.',
  downloadUrl: `${REPO_URL}/releases/latest`
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
    a: 'Yes. Talyx is free and open source under the AGPL-3.0 licence, with no account and no card. Your model provider bills you for what your bots use, if it charges.'
  },
  {
    q: 'Can Talyx see my chats?',
    a: 'No. Talyx has no server, so your chats never reach us. They pass between the app and the engine on your computer, and each bot sends them on to the model provider you chose, under that provider\u2019s terms. A bot\u2019s tools, like web search or a command it runs, can reach other services too.'
  },
  {
    q: 'Which computers does it run on?',
    a: `Macs with ${MIN_MACOS} or newer, Apple Silicon or Intel, and Linux x64, as an AppImage or a deb. Windows comes later.`
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

const featureMeta: Record<FeatureSlug, Pick<PageMeta, 'title' | 'description'>> = {
  roster: {
    title: 'Roster: Talyx | Every Bot in One List',
    description:
      'Pin the bots you use most, file the rest in folders, and see which are working, waiting on you or have a reply you have not read.'
  },
  manager: {
    title: 'Manager Bot: Talyx | Hands Out the Work, Then Briefs You',
    description:
      'Ask Talyx for something and it passes the work to the bot that fits, reads the reply and sums it up for you.'
  },
  rooms: {
    title: 'Group Rooms: Talyx | Two to Six Bots in One Chat',
    description:
      'Write once and each bot in the room answers in turn, while Talyx shows who is answering now and who is next. The engine hosts the room.'
  },
  routines: {
    title: 'Routines: Talyx | Scheduled Jobs for Your Bots',
    description:
      'A routine is an instruction a bot carries out on a schedule, such as a report every Monday morning. The engine runs it, even with Talyx closed.'
  },
  'bot-details': {
    title: 'Bot Details: Talyx | Title, Model, Look and SOUL',
    description:
      'Open a bot\u2019s name to set its title, description and model, choose its look and write its SOUL, all in one panel.'
  },
  'models-and-keys': {
    title: 'Models and Keys: Talyx | Bring Your Own Provider',
    description:
      'Talyx runs no model of its own. Add a provider with an API key, an account sign-in or a custom endpoint, and every bot can use it.'
  },
  privacy: {
    title: 'Privacy: Talyx | No Account, No Server, No Telemetry in the App',
    description:
      'Chats pass from Talyx to the engine on your computer, then to the model provider each bot uses and any service its tools reach. Talyx has no server and no telemetry.'
  }
}

const breadcrumb = (title: string, path: string) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Talyx', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: title, item: `${BASE_URL}${path}` }
  ]
})

export const seoData: Record<string, PageMeta> = {
  '/': {
    title: 'Talyx: Your bots, in one place | Free and open source',
    description:
      'Talyx is a free desktop app for your AI bots, on macOS and Linux. One roster, one chat, and a manager bot that hands out the work and briefs you.',
    ogTitle: 'Talyx: Your bots, in one place',
    ogDescription:
      'A free, open-source desktop app: one roster, one chat, and a manager bot that briefs you. macOS and Linux.',
    canonical: '/',
    jsonLd: [orgJsonLd, softwareJsonLd, faqJsonLd]
  },
  '/roadmap': {
    title: 'Roadmap: Talyx | What 1.0 Ships and What Comes Next',
    description:
      'What Talyx 1.0 ships and what comes next. Free and open source; suggest a change with a GitHub issue.',
    canonical: '/roadmap'
  },
  '/contact': {
    title: 'Contact: Talyx | Issues, Questions and Security Reports',
    description:
      'Report a bug or share an idea in a public GitHub issue, or send a private security report. Talyx has no accounts and no support desk.',
    canonical: '/contact'
  },
  '/legal/terms': {
    title: 'Terms of Use: Talyx | AGPL-3.0 Licence, No Warranty',
    description:
      'Talyx is free software under the AGPL-3.0 licence, provided as is. What the licence lets you do, and what the website and the app do not promise.',
    canonical: '/legal/terms'
  },
  '/legal/refund': {
    title: 'Refund Policy: Talyx | 30-Day Refunds on Modules',
    description:
      'Talyx modules are sold through Paddle.com, our Merchant of Record. Ask within 30 days of purchase for a full refund, no reason needed.',
    canonical: '/legal/refund'
  },
  '/pricing': {
    title: 'Pricing: Talyx | Free App, One-Time Modules',
    description:
      'Talyx is free and open source. Modules are a one-time purchase: Workflows $47, Talyx Pro with every module $92, with every later update included.',
    canonical: '/pricing'
  },
  '/legal/privacy': {
    title: 'Privacy Policy: Talyx | No Server, No Telemetry in the App',
    description:
      'The app collects nothing and has no server. Bots send what they need to the model provider you chose and to the services their tools use, and this website counts page views without cookies.',
    canonical: '/legal/privacy'
  },
  '/press': {
    title: 'Press Kit: Talyx | Logo, Screenshots and Facts',
    description:
      'The Talyx 1.0 press kit: logo (SVG), app icon (PNG), screenshots, short and long descriptions, and key facts for writing about Talyx.',
    canonical: '/press'
  },

  ...Object.fromEntries(
    features.map(({ slug, title: name }) => {
      const path = `/features/${slug}`
      const { title, description } = featureMeta[slug]
      return [path, { title, description, canonical: path, jsonLd: [breadcrumb(name, path)] }]
    })
  )
}

/**
 * What Talyx would show for a request, matched locally by keyword. Sample
 * plans in the shape of the real approval card: a change waits for Approve,
 * a read runs straight away. Nothing here calls a model.
 */
import { ABILITY_COUNT } from './offer'
import type { Plan } from './plan'

const FOUND: Plan = {
  summary: 'Found 3 files. Reads run without asking.',
  steps: [
    'Invoice-Hetzner-2026-09.pdf · Documents/Invoices',
    'Invoice-Hetzner-2026-08.pdf · Documents/Invoices',
    'hetzner-receipt.eml · Mail, 2 Sep'
  ],
  needsApproval: false
}

// First match wins. Words match from their start, so "sorting" still sorts but "unsorted" does not.
const RULES: { match: RegExp; plan: Plan }[] = [
  // A request that opens by asking for something is a read, whatever folder it names.
  { match: /^\s*(find|where|search|look for|recall)\b/i, plan: FOUND },
  {
    match: /\b(sort|download|tidy|clean|organi[sz]e|desktop)/i,
    plan: {
      summary: 'Sort 47 files in Downloads into 6 folders',
      steps: [
        '12 invoices → Documents/Invoices',
        '21 screenshots → Images/Screenshots',
        '14 installers → Archives/Installers'
      ],
      needsApproval: true
    }
  },
  {
    match: /\b(calendar|dentist|meeting at|book\b|schedule|remind)/i,
    plan: {
      summary: 'Add “Dentist” to your Calendar',
      steps: ['Tomorrow, 16:00 to 17:00', 'Calendar: Personal', 'Alert 30 minutes before'],
      needsApproval: true
    }
  },
  {
    match: /\b(reply|send|mail|email|inbox)/i,
    plan: {
      summary: 'Reply to Maya in Mail',
      steps: ['To: Maya Petrova', 'Subject: Re: Thursday review', '“Thursday at 10 works for me.”'],
      needsApproval: true
    }
  },
  { match: /\b(find|where|invoice|search|recall)/i, plan: FOUND },
  {
    match: /\b(quiet|focus|silence|do not disturb|mute)/i,
    plan: {
      summary: 'Quiet your Mac until 15:45',
      steps: [
        'Turn on Focus: Work',
        'Hold Talyx notices',
        'Open the 3 files linked to the meeting'
      ],
      needsApproval: true
    }
  },
  {
    match: /\b(click|screen|button|open|type)\b/i,
    plan: {
      summary: 'Use the screen: no ability fits',
      steps: ['Look at the front window', 'Click “Export as PDF”', 'Each click gets its own card'],
      needsApproval: true
    }
  }
]

const FALLBACK: Plan = {
  summary: `Pick one of ${ABILITY_COUNT} abilities for this`,
  steps: [
    'Plan it with your own Claude',
    'Show the exact change on a card',
    'Run only after you approve'
  ],
  needsApproval: true
}

export const EXAMPLE_ASKS = [
  'sort my Downloads',
  'find the Hetzner invoice',
  'quiet everything for my 3pm'
]

export function planFor(ask: string): Plan {
  return RULES.find(({ match }) => match.test(ask))?.plan ?? FALLBACK
}

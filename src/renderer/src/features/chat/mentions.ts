/**
 * A room member as you @ it: the engine routes by handle (a profile id like `bot-2`), you read
 * and write the name the roster shows.
 */
export interface Mention {
  handle: string
  name: string
}

// A mention ends where a name could not go on: not before a letter, digit, `_`, `-` or `/`. It
// starts after none of those but `-`, so an address (`mail@x`) or a link (`x.com/@y`) stays as is.
const END = '(?![\\p{L}\\p{N}_/-])'
const START = '(?<![\\p{L}\\p{N}_/])@'

/** Room text as you read it: each member's `@handle` shows as `@name`. */
export function showMentions(text: string, mentions: Mention[]): string {
  return replaceAll(text, mentions, (mention) => [mention.handle, mention.name])
}

/** Room text as the engine routes it: each member's `@name` goes back to `@handle`. */
export function sendMentions(text: string, mentions: Mention[]): string {
  return replaceAll(text, mentions, (mention) => [mention.name, mention.handle])
}

function replaceAll(
  text: string,
  mentions: Mention[],
  direction: (mention: Mention) => [string, string]
): string {
  const pairs = unambiguous(mentions)
    .map(direction)
    .filter(([from]) => from)
  if (!pairs.length || !text.includes('@')) return text
  // Longest first, so `@Ops Lead` wins over `@Ops`.
  pairs.sort(([a], [b]) => b.length - a.length)
  const to = new Map(pairs.map(([from, into]) => [from.toLowerCase(), into]))
  const pattern = new RegExp(
    `${START}(${pairs.map(([from]) => escape(from)).join('|')})${END}`,
    'giu'
  )
  return text.replace(pattern, (_match, from: string) => `@${to.get(from.toLowerCase()) ?? from}`)
}

// A member whose name another member also goes by (as a name or a handle) keeps its handle both
// ways: `@Alex` cannot say which of two Alexes you mean.
function unambiguous(mentions: Mention[]): Mention[] {
  const count = new Map<string, number>()
  for (const { handle, name } of mentions)
    for (const key of new Set([handle.toLowerCase(), name.toLowerCase()]))
      count.set(key, (count.get(key) ?? 0) + 1)
  return mentions.filter(({ name }) => count.get(name.toLowerCase()) === 1)
}

function escape(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

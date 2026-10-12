import type {
  MessageCapabilityDeps,
  Recipient
} from '../../domain/instruction/capabilities/messages'
import { runJxa } from './appleScript'

/**
 * Spaces, dashes and brackets are how people write phone numbers; Messages wants
 * them gone. Never applied to an email address — a dot is part of the address,
 * and stripping it sends the message to a different person.
 */
const PHONE_NOISE = /[\s\-()]/g

export function normalizeHandle(handle: string): string {
  return handle.includes('@') ? handle.trim() : handle.replace(PHONE_NOISE, '')
}

/**
 * One handle per person, not one per phone number — otherwise a contact with a
 * mobile, a landline and an email reads as three people and every send stalls
 * on "which one?".
 */
const RESOLVE_RECIPIENT = `
function run(argv) {
  const query = argv[0]
  const clean = (s) => (s.indexOf('@') >= 0 ? s.trim() : s.replace(/[\\s\\-()]/g, ''))
  if (/@/.test(query) || /^\\+?[0-9][0-9\\s\\-()]*$/.test(query)) {
    return JSON.stringify([{ handle: clean(query), display: query.trim() }])
  }
  const app = Application('Contacts')
  const people = app.people.whose({ name: { _contains: query } })()
  const out = []
  for (let i = 0; i < people.length; i++) {
    const person = people[i]
    const phones = person.phones()
    let handle = null
    for (let j = 0; j < phones.length && !handle; j++) {
      if (/mobile|iphone/i.test(phones[j].label() || '')) handle = clean(phones[j].value())
    }
    if (!handle && phones.length > 0) handle = clean(phones[0].value())
    if (!handle) {
      const emails = person.emails()
      if (emails.length > 0) handle = emails[0].value()
    }
    if (handle) out.push({ handle: handle, display: person.name() })
  }
  return JSON.stringify(out)
}`

/**
 * macOS 27 Messages has no `buddy` and no `service` — those raise "Message not
 * understood". It is accounts and participants now, and a participant must be
 * named, not looked up by id: `byId` only finds someone already in a thread, so
 * a first message to a new number answers "Can't get object (-1728)".
 *
 * Addressed to the iMessage account only: Talyx never picks the SMS account,
 * which is charged by the carrier and which the approval card cannot warn about
 * before the send happens. That is as far as the guarantee goes — Messages' own
 * "Send as SMS when iMessage is unavailable" setting is the owner's, not ours.
 *
 * Delivery is asynchronous. `send` returning means Messages accepted the text,
 * not that it arrived; an unreachable handle fails later, in Messages' own UI.
 */
const SEND_MESSAGE = `
function run(argv) {
  const handle = argv[0]; const text = argv[1]
  const app = Application('Messages')
  const accounts = app.accounts()
  let imessage = null
  for (let i = 0; i < accounts.length && !imessage; i++) {
    try {
      if (accounts[i].enabled() && String(accounts[i].serviceType()) === 'iMessage') {
        imessage = accounts[i]
      }
    } catch (e) {
      // Not every account answers serviceType; those are never the one.
    }
  }
  if (!imessage) throw new Error('Messages has no iMessage account signed in')
  try {
    app.send(text, { to: imessage.participants.byName(handle) })
  } catch (e) {
    throw new Error('Messages refused to send to ' + handle + ': ' + e.message)
  }
  return JSON.stringify({ ok: true })
}`

export function messagesDeps(): MessageCapabilityDeps {
  return {
    resolveRecipient: (query) => runJxa<Recipient[]>(RESOLVE_RECIPIENT, [query]),
    async sendMessage({ handle, text }) {
      await runJxa(SEND_MESSAGE, [normalizeHandle(handle), text])
    }
  }
}

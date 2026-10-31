import type { Bot, Group } from './model'

const TOKEN_PLACEHOLDER = '<TALYX_TOKEN>'

/** The block a bot owner pastes into the bot's setup so it reports to Talyx. Never holds the token. */
export function botInstructions(input: { bot: Bot; groups: Group[]; eventsUrl: string }): string {
  const { bot, eventsUrl } = input
  const groups = input.groups.filter((g) => bot.groupIds.includes(g.id))
  const event = (body: Record<string, string>): string => JSON.stringify({ bot: bot.id, ...body })
  const curl = (body: Record<string, string>): string =>
    [
      `curl -X POST '${eventsUrl}' \\`,
      `  -H 'Authorization: Bearer ${TOKEN_PLACEHOLDER}' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -d '${event(body)}'`
    ].join('\n')

  return [
    `Talyx Office reporting for ${bot.name} (bot id: ${bot.id})`,
    '',
    `POST each event as JSON to ${eventsUrl}`,
    `Send the token in the header: Authorization: Bearer ${TOKEN_PLACEHOLDER}`,
    `${TOKEN_PLACEHOLDER} stands for the Talyx token: the owner gives it to you separately.`,
    `Every event carries "bot": "${bot.id}".`,
    '',
    'When to POST:',
    groups.length > 0
      ? `- You join or speak in a group chat: kind "chat" with "group" set to one of ${groups
          .map((g) => `"${g.id}" (${g.name})`)
          .join(', ')}, and the "text" you said.`
      : '- Group chat: this bot is not in any group yet, so send no chat events.',
    '- You start a task: kind "task" with the "task"; add "t3ThreadId" when it is T3 work.',
    '- You finish: kind "idle".',
    '- A routine run that carried a "runId" finishes: kind "result" with that "runId" and the "text".',
    '',
    'Examples:',
    curl({ kind: 'chat', group: groups[0]?.id ?? '<group id>', text: 'Morning, team' }),
    '',
    curl({ kind: 'task', task: 'Draft the pricing page', t3ThreadId: '<t3 thread id or omit>' }),
    '',
    curl({ kind: 'idle' }),
    '',
    curl({ kind: 'result', runId: '<runId you were given>', text: 'Pricing page drafted' })
  ].join('\n')
}

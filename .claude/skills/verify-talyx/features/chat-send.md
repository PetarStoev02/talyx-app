# Send a message

With a bot selected, a user types in the composer and sends. The message shows in the transcript
at once, the bot's reply streams in below it, and the roster row shows the bot working, then an
unread or ready mark. The engine runs the turn; Talyx shows it.

## Sub-features

- `send-type` types into the composer (`Message <bot name>`), Enter sends, Shift+Enter is a new line.
- `send-show` shows the sent message in the transcript before the reply arrives.
- `send-reply` streams the reply; `Stop` is available while it runs.
- `send-queue` queues a message typed while the bot is still answering.
- `send-no-provider` shows `chat.noProvider` guidance with `Open Settings` when no provider is set.
- `send-bot-traffic` keeps bot-to-bot traffic out of the conversation: another bot's message shows
  as `{name} sent a message`, a worker's answer to it as `Reply to {name}` or `Note after a
background task`, and a Workflows stop as `Workflows asked to stop {task}`, each a line that
  opens on click. In Talyx's own chat its answers stay bubbles. The roster fixture's Researcher
  chat shows all four (`npx vite --config tests/fixtures/roster/vite.config.ts`).

## How to get to it (user POV)

- Select a bot in the roster, then type in the composer at the bottom of the chat and press Enter
  or choose `Send`.
- Press `Meta+L` (go to the message box) from anywhere in the chat.

## Driving it with control-talyx

Preconditions:

- Launch with `control-talyx launch --real-engine`. A scratch bot `Verify scratch` on
  `claude-haiku-4-5` exists (see create-bot) and a provider for it is configured.
- The scratch bot is selected: run `control-talyx browser click --role button --name "Verify scratch"`.

- **Type.** Run `control-talyx browser fill --role textbox --name "Message Verify scratch" --value "Reply with the single word pong."`. The `Send` button is enabled.
- **Send.** Choose `Send`. Run `control-talyx browser click --role button --name "Send" --exact`. The composer empties and `Send` is disabled. While the bot answers the snapshot has `status: Verify scratch is typing` and `button "Stop"`.
- **Reply.** Snapshot until `status: Verify scratch replied` shows. The transcript is an unnamed `list` in `region "Chat with Verify scratch"`: one `listitem` with `paragraph: Reply with the single word pong.`, one with `paragraph: pong`, and a last `listitem` holding the button `Regenerate` (its accessible name starts `Regenerate: answer again`).
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/chat-send/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/chat-send/after.png`. Second view: select another bot without typing, then `Verify scratch` again; the transcript still shows both, and the roster row reads `Verify scratch just now pong`.
- **Cleanup.** Delete the scratch bot as in create-bot. Keep the evidence.

## Gotchas

- Proven 2026-11-18 against the real engine on an approved scratch bot (`claude-haiku-4-5`).
- The first message in a new bot's empty chat showed only with the reply: 1.5 s after `Send` the
  empty state was still on screen, about 12 s later both rows were there. In a chat with messages
  the sent text showed at once. Wait for the reply before asserting `send-show` on a first message.
- After the first turn the composer's model button reads the bot's model
  (`Model: claude-haiku-4-5-20251001`) instead of `Model: Bot’s model`.
- A real send costs real tokens on the user's provider. Only on an approved scratch bot, one short
  message.
- Never send to the user's existing bots; their chats are real conversations.
- `fill` sets the value in one go; it does not prove `send-queue`. For the queue, send twice
  quickly and assert the second shows as queued.

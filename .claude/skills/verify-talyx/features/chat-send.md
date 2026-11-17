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

## How to get to it (user POV)

- Select a bot in the roster, then type in the composer at the bottom of the chat and press Enter
  or choose `Send`.
- Press `Meta+L` (go to the message box) from anywhere in the chat.

## Driving it with control-talyx

Preconditions:

- Launch with `control-talyx launch` (real engine). A scratch bot `Verify scratch` on
  `claude-haiku-4-5` exists (see create-bot) and a provider for it is configured.
- The scratch bot is selected: run `control-talyx browser click --role button --name "Verify scratch"`.

- **Type.** Run `control-talyx browser fill --role textbox --name "Message Verify scratch" --value "Reply with the single word pong."`. The `Send` button is enabled.
- **Send.** Choose `Send`. Run `control-talyx browser click --role button --name "Send" --exact`. The transcript shows the sent text; the composer is empty.
- **Reply.** Run `control-talyx browser wait --role button --name "Send" --timeout 60000` after `Stop` disappears, or snapshot until the transcript shows a reply containing `pong`.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/chat-send/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/chat-send/after.png`. The snapshot has the sent text and the reply. Second view: reselect another bot, then `Verify scratch` again; the transcript still shows both.
- **Cleanup.** Delete the scratch bot as in create-bot. Keep the evidence.

## Gotchas

- Unverified by this skill so far: written from the code (2026-11-17), not from a run. The exact
  roles of the transcript rows are to be read from a snapshot first.
- A real send costs real tokens on the user's provider. Only on an approved scratch bot, one short
  message.
- Never send to the user's existing bots; their chats are real conversations.
- `fill` sets the value in one go; it does not prove `send-queue`. For the queue, send twice
  quickly and assert the second shows as queued.

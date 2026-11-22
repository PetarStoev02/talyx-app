# Chat interface inside an answer

While a bot answers in its own chat, it can draw a small interface in the transcript: stats, a chart, a table, buttons, choices, or a short form. Buttons send your next message; answered cards stay in the transcript and show your answer: `Your answer: {choice}`. Charts offer `Show numbers` with a table of values. Choice fields use `Choose` in a long dropdown.

## Sub-features

- `surface-buttons` shows pill buttons; a primary button sends on click.
- `surface-form` shows text fields and choice pickers; the click message lists each filled input.
- `surface-chart` draws bar, line, area or pie charts with an accessible summary on the SVG.
- `surface-answered` greys out controls and shows `Your answer: {choice}` after you send.

## How to get to it (user POV)

- Select a bot and ask it to use its interface tool for a simple choice or form. The card appears at the end of the transcript while the bot is still answering.
- After you click or send, your message appears below and the card stays as a record.

## Driving it with control-talyx

Preconditions:

- Engine-backed. Launch with `control-talyx launch` (real engine). The scratch bot `Verify scratch` exists (see create-bot) and is selected: `control-talyx browser click --role button --name "Verify scratch"`.
- With `--no-engine` nothing here can be reached: no bot, no transcript.

- **Ask for a two-button pick.** Run `control-talyx browser fill --role textbox --name "Message Verify scratch" --value "Use your show_ui tool to ask me to pick Red or Blue with two buttons."`, then `control-talyx browser click --role button --name "Send" --exact`. Within about 60 s a card with two buttons appears in the transcript.
- **Pick an answer.** Read the snapshot and click a button named `Red` or `Blue` as the bot drew them. Your message shows that label and the card shows `Your answer: {choice}`.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/chat-interface/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/chat-interface/after.png`. The transcript still shows the card and your answer beneath it.

## Gotchas

- Real engine only, on the approved scratch bot `Verify scratch`. Never trigger interfaces in the user's bots or rooms. Each turn costs real tokens.
- Button and choice labels come from the bot, not i18n handles: read them from a snapshot.
- While the bot is still answering, the composer may show `Stop`; the card still accepts clicks unless you already answered it.
- Written from the code (2026-11-22); confirm roles from a snapshot.

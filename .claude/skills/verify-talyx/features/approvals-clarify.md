# Approvals and clarify cards

While a bot works, it can stop and ask before it goes on. An approval card reads "<bot> wants to run this", shows the command (and the engine's description when there is one), and offers the engine's answers in order: Deny, Allow once (the main button), Allow in this chat, Always allow. Only the answers that request allows are shown. A clarify card shows one question per page. The bot's choices are pills you press (one, or several when the question allows more than one). A question with no choices gets a text box instead. Next moves to the next question, Back goes to the previous one, and Send on the last page sends every answer. While a card waits, the chat says "<bot> is waiting for your answer." and the card goes away once answered. In a group room, a member's approval offers only Deny and Allow once.

## Sub-features

- `approval-show` shows the region named `<bot> wants to run this`, with the command in a code block and an optional description.
- `approval-answer` sends deny, once, session or always to the engine and removes the card from the transcript.
- `approval-room` is the room version of the card: only `Deny` and `Allow once`, sent as the room's approve call.
- `clarify-pick` presses a choice pill (it shows as `[pressed]`). In a multi-select question each pill toggles.
- `clarify-type` is a question with no choices: a text box named by the question, and Enter moves on.
- `clarify-pages` gives several questions `Back`, `Next` and an image named `Question 1 of 2`. `Send` on the last page locks each answer in order.
- `clarify-error` shows a toast "Your answer did not reach the bot. Answer the card again." when sending fails.

## How to get to it (user POV)

- Select a bot and ask it for something it must ask about or get approved first. The card shows at the end of the transcript, below the queued messages.
- In a room, a member's approval shows as a task card in the room.

## Driving it with control-talyx

Preconditions:

- Engine-backed. Launch with `control-talyx launch --real-engine`. The scratch bot `Verify scratch` exists (see create-bot) and is selected: `control-talyx browser click --role button --name "Verify scratch"`.
- In an isolated run nothing here can be reached: no bot, no transcript.

- **Ask for a clarify.** Run `control-talyx browser fill --role textbox --name "Message Verify scratch" --value "Use your clarify tool to ask me one question with the two choices Red and Blue."`, then `control-talyx browser click --role button --name "Send" --exact`. Within about 60 s a region named after the question shows, with two choice buttons and a disabled `Send`.
- **Pick and send.** Read the snapshot, then click the first choice pill by the name the snapshot prints (that text comes from the bot, so it has no i18n handle). It shows `[pressed]` and `Send` turns enabled. Run `control-talyx browser click --role button --name "Send" --exact`. The card is gone and the bot's reply names the choice.
- **Ask for an approval.** Run `control-talyx browser fill --role textbox --name "Message Verify scratch" --value "Run the shell command curl -fsS https://example.com and tell me the first line."`, send it, then `control-talyx browser wait --role region --name "Verify scratch wants to run this" --timeout 60000`. The region shows the command and the buttons `Deny`, `Allow once`, `Allow in this chat`, `Always allow` (or the subset the request allows).
- **Deny.** Run `control-talyx browser click --role button --name "Deny" --exact`. The card is gone and the bot reports that the command was denied.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/approvals-clarify/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/approvals-clarify/after.png`. The snapshot has no region named `Verify scratch wants to run this`. Second view: select another bot, come back to `Verify scratch`, and check that no card comes back.
- **Cleanup.** Delete the scratch bot as in create-bot. Keep the evidence.

## Gotchas

- Real engine only, and only on the approved scratch bot `Verify scratch`. Never trigger or answer cards in the user's bots or rooms. Each turn costs real tokens.
- Always answer approvals with `Deny` in a run. Never click `Always allow`: it changes the engine's allowlist past this run.
- An approval shows only when the engine's approval mode flags the command. If no card shows after 60 s, report `approval-show` as unreachable with that mode as the unmet precondition, and do not loosen the check. The probe command is harmless if the engine runs it without asking.
- Name not from i18n: the clarify region, its text box and its choice pills are named by the bot's question and choices (`ClarifyCard.tsx`). Read those names from a snapshot.
- Name not from i18n: the command and description in an approval card are engine text, not a control.
- Both cards are a `section` with `aria-labelledby`, so they should show as role `region`. Confirm that in a snapshot.
- While a card waits, the turn is still running, so with an empty composer the composer shows `Stop` and no Send button. The only `Send` is the card's. With a draft in the composer there is also `Send after this answer`, so keep `--exact`.
- Written from the code (2026-11-18); confirm roles from a snapshot.

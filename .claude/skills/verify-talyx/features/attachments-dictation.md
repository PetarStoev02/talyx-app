# Attachments and dictation

The composer under a bot's chat has a `+` button, `Add images or files`, and a microphone button, `Dictate`. Images (picked, pasted or dropped anywhere on the chat) upload with the message. Any other file or folder becomes a chip that carries its path on this computer, and the path joins the message text when it is sent. A file with no path of its own, such as a web download or a Mail attachment, is saved as a copy Talyx keeps (up to 50 MB) and goes by that copy's path. A file over that limit shows "Could not attach {name}." with "It is over 50 MB. Save it to a folder on this computer, then add it from there." Each chip has a `Remove {name}` button. The first press of `Dictate` starts recording and the button becomes `Stop dictating` (pressed). The second press sends the audio to be transcribed (`Transcribing…`) and the words are added to the draft. If the microphone is blocked, the toast reads "Talyx cannot use the microphone. Allow it for Talyx in your system settings, then try again." With no speech-to-text provider, the toast reads "Dictation needs a speech-to-text provider. Add an OpenAI, Groq, Mistral or ElevenLabs key in Settings → Providers." with an `Open Settings` action.

## Sub-features

- `attach-pick` opens the system file picker from `Add images or files` (it allows more than one file).
- `attach-drop-paste` attaches files dropped anywhere on the chat area or pasted into the message box. Dragged text and links still go into the text field.
- `attach-image` uploads an image to the engine, and the chip shows the file name.
- `attach-path` adds a chip for a file or folder on disk. Its path joins the sent text, one line each.
- `attach-keep` runs `files:keep`: a file with no path is copied to `userData/attachments/<uuid>/<name>`, at most 50 MB.
- `attach-remove` uses `Remove {name}` to take a chip off the draft.
- `attach-again` puts an answered message that had images back into the composer through `Attach again`.
- `dictate-toggle` cycles `Dictate`, then `Stop dictating` (pressed), then `Transcribing…` (disabled), then `Dictate` again.
- `dictate-errors` shows the denied-microphone, no-provider and failed ("Dictation did not work. Try again, or type your message.") toasts.

## How to get to it (user POV)

- Select a bot in the roster. The composer sits at the bottom of the chat. Choose `+` or the microphone, or drag files onto the chat.
- A room's composer (`Message the room · @ to address one bot`) has the same two buttons.

## Driving it with control-talyx

Preconditions:

- This feature needs the real engine. In an isolated run the Agents page shows the engine gate and there is no composer.
- Launch with `control-talyx launch --real-engine`. The scratch bot `Verify scratch` exists (see create-bot). Create nothing else.
- Select it with `control-talyx browser click --role button --name "Verify scratch"`.

- **Composer shows.** Run `control-talyx browser wait --role textbox --name "Message Verify scratch"`. The snapshot has `button "Add images or files"`, `button "Dictate"` and `button "Send"` (disabled).
- **Start dictating (only with the user's approval: it uses the real microphone).** Run `control-talyx browser click --role button --name "Dictate" --exact`. Expect `button "Stop dictating" [pressed]`. If the microphone is denied, expect the micDenied toast text instead.
- **Stop.** Run `control-talyx browser click --role button --name "Stop dictating"`. The button reads `Transcribing…`, then `Dictate` again. Then one of three things happens: the words appear in the textbox, nothing changes (the recording was silent), or the no-provider toast appears with `Open Settings`.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/attachments-dictation/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/attachments-dictation/after.png`.
- **Cleanup.** Clear the draft: run `control-talyx browser click --role textbox --name "Message Verify scratch"`, then `control-talyx browser press --key Meta+A` and `control-talyx browser press --key Backspace`. Never send it. Delete the scratch bot as in create-bot unless another recipe still needs it.

## Gotchas

- Attaching cannot be driven. `Add images or files` opens the native open panel, which CDP cannot drive. control-talyx has no command to drop files, upload them or paste a clipboard file. Report `attach-pick`, `attach-drop-paste`, `attach-image`, `attach-path`, `attach-keep` and `attach-remove` as not drivable, and leave them to unit tests (`sortAttachments`, `keepFile`).
- The chip's `Remove {name}` button has no fixed name to drive: the name comes from the file, and a path chip uses the full path. To check that it renders, read the chip in a snapshot.
- macOS may show its own microphone prompt (TCC) the first time this dev Electron records. CDP cannot answer it. Electron itself grants only audio `media` (webContentsGuard).
- Dictation records whatever the real microphone hears, and transcribing calls the bot's speech-to-text provider over the network. That costs money and needs network access.
- `Dictate` needs `--exact` as a habit. `Stop dictating` does not contain it, but keep the name exact.
- Sonner toasts are not buttons or headings. Assert their text in the snapshot rather than with `wait`.
- Never attach to or dictate into the user's own bots or rooms. Use only `Verify scratch`, and never send.
- Written from the code (2026-11-18); confirm roles from a snapshot.

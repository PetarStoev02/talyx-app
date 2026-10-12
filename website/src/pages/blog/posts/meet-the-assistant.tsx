export function MeetTheAssistant() {
  return (
    <>
      <p>
        <em>
          Updated 2026-09-18: Talyx now also offers optional AI sorting with your own Claude.
          Sorting is on-device by default; see the <a href="/legal/privacy">privacy policy</a> for
          what is sent when you turn that on.
        </em>
      </p>

      <p>
        Talyx started as a file organizer. Version 0.9.0 makes it something else: a personal
        assistant that lives behind one shortcut and runs on the Claude you already pay for. Press
        Cmd+Shift+Space anywhere on your Mac, say what you want, read the card, approve. Sorting
        files is now one of about twenty things it can do.
      </p>

      <h2>Your own Claude, not ours</h2>

      <p>
        There is no Talyx account and no Talyx AI bill. In Settings you pick one of two brains:
        paste an Anthropic API key, or point Talyx at the Claude Code that is already signed in on
        your Mac and run on your subscription. Either way the conversation goes straight from your
        Mac to Anthropic under your own terms with them. Talyx has no server in that path and never
        sees what you ask.
      </p>

      <p>
        A model picker sits inside the input. On Claude Code it lists whatever your subscription can
        run — Opus, Sonnet, Haiku, and newer models as they appear — because Talyx asks the binary
        instead of guessing. Switch mid-conversation; the next reply uses the new model and the
        transcript stays.
      </p>

      <h2>What it can do today</h2>

      <ul>
        <li>
          <strong>Files:</strong> sort a folder by what is inside it, find duplicates, search inside
          documents, find a file by name, open what you worked on recently, convert HEIC and PNG to
          JPG or PDF, and see what is eating your disk.
        </li>
        <li>
          <strong>Your day:</strong> what is on the calendar today or tomorrow, add a reminder, save
          a note, read unread mail, play or skip music, toggle dark mode, Wi-Fi or mute, set the
          volume.
        </li>
        <li>
          <strong>Your code:</strong> list the repositories in your projects folder, run a command
          in one of them, open an app or a URL.
        </li>
        <li>
          <strong>Take it back:</strong> every change is logged, and &ldquo;undo that&rdquo;
          reverses the last one.
        </li>
      </ul>

      <h2>Nothing changes until you approve</h2>

      <p>
        Every ability declares what it touches. Reads — listing a folder, checking the calendar —
        run without asking. Anything that changes a file or your system shows a card first: the
        exact command, the exact paths, the exact reminder text. You approve, deny, or approve the
        rest of the task. Cmd+Shift+Esc is the kill switch; it stops the assistant and any running
        command in under a second.
      </p>

      <p>
        Shell commands have a floor no approval can lower. A destructive command stays on a card
        even after you have said &ldquo;approve the rest.&rdquo;
      </p>

      <h2>Talk to it</h2>

      <p>
        Hold Option+Space and speak. Whisper transcribes on your Mac and the text goes down the same
        path as typing. Turn on spoken replies and the answer comes back in a neural voice, also
        generated on-device. No audio ever leaves the machine; only the transcript reaches your
        Claude as part of the conversation. Voice needs Apple Silicon.
      </p>

      <h2>What stayed the same</h2>

      <p>
        File classification stays on-device by default. Smart Local still sorts from names and
        metadata entirely on your machine, and the Sort, Watch and History pages work exactly as
        before. Turn on Your Claude sorting and files a reader could actually open — documents,
        spreadsheets, emails, plain text — have their text sent to your own Claude account instead;
        see the privacy policy for exactly what that sends. The assistant simply became the front
        door.
      </p>

      <p>Talyx is free and open source (MIT) and runs on macOS.</p>
    </>
  )
}

import { FeaturePageLayout } from '../../../shared/layouts/FeaturePageLayout'

export function AssistantPage() {
  return (
    <FeaturePageLayout
      slug="assistant"
      title="The assistant"
      lead="Press ⌘⇧Space anywhere and tell your Mac what to do. Your own Claude, an Anthropic API key or the Claude Code you already have, plans the steps, shows you a card, and asks before it changes anything."
      steps={[
        {
          title: 'Press ⌘⇧Space',
          description:
            'A system-wide shortcut opens the assistant overlay on top of whatever you are doing. Type, or hold Option+Space and speak.'
        },
        {
          title: 'Say it in your own words',
          description:
            '“Sort my Downloads”, “what is on my calendar today”, “run the tests in talyx”, “remind me to call the bank at 4”. The assistant picks the right ability and fills in the details.'
        },
        {
          title: 'Read the card, then approve',
          description:
            'Anything that changes files or your system shows exactly what will happen before it runs. Approve, deny, or press ⌘⇧Esc to stop everything. Reads never ask.'
        }
      ]}
      benefitsHeading="What it can do"
      benefits={[
        {
          title: 'Bring your own Claude',
          description:
            'Paste an Anthropic API key, or point Talyx at the Claude Code already signed in on your Mac and run on your subscription. Pick the model per conversation.'
        },
        {
          title: 'Voice in, voice out',
          description:
            'Hold Option+Space to dictate. Replies can be spoken back in a natural neural voice. Speech recognition and synthesis run on your Mac, so audio never leaves it. Apple Silicon required.'
        },
        {
          title: 'Files',
          description:
            'Sort a folder by content, find duplicates, search inside documents, find a file by name, open recent work, convert images, see what is cluttering your disk.'
        },
        {
          title: 'Your day',
          description:
            'What is on your calendar today or tomorrow, add a reminder, save a note, check unread mail, control Music, toggle dark mode, Wi-Fi or volume.'
        },
        {
          title: 'Your code',
          description:
            'List the repositories in your projects folder, run a command in one of them, open an app or a URL. Every command is shown before it runs.'
        },
        {
          title: 'Undo and a kill switch',
          description:
            'Every change is logged and “undo that” takes back the last one. ⌘⇧Esc stops the assistant and any running command instantly.'
        }
      ]}
    />
  )
}

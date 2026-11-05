import { FeaturePageLayout } from '../FeaturePageLayout'

export function RoomsPage() {
  return (
    <FeaturePageLayout
      slug="rooms"
      title="Several bots, one chat."
      lead="A group room puts two to six bots in one chat. You write once, each bot answers in turn, and Talyx shows who is answering now and who is next."
      steps={[
        {
          title: 'Make a room.',
          description: 'Click + in the roster, choose New room, name it and pick two to six bots.'
        },
        {
          title: 'Write to the room.',
          description:
            'Every bot in the room answers in turn. Start with @ and a bot’s handle to ask just that one.'
        },
        {
          title: 'Approve what they ask for.',
          description:
            'When a bot in the room wants to run something, its approval card shows in the room. Allow it once or deny it there.'
        }
      ]}
      benefitsHeading="How rooms work"
      benefits={[
        {
          title: 'The engine hosts it',
          description:
            'Rooms run in the engine, not in the app. The engine keeps each room’s history, so the conversation is there the next time you open it.'
        },
        {
          title: 'One model, or each their own',
          description: 'Switch every bot in the room to one model, or leave each bot on its own.'
        },
        {
          title: 'Pin it, file it, delete it',
          description:
            'Rooms sit in the roster beside your bots. Deleting a room keeps its bots and their own chats.'
        }
      ]}
    />
  )
}

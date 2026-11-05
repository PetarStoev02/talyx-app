import { FeaturePageLayout } from '../FeaturePageLayout'

export function RosterPage() {
  return (
    <FeaturePageLayout
      slug="roster"
      title="Every bot in one list."
      lead="The roster runs down the left side of Talyx. Pins keep the bots you use most on top, folders hold the rest, and each bot shows whether it is working, waiting on you or has a reply you have not read."
      steps={[
        {
          title: 'Pin the ones you use most.',
          description:
            'Pinned bots sit as tiles at the top of the roster. Move a pin earlier or later to set their order.'
        },
        {
          title: 'File the rest in folders.',
          description:
            'Make a folder for each project and drag bots and rooms into it. A folder can hold other folders, and it shows how many bots are inside.'
        },
        {
          title: 'Read the marks.',
          description:
            'Each row shows the bot’s last message and how long ago it came. Its mark says Working, Waiting on you or Unread reply, so you can see who needs you without opening a chat.'
        }
      ]}
      benefitsHeading="More in the roster"
      benefits={[
        {
          title: 'A block for each bot',
          description:
            'Every bot is an isometric block avatar. Choose one of six shapes and a color, or let the bot’s name choose, and give it a face if you like. Talyx is always the logo.'
        },
        {
          title: 'A new bot from the +',
          description:
            'Click + at the top of the roster, then name the bot, pick its folder, say what it does and choose its look. Its SOUL and routines come after, from its details.'
        },
        {
          title: 'Rooms sit beside your bots',
          description:
            'Group rooms are in the same list. Pin them and file them in folders the same way you do bots.'
        },
        {
          title: 'Delete a folder, keep its bots',
          description:
            'When you delete a folder, its bots and rooms move up a level. No bot or room is deleted with it.'
        }
      ]}
    />
  )
}

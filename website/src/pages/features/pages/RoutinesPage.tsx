import { FeaturePageLayout } from '../FeaturePageLayout'

export function RoutinesPage() {
  return (
    <FeaturePageLayout
      slug="routines"
      title="Jobs on a schedule."
      lead="A routine is an instruction a bot carries out on a schedule, such as a cash report every Monday morning. The engine runs it, even with Talyx closed."
      steps={[
        {
          title: 'Open the bot’s details.',
          description:
            'Click the bot’s name at the top of its chat. Routines sit below its title, description and model.'
        },
        {
          title: 'Say what to do.',
          description:
            'Click New routine, give it a name and write the instruction: what the bot should do each time.'
        },
        {
          title: 'Pick when it runs.',
          description:
            'Daily, on weekdays or once a week at a time you choose, or every few hours. For any other schedule, write a cron line.'
        }
      ]}
      benefitsHeading="After you set it"
      benefits={[
        {
          title: 'Results in the chat',
          description:
            'Turn on Post to this chat and each run lands in the bot’s chat, next to your own messages.'
        },
        {
          title: 'Pause, run or delete',
          description:
            'A switch turns a routine off and on again. Run it now to try it, or delete it to remove it from the engine.'
        }
      ]}
    />
  )
}

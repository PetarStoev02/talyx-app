import { FeaturePageLayout } from '../FeaturePageLayout'

export function ManagerPage() {
  return (
    <FeaturePageLayout
      slug="manager"
      title="A manager for your bots."
      lead="Talyx is a bot too, and its job is the others. Ask it for something and it passes the work to the bot that fits, reads the reply and sums it up for you."
      steps={[
        {
          title: 'Ask Talyx.',
          description:
            'Talyx has its own chat in the roster. Ask in your own words, or start from a suggestion such as “What are my bots working on?” or “Brief me on today”.'
        },
        {
          title: 'It asks the bot that fits.',
          description:
            'Each hand-off shows as a line in the chat, such as “Asked Analyst”, and the bot’s answer appears under its own name.'
        },
        {
          title: 'You read the brief.',
          description: 'Talyx collects the replies and sums them up for you.'
        }
      ]}
      benefitsHeading="How it fits in"
      benefits={[
        {
          title: 'Its own model',
          description:
            'Talyx uses the model you set for it in Settings. New bots start on that model too, and the bots you already have keep their own.'
        },
        {
          title: 'Questions come to you',
          description:
            'When a bot needs an answer or your approval, it asks with a card in its chat, and the roster marks it Waiting on you.'
        },
        {
          title: 'Every bot, still direct',
          description:
            'Talyx is a shortcut, not a gate. Open any bot in the roster and talk to it yourself.'
        }
      ]}
    />
  )
}

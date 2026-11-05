import { FeaturePageLayout } from '../FeaturePageLayout'

export function BotDetailsPage() {
  return (
    <FeaturePageLayout
      slug="bot-details"
      title="One panel per bot."
      lead="Click a bot’s name at the top of its chat to open its details. There you set its title, description and model, choose its look and write its SOUL."
      stepsHeading="Three tabs"
      steps={[
        {
          title: 'Say what it is for.',
          description:
            'On the Details tab, set the bot’s title, a one-line description of what it is for, and the model it uses. Its routines are listed below.'
        },
        {
          title: 'Give it a look.',
          description:
            'On the Look tab, pick one of six block shapes and a color, or let the bot’s name choose both. Turn on a face if you want one.'
        },
        {
          title: 'Write its SOUL.',
          description:
            'On the Soul tab, edit the bot’s SOUL.md: a few lines, in your words, on who the bot is and how it works.'
        }
      ]}
      benefitsHeading="Good to know"
      benefits={[
        {
          title: 'A yes before costly models',
          description:
            'Some models need your yes before a bot switches to them. Talyx asks first, and you can keep the current model.'
        },
        {
          title: 'Talyx keeps its logo',
          description:
            'The manager’s look is always the Talyx logo in black and white, so you can find it at a glance.'
        },
        {
          title: 'New bots start small',
          description:
            'A new bot needs only a name, a folder, what it does and a look. Fill in the rest here when you are ready.'
        }
      ]}
    />
  )
}

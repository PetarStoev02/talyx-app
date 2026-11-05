import { FeaturePageLayout } from '../FeaturePageLayout'

export function ModelsAndKeysPage() {
  return (
    <FeaturePageLayout
      slug="models-and-keys"
      title="The models are yours."
      lead="Talyx runs no model of its own. In Settings, add a provider with an API key, sign in with an account you already have, or point Talyx at a custom endpoint. Every bot can then use it."
      stepsHeading="Three ways to add one"
      steps={[
        {
          title: 'An API key',
          description:
            'Pick the provider, paste the key and click Check. Talyx tells you whether the key works and how many models it serves.'
        },
        {
          title: 'An account sign-in',
          description:
            'Sign in with an account you already have and approve it in your browser. Some accounts sign in with their own tool; Talyx shows the command to run.'
        },
        {
          title: 'A custom endpoint',
          description:
            'Any OpenAI-compatible server, such as a local router. Give it a name, its base URL and the models it serves.'
        }
      ]}
      benefitsHeading="Then pick per bot"
      benefits={[
        {
          title: 'Set up once',
          description:
            'Keys and endpoints you add go to every bot, and all of them share a sign-in. You add a provider once, not once per bot.'
        },
        {
          title: 'A model per bot, and per chat',
          description:
            'Each bot has its own model, set in its details. In the composer, switch the model for a chat and set how hard it reasons: low, medium or high.'
        },
        {
          title: 'Talyx’s model',
          description:
            'Settings also holds the model Talyx itself uses. New bots start with it; the others keep their own.'
        },
        {
          title: 'Keys stay on your computer',
          description:
            'The engine keeps your keys and sign-ins on your computer. Talyx hands them over and keeps no copy. Your provider bills you for what your bots use, if it charges.'
        }
      ]}
    />
  )
}

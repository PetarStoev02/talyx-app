import { Link, useParams } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { PageHero, STEP } from '../../shared/ui/page'
import { BotDetailsPage } from './pages/BotDetailsPage'
import { ManagerPage } from './pages/ManagerPage'
import { ModelsAndKeysPage } from './pages/ModelsAndKeysPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { RoomsPage } from './pages/RoomsPage'
import { RosterPage } from './pages/RosterPage'
import { RoutinesPage } from './pages/RoutinesPage'

// Static imports: this module is already its own lazy route chunk, and the pages are small.
const featurePages: Record<string, () => React.JSX.Element> = {
  roster: RosterPage,
  manager: ManagerPage,
  rooms: RoomsPage,
  routines: RoutinesPage,
  'bot-details': BotDetailsPage,
  'models-and-keys': ModelsAndKeysPage,
  privacy: PrivacyPage
}

export function FeaturePage() {
  const { slug } = useParams({ from: '/features/$slug' })
  const Page = featurePages[slug]

  if (!Page) {
    return (
      <PageHero title="Feature not found" lead="There is no Talyx feature at this address.">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-medium text-[var(--color-text-primary)] underline underline-offset-4 transition-opacity hover:opacity-70"
          style={STEP.lead}
        >
          Go to the home page
          <ArrowRight className="size-4" />
        </Link>
      </PageHero>
    )
  }

  return <Page />
}

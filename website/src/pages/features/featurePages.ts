import type { FeatureSlug } from '../../shared/data/navigation'
import { BotDetailsPage } from './pages/BotDetailsPage'
import { ManagerPage } from './pages/ManagerPage'
import { ModelsAndKeysPage } from './pages/ModelsAndKeysPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { RoomsPage } from './pages/RoomsPage'
import { RosterPage } from './pages/RosterPage'
import { RoutinesPage } from './pages/RoutinesPage'

// A Record over FeatureSlug, so a slug added to navigation.ts without a page fails the typecheck.
const PAGES: Record<FeatureSlug, () => React.JSX.Element> = {
  roster: RosterPage,
  manager: ManagerPage,
  rooms: RoomsPage,
  routines: RoutinesPage,
  'bot-details': BotDetailsPage,
  'models-and-keys': ModelsAndKeysPage,
  privacy: PrivacyPage
}

/** Each feature slug's page. A Map, so `/features/constructor` finds nothing. */
export const featurePages = new Map<string, () => React.JSX.Element>(Object.entries(PAGES))

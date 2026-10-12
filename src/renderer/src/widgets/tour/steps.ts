import { useNavigation } from '@app/providers/useNavigation'
import type { TranslationKey } from '@shared/lib/i18n'

export type TourStepId = 'ask-input' | 'ask-chips' | 'approval' | 'files-group' | 'feedback'

export interface TourStep {
  id: TourStepId
  /** `data-tour` value to highlight; null draws a centered card with no highlight. */
  target: string | null
  titleKey: TranslationKey
  bodyKey: TranslationKey
  /** Runs before the stop is measured, e.g. to switch the view its target lives on. */
  before?: () => void
}

function goToAsk(): void {
  useNavigation.getState().navigate('ask')
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'ask-input',
    target: 'ask-input',
    titleKey: 'tour.askInput.title',
    bodyKey: 'tour.askInput.body',
    before: goToAsk
  },
  {
    id: 'ask-chips',
    target: 'ask-chips',
    titleKey: 'tour.askChips.title',
    bodyKey: 'tour.askChips.body',
    before: goToAsk
  },
  {
    id: 'approval',
    target: null,
    titleKey: 'tour.approval.title',
    bodyKey: 'tour.approval.body'
  },
  {
    id: 'files-group',
    target: 'files-group',
    titleKey: 'tour.filesGroup.title',
    bodyKey: 'tour.filesGroup.body'
  },
  {
    id: 'feedback',
    target: 'feedback',
    titleKey: 'tour.feedback.title',
    bodyKey: 'tour.feedback.body'
  }
]

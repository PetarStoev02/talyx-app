import { Briefcase, FolderSearch, Clock, AlertTriangle } from 'lucide-react'
import { UseCasePageLayout } from '../../../shared/layouts/UseCasePageLayout'
import { KnowledgeWorkersAnim } from '../../../shared/ui/HeroAnimations'

export function KnowledgeWorkersPage() {
  return (
    <UseCasePageLayout
      title="Talyx for Knowledge Workers"
      subtitle="Drop your Downloads folder: Smart Local sorts by type on your Mac, and Your Claude sorts by what’s inside. Reclaim the hours you spend manually sorting files every week."
      persona="For Knowledge Workers"
      icon={Briefcase}
      relatedFeatureSlugs={['ai-classification', 'watch-folders', 'sort-history']}
      painPoints={[
        {
          icon: FolderSearch,
          title: 'Downloads folder chaos',
          description:
            'Hundreds of PDFs, spreadsheets, and presentations piling up with no structure. Finding the right file means scrolling through an endless list.'
        },
        {
          icon: Clock,
          title: 'Hours wasted organizing',
          description:
            'Manual file sorting eats into productive time. Creating folders, dragging files, renaming — it adds up to hours every week.'
        },
        {
          icon: AlertTriangle,
          title: 'Lost documents',
          description:
            'Important reports, contracts, and reference materials buried in nested folders you created months ago and forgot about.'
        }
      ]}
      solutions={[
        {
          title: 'Drop your messy folder and sort in seconds',
          description:
            'Drag your Downloads folder into Talyx. Your connected AI classifies every file — documents, spreadsheets, presentations, images — and organizes them into clean categories automatically.'
        },
        {
          title: 'Set up Watch Folders for ongoing organization',
          description:
            'Configure your Downloads folder as a watch folder. Every new file is automatically sorted as soon as it appears. Your folder stays clean without any effort.'
        },
        {
          title: 'Full history with undo',
          description:
            'Every sort operation is logged. If a file ends up in the wrong place, undo the operation and it returns to its original location. No files are ever lost.'
        }
      ]}
      heroIllustration={<KnowledgeWorkersAnim />}
    />
  )
}

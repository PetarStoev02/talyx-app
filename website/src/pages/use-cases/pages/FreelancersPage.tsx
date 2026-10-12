import { Palette, FolderSearch, FileText, AlertTriangle } from 'lucide-react'
import { UseCasePageLayout } from '../../../shared/layouts/UseCasePageLayout'
import { FreelancersAnim } from '../../../shared/ui/HeroAnimations'

export function FreelancersPage() {
  return (
    <UseCasePageLayout
      title="Talyx for Freelancers & Creatives"
      subtitle="Smart Local sorts by type on your Mac; Your Claude sorts client files by what’s inside. Keep project assets organized and billing documents easy to find — without spending hours on file management."
      persona="For Freelancers & Creatives"
      icon={Palette}
      relatedFeatureSlugs={['ai-classification', 'watch-folders', 'drag-and-drop']}
      painPoints={[
        {
          icon: FolderSearch,
          title: 'Client files mixed together',
          description:
            'Deliverables, feedback, briefs, and assets from different clients end up in one chaotic pile. Finding the right version takes forever.'
        },
        {
          icon: FileText,
          title: 'Project assets scattered',
          description:
            'Photos, mockups, fonts, and exports spread across Desktop, Downloads, and random project folders with no consistent structure.'
        },
        {
          icon: AlertTriangle,
          title: 'Billing docs lost',
          description:
            'Invoices, contracts, and receipts buried in email attachments and download folders. Tax time becomes a nightmare.'
        }
      ]}
      solutions={[
        {
          title: 'Your AI sorts creative assets by type',
          description:
            'Images, videos, documents, fonts, and archives are automatically categorized. Drop a project folder: Smart Local sorts by type on your Mac, and Your Claude sorts by what’s inside.'
        },
        {
          title: 'Quick drag-and-drop sorting',
          description:
            'Drag a folder of deliverables straight into Talyx, preview the organization, and apply. Perfect for end-of-project cleanup.'
        }
      ]}
      heroIllustration={<FreelancersAnim />}
    />
  )
}

import { UseCasePageLayout } from '../../../shared/layouts/UseCasePageLayout'

export function FreelancersPage() {
  return (
    <UseCasePageLayout
      slug="freelancers"
      title="Talyx for freelancers"
      lead="Smart Local sorts by type on your Mac; Your Claude sorts client files by what’s inside. Keep project assets organized and billing documents easy to find — without spending hours on file management."
      screenshot="/previews/sort.jpg"
      relatedFeatureSlugs={['ai-classification', 'watch-folders', 'drag-and-drop']}
      painPoints={[
        {
          title: 'Client files mixed together',
          description:
            'Deliverables, feedback, briefs, and assets from different clients end up in one chaotic pile. Finding the right version takes forever.'
        },
        {
          title: 'Project assets scattered',
          description:
            'Photos, mockups, fonts, and exports spread across Desktop, Downloads, and random project folders with no consistent structure.'
        },
        {
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
    />
  )
}

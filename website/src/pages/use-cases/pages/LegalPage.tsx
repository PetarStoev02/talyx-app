import { UseCasePageLayout } from '../UseCasePageLayout'

export function LegalPage() {
  return (
    <UseCasePageLayout
      slug="legal"
      title="Talyx for legal work"
      lead="Organize confidential documents with sorting that defaults to staying on your device. Smart Local never sends file content anywhere; Your Claude, if you choose to turn it on, is the one mode that does."
      screenshot="/previews/history.jpg"
      relatedFeatureSlugs={['privacy-offline', 'ai-classification', 'sort-history']}
      painPoints={[
        {
          title: 'Confidential docs need careful handling',
          description:
            'Client files, case documents, and legal briefs contain privileged information. You need control over where data is processed.'
        },
        {
          title: 'Data locality requirements',
          description:
            'Data residency and privilege requirements mean you need control over how files are processed. Smart Local stays on your device; only turning on Your Claude sends anything off it.'
        },
        {
          title: 'Audit trail requirements',
          description:
            'Regulatory compliance often requires tracking who moved which files and when. Manual organization leaves no paper trail.'
        }
      ]}
      solutions={[
        {
          title: 'Smart sorting, on by default',
          description:
            'Every new install starts on Smart Local: extension and metadata analysis with zero internet connection. No AI, no cloud, no data transmitted — no setup needed for privileged files.'
        },
        {
          title: 'Smart Local, for sorting with no third party',
          description:
            'Want sorting that sends nothing off the machine? Leave Your Claude off. Smart Local files contracts, filings and correspondence from their names and metadata, entirely on your device — no cloud, no servers, no third parties.'
        },
        {
          title: 'Full operation history for audit compliance',
          description:
            'Every file move is logged with timestamps and paths in a local SQLite database. Export the history for compliance audits.'
        }
      ]}
    />
  )
}

import { Scale, ShieldAlert, Globe, FileSearch } from 'lucide-react'
import { UseCasePageLayout } from '../../../shared/layouts/UseCasePageLayout'
import { LegalAnim } from '../../../shared/ui/HeroAnimations'

export function LegalPage() {
  return (
    <UseCasePageLayout
      title="Talyx for Legal & Compliance"
      subtitle="Organize confidential documents with sorting that defaults to staying on your device. Smart Local never sends file content anywhere; Your Claude, if you choose to turn it on, is the one mode that does."
      persona="For Legal & Compliance"
      icon={Scale}
      relatedFeatureSlugs={['privacy-offline', 'ai-classification', 'sort-history']}
      painPoints={[
        {
          icon: ShieldAlert,
          title: 'Confidential docs need careful handling',
          description:
            'Client files, case documents, and legal briefs contain privileged information. You need control over where data is processed.'
        },
        {
          icon: Globe,
          title: 'Data locality requirements',
          description:
            'Data residency and privilege requirements mean you need control over how files are processed. Smart Local stays on your device; only turning on Your Claude sends anything off it.'
        },
        {
          icon: FileSearch,
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
      heroIllustration={<LegalAnim />}
    />
  )
}

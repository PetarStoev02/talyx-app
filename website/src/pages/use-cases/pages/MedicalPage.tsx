import { HeartPulse, ShieldAlert, Clock, FileSearch } from 'lucide-react'
import { UseCasePageLayout } from '../../../shared/layouts/UseCasePageLayout'
import { MedicalAnim } from '../../../shared/ui/HeroAnimations'

export function MedicalPage() {
  return (
    <UseCasePageLayout
      title="Talyx for Medical & Healthcare"
      subtitle="Organize patient records, medical documents, and research files with sorting that defaults to staying on your device. Smart Local never send file content anywhere; Your Claude, an optional mode, is the one that does — choose accordingly for protected health information."
      persona="For Medical & Healthcare"
      icon={HeartPulse}
      relatedFeatureSlugs={['privacy-offline', 'watch-folders', 'ai-classification']}
      painPoints={[
        {
          icon: ShieldAlert,
          title: 'Patient data privacy concerns',
          description:
            'Patient records, medical images, and clinical data require strict handling. You need control over where and how data is processed.'
        },
        {
          icon: FileSearch,
          title: 'Patient records organization',
          description:
            'Medical documents, lab results, imaging files, and clinical notes accumulate rapidly and need consistent, reliable organization.'
        },
        {
          icon: Clock,
          title: 'Time pressure',
          description:
            "Healthcare professionals can't afford to spend time manually sorting files. Every minute spent on file management is time away from patient care."
        }
      ]}
      solutions={[
        {
          title: 'Smart sorting, on by default',
          description:
            'Every new install starts on Smart sorting: extension and metadata analysis with zero internet connection. No AI, no cloud, no data transmitted — the safest default for patient records.'
        },
        {
          title: 'Watch Folders for automatic organization',
          description:
            'Set up watch folders for incoming scans, reports, and documents. Files are automatically classified and sorted as they arrive.'
        },
        {
          title: 'Smart Local, for sorting with no third party',
          description:
            'Want sorting that sends nothing off the machine? Leave Your Claude off. Smart Local files medical documents, imaging files, lab results and clinical notes from their names and metadata, entirely on your device. Your Claude is a separate, optional mode — review your data policy before using it for patient records.'
        }
      ]}
      heroIllustration={<MedicalAnim />}
    />
  )
}

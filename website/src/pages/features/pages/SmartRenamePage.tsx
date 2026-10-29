import { FeaturePageLayout } from '../../../shared/layouts/FeaturePageLayout'

export function SmartRenamePage() {
  return (
    <FeaturePageLayout
      slug="smart-rename"
      title="Smart rename"
      lead="With Your Claude sorting on, Talyx reads each file and suggests a descriptive name following Harvard file naming conventions."
      steps={[
        {
          title: 'Your Claude reads the file',
          description:
            'Talyx extracts text and metadata from your files, then analyzes them with your own Claude, the same account the assistant uses.'
        },
        {
          title: 'It suggests a Harvard-style name',
          description:
            'Based on the analysis, it suggests a clean, descriptive filename following Harvard file naming conventions: lowercase, hyphen-separated, with dates and descriptors that make files easy to find and sort.'
        },
        {
          title: 'Preview and apply',
          description:
            'Review the suggested names before applying. Accept individual renames or apply them all at once.'
        }
      ]}
      benefits={[
        {
          title: 'Always preview first',
          description:
            'See every proposed rename before it happens. Nothing is renamed until you confirm the sort.'
        },
        {
          title: 'Names from the contents',
          description:
            'With Your Claude, names are based on what the file actually contains. Without it, Smart Local only tidies generic names like IMG_4032.jpg or Document (3).pdf.'
        },
        {
          title: 'Edit suggestions',
          description: 'Tweak any suggested name before applying. You stay in full control.'
        },
        {
          title: 'Batch processing',
          description:
            'Rename hundreds of files at once while keeping names consistent and meaningful.'
        }
      ]}
    />
  )
}

import { FeaturePageLayout } from '../FeaturePageLayout'

export function DragAndDropPage() {
  return (
    <FeaturePageLayout
      slug="drag-and-drop"
      title="Drag and drop"
      lead="Drag a folder into Talyx, preview how your files will be organized, and confirm with a single click."
      steps={[
        {
          title: 'Drag your folder in',
          description:
            'Drag any folder from your file manager directly into the Talyx window. Or use the folder picker to browse.'
        },
        {
          title: 'Preview the classification',
          description:
            'See exactly how your files will be categorized before anything moves. Review and adjust as needed.'
        },
        {
          title: 'Confirm and sort',
          description:
            'Hit sort and watch your files organize themselves. The entire process takes seconds, even for large folders.'
        }
      ]}
      benefits={[
        {
          title: 'Nothing to learn',
          description: 'Drag and drop feels natural. No menus to navigate or commands to remember.'
        },
        {
          title: 'Preview before sorting',
          description:
            'Always see the proposed organization before confirming. Nothing happens without your approval.'
        },
        {
          title: 'Fast',
          description:
            'Classification and sorting complete in seconds, even for folders with thousands of files.'
        },
        {
          title: 'Handles nested folders',
          description:
            'Deep folder structures are flattened and re-organized into clean, logical categories.'
        }
      ]}
    />
  )
}

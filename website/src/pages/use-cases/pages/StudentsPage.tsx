import { UseCasePageLayout } from '../../../shared/layouts/UseCasePageLayout'

export function StudentsPage() {
  return (
    <UseCasePageLayout
      slug="students"
      title="Talyx for students"
      lead="For students and researchers: Smart Local sorts papers, notes, and datasets by type on your Mac; Your Claude sorts by what’s inside. Spend less time managing files and more time on your work."
      screenshot="/previews/sort.jpg"
      relatedFeatureSlugs={['ai-classification', 'smart-rename', 'sort-history']}
      painPoints={[
        {
          title: 'Research papers pile up',
          description:
            'Dozens of PDFs downloaded from journals and databases accumulate with cryptic filenames like "paper_final_v3 (2).pdf".'
        },
        {
          title: 'Unnamed lecture notes',
          description:
            'Slides, handouts, and notes from different courses get mixed together in Downloads with no clear naming or folder structure.'
        },
        {
          title: 'Scattered datasets',
          description:
            'CSV files, code notebooks, and experiment data spread across multiple folders. Reproducing results means hunting for the right files.'
        }
      ]}
      solutions={[
        {
          title: 'Your AI categorizes academic files',
          description:
            'Research papers, presentations, spreadsheets, code, and datasets are automatically identified and sorted into logical categories by your connected AI.'
        },
        {
          title: 'Smart Rename gives files meaningful names',
          description:
            'Turn "document (1).pdf" into descriptive names based on actual content. Find papers by what they\'re about, not by random filenames.'
        },
        {
          title: 'Full undo for peace of mind',
          description:
            'Every sort operation is reversible. If a file ends up in the wrong category, undo it instantly. Nothing is ever lost.'
        }
      ]}
    />
  )
}

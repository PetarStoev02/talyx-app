import { FeaturePageLayout } from '../../../shared/layouts/FeaturePageLayout'

export function SortHistoryPage() {
  return (
    <FeaturePageLayout
      slug="sort-history"
      title="Sort history"
      lead="Every sort is recorded as a batch. Browse past batches, see exactly where each file went, and undo a whole batch."
      steps={[
        {
          title: 'Every move and copy is logged',
          description:
            'Each file move or copy is recorded with a timestamp, its source and destination paths, and the category it was sorted into.'
        },
        {
          title: 'Browse past sorts',
          description:
            'Pick any batch from the history list to see its mode, time, and every file with where it came from and where it went.'
        },
        {
          title: 'Undo a whole batch',
          description:
            'Moved files go back where they came from, copies are removed. Anything Talyx can’t restore safely, a file that’s gone or a new file in its old place, is left as it is and listed for you. The batch stays in the list, marked undone.'
        }
      ]}
      benefits={[
        {
          title: 'Never lose files',
          description:
            'Nothing is overwritten on the way back. If Talyx can’t restore a file safely, it leaves it where it is and tells you.'
        },
        {
          title: 'Persistent history',
          description: 'History is stored in a local database and persists across app restarts.'
        },
        {
          title: 'Timestamped entries',
          description:
            'See exactly when each operation happened. Track your organization progress over time.'
        },
        {
          title: 'One step back',
          description:
            'Undo an entire sort session in one step. Moved files return to their original locations; copies are removed.'
        }
      ]}
    />
  )
}

import { FeaturePageLayout } from '../FeaturePageLayout'

export function WatchFoldersPage() {
  return (
    <FeaturePageLayout
      slug="watch-folders"
      title="Watch folders"
      lead="Point Talyx at any folder. New files are classified and sorted the moment they appear."
      steps={[
        {
          title: 'Choose a folder to watch',
          description:
            'Pick any folder: your Downloads, Desktop, or a project directory. Talyx begins monitoring it for new files.'
        },
        {
          title: 'Set where files go',
          description: 'Choose between copy or move mode and define where sorted files should go.'
        },
        {
          title: 'Files sort themselves',
          description:
            'When new files appear in the watched folder, they are classified and organized right away, with no manual step.'
        }
      ]}
      benefits={[
        {
          title: 'Real-time monitoring',
          description: 'Files are detected and sorted within seconds of appearing in the folder.'
        },
        {
          title: 'Set and forget',
          description: 'Configure once and your folders stay organized without any ongoing effort.'
        },
        {
          title: 'Persistent across restarts',
          description:
            'Watch configurations are saved and resume automatically when you open Talyx.'
        },
        {
          title: 'Copy or move, per folder',
          description:
            'Choose to copy or move files, and set custom output directories per watched folder.'
        }
      ]}
    />
  )
}

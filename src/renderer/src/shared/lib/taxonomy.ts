/**
 * Category → subcategory options offered by the correction dialog.
 *
 * Must stay in step with SUBCATEGORIES in the main process
 * (src/main/domain/classification/model/Category.ts) — the correction IPC
 * rejects any path outside it. A unit test asserts the two agree.
 */
export const TAXONOMY: Record<string, string[]> = {
  Documents: [
    'Invoices',
    'Reports',
    'Contracts',
    'Legal',
    'Investment',
    'Resumes',
    'Spreadsheets',
    'Presentations',
    'Ebooks',
    'Other'
  ],
  Images: ['Photos', 'Screenshots', 'Graphics', 'Icons', 'Vectors', 'Other'],
  Videos: ['Movies', 'Clips', 'Screencasts', 'Animations', 'Other'],
  Audio: ['Music', 'Recordings', 'Podcasts', 'Audiobooks', 'Sound Effects', 'Other'],
  Code: ['JavaScript', 'TypeScript', 'Python', 'Web', 'Systems', 'Data', 'Shell', 'Other'],
  Software: ['Installers', 'Disk Images', 'Packages', 'Application Data', 'Other'],
  Archives: ['Compressed', 'Other'],
  Other: ['3D Models', 'CAD', 'Fonts', 'Torrents', 'Other']
}

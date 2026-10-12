import type { ClassifiedFile } from '@shared/api/ipc'

/** Three Smart Local classifications — matches ExtensionClassifier mappings. */
export const DEMO_CLASSIFIED: ClassifiedFile[] = [
  {
    path: '/Users/you/Downloads/scan_003.pdf',
    name: 'scan_003.pdf',
    size: 240_000,
    classification: {
      category: 'Documents',
      subcategory: null,
      confidence: 0.95,
      metadata: {},
      semanticPath: ['Documents'],
      suggestedName: 'invoice_march.pdf'
    }
  },
  {
    path: '/Users/you/Downloads/IMG_1042.heic',
    name: 'IMG_1042.heic',
    size: 1_800_000,
    classification: {
      category: 'Images',
      subcategory: 'Photos',
      confidence: 0.99,
      metadata: {},
      semanticPath: ['Images', 'Photos']
    }
  },
  {
    path: '/Users/you/Downloads/track.mp3',
    name: 'track.mp3',
    size: 4_200_000,
    classification: {
      category: 'Audio',
      subcategory: 'Music',
      confidence: 0.99,
      metadata: {},
      semanticPath: ['Audio', 'Music']
    }
  }
]

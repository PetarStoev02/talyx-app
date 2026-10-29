import { FeaturePageLayout } from '../FeaturePageLayout'

export function AiClassificationPage() {
  return (
    <FeaturePageLayout
      slug="ai-classification"
      title="AI classification"
      lead="Smart Local sorts by name and metadata on your Mac, with nothing sent. Connect Your Claude and the whole batch is classified by the same account as the assistant. Talyx is the harness; you bring the brain."
      steps={[
        {
          title: 'Talyx scans your files',
          description:
            'Select or drag any folder into Talyx. It scans every file for its extension and metadata. Smart Local classifies from those alone; Your Claude also gets extracted text from readable files.'
        },
        {
          title: 'Your Claude reads the whole batch',
          description:
            'When Your Claude is on and reachable, the whole preview batch goes to your own account in one look: names, metadata, and for readable files a 2,000-character excerpt with currency amounts, dates and company names ending in a legal suffix masked, best-effort. If Claude is unreachable, Smart Local answers and the Sort page says so.'
        },
        {
          title: 'Preview, then sort',
          description:
            'Review the proposed organization before applying. Choose to copy or move files, then sort with one click. A whole sort batch can be undone.'
        }
      ]}
      benefits={[
        {
          title: 'Semantic understanding',
          description:
            'AI reads content, not just extensions. Invoices, contracts, reports and photos are classified by what they actually contain.'
        },
        {
          title: 'One batch, one look',
          description:
            'The whole preview is classified together, so “invoice”, “receipt” and “statement” land in the same category instead of being guessed one file at a time.'
        },
        {
          title: 'Your account, your quota',
          description:
            'An Anthropic API key, or the Claude Code already signed in on your Mac. Talyx hosts no model, downloads no classification weights, resells nothing and adds no subscription of its own.'
        },
        {
          title: 'Smart Local is the floor',
          description:
            'Turn Your Claude off, lose the network, or hit a rate limit, and sorting still works from names and metadata: no model, no download, nothing sent.'
        }
      ]}
    />
  )
}

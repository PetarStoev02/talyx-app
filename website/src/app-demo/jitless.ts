import { config } from 'zod'

// Zod probes for eval with `new Function` and compiles fast parsers when it can. The site's CSP
// has no 'unsafe-eval', so the probe is reported as a violation; jitless skips the probe. Imported
// first in main.tsx, since schemas read this when they are created.
config({ jitless: true })

// Usage: UPDATE_SIGNING_KEY=<base64 of the private key PEM> node scripts/sign-feed.mjs <feed>...
// Signs each update feed (latest-mac.yml, latest-linux.yml) into <feed>.sig, the Ed25519
// signature in base64. Talyx downloads an update only when its feed carries this signature.
import { createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const SHIPPED_KEY_SOURCE = new URL(
  '../src/main/infrastructure/updater/feedSignature.ts',
  import.meta.url
)

try {
  const encoded = process.env.UPDATE_SIGNING_KEY
  if (!encoded)
    throw new Error('UPDATE_SIGNING_KEY is not set. CLAUDE.md → Builds → Signing secrets.')
  const feeds = process.argv.slice(2)
  if (feeds.length === 0) throw new Error('Name the feed files to sign.')

  const key = createPrivateKey(Buffer.from(encoded, 'base64'))
  // A feed signed with any other key would be refused by every installed Talyx.
  const shipped = /UPDATE_FEED_KEY = publicKey\('([^']+)'\)/.exec(
    readFileSync(SHIPPED_KEY_SOURCE, 'utf8')
  )?.[1]
  if (createPublicKey(key).export({ format: 'jwk' }).x !== shipped)
    throw new Error(
      'UPDATE_SIGNING_KEY is not the key Talyx checks updates with (UPDATE_FEED_KEY).'
    )

  for (const feed of feeds) {
    writeFileSync(`${feed}.sig`, `${sign(null, readFileSync(feed), key).toString('base64')}\n`)
    console.log(`✓ Signed ${feed}`)
  }
} catch (error) {
  console.error(`✗ ${error.message}`)
  process.exit(1)
}

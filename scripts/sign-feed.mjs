// Usage: node scripts/sign-feed.mjs <feed>...
// Signs each update feed (latest-mac.yml, latest-linux.yml) into <feed>.sig, the Ed25519
// signature in base64. Talyx downloads an update only when its feed carries this signature.
// The key is ~/.config/talyx/keys/update.private.pem: on the owner's machine, never on GitHub.
import { createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const KEY_FILE = join(homedir(), '.config/talyx/keys/update.private.pem')

const SHIPPED_KEY_SOURCE = new URL(
  '../src/main/infrastructure/updater/feedSignature.ts',
  import.meta.url
)

try {
  const feeds = process.argv.slice(2)
  if (feeds.length === 0) throw new Error('Name the feed files to sign.')

  const key = createPrivateKey(readFileSync(KEY_FILE))
  // A feed signed with any other key would be refused by every installed Talyx.
  const shipped = /UPDATE_FEED_KEY = publicKey\('([^']+)'\)/.exec(
    readFileSync(SHIPPED_KEY_SOURCE, 'utf8')
  )?.[1]
  if (createPublicKey(key).export({ format: 'jwk' }).x !== shipped)
    throw new Error(`${KEY_FILE} is not the key Talyx checks updates with (UPDATE_FEED_KEY).`)

  for (const feed of feeds) {
    writeFileSync(`${feed}.sig`, `${sign(null, readFileSync(feed), key).toString('base64')}\n`)
    console.log(`✓ Signed ${feed}`)
  }
} catch (error) {
  console.error(`✗ ${error.message}`)
  process.exit(1)
}

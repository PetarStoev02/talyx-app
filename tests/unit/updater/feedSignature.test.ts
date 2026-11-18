import { generateKeyPairSync, sign } from 'node:crypto'
import fc from 'fast-check'
import { dump } from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  feedVouchesFor,
  type OfferedUpdate
} from '../../../src/main/infrastructure/updater/feedSignature'

const keys = generateKeyPairSync('ed25519')
const VERSION = '1.0.6'

type FeedFile = OfferedUpdate['files'][number]

// Few names, hashes and sizes, so offered files often share some fields with a listed one.
const file: fc.Arbitrary<FeedFile> = fc.record({
  url: fc.constantFrom('Talyx-x86_64.AppImage', 'Talyx-amd64.deb', 'Talyx-arm64-mac.zip'),
  sha512: fc.constantFrom('YXBwaW1hZ2U=', 'ZGVi', 'emlw'),
  size: fc.constantFrom(10, 20, 30)
})

function signedFeed(files: FeedFile[]): { feed: Buffer; signature: string } {
  const feed = Buffer.from(dump({ version: VERSION, files, path: files[0].url }))
  return { feed, signature: sign(null, feed, keys.privateKey).toString('base64') }
}

const listed = (files: FeedFile[], offered: FeedFile): boolean =>
  files.some(
    (entry) =>
      entry.url === offered.url && entry.sha512 === offered.sha512 && entry.size === offered.size
  )

describe('feedVouchesFor, for any signed feed and offered files', () => {
  it('should never let a file the feed does not list by that name, sha512 and size replace the app', () => {
    fc.assert(
      fc.property(
        fc.array(file, { minLength: 1, maxLength: 4 }),
        fc.array(file, { minLength: 1, maxLength: 3 }),
        (files, offered) => {
          const vouched = feedVouchesFor(
            signedFeed(files),
            { version: VERSION, files: offered },
            keys.publicKey
          )
          expect(vouched).toBe(offered.every((item) => listed(files, item)))
        }
      )
    )
  })
})

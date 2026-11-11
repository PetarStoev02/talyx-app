import { verify, type KeyObject } from 'node:crypto'
import { load } from 'js-yaml'
import { z } from 'zod/v4'
import { publicKey } from '../modules/signing'

/**
 * The update feed (latest-mac.yml, latest-linux.yml) names the files of a release and their
 * sha512. The owner signs it on their own machine (npm run sign-release, npm run release) with a
 * key that never goes to GitHub, so a release someone else publishes on the repository cannot
 * make Talyx install their files. Only the public half (Ed25519, JWK `x`) is here; scripts/sign-feed.mjs
 * checks its key against it.
 */
export const UPDATE_FEED_KEY = publicKey('Ywgrlthvt99sP7u5iP1MRzMUV3lx1g7noxBi3T3R6PA')

export const FEED_SIGNATURE_SUFFIX = '.sig'

/** What electron-updater is about to download: the version, and each file's name, sha512 and size. */
export interface OfferedUpdate {
  version: string
  files: Array<{ url: string; sha512: string; size?: number }>
}

export interface SignedFeed {
  /** The feed file's exact bytes. */
  feed: Buffer
  /** Its Ed25519 signature, base64. */
  signature: string
}

const FeedSchema = z.object({
  version: z.string(),
  files: z.array(z.object({ url: z.string(), sha512: z.string(), size: z.number() })).min(1)
})

/**
 * Whether the signed feed vouches for `offered`: the signature is ours, the feed is for that
 * version, and every file about to be downloaded is one of its files, by name, sha512 and size.
 * The name matters: a feed also lists files that must never replace the app (the deb).
 */
export function feedVouchesFor(
  { feed, signature }: SignedFeed,
  offered: OfferedUpdate,
  key: KeyObject
): boolean {
  if (!verify(null, feed, key, Buffer.from(signature.trim(), 'base64'))) return false
  const signed = readFeed(feed)
  if (!signed || signed.version !== offered.version) return false
  if (!Array.isArray(offered.files) || offered.files.length === 0) return false
  return offered.files.every((file) =>
    signed.files.some(
      (entry) => entry.url === file.url && entry.sha512 === file.sha512 && entry.size === file.size
    )
  )
}

function readFeed(feed: Buffer): z.infer<typeof FeedSchema> | null {
  try {
    return FeedSchema.parse(load(feed.toString('utf8')))
  } catch {
    // Signed, yet not a feed: nothing to vouch with.
    return null
  }
}

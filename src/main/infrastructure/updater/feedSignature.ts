import { verify, type KeyObject } from 'node:crypto'
import { publicKey } from '../modules/signing'

/**
 * The update feed (latest-mac.yml, latest-linux.yml) names the files of a release and their
 * sha512. The release workflow signs it with a key GitHub's release page does not hold, so a
 * release someone else publishes on the repository cannot make Talyx install their files. Only
 * the public half (Ed25519, JWK `x`) is here; scripts/sign-feed.mjs checks its key against it.
 */
export const UPDATE_FEED_KEY = publicKey('Ywgrlthvt99sP7u5iP1MRzMUV3lx1g7noxBi3T3R6PA')

export const FEED_SIGNATURE_SUFFIX = '.sig'

/** What electron-updater is about to download: the version and each file's sha512. */
export interface OfferedUpdate {
  version: string
  files: Array<{ sha512: string }>
}

export interface SignedFeed {
  /** The feed file's exact bytes. */
  feed: Buffer
  /** Its Ed25519 signature, base64. */
  signature: string
}

/**
 * Whether the signed feed vouches for `offered`: the signature is ours, the feed is for that
 * version, and it lists the sha512 of every file about to be downloaded.
 */
export function feedVouchesFor(
  { feed, signature }: SignedFeed,
  offered: OfferedUpdate,
  key: KeyObject
): boolean {
  if (!verify(null, feed, key, Buffer.from(signature.trim(), 'base64'))) return false
  const text = feed.toString('utf8')
  const version = /^version:\s*['"]?([^\s'"]+)/m.exec(text)?.[1]
  const hashes = new Set(
    [...text.matchAll(/^\s*(?:- )?sha512:\s*['"]?([^\s'"]+)/gm)].map((match) => match[1])
  )
  return (
    version === offered.version &&
    offered.files.length > 0 &&
    offered.files.every((file) => hashes.has(file.sha512))
  )
}

#!/usr/bin/env node

/**
 * Clears all Talyx app data for a fresh start.
 * Usage: npm run reset (or npm run dev:reset to reset and start the app)
 *
 * Deletes:
 * - SQLite database (talyx.db, talyx.db-wal, talyx.db-shm)
 * - Settings (settings.json)
 * - Transformers.js model cache
 * - Search index and sort history (both live in the SQLite database)
 *
 * Does NOT delete:
 * - Downloaded voice models (the `models` folder) — too large to re-download
 */

import { join } from 'path'
import { rmSync, existsSync } from 'fs'
import { homedir } from 'os'

// Talyx is macOS only; Electron's userData lives here.
const appData = join(homedir(), 'Library', 'Application Support', 'talyx')
console.log(`\n🧹 Clearing Talyx app data from: ${appData}\n`)

const targets = [
  { path: join(appData, 'talyx.db'), label: 'Database' },
  { path: join(appData, 'talyx.db-wal'), label: 'Database WAL' },
  { path: join(appData, 'talyx.db-shm'), label: 'Database SHM' },
  { path: join(appData, 'settings.json'), label: 'Settings' },
  { path: join(appData, 'transformers-models'), label: 'Transformers.js models' }
]

let cleared = 0
for (const { path, label } of targets) {
  if (existsSync(path)) {
    try {
      rmSync(path, { recursive: true })
      console.log(`  ✓ ${label}`)
      cleared++
    } catch (err) {
      console.log(`  ✗ ${label} — ${err.message}`)
    }
  }
}

if (cleared === 0) {
  console.log('  Nothing to clear — already clean.\n')
} else {
  console.log(`\n✅ Cleared ${cleared} item(s). App will start fresh.\n`)
}

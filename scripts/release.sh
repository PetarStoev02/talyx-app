#!/bin/bash
# Build the macOS release and create a draft GitHub release.
# The DMGs are unsigned in Apple's sense: ad-hoc signed ('-'), not notarized, no
# Developer ID. Apple Silicon will not run a binary with no signature at all, and
# the Electron fuses invalidate any earlier one, so electron-builder signs ad hoc last.
# Needs no credentials. macOS blocks every downloaded version the first time it is opened:
# users click Open Anyway in System Settings > Privacy & Security, or run
# xattr -dr com.apple.quarantine /Applications/Talyx.app. After each new version the
# Automation and Files & Folders prompts return, and Accessibility and Screen Recording
# must be removed with "-" and added again.
# Windows is not built here: @huggingface/transformers imports sharp, whose
# win32 native binary is not installed on a macOS host, so a cross-built
# Windows package would ship with voice broken.

set -e

# Every uploaded file must come from this build; electron-builder never cleans dist/.
rm -rf dist

VERSION=$(node -p "require('./package.json').version")
echo "Building Talyx v$VERSION..."

# Rebuild better-sqlite3 for Electron; the tests leave it built for Node.
npx electron-builder install-app-deps

echo "→ Building macOS (ARM64 + x64)..."
npm run build:mac

echo ""
ls -lh dist/*.dmg

echo ""
echo "→ Creating a DRAFT GitHub release v$VERSION on PetarStoev02/talyx-app..."
gh release create "v$VERSION" \
  --repo PetarStoev02/talyx-app \
  --draft \
  --title "Talyx $VERSION" \
  --generate-notes \
  dist/*.dmg
echo "✅ Draft created. Review it, then publish: gh release edit v$VERSION --repo PetarStoev02/talyx-app --draft=false"
echo "   Every download is blocked on first open: users try to open it, dismiss the warning, then click"
echo "   Open Anyway in System Settings > Privacy & Security, or: xattr -dr com.apple.quarantine /Applications/Talyx.app"
echo "   After each update users re-grant Automation and Files & Folders, and must remove and re-add"
echo "   Talyx under Accessibility and Screen Recording."
echo "   Run 'npm rebuild better-sqlite3' to restore the build the tests use."

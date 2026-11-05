#!/bin/bash
# Build the macOS release and create a draft GitHub release.
# The DMGs are unsigned in Apple's sense: ad-hoc signed ('-'), not notarized, no
# Developer ID. Apple Silicon will not run a binary with no signature at all, and
# the Electron fuses invalidate any earlier one, so electron-builder signs ad hoc last.
# Needs no credentials. macOS blocks every downloaded version the first time it is opened:
# users click Open Anyway in System Settings > Privacy & Security, or run
# xattr -dr com.apple.quarantine /Applications/Talyx.app.

set -e

# Every uploaded file must come from this build; electron-builder never cleans dist/.
rm -rf dist

VERSION=$(node -p "require('./package.json').version")
echo "Building Talyx v$VERSION..."

echo "→ Building macOS (ARM64 + x64)..."
npm run build:mac

# Unsigned builds carry no proof of origin; the checksums let a user check a download against
# the release page (shasum -a 256 -c SHA256SUMS --ignore-missing).
(cd dist && shasum -a 256 *.dmg > SHA256SUMS)

echo ""
ls -lh dist/*.dmg
cat dist/SHA256SUMS

echo ""
echo "→ Creating a DRAFT GitHub release v$VERSION on PetarStoev02/talyx-app..."
gh release create "v$VERSION" \
  --repo PetarStoev02/talyx-app \
  --draft \
  --title "Talyx $VERSION" \
  --generate-notes \
  dist/*.dmg dist/SHA256SUMS
echo "✅ Draft created. Review it, then publish: gh release edit v$VERSION --repo PetarStoev02/talyx-app --draft=false"
echo "   Every download is blocked on first open: users try to open it, dismiss the warning, then click"
echo "   Open Anyway in System Settings > Privacy & Security, or: xattr -dr com.apple.quarantine /Applications/Talyx.app"

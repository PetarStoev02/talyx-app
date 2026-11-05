#!/bin/bash
# Build the macOS release and create a draft GitHub release. Local path, macOS DMGs only: the
# Linux builds and the real-engine smoke test come from the Release workflow on GitHub Actions.
# The DMGs are unsigned in Apple's sense: ad-hoc signed ('-'), not notarized, no
# Developer ID. Apple Silicon will not run a binary with no signature at all, and
# the Electron fuses invalidate any earlier one, so electron-builder signs ad hoc last.
# Needs no credentials. macOS blocks every downloaded version the first time it is opened:
# users click Open Anyway in System Settings > Privacy & Security, or run
# xattr -dr com.apple.quarantine /Applications/Talyx.app.

set -e

source "$(dirname "$0")/release-lib.sh"

# Checked before the build so a bad file fails fast, and again on the copy that is uploaded,
# since the file can change during the minutes the build takes.
check_install_file

# The same body as the workflow: Highlights, the fixed notes, then GitHub's generated notes.
VERSION=$(node -p "require('./package.json').version")
FIXED_NOTES="docs/release-notes/$VERSION.md"
if [ ! -f "$FIXED_NOTES" ]; then
  echo "$FIXED_NOTES is missing; write the release notes before releasing." >&2
  exit 1
fi
NOTES_TMP=$(mktemp)
trap 'rm -f "$NOTES_TMP"' EXIT
if release_notes_file "$HIGHLIGHTS_FILE" "$NOTES_TMP"; then echo >> "$NOTES_TMP"; else : > "$NOTES_TMP"; fi
cat "$FIXED_NOTES" >> "$NOTES_TMP"

# Every uploaded file must come from this build; electron-builder never cleans dist/.
rm -rf dist

echo "Building Talyx v$VERSION..."

echo "→ Building macOS (ARM64 + x64)..."
npm run build:mac

# Unsigned builds carry no proof of origin; the checksums let a user check a download against
# the release page (shasum -a 256 -c SHA256SUMS --ignore-missing). The install file is listed
# too: the app fetches it from this release, so its checksum is part of what users verify.
cp "$INSTALL_FILE" dist/
check_install_file "dist/$INSTALL_FILE"
(cd dist && shasum -a 256 *.dmg "$INSTALL_FILE" > SHA256SUMS)

echo ""
ls -lh dist/*.dmg
cat dist/SHA256SUMS

echo ""
echo "→ Creating a DRAFT GitHub release v$VERSION on PetarStoev02/talyx-app..."
gh release create "v$VERSION" \
  --repo PetarStoev02/talyx-app \
  --draft \
  --title "Talyx $VERSION" \
  --notes-file "$NOTES_TMP" \
  --generate-notes \
  dist/*.dmg "dist/$INSTALL_FILE" dist/SHA256SUMS
echo "✅ Draft created. Review it, then publish: gh release edit v$VERSION --repo PetarStoev02/talyx-app --draft=false"
echo "   Every download is blocked on first open: users try to open it, dismiss the warning, then click"
echo "   Open Anyway in System Settings > Privacy & Security, or: xattr -dr com.apple.quarantine /Applications/Talyx.app"

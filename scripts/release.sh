#!/bin/bash
# Build the macOS release and create a draft GitHub release.
# The DMGs are unsigned in Apple's sense: ad-hoc signed ('-'), not notarized, no
# Developer ID. Apple Silicon will not run a binary with no signature at all, and
# the Electron fuses invalidate any earlier one, so electron-builder signs ad hoc last.
# Needs no credentials. macOS blocks every downloaded version the first time it is opened:
# users click Open Anyway in System Settings > Privacy & Security, or run
# xattr -dr com.apple.quarantine /Applications/Talyx.app.

set -e

# The app runs only the install steps whose hash is pinned in the code, so a release must ship
# exactly that file. The file is gitignored, so a fresh clone has none and cannot release.
INSTALL_FILE=engine-install.json
INSTALL_PIN_FILE=src/main/infrastructure/setup/installSteps.ts

check_install_file() {
  local file="${1:-$INSTALL_FILE}"
  if [ ! -f "$file" ]; then
    echo "✗ $file is missing; the release cannot ship without it." >&2
    return 1
  fi
  local pinned actual
  pinned=$(grep -oE "ENGINE_INSTALL_SHA256 = '[0-9a-f]{64}'" "$INSTALL_PIN_FILE" | grep -oE '[0-9a-f]{64}' || true)
  actual=$(shasum -a 256 "$file" | cut -d' ' -f1)
  if [ -z "$pinned" ] || [ "$actual" != "$pinned" ]; then
    echo "✗ $file does not match the hash pinned in $INSTALL_PIN_FILE." >&2
    echo "  file:   $actual" >&2
    echo "  pinned: ${pinned:-none}" >&2
    echo "  If the file changed on purpose, review it and update the pin in the same commit." >&2
    return 1
  fi
}

# Checked before the build so a bad file fails fast, and again on the copy that is uploaded,
# since the file can change during the minutes the build takes.
check_install_file

# Every uploaded file must come from this build; electron-builder never cleans dist/.
rm -rf dist

VERSION=$(node -p "require('./package.json').version")
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
  --generate-notes \
  dist/*.dmg "dist/$INSTALL_FILE" dist/SHA256SUMS
echo "✅ Draft created. Review it, then publish: gh release edit v$VERSION --repo PetarStoev02/talyx-app --draft=false"
echo "   Every download is blocked on first open: users try to open it, dismiss the warning, then click"
echo "   Open Anyway in System Settings > Privacy & Security, or: xattr -dr com.apple.quarantine /Applications/Talyx.app"

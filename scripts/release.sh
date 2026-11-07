#!/bin/bash
# Build the macOS release and create a draft GitHub release. Local path, macOS DMGs only: the
# Linux builds and the real-engine smoke test come from the Release workflow on GitHub Actions.
# The DMGs are signed with Developer ID and notarized, like the workflow's. Without the five
# signing variables (see CLAUDE.md → Builds → Signing secrets) it refuses: an unsigned release would
# contradict the README. `npm run build:mac` still builds unsigned DMGs for local testing.

set -e

source "$(dirname "$0")/release-lib.sh"

# Checked before the build so a bad file fails fast, and again on the copy that is uploaded,
# since the file can change during the minutes the build takes.
check_install_file
check_mac_signing_env

# The same body as the workflow: Highlights, the fixed notes, then GitHub's generated notes.
VERSION=$(node -p "require('./package.json').version")
FIXED_NOTES="docs/release-notes/$VERSION.md"
if [ ! -f "$FIXED_NOTES" ]; then
  echo "$FIXED_NOTES is missing; write the release notes before releasing." >&2
  exit 1
fi
NOTES_TMP=$(mktemp)
KEY_TMP=$(mktemp)
trap 'rm -f "$NOTES_TMP" "$KEY_TMP"' EXIT
write_apple_api_key "$KEY_TMP"
if release_notes_file "$HIGHLIGHTS_FILE" "$NOTES_TMP"; then echo >> "$NOTES_TMP"; else : > "$NOTES_TMP"; fi
cat "$FIXED_NOTES" >> "$NOTES_TMP"

# Every uploaded file must come from this build; electron-builder never cleans dist/.
rm -rf dist

echo "Building Talyx v$VERSION..."

echo "→ Building macOS (ARM64 + x64)..."
npm run build:mac -- --config.forceCodeSigning=true
notarize_dmgs dist/*.dmg
verify_mac_release

# The in-app update checks each download against these; users can check one by hand against the
# release page (shasum -a 256 -c SHA256SUMS --ignore-missing). The install file is listed
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

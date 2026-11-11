#!/bin/bash
# Build the macOS release and create a draft GitHub release. Local path, macOS only (the DMGs and
# the update zips with latest-mac.yml): the
# Linux builds and the real-engine smoke test come from the Release workflow on GitHub Actions.
# The DMGs are signed with Developer ID and notarized, like the workflow's. Without the five
# signing variables and UPDATE_SIGNING_KEY (see CLAUDE.md → Builds → Signing secrets) it refuses: an unsigned release would
# contradict the README. `npm run build:mac` still builds unsigned DMGs for local testing.

set -e

source "$(dirname "$0")/release-lib.sh"

# Checked before the build so a bad file fails fast, and again on the copy that is uploaded,
# since the file can change during the minutes the build takes.
check_install_file
check_mac_signing_env
check_update_signing_env

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
npm run build:mac -- --config.forceCodeSigning=true
notarize_dmgs dist/*.dmg
verify_mac_release

# Talyx downloads this release only through the signed feed: the zips' sha512 are in
# latest-mac.yml, and latest-mac.yml.sig says the feed is ours.
node scripts/sign-feed.mjs dist/latest-mac.yml

# Users can check a download by hand against the release page
# (shasum -a 256 -c SHA256SUMS --ignore-missing). The install file is listed too: the app
# fetches it from this release, so its checksum is part of what users verify.
cp "$INSTALL_FILE" dist/
check_install_file "dist/$INSTALL_FILE"
(cd dist && shasum -a 256 *.dmg "$INSTALL_FILE" > SHA256SUMS)

echo ""
ls -lh dist/*.dmg dist/*.zip
cat dist/SHA256SUMS

echo ""
echo "→ Creating a DRAFT GitHub release v$VERSION on PetarStoev02/talyx-app..."
gh release create "v$VERSION" \
  --repo PetarStoev02/talyx-app \
  --draft \
  --title "Talyx $VERSION" \
  --notes-file "$NOTES_TMP" \
  --generate-notes \
  dist/*.dmg dist/*.zip dist/*.zip.blockmap dist/latest-mac.yml dist/latest-mac.yml.sig "dist/$INSTALL_FILE" dist/SHA256SUMS
echo "✅ Draft created. Review it, then publish: gh release edit v$VERSION --repo PetarStoev02/talyx-app --draft=false"

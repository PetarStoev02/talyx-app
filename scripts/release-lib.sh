#!/bin/bash
# Shared by scripts/release.sh and .github/workflows/release.yml: the install-file check and the
# highlights section of the release notes. Source it from the repo root; it only defines things.

# The app runs only the install steps whose hash is pinned in the code, so a release must ship
# exactly that file. The file is gitignored, so a fresh clone has none and cannot release.
# It must also name the engine version the app expects and exactly one engine commit, so the
# app and the engine it installs cannot drift apart.
INSTALL_FILE=engine-install.json
INSTALL_PIN_FILE=src/main/infrastructure/setup/installPin.ts
ENGINE_VERSION_FILE=src/shared/engine.ts

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
  check_install_file_content "$file"
}

# CI: writes the install file from the ENGINE_INSTALL_JSON secret (base64 of the file's exact bytes)
# to $1 and checks it. Never echoes the secret.
write_install_file_from_secret() {
  local dest="$1"
  if [ -z "${ENGINE_INSTALL_JSON:-}" ]; then
    echo "::error::Add the ENGINE_INSTALL_JSON secret (base64 of engine-install.json)"
    return 1
  fi
  printf '%s' "$ENGINE_INSTALL_JSON" | base64 -d > "$dest" || return 1
  check_install_file "$dest"
}

check_install_file_content() {
  local file="$1" expected declared commits
  expected=$(grep -oE "EXPECTED_ENGINE_VERSION = '[0-9.]+'" "$ENGINE_VERSION_FILE" | grep -oE "[0-9.]+'" | tr -d "'" || true)
  declared=$(node -e "process.stdout.write(String(require(require('path').resolve(process.argv[1])).engineVersion))" "$file" 2>/dev/null || true)
  if [ -z "$expected" ] || [ "$declared" != "$expected" ]; then
    echo "✗ $file installs engine ${declared:-?}, but the app expects ${expected:-?} ($ENGINE_VERSION_FILE)." >&2
    return 1
  fi
  commits=$(grep -oE '[0-9a-f]{40}' "$file" | sort -u | wc -l | tr -d ' ')
  if [ "$commits" != "1" ]; then
    echo "✗ $file pins $commits distinct commits; it must pin exactly one." >&2
    return 1
  fi
}

# The update button shows the "## Highlights" section of the release body. It is written by hand in
# the gitignored release-highlights.md (1-3 lines like "- **Lead.** Text."), and goes above the
# notes GitHub generates. Writes the body to $2 and returns 0, or returns 1 when there is no file.
# A line the app cannot read only warns: the app skips it.
HIGHLIGHTS_FILE=release-highlights.md
HIGHLIGHT_LINE='^- \*\*.+\.\*\* .+$'

release_notes_file() {
  local highlights="${1:-$HIGHLIGHTS_FILE}" out="$2" line
  if [ ! -f "$highlights" ]; then
    echo "! No $highlights: the update button will show no highlights." >&2
    return 1
  fi
  while IFS= read -r line || [ -n "$line" ]; do
    if [ -n "${line//[[:space:]]/}" ] && ! [[ "$line" =~ $HIGHLIGHT_LINE ]]; then
      echo "! $highlights: the app will skip this line (want '- **Lead.** Text.'): $line" >&2
    fi
  done < "$highlights"
  { printf '## Highlights\n\n'; cat "$highlights"; echo; } > "$out"
}

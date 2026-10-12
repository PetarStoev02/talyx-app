#!/usr/bin/env bash
# Regenerates the voice fixtures. macOS only; run from the repo root:
#   bash tests/fixtures/voice/generate.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"

speak() { # voice, text, outfile
  say -v "$1" -o "$here/tmp.aiff" "$2"
  afconvert -f WAVE -d LEI16@16000 -c 1 "$here/tmp.aiff" "$here/$3"
  rm -f "$here/tmp.aiff"
}

speak Samantha "what is on my calendar tomorrow" en-calendar.wav
speak Daria "какво имам в календара утре" bg-calendar.wav

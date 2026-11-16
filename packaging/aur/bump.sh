#!/bin/bash
# Points PKGBUILD and .SRCINFO at a release: bump.sh <version> <Talyx-amd64.deb> <out dir>.
# Writes the bumped copies to <out dir> and leaves the committed files as they are.
# The Release workflow runs it on the deb it built, so the sum is that of the file in the draft.
set -euo pipefail

VERSION="$1"
DEB="$2"
OUT="$3"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "✗ Not a version: $VERSION" >&2; exit 1; }
SUM=$(sha256sum "$DEB" | cut -d' ' -f1)
HERE=$(dirname "$0")
OLD=$(sed -n 's/^pkgver=//p' "$HERE/PKGBUILD")
OLD_RE=${OLD//./\\.}

mkdir -p "$OUT"
sed -e "s/^pkgver=.*/pkgver=$VERSION/" -e 's/^pkgrel=.*/pkgrel=1/' \
  -e "s/^sha256sums=.*/sha256sums=('$SUM')/" "$HERE/PKGBUILD" > "$OUT/PKGBUILD"
sed -e "s/$OLD_RE/$VERSION/g" -e 's/pkgrel = .*/pkgrel = 1/' \
  -e "s/sha256sums = .*/sha256sums = $SUM/" "$HERE/.SRCINFO" > "$OUT/.SRCINFO"
echo "talyx-bin $VERSION-1, Talyx-amd64.deb sha256 $SUM"

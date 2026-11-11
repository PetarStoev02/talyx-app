#!/bin/bash
# Signs the update feeds of the draft release the Release workflow made, on this machine, and
# adds the signatures to the draft. Run it after the workflow and before publishing: installed
# copies download a release only when its feed carries this signature.
#
# The key never goes to GitHub, so this is the step someone inside the repository cannot do. For
# that to mean anything, it must sign only what the Release workflow built from main. A draft's
# files prove nothing: anyone who can write to the repository can replace them, also from a
# workflow of their own, which uploads under the same name as ours. So the feeds are taken from
# the artifacts of the release.yml run on main at the draft's commit, which nothing outside that
# run can change, and the draft must hold those same bytes.

set -euo pipefail

source "$(dirname "$0")/release-lib.sh"

REPO=PetarStoev02/talyx-app
WORKFLOW_UPLOADER='github-actions[bot]'
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

refuse() {
  echo "✗ $1" >&2
  exit 1
}

check_update_signing_key

# One line per release: draft or not, the commit it is tagged at, who uploaded its files (the
# signatures this script adds aside).
RELEASE_FIELDS='[
  (if has("draft") then .draft else "none" end),
  (.target_commitish // ""),
  ([.assets[]? | select(.name | endswith(".sig") | not) | .uploader.login] | unique | join(","))
] | @tsv'
RELEASE=$(gh api "repos/$REPO/releases" \
  --jq "[.[] | select(.tag_name == \"$TAG\")][0] // {} | $RELEASE_FIELDS") ||
  refuse "GitHub could not be read."
IFS=$'\t' read -r DRAFT TARGET UPLOADERS <<< "$RELEASE"
[ "$DRAFT" != none ] || refuse "There is no release $TAG. Run the Release workflow first."
[ "$DRAFT" = true ] || refuse "$TAG is already published. Sign a release while it is a draft."
[ "$UPLOADERS" = "$WORKFLOW_UPLOADER" ] ||
  refuse "$TAG has files not uploaded by a workflow (uploaded by: $UPLOADERS). Delete the draft and run the Release workflow again."

git fetch --quiet origin main
git merge-base --is-ancestor "$TARGET" origin/main 2>/dev/null ||
  refuse "$TAG was built from $TARGET, which is not a commit of main."

RUN=$(gh run list --repo "$REPO" --workflow release.yml --branch main --event workflow_dispatch \
  --commit "$TARGET" --status success --limit 1 --json databaseId --jq '.[0].databaseId // empty') ||
  refuse "GitHub could not be read."
[ -n "$RUN" ] || refuse "No successful Release workflow run on main built $TARGET."

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
BUILT="$WORK/built"
DRAFTED="$WORK/drafted"
gh run download "$RUN" --repo "$REPO" --name feeds --dir "$BUILT" ||
  refuse "Release run $RUN kept no update feeds (its feeds artifact)."
gh release download "$TAG" --repo "$REPO" --pattern 'latest-*.yml' --dir "$DRAFTED"

# The same feeds on both sides, byte for byte.
[ "$(ls "$BUILT")" = "$(ls "$DRAFTED")" ] ||
  refuse "$TAG's update feeds are not the ones run $RUN built: $(ls "$DRAFTED" | tr '\n' ' ')"
for feed in "$BUILT"/latest-*.yml; do
  cmp -s "$feed" "$DRAFTED/$(basename "$feed")" ||
    refuse "$(basename "$feed") in $TAG differs from what run $RUN built. Delete the draft and run the Release workflow again."
done

echo "Signing the update feeds of $TAG, built by run $RUN from $(git log -1 --format='%h %s' "$TARGET"):"
grep -H -E '^version:|url:' "$BUILT"/latest-*.yml | sed "s|$BUILT/||"
node scripts/sign-feed.mjs "$BUILT"/latest-*.yml
gh release upload "$TAG" --repo "$REPO" --clobber "$BUILT"/latest-*.yml.sig

echo "✅ Signed. Review the draft, then publish: gh release edit $TAG --repo $REPO --draft=false"

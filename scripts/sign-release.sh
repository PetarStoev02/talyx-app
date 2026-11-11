#!/bin/bash
# Signs the update feeds of the draft release the Release workflow made, on this machine, and
# adds the signatures to the draft. Run it after the workflow and before publishing: installed
# copies download a release only when its feed carries this signature.
#
# The key never goes to GitHub, so this is the step someone inside the repository cannot do. It
# signs only what the workflow built: a draft, tagged at a commit of main, whose every file was
# uploaded by the workflow (the signatures this script adds aside). A file added or replaced by
# hand, or with a stolen token, stops it.

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

IFS=$'\t' read -r DRAFT TARGET UPLOADERS < <(
  gh api "repos/$REPO/releases" --jq \
    "[.[] | select(.tag_name == \"$TAG\")][0] // {} | [(if has(\"draft\") then .draft else \"none\" end), (.target_commitish // \"\"), ([.assets[]? | select(.name | endswith(\".sig\") | not) | .uploader.login] | unique | join(\",\"))] | @tsv"
)
[ "$DRAFT" != none ] || refuse "There is no release $TAG. Run the Release workflow first."
[ "$DRAFT" = true ] || refuse "$TAG is already published. Sign a release while it is a draft."
[ "$UPLOADERS" = "$WORKFLOW_UPLOADER" ] ||
  refuse "$TAG has files not uploaded by the Release workflow (uploaded by: $UPLOADERS). Delete the draft and run the workflow again."

git fetch --quiet origin main
git merge-base --is-ancestor "$TARGET" origin/main 2>/dev/null ||
  refuse "$TAG was built from $TARGET, which is not a commit of main."

FEEDS=$(mktemp -d)
trap 'rm -rf "$FEEDS"' EXIT
gh release download "$TAG" --repo "$REPO" --pattern 'latest-*.yml' --dir "$FEEDS"
ls "$FEEDS"/latest-*.yml > /dev/null 2>&1 || refuse "$TAG has no update feed (latest-*.yml)."

echo "Signing the update feeds of $TAG, built from $(git log -1 --format='%h %s' "$TARGET"):"
grep -H -E '^version:|url:' "$FEEDS"/latest-*.yml | sed "s|$FEEDS/||"
node scripts/sign-feed.mjs "$FEEDS"/latest-*.yml
gh release upload "$TAG" --repo "$REPO" --clobber "$FEEDS"/latest-*.yml.sig

echo "✅ Signed. Review the draft, then publish: gh release edit $TAG --repo $REPO --draft=false"

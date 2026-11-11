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

# The release with this tag: how many there are, draft or not, the commit it is tagged at, and
# who uploaded its files (the signatures this script adds aside). "|" keeps an empty field in
# its place, which a tab would not.
RELEASE_FIELDS='[
  length,
  (.[0] | if . == null then "none" else .draft end),
  (.[0].target_commitish // ""),
  ([.[0].assets[]? | select(.name | endswith(".sig") | not) | .uploader.login] | unique | join(","))
] | map(tostring) | join("|")'
RELEASE=$(gh api "repos/$REPO/releases?per_page=100" \
  --jq "[.[] | select(.tag_name == \"$TAG\")] | $RELEASE_FIELDS") ||
  refuse "GitHub could not be read."
IFS='|' read -r COUNT DRAFT TARGET UPLOADERS <<< "$RELEASE"
[ "$COUNT" != 0 ] || refuse "There is no release $TAG. Run the Release workflow first."
# A draft has no tag of its own yet, so two can carry the same one: which would be signed?
[ "$COUNT" = 1 ] || refuse "$COUNT releases are tagged $TAG. Delete the ones the Release workflow did not make."
[ "$DRAFT" = true ] || refuse "$TAG is already published. Sign a release while it is a draft."
[ "$UPLOADERS" = "$WORKFLOW_UPLOADER" ] ||
  refuse "$TAG has files not uploaded by a workflow (uploaded by: $UPLOADERS). Delete the draft and run the Release workflow again."

git fetch --quiet --tags origin main
git merge-base --is-ancestor "$TARGET" origin/main 2>/dev/null ||
  refuse "$TAG was built from $TARGET, which is not a commit of main."

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
DRAFTED="$WORK/drafted"
gh release download "$TAG" --repo "$REPO" --pattern 'latest-*.yml' --dir "$DRAFTED" ||
  refuse "$TAG has no update feed (latest-*.yml)."

# The run that built this draft: a successful release.yml run on main at that commit whose feeds
# are the draft's, byte for byte. The workflow can have run there more than once.
RUNS=$(gh run list --repo "$REPO" --workflow release.yml --branch main --event workflow_dispatch \
  --commit "$TARGET" --status success --limit 20 --json databaseId --jq '.[].databaseId') ||
  refuse "GitHub could not be read."
[ -n "$RUNS" ] || refuse "No successful Release workflow run on main built $TARGET."

same_feeds() {
  local feed
  [ "$(ls "$1")" = "$(ls "$DRAFTED")" ] || return 1
  for feed in "$1"/latest-*.yml; do
    cmp -s "$feed" "$DRAFTED/$(basename "$feed")" || return 1
  done
}

BUILT=""
for RUN in $RUNS; do
  gh run download "$RUN" --repo "$REPO" --name feeds --dir "$WORK/run-$RUN" 2> /dev/null || continue
  if same_feeds "$WORK/run-$RUN"; then
    BUILT="$WORK/run-$RUN"
    break
  fi
done
[ -n "$BUILT" ] ||
  refuse "$TAG's update feeds are not what a Release run on main built from $TARGET. Delete the draft and run the Release workflow again."

# This is the one moment a person looks at what is about to reach every installed Talyx: the
# branch rules let code into main with no second reviewer.
LAST=$(gh release list --repo "$REPO" --exclude-drafts --exclude-pre-releases --limit 1 \
  --json tagName --jq '.[0].tagName // empty') || refuse "GitHub could not be read."
echo "Release $TAG, built by run $RUN from $(git log -1 --format='%h %s' "$TARGET")."
echo "Commits since ${LAST:-the first commit}:"
git log --format='  %h %an %ad %s' --date=short ${LAST:+"$LAST.."}"$TARGET"
echo "Update feeds:"
grep -H -E '^version:|url:' "$BUILT"/latest-*.yml | sed "s|$BUILT/|  |" || true
read -r -p "Sign these feeds? Type yes: " ANSWER
[ "$ANSWER" = yes ] || refuse "Not signed."

node scripts/sign-feed.mjs "$BUILT"/latest-*.yml
gh release upload "$TAG" --repo "$REPO" --clobber "$BUILT"/latest-*.yml.sig

echo "✅ Signed. Review the draft, then publish: gh release edit $TAG --repo $REPO --draft=false"

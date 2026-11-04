# Roster interaction fixture

Run from the repository root:

```sh
npx vite --config tests/fixtures/roster/vite.config.ts
```

Open `http://localhost:5183`. This renders the production roster components against an
in-memory engine double with 11 profiles and two rooms. It never accesses user profiles.
Reloading resets its synthetic data; restart/cross-client persistence is covered by the
service tests and must also be verified against the real engine once PR 2 is integrated.

Check pin/unpin (folder counts change), four-pin layout, menu and drag reordering, nesting
and cycle prevention, hide/restore, folder creation, profile deletion confirmation, bot and
room selection, unread clearing, and keyboard navigation through menus and dialogs.
Use the engine integration for final acceptance; this fixture does not prove gateway access.

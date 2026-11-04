# Roster interaction fixture

Run from the repository root:

```sh
npx vite --config tests/fixtures/roster/vite.config.ts
```

Open `http://localhost:5183`. This renders the production roster components against an
in-memory engine double with 11 profiles and two rooms. It never accesses user profiles.
Reloading resets its synthetic data; restart and cross-client persistence are covered by the
unit tests and checked against the real engine through `npm run dev`.

Check pin/unpin (folder counts change), four-pin layout, menu and drag reordering, nesting
and cycle prevention, hide/restore, folder creation, profile deletion confirmation, bot and
room selection, unread clearing, and keyboard navigation through menus and dialogs.
The chat side runs a scripted bot per profile (`fixtureChat.ts`): Talyx has a history with a
delegation line; any other bot starts empty. A message containing "clarify" shows a two-question
card, "approve" an approval card, "ask" a delegation line before the reply; anything else streams
a short markdown reply. Check streaming, the cards, Stop, the model and reasoning chips, images,
scroll-to-bottom and unread marks on a bot you leave while it replies.

The details panel opens from the name pill or "Edit profile". Each profile has a synthetic
description, SOUL and model (`custom · team-manager`); Analyst has two routines, one paused.
Picking `team-worker` makes the double ask for confirmation, as the engine does for a costly
model. Check that the panel pushes the chat, Save applies title, description, model and SOUL,
Cancel discards, the confirm dialog's two answers, routine toggles, New routine and Delete. The
roster's `+` opens New bot: check the profile-id hint, a taken name, a non-Latin name (`bot-N`),
the default folder, and that the new bot lands in its folder, is selected and answers a message.

Use the engine integration for final acceptance; this fixture does not prove gateway access.

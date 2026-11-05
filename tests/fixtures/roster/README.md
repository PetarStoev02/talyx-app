# Roster interaction fixture

Run from the repository root:

```sh
npx vite --config tests/fixtures/roster/vite.config.ts
```

Open `http://localhost:5183`. This renders the production roster components against an
in-memory engine double with 11 profiles and three rooms. It never accesses user profiles.
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

The details panel opens from the name pill or "Edit bot" (right-click a bot). Each profile has a synthetic
description, SOUL and model (`custom · 9-route-provider`); Analyst has two routines, one paused.
Picking `paid-model` makes the double ask for confirmation, as the engine does for a costly
model. Check that the panel pushes the chat, Save applies title, description, model and SOUL,
Cancel discards, the confirm dialog's two answers, routine toggles, New routine and Delete. The
roster's `+` opens New bot: check the profile-id hint, a taken name, a non-Latin name (`bot-N`),
the default folder, and that the new bot lands in its folder, is selected and answers a message.

Avatars: every bot is a block. Writer has a saved look (tower, faces off), Designer an older
client's blobatar and hsl colour (read as the nearest block), the rest match their names; Talyx is
the logo. Researcher shows working, Analyst waiting on you, and "Drop the engine socket" greys
every block as offline. Check the pinned tiles blink, bob and lift on hover, the details hero
turns toward the cursor, the Look tab (shapes, colours, Match the name, the face switch, the
preview's crossfade) and that Save updates every size at once. A Look save or a new bot exports
the block through `profiles.set_asset`; the newest export shows under the roster as a 1024px PNG.
A bot that is answering shows "<name> is typing" with its block bobbing; in a room, each answering
member's block bobs beside "Answering:" and in the name pill.

Rooms (`fixtureRooms.ts`): Team discussion has a history with three senders; Archived plans is a
room the engine does not run, so it reads but has no composer. Sending to a room makes each member
answer in turn, a few seconds apart, with "Answering:" and "Up next:" under the transcript. A message
containing "approve" shows an approval card, "stall" a turn to retry, "fail" a failed turn. Check
New room from `+` (name, 2 to 6 bots, folder), Pin (the room joins the pinned tiles, which center
when a row is not full), Move to, Delete room with its name in the confirmation, images in the room
composer, and the unread dot on a room that gets a reply while another one is open.

Settings (the button under the roster) shows the Providers and Default model sections against an
in-memory providers double (`fixtureProviders.ts`, the unit tests' double): the router as the active
endpoint, written in config.yaml, so Edit asks for its key again and it has no Remove. Check Add
provider with an API key (`sk-` keys pass Check, others are rejected), Reveal and Hide, an account
sign-in (openai-codex: a device code the "browser" approves after two polls; xai-oauth: paste `good`,
anything else fails with Retry; qwen-oauth: an external command with Copy and Check again), a new
custom endpoint (Check fills the first served model), the default model, and that every model picker
lists only an endpoint's saved models.

Setup (`fixtureSetup.ts`): `?setup=<mode>` opens the first-run flow at Welcome against a scripted
install (fake `echo` commands, one output line every 300 ms) and the providers and roster doubles
above; its Done opens the fixture on Talyx's chat. No `?setup` keeps the fixture as it is.

| Mode       | The engine step shows                                                         |
| ---------- | ----------------------------------------------------------------------------- |
| `missing`  | The install commands; Install runs them, then the engine is ready (0.22.5)    |
| `offline`  | "Talyx could not get the install steps." with Try again and Choose file       |
| `mismatch` | The same screen with the hash-mismatch sentence                               |
| `fail`     | The install stops in command 2 (exit 1): Try again, Show the commands, Copy   |
| `old`      | Engine 0.21.0 is older: Update runs the install, Continue anyway moves on     |
| `windows`  | Windows' attach error; Install the engine shows the Windows sentence and link |

Check Copy and Copy all, Install, Cancel (back to the commands), Try again, Choose file (it always
"finds" engine 0.22.5), Continue, the provider step (Continue once the router is read, Skip), Make
bot and Skip, and that Done lands on Talyx's chat; in light and dark, keyboard only.

`?nudge` starts with no provider: Talyx's chat (no other bot's) shows "Add a model provider so bots
can answer." above the composer, its Open Settings opens Settings, and once the Providers section
reads the router the line is gone when you go back.

Use the engine integration for final acceptance; this fixture does not prove gateway access.

Room model: Team discussion starts on mixed models (Analyst runs on `paid-model`), so its model
chip reads "Mixed models" and a pick switches every member. Clients discussion's chip is off until
its bots have answered once.

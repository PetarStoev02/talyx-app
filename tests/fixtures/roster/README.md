# Roster interaction fixture

Run from the repository root:

```sh
npx vite --config tests/fixtures/roster/vite.config.ts
```

Open `http://localhost:5183`. This renders the production roster components against an
in-memory engine double (`engineDouble.ts`, which the website's live demo runs on too) with 11
profiles and three rooms. It never accesses user profiles.
Reloading resets its synthetic data; restart and cross-client persistence are covered by the
unit tests and checked against the real engine through `npm run dev`.

Check pin/unpin (folder counts change), four-pin layout, menu and drag reordering, nesting
and cycle prevention, hide/restore, folder creation, profile deletion confirmation, bot and
room selection, unread clearing, and keyboard navigation through menus and dialogs.
The chat side runs a scripted bot per profile (`fixtureChat.ts`): Talyx has a history with a
delegation (its tool line is hidden), Analyst one that ends on a question, Developer one that opens
with an approval card and a question card (the website's cards demo); any other bot starts empty. A message containing "clarify" shows a two-question
card, "approve" an approval card, "ask" the activity line on "Asking Analyst" before the reply; anything else streams
a short markdown reply. Check streaming, the cards, Stop, the model and reasoning chips, images,
scroll-to-bottom and unread marks on a bot you leave while it replies.

The details panel opens from the name pill or "Edit bot" (right-click a bot). Each profile has a one-line
description, SOUL and model (`anthropic · claude-sonnet-4-5`); Analyst has two routines, one paused.
Picking `claude-opus-4-1` makes the double ask for confirmation, as the engine does for a costly
model. The model menu starts with "Uses default (<Talyx's model>)": a bot on it moves when Talyx's
model changes, from Talyx's panel or Settings, and a bot with its own model stays. Check that the panel pushes the chat, Save applies title, description, model and SOUL,
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
A bot that is answering shows one activity line with its block bobbing ("<name> is typing" before
its first tool, then the newest tool, the tool count and the time taken); in a room, each answering
member's block bobs beside "Answering:" and in the name pill.

Rooms (`fixtureRooms.ts`): Team discussion has a history with three senders; Archived plans has
a short one with Planner. Sending to a room makes each member answer in turn, a few seconds apart,
with "Answering:" and "Up next:" under the transcript. A message
containing "approve" shows an approval card, "stall" a turn to retry, "fail" a failed turn. Check
New room from `+` (name, 2 to 6 bots, folder), Pin (the room joins the pinned tiles, which center
when a row is not full), Move to, Delete room with its name in the confirmation, images in the room
composer, and the unread dot on a room that gets a reply while another one is open.

Settings (the button under the roster) shows the Providers and Default model sections against an
in-memory providers double (`fixtureProviders.ts`, the unit tests' double): an Anthropic endpoint as the
active one, written in config.yaml, so Edit asks for its key again and it has no Remove. Check Add
provider with an API key (`sk-` keys pass Check, others are rejected), Reveal and Hide, an account
sign-in (openai-codex: a device code the "browser" approves after two polls; xai-oauth: paste `good`,
anything else fails with Retry; qwen-oauth: an external command with Copy and Check again), a new
custom endpoint (Check fills the first served model), the default model, and that every model picker
lists only an endpoint's saved models.

Setup (`fixtureSetup.ts`): `?setup=<mode>` opens the first-run flow at Welcome against a scripted
install (fake `echo` commands, one output line every 300 ms) and the providers and roster doubles
above; its Done opens the fixture on Talyx's chat. No `?setup` keeps the fixture as it is.

| Mode        | The engine step shows                                                          |
| ----------- | ------------------------------------------------------------------------------ |
| `missing`   | The install commands; Install runs them, then the engine is ready (0.22.7)     |
| `offline`   | "Talyx could not get the install steps." with Try again and Choose file        |
| `mismatch`  | The same screen with the hash-mismatch sentence                                |
| `fail`      | The install stops in command 2 (exit 1): Try again, Show the commands, Copy    |
| `ssl`       | The same stop on a TLS download error, with the network hint above the output  |
| `old`       | Engine 0.21.0 is older: Update runs the install, Continue anyway moves on      |
| `old-after` | No setup; the footer's update button offers the engine update (0.22.5), below  |
| `windows`   | Windows' attach error; Install the engine shows the Windows sentence and link  |
| `protocol`  | Engine 0.22.9 on another protocol: Get the latest Talyx opens the release page |

`old-after` is an older engine after setup: the footer's update button (see Update button below)
carries "Engine 0.22.7 ready to install" (you have 0.22.5); its Install the engine button opens the
Agents page's install flow, which ends on ready with the restart hint (Copy; Try again clears it), and the
button is gone. Add `&stuck=1` to `old` or
`old-after` and the install leaves the older engine running: "Talyx still runs the engine at
/usr/local/bin/talyx-engine, which is 0.21.0." (0.22.5 in `old-after`). Use the newly installed
engine (or Choose file) then finds the expected engine in the user bin.

The install output names a made-up engine (`fakeengine`), which setup shows as `talyx-engine`; the
ready screen keeps it under a collapsed "Install output". Add `&outside=1` to `fail` or `ssl` and
the engine is installed "from a terminal" after the failure: focusing the window moves the step to
ready. `&provider=elsewhere` starts the provider step with no provider; one is added "in another
window" when this one loses focus, and the step shows it when the window gets focus again.

Update button (`fixtureUpdates.ts`): the sidebar footer is the app's own, so its update button takes the
refresh button's place while an update is pending. `?update=<mode>` scripts what main reports; no
`?update` leaves the refresh button. The fake release is 1.0.1, published 3 hours ago, with two
highlights and 9 changes. A download advances every 200 ms (about 2 s) to ready; Restart to update and
Open the release page only show a toast.

| Mode          | The footer shows                                                                |
| ------------- | ------------------------------------------------------------------------------- |
| `talyx`       | Available: Download; the ring fills, then "ready" with Restart to update        |
| `downloading` | A download already running (progress ring, Cancel back to available)            |
| `ready`       | Ready: Restart to update                                                        |
| `failed`      | A checksum failure: Try again (fails again) and Open the release page           |
| `unsigned`    | A feed Talyx did not sign: the same, with the signature message                 |
| `nodownload`  | Available with nothing Talyx can download itself: only Open the release page    |
| `engine`      | The engine item only (0.22.5 below the pin); its action runs the engine install |
| `both`        | The engine item above the Talyx item, one button                                |

Check hover and click to open and pin the popover, Escape, the ring and percent while downloading,
Cancel, and the engine action landing on the Agents page's install flow; in light and dark, keyboard
only.

Check Copy and Copy all, Install, Cancel (back to the commands), Try again, Choose file (it always
"finds" engine 0.22.7), Continue, the provider step (Continue once the endpoint is read, Skip), Make
bot and Skip, and that Done lands on Talyx's chat; in light and dark, keyboard only.

`?nudge` starts with no provider: Talyx's chat (no other bot's) shows "Add a model provider so bots
can answer." above the composer, its Open Settings opens Settings, and once the Providers section
reads the endpoint the line is gone when you go back.

Use the engine integration for final acceptance; this fixture does not prove gateway access.

Room model: Team discussion starts on mixed models (Analyst runs on `claude-opus-4-1`), so its model
chip reads "Mixed models" and a pick switches every member. Clients discussion's chip is off until
its bots have answered once.

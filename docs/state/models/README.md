# TLA+ models of the engine connection and the update flow

These are the models TLC checked for #188 (F2). They model the code on `main` at 1383426, after the
fixes from the first statechart runs (#190 to #193), and with the chat's `load` reading the history
after `session.resume` (finding 1 below). `tests/unit/stateModels.test.ts` (F5) fails when a model's
states or events differ from the TypeScript unions it models (`ConnectionState`, `UpdateState`,
`UpdateEvent`). It also fails when a guard or a property names a state outside them, or when a
property in a `.cfg` is missing from this file. The test does not run TLC. When you change a flow,
change its model, run TLC again and update the results below.

| Model                  | Code it models                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EngineConnection.tla` | `shared/engine/host.ts` and `reconnect-backoff.ts` (redial), `json-rpc-gateway.ts` (replay of the gap, `snapshot_required`, replay timeout), `features/chat/chat.ts` `load` and `events.ts` `handleEvent` (reload and its buffer), `app/providers/useChatBackend.ts` (reload after a drop, unread mark) |
| `RoomPolling.tla`      | `features/chat/useRoomPolling.ts` and `room.ts` (`groups.*` reads, send with an event id, `readAfterChange`), `features/bots/actions.ts` `applySnapshot` and `store.ts` `seeRoom` (room unread mark)                                                                                                    |
| `UpdateFlow.tla`       | `main/infrastructure/updater/releaseChecks.ts` (four triggers, one check at a time), `updateState.ts` (`next`, the store), `selfUpdate.ts` (download, restart, install on quit)                                                                                                                         |

The connection model also takes three facts from the engine's own code: the engine subscribes a
session on a socket only on `session.resume`; a `session.resume` after a replay on the same
connection first writes the frames published since that replay's cursor (`catch_up`), unless its
ring let go of them; and it answers the calls on one socket in order.

## Run TLC

TLC 1.7.4 (`tla2tools.jar`) and Java 25, as `/pstack:statechart` installs them with mise. From
this folder:

```sh
java -XX:+UseParallelGC -cp "$(mise where http:tla2tools)/tla2tools.jar" tlc2.TLC -workers auto UpdateFlow.tla
```

Do the same for `RoomPolling.tla` and `EngineConnection.tla`. Each `.cfg` sets the bounds and
lists the properties. TLC stops at the first property that breaks; to see the others, remove it
from the `.cfg`. `/pstack:statechart` draws a chart from the same files.

In the tables, "checked" means a change to the modeled code can break the property. "By
construction" means the model writes the code's rule into its steps: the property records the
rule, and TLC cannot break it.

## Results (2026-11-20)

### Engine connection

`MaxMsgs = 3`, `MaxDials = 2`, `MaxDrops = 1`. Without `NoMessageSkipped`, the one property that
breaks: 564,748 distinct states, no violation.

| Property                 | Result       | What it says                                                                                                                                      |
| ------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TypeOK`                 | holds        | The connection is always in a `ConnectionState`.                                                                                                  |
| `RedialWhenWanted`       | holds        | A wanted socket that is closed or in error always has a redial set (checked; #193).                                                               |
| `NoMessageLost`          | holds        | A settled chat shows every message the engine stored, and the session stays subscribed (checked: finding 1 below broke it).                       |
| `NoMessageSkipped`       | **violated** | Under one replay cursor, the gateway gives the chat every message from the first it gave up to the cursor. Finding 2 below.                       |
| `NoSendLost`             | holds        | A send that is over is stored by the engine, or the composer has the draft back (checked).                                                        |
| `NoneShownTwice`         | holds        | The gateway gives each message to the chat once per replay cursor (checked). The transcript also keeps one row per message id (fast-check, #197). |
| `NoUnreadWithoutMessage` | holds        | An unread mark means the chat has a message that the user did not see. By construction: `handleEvent` marks only a message new to the transcript. |

**Finding 1: a load could miss a reply (fixed).** On the order before the fix, TLC's shortest path
had 9 steps. The socket opens. The user opens a bot's chat for the first time in this window. `load`
reads the history over REST. The bot finishes a reply. Then `load`'s `session.resume` subscribes the
session on the socket. The reply is not in the history that was read, and it did not come live,
because the session was not subscribed yet. The engine's catch-up starts only from the cursor of a
replay on the same connection, and here there is none.

The same window opens for any load whose history read lands before the session is subscribed,
when the client has no replay cursor for that session. Examples: a first open, or the reload after
a reconnect of a chat that had no live event since it loaded (the review found that path, 17
steps). The reply then shows only after the next turn ends, after another reconnect, or after the
whole history is loaded. Selecting the bot again does not reload, because `open` runs only for a
chat with no session. In the model a reply is one event. In the code a reply is many events, and
a `message.complete` that arrives live ends the turn and reloads the chat. So only a reply whose
`message.complete` lands inside the window is lost. The fix: `load` now waits for
`session.resume` and only then reads the history, so a reply that ends between the two comes live
into the load's buffer. The model's `HistoryRead` waits for the resume the same way; without that
wait, TLC breaks `NoMessageLost` again in 9 steps. That order makes another case likely: a reply
that ends after the resume but before the history read is in the history and in the buffer. So a
load that buffered the `message.complete` of a reply past its snapshot reads again (`LoadReadsAgain` in the model), and its new snapshot is then past that reply. A failed reply is never stored, so its frame is kept instead. The model shows the transcript as a set, so it cannot see that
duplicate itself; `tests/unit/chat/chat.test.ts` ("should show a reply once when it ends while a
first open reads the history", and "... the resume") checks both cases.
The code reads again at most twice (`MAX_REREADS` in `features/chat/chat.ts`), so a bot that ends a
reply on every read cannot keep the chat loading; past that the load lands and the buffer may show
one reply twice. The model's `LoadReadsAgain` is unbounded, which only adds behaviours.

**Finding 2: a replay that times out skips the gap (vendored client).** TLC's shortest path has
18 steps. Message 1 arrives live. The socket drops. Message 2 is stored while it is down. On the
redial, `session.events.since` gets no answer within `REPLAY_REQUEST_TIMEOUT_MS`. The client drops
the error, keeps its cursor at 1 and sends no `session.replay_gap`. The engine then answers late
and records its replay cursor at 2, so its catch-up starts after 2. Message 3 arrives live, and the
client's cursor moves past 2. The chat still heals: the reload after the reconnect and the reload
at the end of message 3's turn read the history, so finding 2 alone does not break
`NoMessageLost`. The code is the vendored engine client (`json-rpc-gateway.ts`), which keeps
upstream's code as written.

### Rooms

`MaxRows = 3`, `MaxDrops = 2`. 40,850 distinct states, no violation.

| Property                 | Result | What it says                                                                                                                           |
| ------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `TypeOK`                 | holds  | The send and the read are always in a known phase.                                                                                     |
| `NoHole`                 | holds  | The room shows a prefix of the log, each row once (checked: a read that lands late keeps only what is past the cursor).                |
| `MineShows`              | holds  | Your message shows when a read that started after it was stored lands (checked: `readAfterChange` waits out the running read).         |
| `MineOnce`               | holds  | Your message is one row, however many times you send it. By construction: the model reuses the event id on a retry, as `room.ts` does. |
| `NoSendLost`             | holds  | A send that is over left a row, or a draft to send again. By construction.                                                             |
| `NoUnreadWithoutMessage` | holds  | The room is marked unread only when its log has a row that the room did not show you (checked).                                        |

### Update flow

`MaxChecks = 4`, `MaxRestarts = 2`. 1,836 distinct states, no violation.

| Property                      | Result | What it says                                                                                                                   |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `TypeOK`                      | holds  | The store is always in an `UpdateState`, and the last event is an `UpdateEvent`.                                               |
| `OneDownload`                 | holds  | Never two downloads (checked: if a download can start from any state, it breaks).                                              |
| `DownloadIsOffered`           | holds  | The running download gets the version that the button shows. By construction: a check sets the target and the button together. |
| `NoRestartUnasked`            | holds  | Talyx restarts into an update only when you click Restart, or when you quit. By construction: no other step restarts.          |
| `ReadyCanRestart`             | holds  | A Restart button always has a verified download behind it (checked).                                                           |
| `FailedRestartOffersTryAgain` | holds  | After a failed restart, the button shows the failure and offers Try again (checked: the code before #190 breaks it).           |

## What the models leave out

- One bot's chat with one session, and one room. The other chats and rooms are independent
  copies.
- The backoff delays and the heartbeat. A redial, a timeout and a dropped heartbeat are steps
  with no clock. The ladder is in `docs/state/connection.md`.
- A gateway restart that changes the replay epoch. It drops the cursor, as the
  `snapshot_required` case does.
- The roster poll's unread mark for bots (`last_active`). The model covers the live mark from
  `message.complete`.
- Room rows that the transcript hides (settled turns, finished rounds). The roster counts them,
  so a room can show a dot with nothing new (the `ponytail` note in `applySnapshot`).
- The engine's turn: a reply is one event, and a send stores one message.

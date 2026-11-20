# TLA+ models of the engine connection and the update flow

These are the models TLC checked for #188 (F2). They model the code on `main` at 1383426, after
the fixes the first statechart runs led to (#190 to #193). `tests/unit/stateModels.test.ts` (F5)
fails when a model's states or events differ from the TypeScript unions it models
(`ConnectionState`, `UpdateState`, `UpdateEvent`). It also fails when a property in a `.cfg` is
missing from this file. The test does not run TLC. When you change a flow, change its model, run
TLC again and update the results below.

| Model                  | Code it models                                                                                                                                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EngineConnection.tla` | `shared/engine/host.ts` and `reconnect-backoff.ts` (redial), `json-rpc-gateway.ts` (replay of the gap, `snapshot_required`), `features/chat/chat.ts` `load` and `events.ts` `handleEvent` (reload and its buffer), `app/providers/useChatBackend.ts` (reload after a drop, unread mark) |
| `RoomPolling.tla`      | `features/chat/useRoomPolling.ts` and `room.ts` (`groups.*` reads, send with an event id, `readAfterChange`), `features/bots/actions.ts` `applySnapshot` and `store.ts` `seeRoom` (room unread mark)                                                                                    |
| `UpdateFlow.tla`       | `main/infrastructure/updater/releaseChecks.ts` (four triggers, one check at a time), `updateState.ts` (`next`, the store), `selfUpdate.ts` (download, restart, install on quit)                                                                                                         |

## Run TLC

TLC 1.7.4 (`tla2tools.jar`) and Java 25, as `/pstack:statechart` installs them with mise. From
this folder:

```sh
java -XX:+UseParallelGC -cp "$(mise where http:tla2tools)/tla2tools.jar" tlc2.TLC -workers auto UpdateFlow.tla
```

Do the same for `RoomPolling.tla` and `EngineConnection.tla`. Each `.cfg` sets the bounds and
lists the properties. `/pstack:statechart` draws a chart from the same files.

## Results (2026-11-20)

### Engine connection

`MaxMsgs = 2`, `MaxDials = 3`, `MaxDrops = 2`. Without `NoMessageLost`: 453,901 distinct states,
no violation.

| Property                 | Result       | What it says                                                                                                                            |
| ------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `TypeOK`                 | holds        | The connection is always in a `ConnectionState`.                                                                                        |
| `RedialWhenWanted`       | holds        | A wanted socket that is closed or in error always has a redial set.                                                                     |
| `NoMessageLost`          | **violated** | A settled chat shows every message the engine stored, and the session stays subscribed. See the open finding below.                     |
| `NoMessageSkipped`       | holds        | Under one replay cursor, the gateway gives the chat every message from the first it gave up to the cursor.                              |
| `NoSendLost`             | holds        | A send that is over is stored by the engine, or the composer has the draft back.                                                        |
| `NoneShownTwice`         | holds        | The gateway gives each message to the chat once per replay cursor. The transcript also keeps one row per message id (fast-check, #197). |
| `NoUnreadWithoutMessage` | holds        | An unread mark means the chat has a message that the user did not see.                                                                  |

**Open finding (to discuss, no issue yet).** TLC's shortest path for `NoMessageLost` has 9
steps. The socket opens. The user opens a bot's chat for the first time in this window. `load`
reads the history over REST. The bot finishes a reply. Then `session.resume` subscribes the
session on the socket. The reply is not in the history that was read, and it did not come live,
because the session was not subscribed yet. The engine catches a socket up on `session.resume`
only from the cursor of a replay on that connection (`SessionEvents.catch_up`). On a first open
there is no cursor. The reply then shows only after the next turn ends, after a reconnect, or
after the whole history is loaded. Selecting the bot again does not reload the chat, because
`open` runs only when the chat has no session. In the model a message is one event. In the code
a reply is many events. Only a reply whose `message.complete` lands inside that short window is
lost: an earlier `message.complete` ends the turn, and that reload heals the chat. A model that
reads the history only after the session is subscribed (400,171 states) satisfies every property,
including `NoMessageLost`.

**Note on `replayHold`.** The model shows that the hold never parks a frame. A new socket gets
live frames only after `session.resume`, and the client sends that after its
`session.events.since`. The engine answers them in order on one socket. With the hold removed,
`NoMessageSkipped` still holds. The hold costs nothing and protects an engine that delivers
frames in another order, so it stays.

### Rooms

`MaxRows = 3`, `MaxDrops = 2`. 40,850 distinct states, no violation.

| Property                 | Result | What it says                                                                               |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------ |
| `TypeOK`                 | holds  | The send and the read are always in a known phase.                                         |
| `NoHole`                 | holds  | The room shows a prefix of the log, each row once.                                         |
| `Caught`                 | holds  | When no read is running and the cursor reached the log, every row shows.                   |
| `MineShows`              | holds  | Your message shows when a read that started after it was stored lands.                     |
| `MineOnce`               | holds  | Your message is one row, however many times you send it (the event id is kept on a retry). |
| `NoSendLost`             | holds  | A send that is over left a row, or a draft to send again.                                  |
| `NoUnreadWithoutMessage` | holds  | The room is marked unread only when its log has a row that the room did not show you.      |

### Update flow

`MaxChecks = 4`, `MaxRestarts = 2`. 1,836 distinct states, no violation.

| Property                      | Result | What it says                                                                     |
| ----------------------------- | ------ | -------------------------------------------------------------------------------- |
| `TypeOK`                      | holds  | The store is always in an `UpdateState`, and the last event is an `UpdateEvent`. |
| `OneDownload`                 | holds  | Never two downloads.                                                             |
| `DownloadIsOffered`           | holds  | The running download gets the version that the button shows.                     |
| `NoRestartUnasked`            | holds  | Talyx restarts into an update only when you click Restart, or when you quit.     |
| `ReadyCanRestart`             | holds  | A Restart button always has a verified download behind it.                       |
| `FailedRestartOffersTryAgain` | holds  | After a failed restart, the button shows the failure and offers Try again.       |

The properties are not vacuous. If a download can start from any state, `OneDownload` fails. If a
failed restart leaves the button on Restart (as before #190), `FailedRestartOffersTryAgain` fails.

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

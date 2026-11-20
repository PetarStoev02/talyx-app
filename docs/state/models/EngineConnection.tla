---- MODULE EngineConnection ----
\* The engine connection as one bot's chat sees it: the shared socket and its redial
\* (shared/engine/host.ts, reconnect-backoff.ts), the gateway client's replay of the gap
\* (json-rpc-gateway.ts: fetchReplay, replayHold, snapshot_required), the chat's reload with its
\* buffer of events (features/chat/chat.ts load, events.ts handleEvent,
\* app/providers/useChatBackend.ts) and the roster's unread mark. Rooms are RoomPolling.tla.
\*
\* Each engine message is one numbered session event (its seq); a send stores one more. The
\* transcript is a set because applyEvent keeps one row per message id (fast-check, #197), so
\* "none shown twice" is checked where a duplicate starts: the gateway handing a seq to the
\* chat again under the same replay cursor.
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS MaxMsgs, MaxDials, MaxDrops

\* ConnectionState in json-rpc-gateway.ts; tests/unit/stateModels.test.ts keeps them equal.
States == {"idle", "connecting", "open", "closed", "error"}

VARIABLES
  st,            \* the gateway client's ConnectionState
  wanted,        \* host: connect() called and no disconnect() since
  retry,         \* host: a redial timer is set
  redialed,      \* host: the next open is a redial, so it re-resumes open sessions
  tracked,       \* host: openSessions holds the chat's session
  dials, drops,  \* bounds for TLC
  eLog,          \* engine: messages stored, seqs 1..eLog
  ringFrom,      \* engine: oldest seq its replay ring still holds
  sub,           \* engine: the session is subscribed on the current socket
  replayed,      \* engine: the cursor this socket's replay answered (-1: none)
  reqs,          \* calls on the current socket the engine has not answered, in order
  wire,          \* frames from the engine on the current socket, in order
  wm,            \* gateway client: the session's replay cursor (0: none)
  hold,          \* gateway client: a replay is in flight, live frames wait in `held`
  held,
  given,         \* seqs handed to the chat under the current cursor
  twice,         \* a seq was handed to the chat twice under one cursor
  chat,          \* "none" | "opening" (first load) | "unloaded" (its first load failed)
                 \* | "loading" (reload) | "loaded"
  hist,          \* the load's REST history read: the seqs it returned (-1: not read yet)
  resumed,       \* the load's session.resume answered
  pending,       \* events buffered while a load is out
  shown,         \* seqs in the transcript
  reload,        \* a reload is asked for (turn ended, replay gap, socket reopened)
  dropped,       \* useChatBackend saw closed or error since the last open
  selected,      \* the bot is selected on the roster
  seen,          \* what the transcript showed when the user last looked at it
  unread,        \* the roster's unread mark
  send,          \* the user's one message: "none" | "out" | "stored" | "returned"
  stored         \* the engine stored the user's message

vars == <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed, reqs,
          wire, wm, hold, held, given, twice, chat, hist, resumed, pending, shown, reload, dropped,
          selected, seen, unread, send, stored>>

client == <<wm, hold, held, given, twice>>
chatVars == <<chat, hist, resumed, pending, shown, reload, seen, unread>>

Init ==
  /\ st = "idle" /\ wanted = FALSE /\ retry = FALSE /\ redialed = FALSE /\ tracked = FALSE
  /\ dials = 0 /\ drops = 0
  /\ eLog = 0 /\ ringFrom = 1 /\ sub = FALSE /\ replayed = -1 /\ reqs = <<>> /\ wire = <<>>
  /\ wm = 0 /\ hold = FALSE /\ held = <<>> /\ given = {} /\ twice = FALSE
  /\ chat = "none" /\ hist = -1 /\ resumed = FALSE /\ pending = {} /\ shown = {}
  /\ reload = FALSE /\ dropped = FALSE
  /\ selected = FALSE /\ seen = {} /\ unread = FALSE
  /\ send = "none" /\ stored = FALSE

Dialing == st \in {"open", "connecting"}
Max(a, b) == IF a > b THEN a ELSE b
Min(S) == CHOOSE m \in S : \A s \in S : m <= s
Seqs(from, to) == [i \in 1..(to - from) |-> from + i]

\* dispatchIfNewer over frames in order: <<cursor after, seqs dispatched>>.
RECURSIVE Newer(_, _, _)
Newer(frames, w, out) ==
  IF frames = <<>> THEN <<w, out>>
  ELSE IF Head(frames) > w THEN Newer(Tail(frames), Head(frames), out \cup {Head(frames)})
  ELSE Newer(Tail(frames), w, out)

\* handleEvent for each seq in S: a load buffers it, a chat with a transcript applies it; a
\* message new to the transcript ends a turn (reload) and marks the bot unread unless selected.
\* `before` is what the cursor already handed over; `gap` is a session.replay_gap, which reloads.
Hand(S, before, gap) ==
  LET new == S \ shown
      showing == chat \in {"loading", "loaded"}
  IN /\ given' = before \cup S
     /\ twice' = (twice \/ S \cap before # {})
     /\ pending' = IF chat \in {"opening", "loading"} THEN pending \cup S ELSE pending
     /\ shown' = IF showing THEN shown \cup S ELSE shown
     /\ unread' = (unread \/ (showing /\ new # {} /\ ~selected))
     /\ reload' = (reload \/ (showing /\ (new # {} \/ gap)))
     /\ seen' = IF selected /\ showing THEN shown \cup S ELSE seen

Give(S) == Hand(S, given, FALSE)

----
\* The socket.

Dial == st' = "connecting" /\ dials' = dials + 1

\* host.connect(): the engine came up, or a screen asked for it.
Connect ==
  /\ dials < MaxDials /\ wanted' = TRUE
  /\ IF Dialing THEN UNCHANGED <<st, dials>> ELSE Dial
  /\ UNCHANGED <<retry, redialed, tracked, drops, eLog, ringFrom, sub, replayed, reqs, wire, client,
                 chatVars, dropped, selected, send, stored>>

\* host.retryNow(): the banner's Try again.
RetryNow ==
  /\ dials < MaxDials /\ retry' = FALSE /\ wanted' = TRUE
  /\ IF Dialing THEN UNCHANGED <<st, dials>> ELSE Dial
  /\ UNCHANGED <<redialed, tracked, drops, eLog, ringFrom, sub, replayed, reqs, wire, client,
                 chatVars, dropped, selected, send, stored>>

RedialFires ==
  /\ retry /\ dials < MaxDials /\ retry' = FALSE
  /\ IF Dialing THEN UNCHANGED <<st, dials>> ELSE Dial
  /\ UNCHANGED <<wanted, redialed, tracked, drops, eLog, ringFrom, sub, replayed, reqs, wire,
                 client, chatVars, dropped, selected, send, stored>>

\* host.scheduleReconnect(), run by the state handler on closed or error.
Schedule ==
  IF wanted /\ ~retry THEN retry' = TRUE /\ redialed' = TRUE
  ELSE UNCHANGED <<retry, redialed>>

\* The socket goes: its calls fail, its replay is cancelled with its parked frames.
Lose(to) ==
  /\ st' = to /\ sub' = FALSE /\ replayed' = -1 /\ reqs' = <<>> /\ wire' = <<>>
  /\ hold' = FALSE /\ held' = <<>>
  /\ dropped' = (dropped \/ chat # "none")
  \* A load whose session.resume fails keeps the chat as it was; a first one keeps its session.
  /\ chat' = CASE chat = "opening" -> "unloaded" [] chat = "loading" -> "loaded" [] OTHER -> chat
  /\ pending' = IF chat \in {"opening", "loading"} THEN {} ELSE pending
  /\ send' = IF send = "out" THEN "returned" ELSE send

\* The socket opens: the client asks for the gap first, then the host re-resumes, then the
\* chat backend reloads the open chat if the socket had dropped.
Opens ==
  /\ st = "connecting" /\ st' = "open"
  /\ hold' = (wm > 0)
  /\ reqs' = (IF wm > 0 THEN <<[k |-> "since", from |-> wm]>> ELSE <<>>)
             \o (IF redialed /\ tracked THEN <<[k |-> "resume"]>> ELSE <<>>)
  /\ retry' = FALSE /\ redialed' = FALSE
  /\ reload' = (reload \/ (dropped /\ chat \in {"unloaded", "loading", "loaded"}))
  /\ dropped' = FALSE
  /\ UNCHANGED <<wanted, tracked, dials, drops, eLog, ringFrom, sub, replayed, wire, wm, held,
                 given, twice, chat, hist, resumed, pending, shown, seen, unread, selected, send,
                 stored>>

\* The dial fails or times out.
DialFails ==
  /\ st = "connecting" /\ Lose("error") /\ Schedule
  /\ UNCHANGED <<wanted, tracked, dials, drops, eLog, ringFrom, wm, given, twice, hist, resumed,
                 shown, reload, seen, unread, selected, stored>>

\* The network drops, the heartbeat deadline passes, or a test drops it on purpose.
Drops ==
  /\ st = "open" /\ drops < MaxDrops /\ drops' = drops + 1 /\ Lose("closed") /\ Schedule
  /\ UNCHANGED <<wanted, tracked, dials, eLog, ringFrom, wm, given, twice, hist, resumed, shown,
                 reload, seen, unread, selected, stored>>

\* host.disconnect(): the engine stopped.
Disconnect ==
  /\ wanted /\ wanted' = FALSE /\ tracked' = FALSE /\ retry' = FALSE
  /\ IF Dialing THEN Lose("closed")
     ELSE UNCHANGED <<st, sub, replayed, reqs, wire, hold, held, dropped, chat, pending, send>>
  /\ UNCHANGED <<redialed, dials, drops, eLog, ringFrom, wm, given, twice, hist, resumed, shown,
                 reload, seen, unread, selected, stored>>

----
\* The engine.

Emit(s) == wire' = IF st = "open" /\ sub THEN Append(wire, [k |-> "event", s |-> s]) ELSE wire

\* A bot's reply: delivered live only to a socket the session is subscribed on.
EngineReplies ==
  /\ eLog < MaxMsgs /\ eLog' = eLog + 1 /\ Emit(eLog + 1)
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, ringFrom, sub, replayed, reqs,
                 client, chatVars, dropped, selected, send, stored>>

\* The replay ring lets go of its oldest event.
EngineEvicts ==
  /\ ringFrom <= eLog /\ ringFrom' = ringFrom + 1
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, sub, replayed, reqs,
                 wire, client, chatVars, dropped, selected, send, stored>>

\* The engine answers the oldest call on the socket.
EngineAnswers ==
  /\ st = "open" /\ reqs # <<>> /\ reqs' = Tail(reqs)
  /\ LET r == Head(reqs) IN
     CASE r.k = "since" ->
            \* snapshot_required when the ring no longer holds the whole gap.
            LET gap == r.from < eLog /\ r.from + 1 < ringFrom IN
            /\ wire' = Append(wire, [k |-> "since", from |-> r.from, to |-> eLog, gap |-> gap])
            /\ replayed' = IF gap THEN -1 ELSE eLog
            /\ UNCHANGED <<sub, eLog, stored>>
       [] r.k \in {"resume", "loadResume"} ->
            \* SessionEvents.catch_up: a socket joining after its replay first gets what the
            \* session published since that replay answered, unless the ring let go of it.
            LET catchUp == ~sub /\ replayed >= 0 /\ replayed + 1 >= ringFrom IN
            /\ sub' = TRUE
            /\ wire' = wire \o (IF catchUp THEN [i \in 1..(eLog - replayed) |->
                                                   [k |-> "event", s |-> replayed + i]]
                                ELSE <<>>)
                            \o <<[k |-> r.k]>>
            /\ UNCHANGED <<eLog, stored, replayed>>
       [] r.k = "submit" ->
            /\ eLog < MaxMsgs /\ eLog' = eLog + 1 /\ stored' = TRUE
            /\ wire' = wire \o (IF sub THEN <<[k |-> "event", s |-> eLog + 1]>> ELSE <<>>)
                            \o <<[k |-> "submitted"]>>
            /\ UNCHANGED <<sub, replayed>>
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, ringFrom, client, chatVars,
                 dropped, selected, send>>

----
\* The client reads the next frame.

\* A live frame: parked while a replay is in flight, else dispatched (handleEvent, recordSeq).
LiveFrame ==
  /\ wire # <<>> /\ Head(wire).k = "event" /\ wire' = Tail(wire)
  /\ LET s == Head(wire).s IN
     IF hold THEN held' = Append(held, s) /\ UNCHANGED <<wm, given, twice, chatVars>>
     ELSE wm' = Max(wm, s) /\ Give({s}) /\ UNCHANGED <<held, chat, hist, resumed>>
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 reqs, hold, dropped, selected, send, stored>>

\* The replay answers: the gap and then the parked frames dispatch, each only past the cursor.
\* snapshot_required drops the cursor and dispatches session.replay_gap, which reloads the chat.
ReplayLands ==
  /\ wire # <<>> /\ Head(wire).k = "since" /\ hold /\ wire' = Tail(wire)
  /\ hold' = FALSE /\ held' = <<>>
  /\ LET a == Head(wire)
         r == IF a.gap THEN Newer(held, 0, {}) ELSE Newer(Seqs(a.from, a.to) \o held, wm, {})
     IN /\ wm' = r[1]
        /\ IF a.gap THEN Hand(r[2], {}, TRUE) ELSE Give(r[2])
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 reqs, chat, hist, resumed, dropped, selected, send, stored>>

\* The replay gets no answer in time (REPLAY_REQUEST_TIMEOUT_MS) or fails: the error is dropped,
\* the parked frames dispatch past the cursor, and an answer that comes later is thrown away.
ReplayGivesUp ==
  /\ hold /\ hold' = FALSE /\ held' = <<>>
  /\ LET r == Newer(held, wm, {}) IN wm' = r[1] /\ Give(r[2])
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 reqs, wire, chat, hist, resumed, dropped, selected, send, stored>>

ReplayLandsLate ==
  /\ wire # <<>> /\ Head(wire).k = "since" /\ ~hold /\ wire' = Tail(wire)
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 reqs, client, chatVars, dropped, selected, send, stored>>

\* A session.resume answers: the host adds the session to openSessions.
ResumeLands ==
  /\ wire # <<>> /\ Head(wire).k \in {"resume", "loadResume"} /\ wire' = Tail(wire)
  /\ tracked' = TRUE
  /\ resumed' = IF Head(wire).k = "loadResume" THEN TRUE ELSE resumed
  /\ UNCHANGED <<st, wanted, retry, redialed, dials, drops, eLog, ringFrom, sub, replayed, reqs,
                 client, chat, hist, pending, shown, reload, seen, unread, dropped, selected, send,
                 stored>>

SubmitLands ==
  /\ wire # <<>> /\ Head(wire).k = "submitted" /\ wire' = Tail(wire)
  /\ send' = IF send = "out" THEN "stored" ELSE send
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 reqs, client, chatVars, dropped, selected, stored>>

----
\* The chat.

\* load(): session.resume on the socket, then the REST history read once it answered; events
\* buffer.
StartLoad(to) ==
  /\ chat' = to /\ hist' = -1 /\ resumed' = FALSE /\ pending' = {}
  /\ reqs' = Append(reqs, [k |-> "loadResume"])

\* The user opens the bot's chat (the socket has opened once, so the chat backend exists).
OpenChat ==
  /\ chat = "none" /\ st = "open" /\ StartLoad("opening")
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 wire, client, shown, reload, seen, unread, dropped, selected, send, stored>>

\* A reload asked for starts once the one before it is over; its resume fails on a closed socket.
Reload ==
  /\ reload /\ chat \in {"unloaded", "loaded"} /\ reload' = FALSE
  /\ IF st = "open" THEN StartLoad(IF chat = "loaded" THEN "loading" ELSE "opening")
     ELSE UNCHANGED <<chat, hist, resumed, pending, reqs>>
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 wire, client, shown, seen, unread, dropped, selected, send, stored>>

\* REST, not the socket: it reads whatever the engine has stored by then. It starts only after
\* the session.resume answered, so the session is subscribed by then (#246, NoMessageLost).
HistoryRead ==
  /\ chat \in {"opening", "loading"} /\ hist = -1 /\ resumed /\ hist' = eLog
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 reqs, wire, client, chat, resumed, pending, shown, reload, seen, unread, dropped,
                 selected, send, stored>>

\* A reply buffered during the load may also be in the history read after it: the load starts
\* again rather than show it twice. The set union in LoadLands could not see that duplicate.
LoadReadsAgain ==
  /\ chat \in {"opening", "loading"} /\ hist >= 0 /\ resumed /\ pending # {} /\ st = "open"
  /\ StartLoad(chat)
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 wire, client, shown, reload, seen, unread, dropped, selected, send, stored>>

\* Both answered and no reply buffered: the transcript is the history with the other buffered
\* events applied over it. In the model every event is a reply, so the buffer is empty here.
LoadLands ==
  /\ chat \in {"opening", "loading"} /\ hist >= 0 /\ resumed /\ pending = {}
  /\ chat' = "loaded" /\ shown' = (1..hist) \cup pending /\ pending' = {}
  /\ seen' = IF selected THEN shown' ELSE seen
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 reqs, wire, client, hist, resumed, reload, unread, dropped, selected, send,
                 stored>>

----
\* The user.

Select ==
  /\ ~selected /\ selected' = TRUE /\ unread' = FALSE /\ seen' = shown
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 reqs, wire, client, chat, hist, resumed, pending, shown, reload, dropped, send,
                 stored>>

Leave ==
  /\ selected /\ selected' = FALSE /\ seen' = shown
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 reqs, wire, client, chat, hist, resumed, pending, shown, reload, unread, dropped,
                 send, stored>>

\* A send on a socket that is not open fails at once and the composer gets the draft back.
Send ==
  /\ send = "none" /\ chat \in {"loading", "loaded"}
  /\ IF st = "open"
     THEN send' = "out" /\ reqs' = Append(reqs, [k |-> "submit"])
     ELSE send' = "returned" /\ UNCHANGED reqs
  /\ UNCHANGED <<st, wanted, retry, redialed, tracked, dials, drops, eLog, ringFrom, sub, replayed,
                 wire, client, chatVars, dropped, selected, stored>>

Done == UNCHANGED vars

Next == Connect \/ RetryNow \/ RedialFires \/ Opens \/ DialFails \/ Drops \/ Disconnect
     \/ EngineReplies \/ EngineEvicts \/ EngineAnswers
     \/ LiveFrame \/ ReplayLands \/ ReplayGivesUp \/ ReplayLandsLate \/ ResumeLands \/ SubmitLands
     \/ OpenChat \/ Reload \/ HistoryRead \/ LoadReadsAgain \/ LoadLands
     \/ Select \/ Leave \/ Send \/ Done

Spec == Init /\ [][Next]_vars

----
\* Properties.

TypeOK == st \in States /\ chat \in {"none", "opening", "unloaded", "loading", "loaded"}
       /\ send \in {"none", "out", "stored", "returned"}

\* Nothing left to happen on an open socket: no call, frame, replay, load or reload outstanding.
Settled == st = "open" /\ reqs = <<>> /\ wire = <<>> /\ ~hold /\ chat = "loaded" /\ ~reload

\* No message lost: a settled chat shows every message the engine stored, and stays subscribed
\* so the next one arrives live.
NoMessageLost == Settled => (1..eLog \subseteq shown /\ sub)

\* No message lost on a send: once the send is over, the engine has it or the composer does.
NoSendLost == send = "stored" => stored

\* No message lost before a reload heals it: under one cursor the gateway hands the chat every
\* message from the first it handed up to the cursor, with no hole (what replayHold is for).
NoMessageSkipped == given # {} => (\A s \in Min(given)..wm : s \in given)

\* None shown twice: the gateway hands each seq to the chat once per replay cursor.
NoneShownTwice == ~twice

\* No unread mark without a message the user has not seen.
NoUnreadWithoutMessage == unread => shown \ seen # {}

\* The chart (docs/state/connection.md) and this model agree on how the socket moves.
RedialWhenWanted == (wanted /\ st \in {"closed", "error"}) => retry
====

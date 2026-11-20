---- MODULE RoomPolling ----
\* One hosted room, open in the window while the socket comes and goes. The engine sends no room
\* events, so the open room polls (features/chat/useRoomPolling.ts): groups.state, then
\* groups.log after the last row read (features/chat/room.ts read, one read at a time). A send
\* posts with an event id the engine stores once, then reads after any read already running
\* (readAfterChange). The roster's poll marks the room unread when its log grew past what the
\* window saw (features/bots/actions.ts applySnapshot, store.ts seeRoom).
EXTENDS Naturals, FiniteSets

CONSTANTS MaxRows, MaxDrops

VARIABLES
  up,         \* the socket is open, so groups.* calls are answered
  drops,
  eLog,       \* engine: rows posted so far (seq 1..eLog)
  mineAt,     \* engine: the seqs stored under your send's event id
  rd,         \* the running read: [p |-> "none"] or its phase, the cursor it read from, the rows
  shown,      \* window: seqs shown
  lastSeq,    \* window: the cursor
  send,       \* your one message: "none" | "out" | "failed" (draft and event id kept) | "sent"
  after,      \* a sent message waits for the running read, then reads (readAfterChange)
  mineRead,   \* a read that started after your message was stored has landed
  open,       \* the room is selected, so its pane polls and records what you read
  saw,        \* the last row the room showed you
  roomSeen,   \* roster: the last row counted as read
  roster,     \* roster poll: [p |-> "none"] or the latest seq it read
  unread

vars == <<up, drops, eLog, mineAt, rd, shown, lastSeq, send, after, mineRead, open, saw, roomSeen,
          roster, unread>>

Idle == [p |-> "none"]

Init == up = TRUE /\ drops = 0 /\ eLog = 0 /\ mineAt = {} /\ rd = Idle /\ shown = {}
     /\ lastSeq = 0 /\ send = "none" /\ after = FALSE /\ mineRead = FALSE /\ open = TRUE
       /\ saw = 0 /\ roomSeen = 0
     /\ roster = Idle /\ unread = FALSE

Max(S) == CHOOSE m \in S : \A s \in S : s <= m

\* The read lands: what is still new past the cursor shows, and the open pane records it as read.
Land(rows) ==
  LET fresh == {s \in rows : s > lastSeq}
      cursor == IF fresh = {} THEN lastSeq ELSE Max(fresh)
  IN /\ shown' = shown \cup fresh /\ lastSeq' = cursor
     /\ saw' = IF open THEN cursor ELSE saw
     /\ roomSeen' = IF open /\ cursor > roomSeen THEN cursor ELSE roomSeen

----
\* The engine and the socket.

MemberPosts ==
  /\ eLog < MaxRows /\ eLog' = eLog + 1
  /\ UNCHANGED <<up, drops, mineAt, rd, shown, lastSeq, send, after, mineRead, open, saw, roomSeen,
                 roster, unread>>

\* A drop fails every call out; the next poll after the redial reads again.
SocketDrops ==
  /\ up /\ drops < MaxDrops /\ up' = FALSE /\ drops' = drops + 1 /\ rd' = Idle
  /\ send' = IF send = "out" THEN "failed" ELSE send
  /\ roster' = Idle /\ after' = FALSE
  /\ UNCHANGED <<mineRead, eLog, mineAt, shown, lastSeq, open, saw, roomSeen, unread>>

SocketOpens ==
  /\ ~up /\ up' = TRUE
  /\ UNCHANGED <<drops, eLog, mineAt, rd, shown, lastSeq, send, after, mineRead, open, saw,
                 roomSeen, roster, unread>>

----
\* The room's reads.

\* refresh(): the poll timer (only while the pane is open), or a send's read once none runs.
Poll ==
  /\ rd = Idle /\ (open \/ after) /\ after' = FALSE
  /\ rd' = [p |-> "state", mine |-> mineAt # {}]
  /\ UNCHANGED <<mineRead, up, drops, eLog, mineAt, shown, lastSeq, send, open, saw, roomSeen,
                 roster, unread>>

\* groups.state answers; groups.log follows only when the latest seq is past the cursor.
StateAnswers ==
  /\ up /\ rd.p = "state"
  /\ rd' = IF eLog > lastSeq THEN [p |-> "log", mine |-> rd.mine, from |-> lastSeq]
           ELSE [p |-> "land", mine |-> rd.mine, rows |-> {}]
  /\ UNCHANGED <<up, drops, eLog, mineAt, shown, lastSeq, send, after, mineRead, open, saw,
                 roomSeen, roster, unread>>

\* groups.log answers every row after the cursor the read started from, as the log is now.
LogAnswers ==
  /\ up /\ rd.p = "log" /\ rd' = [p |-> "land", mine |-> rd.mine, rows |-> (rd.from + 1)..eLog]
  /\ UNCHANGED <<up, drops, eLog, mineAt, shown, lastSeq, send, after, mineRead, open, saw,
                 roomSeen, roster, unread>>

ReadLands ==
  /\ rd.p = "land" /\ Land(rd.rows) /\ rd' = Idle /\ mineRead' = (mineRead \/ rd.mine)
  /\ UNCHANGED <<up, drops, eLog, mineAt, send, after, mineRead, open, roster, unread>>

----
\* Your message: posted with an event id the engine stores once; a failed send keeps the draft
\* and its id, so sending it again cannot post it twice.

Send ==
  /\ send \in {"none", "failed"} /\ eLog < MaxRows
  /\ IF up THEN send' = "out" ELSE send' = "failed"
  /\ UNCHANGED <<up, drops, eLog, mineAt, rd, shown, lastSeq, after, mineRead, open, saw, roomSeen,
                 roster, unread>>

\* The engine stores it (once per event id); its answer may still be lost to a drop.
EngineStores ==
  /\ up /\ send = "out" /\ mineAt = {} /\ eLog < MaxRows
  /\ eLog' = eLog + 1 /\ mineAt' = {eLog + 1}
  /\ UNCHANGED <<up, drops, rd, shown, lastSeq, send, after, mineRead, open, saw, roomSeen, roster,
                 unread>>

SendAnswers ==
  /\ up /\ send = "out" /\ mineAt # {} /\ send' = "sent" /\ after' = TRUE
  /\ UNCHANGED <<mineRead, up, drops, eLog, mineAt, rd, shown, lastSeq, open, saw, roomSeen, roster,
                 unread>>

----
\* The roster.

RosterReads ==
  /\ up /\ roster = Idle /\ roster' = [p |-> "read", latest |-> eLog]
  /\ UNCHANGED <<up, drops, eLog, mineAt, rd, shown, lastSeq, send, after, mineRead, open, saw,
                 roomSeen, unread>>

\* applySnapshot: a log past the last row counted as read marks the room, unless it is open.
RosterApplies ==
  /\ roster.p = "read" /\ roster' = Idle
  /\ unread' = (unread \/ (roster.latest > roomSeen /\ ~open))
  /\ roomSeen' = IF roster.latest > roomSeen THEN roster.latest ELSE roomSeen
  /\ UNCHANGED <<up, drops, eLog, mineAt, rd, shown, lastSeq, send, after, mineRead, open, saw>>

\* Selecting the room shows what it read and clears its mark; its pane records lastSeq.
Select ==
  /\ ~open /\ open' = TRUE /\ unread' = FALSE /\ saw' = lastSeq
  /\ roomSeen' = IF lastSeq > roomSeen THEN lastSeq ELSE roomSeen
  /\ UNCHANGED <<up, drops, eLog, mineAt, rd, shown, lastSeq, send, after, mineRead, roster>>

Leave ==
  /\ open /\ open' = FALSE
  /\ UNCHANGED <<up, drops, eLog, mineAt, rd, shown, lastSeq, send, after, mineRead, saw, roomSeen,
                 roster, unread>>

Done == UNCHANGED vars

Next == MemberPosts \/ SocketDrops \/ SocketOpens \/ Poll \/ StateAnswers \/ LogAnswers
     \/ ReadLands \/ Send \/ EngineStores \/ SendAnswers \/ RosterReads \/ RosterApplies
     \/ Select \/ Leave \/ Done

Spec == Init /\ [][Next]_vars

----
\* Properties.

TypeOK == send \in {"none", "out", "failed", "sent"} /\ rd.p \in {"none", "state", "log", "land"}

\* No message lost or shown twice: the room shows a prefix of the log, each row once (a set).
NoHole == shown = 1..lastSeq

\* No message lost: with nothing out, the open room has every row once its poll catches up.
Caught == (rd = Idle /\ lastSeq = eLog) => shown = 1..eLog
MineShows == mineRead => mineAt \subseteq shown

\* None shown twice: your message is one row however often it was sent.
MineOnce == Cardinality(mineAt) <= 1

\* No message lost on a send: a send that is over left a row or a draft to send again.
NoSendLost == send = "sent" => mineAt # {}

\* No unread mark without a row the room has not shown you.
NoUnreadWithoutMessage == unread => eLog > saw
====

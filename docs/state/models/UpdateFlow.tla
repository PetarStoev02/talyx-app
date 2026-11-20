---- MODULE UpdateFlow ----
\* The Talyx update: release checks from four triggers, one at a time
\* (main/infrastructure/updater/releaseChecks.ts), the update store's states and events
\* (updateState.ts: next and createUpdateStore), the download and the restart
\* (selfUpdate.ts: downloadSelfUpdate, restart), and the install on quit
\* (autoInstallOnAppQuit). Clicks come from the update button (widgets/app-shell/UpdateButton.tsx).
EXTENDS Naturals

CONSTANTS MaxChecks, MaxRestarts

\* UpdateState kinds in src/shared/updater.ts and UpdateEvent kinds in updateState.ts;
\* tests/unit/stateModels.test.ts keeps them equal.
States == {"none", "available", "downloading", "ready", "failed"}
Events == {"found", "download", "progress", "verified", "failed", "cancelled"}

\* r1 and r1n are version 1 (r1n has newer notes), r2 is version 2, p3 is version 3 with no
\* download for this computer (the button offers its page).
Rel == {"r1", "r1n", "r2", "p3"}
Ver(r) == CASE r = "r2" -> 2 [] r = "p3" -> 3 [] OTHER -> 1
Downloadable(r) == r # "p3"
NoRel == "-"

VARIABLES
  kind, shown,   \* UpdateState: its kind and release
  event,         \* the last event `next` applied ("-" before the first)
  target,        \* the store's `release`: what a download fetches
  installer,     \* the store's `installer`: a verified download's restart
  dls,           \* downloads running
  dlVer,         \* the version the running download fetches
  aborted,       \* the running download's signal was aborted (Cancel)
  checking,      \* a release check is running
  checks,        \* checks started, a bound for TLC
  clicks,        \* the user's clicks on Restart
  restarts,      \* restarts into the update: by a click, or by the user quitting
  quit,          \* Talyx has quit
  restartFailed  \* the last click on Restart did not restart

vars == <<kind, shown, event, target, installer, dls, dlVer, aborted, checking, checks, clicks,
          restarts, quit, restartFailed>>

Init == kind = "none" /\ shown = NoRel /\ event = "-" /\ target = NoRel /\ installer = FALSE
     /\ dls = 0 /\ dlVer = 0 /\ aborted = FALSE /\ checking = FALSE /\ checks = 0
     /\ clicks = 0 /\ restarts = 0 /\ quit = FALSE /\ restartFailed = FALSE

\* next(state, found): [kind, release] after a check found r (NoRel: nothing newer).
Found(r) ==
  IF kind \in {"downloading", "ready"} THEN <<kind, shown>>
  ELSE IF r = NoRel THEN <<"none", NoRel>>
  ELSE IF kind # "none" /\ Ver(shown) = Ver(r) THEN
         IF kind \in {"available", "failed"} /\ shown # r THEN <<"available", r>> ELSE <<kind,
                                                                 shown>>
  ELSE <<"available", r>>

\* apply(event): the store publishes only a state that changed.
Apply(e, to) ==
  /\ kind' = to[1] /\ shown' = to[2]
  /\ event' = IF to = <<kind, shown>> THEN event ELSE e
  /\ restartFailed' = (restartFailed /\ to[1] = "failed")

----
\* Release checks: the startup timer, the hourly timer, a wake and a focus all call check(),
\* which joins the check already running.

Trigger ==
  /\ ~quit /\ checks < MaxChecks
  /\ IF checking THEN UNCHANGED <<checking, checks>> ELSE checking' = TRUE /\ checks' = checks + 1
  /\ UNCHANGED <<kind, shown, event, target, installer, dls, dlVer, aborted, clicks, restarts, quit,
                 restartFailed>>

\* A failed check changes nothing; the next trigger tries again.
CheckFails ==
  /\ checking /\ checking' = FALSE
  /\ UNCHANGED <<kind, shown, event, target, installer, dls, dlVer, aborted, checks, clicks,
                 restarts, quit, restartFailed>>

\* store.found(release): a changed state takes the release as the download target and drops
\* the installer.
CheckFinds ==
  /\ checking /\ checking' = FALSE
  /\ \E r \in Rel \cup {NoRel} :
       LET to == Found(r) IN
       /\ Apply("found", to)
       /\ IF to = <<kind, shown>> THEN UNCHANGED <<target, installer>>
          ELSE target' = (IF to[1] = "none" THEN NoRel ELSE r) /\ installer' = FALSE
  /\ UNCHANGED <<dls, dlVer, aborted, checks, clicks, restarts, quit>>

----
\* The update button.

\* Download (or Try again): startDownload applies `download`, then downloads the target.
PressDownload ==
  /\ ~quit /\ target # NoRel
  /\ IF kind \in {"available", "failed"} /\ Downloadable(shown)
     THEN /\ Apply("download", <<"downloading", shown>>)
          /\ dls' = dls + 1 /\ dlVer' = Ver(target) /\ aborted' = FALSE
     ELSE UNCHANGED <<kind, shown, event, restartFailed, dls, dlVer, aborted>>
  /\ UNCHANGED <<target, installer, checking, checks, clicks, restarts, quit>>

PressCancel ==
  /\ ~quit /\ dls > 0 /\ aborted' = TRUE
  /\ UNCHANGED <<kind, shown, event, target, installer, dls, dlVer, checking, checks, clicks,
                 restarts, quit, restartFailed>>

DownloadProgresses ==
  /\ ~quit /\ dls > 0 /\ kind = "downloading" /\ event' = "progress"
  /\ UNCHANGED <<kind, shown, target, installer, dls, dlVer, aborted, checking, checks, clicks,
                 restarts, quit, restartFailed>>

\* The download resolves, also when Cancel came too late: the installer is kept, `verified` applied.
DownloadVerified ==
  /\ ~quit /\ dls > 0 /\ dls' = dls - 1 /\ installer' = TRUE
  /\ Apply("verified", IF kind = "downloading" THEN <<"ready", shown>> ELSE <<kind, shown>>)
  /\ UNCHANGED <<target, dlVer, aborted, checking, checks, clicks, restarts, quit>>

\* The download rejects: `cancelled` when its signal was aborted, else `failed`.
DownloadRejects ==
  /\ ~quit /\ dls > 0 /\ dls' = dls - 1
  /\ IF aborted
     THEN Apply("cancelled", IF kind = "downloading" THEN <<"available", shown>> ELSE <<kind,
                                                            shown>>)
     ELSE Apply("failed", IF kind \in {"downloading", "ready"} THEN <<"failed", shown>>
                          ELSE <<kind, shown>>)
  /\ UNCHANGED <<target, installer, dlVer, aborted, checking, checks, clicks, restarts, quit>>

\* Restart: install() runs the installer. quitAndInstall quits into the update, or (AppImage)
\* emits its error and returns, which restart() turns into a rejection: the store drops the
\* installer and applies `failed`.
PressRestart ==
  /\ ~quit /\ kind = "ready" /\ installer /\ clicks < MaxRestarts /\ clicks' = clicks + 1
  /\ \/ /\ quit' = TRUE /\ restarts' = restarts + 1
        /\ UNCHANGED <<kind, shown, event, installer, restartFailed>>
     \/ /\ installer' = FALSE /\ kind' = "failed" /\ event' = "failed" /\ restartFailed' = TRUE
        /\ UNCHANGED <<shown, quit, restarts>>
  /\ UNCHANGED <<target, dls, dlVer, aborted, checking, checks>>

\* The user quits Talyx; a staged download installs on the way out.
UserQuits ==
  /\ ~quit /\ quit' = TRUE
  /\ restarts' = IF installer THEN restarts + 1 ELSE restarts
  /\ UNCHANGED <<kind, shown, event, target, installer, dls, dlVer, aborted, checking, checks,
                 clicks, restartFailed>>

Done == quit /\ UNCHANGED vars

Next == Trigger \/ CheckFails \/ CheckFinds \/ PressDownload \/ PressCancel \/ DownloadProgresses
     \/ DownloadVerified \/ DownloadRejects \/ PressRestart \/ UserQuits \/ Done

Spec == Init /\ [][Next]_vars

----
\* Properties.

TypeOK == kind \in States /\ event \in Events \cup {"-"}

\* Never two downloads.
OneDownload == dls <= 1
\* The running download fetches the version the button shows.
DownloadIsOffered == dls > 0 => dlVer = Ver(shown)
\* Never a restart unasked: Talyx restarts into an update only on a click or when the user quits.
NoRestartUnasked == restarts <= clicks + (IF quit THEN 1 ELSE 0)
\* A Restart button always has a verified download behind it.
ReadyCanRestart == kind = "ready" => installer
\* A failed restart offers Try again: the button shows the failure and can download again.
FailedRestartOffersTryAgain == restartFailed => (kind = "failed" /\ Downloadable(shown))
====

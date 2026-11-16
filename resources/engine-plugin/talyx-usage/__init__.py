"""Talyx: each bot's token usage per local day and billing provider, read only.

The engine reports usage per day for all providers together, and per provider for the whole
period, but not both at once. Its own store has both. This reads it, never writes, with the
engine's per-model analytics rules, so the days add up to the totals Talyx shows beside them:

* main usage is the per-call rows of ``session_model_usage`` (no task, a model named); a store
  with none in the period (an older one) falls back to the ``sessions`` totals, as the engine does;
* auxiliary usage (titles, compression, vision: rows with a task) is added on top;
* a day is the local date the session started, the day the engine's own daily view uses.

Talyx installs this plugin and runs it as a CLI command; nothing else calls it.
"""

import json
import sqlite3
import sys
import time
from pathlib import Path

DEFAULT_PROFILE = "default"
SECONDS_PER_DAY = 86400
DAY = "date(s.started_at, 'unixepoch', 'localtime')"
SUMS = """SUM(COALESCE({p}input_tokens, 0)) AS input_tokens,
          SUM(COALESCE({p}output_tokens, 0)) AS output_tokens,
          SUM(COALESCE({p}api_call_count, 0)) AS api_calls"""

MAIN = f"""
    SELECT {DAY} AS day, u.billing_provider AS provider, {SUMS.format(p='u.')}
    FROM session_model_usage u JOIN sessions s ON s.id = u.session_id
    WHERE s.started_at > ? AND u.task = '' AND u.model IS NOT NULL AND u.model != ''
    GROUP BY day, u.billing_provider
"""
SESSIONS = f"""
    SELECT {DAY} AS day, s.billing_provider AS provider, {SUMS.format(p='s.')}
    FROM sessions s
    WHERE s.started_at > ? AND s.model IS NOT NULL AND s.model != ''
    GROUP BY day, s.billing_provider
"""
AUXILIARY = f"""
    SELECT {DAY} AS day, u.billing_provider AS provider, {SUMS.format(p='u.')}
    FROM session_model_usage u JOIN sessions s ON s.id = u.session_id
    WHERE s.started_at > ? AND u.task != ''
    GROUP BY day, u.billing_provider
"""


def register(ctx):
    ctx.register_cli_command(
        "talyx-usage", "Talyx: token usage per day and provider", _setup, _run
    )


def _setup(parser):
    actions = parser.add_subparsers(dest="talyx_usage_action", required=True)
    days = actions.add_parser("days", help="Usage per day and provider, one entry per bot")
    days.add_argument("--home", required=True, help="The engine home, where every bot's store is")
    days.add_argument("--days", required=True, type=int, help="How many days back to read")
    days.add_argument("--profile", action="append", default=[], help="A bot to read; repeatable")


def _run(args):
    try:
        bots = read_bots(home=Path(args.home), profiles=args.profile, days=args.days)
    except Exception as error:  # noqa: BLE001 - every failure reaches Talyx as one JSON line
        print(json.dumps({"ok": False, "error": str(error)}))
        sys.exit(1)
    print(json.dumps({"ok": True, "bots": bots}))


def read_bots(*, home, profiles, days, now=None):
    """Each bot's rows, or the reason it could not be read; one unreadable store spoils no other."""
    cutoff = (time.time() if now is None else now) - days * SECONDS_PER_DAY
    bots = {}
    for profile in profiles:
        try:
            bots[profile] = {"rows": read_store(store_of(home, profile), cutoff)}
        except Exception as error:  # noqa: BLE001 - reported per bot
            bots[profile] = {"error": str(error)}
    return bots


def store_of(home, profile):
    if profile == DEFAULT_PROFILE:
        return home / "state.db"
    return home / "profiles" / profile / "state.db"


def read_store(path, cutoff):
    if not path.exists():
        return []  # a bot that never ran has no store yet
    connection = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
    try:
        connection.row_factory = sqlite3.Row
        main = _rows(connection, MAIN, cutoff) or _rows(connection, SESSIONS, cutoff, needed=True)
        return _summed(main + _rows(connection, AUXILIARY, cutoff))
    finally:
        connection.close()


def _rows(connection, query, cutoff, needed=False):
    # A store older than the per-call table has no such rows; only the sessions read must work.
    try:
        return [dict(row) for row in connection.execute(query, (cutoff,))]
    except sqlite3.OperationalError:
        if needed:
            raise
        return []


def _summed(rows):
    by_key = {}
    for row in rows:
        key = (row["day"], row["provider"])
        sum_ = by_key.setdefault(
            key, {"day": row["day"], "provider": row["provider"], "input_tokens": 0,
                  "output_tokens": 0, "api_calls": 0})
        for field in ("input_tokens", "output_tokens", "api_calls"):
            sum_[field] += row[field] or 0
    return sorted(by_key.values(), key=lambda row: (row["day"], row["provider"] or ""))

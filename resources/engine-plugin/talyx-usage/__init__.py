"""Talyx: each bot's token usage per local day, model, billing provider and base URL, read only.

The engine reports usage per day for all providers together, and per model and provider for the
whole period, but not both at once, and never the base URL: it bills every custom endpoint as
``custom``, so only the URL tells two apart. Its own store has all of it. This reads it, never
writes, with the engine's per-model analytics rules, so the days add up to its per-model totals:

* main usage is the per-call rows of ``session_model_usage`` (no task, a model named); a store
  with none in the period (an older one) falls back to the ``sessions`` totals, as the engine does;
* auxiliary usage (titles, compression, vision: rows with a task) is added on top, a row with no
  model under the engine's name for it;
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
UNNAMED_MODEL = "unknown"
AUX_MODEL = f"COALESCE(NULLIF(u.model, ''), '{UNNAMED_MODEL}')"
KEY = ("day", "model", "provider", "base_url")
SUMS = """SUM(COALESCE({p}input_tokens, 0)) AS input_tokens,
          SUM(COALESCE({p}output_tokens, 0)) AS output_tokens,
          SUM(COALESCE({p}api_call_count, 0)) AS api_calls"""

MAIN = f"""
    SELECT {DAY} AS day, u.model AS model, u.billing_provider AS provider,
           COALESCE(u.billing_base_url, '') AS base_url, {SUMS.format(p='u.')}
    FROM session_model_usage u JOIN sessions s ON s.id = u.session_id
    WHERE s.started_at > ? AND u.task = '' AND u.model IS NOT NULL AND u.model != ''
    GROUP BY day, u.model, u.billing_provider, u.billing_base_url
"""
SESSIONS = f"""
    SELECT {DAY} AS day, s.model AS model, s.billing_provider AS provider,
           COALESCE(s.billing_base_url, '') AS base_url, {SUMS.format(p='s.')}
    FROM sessions s
    WHERE s.started_at > ? AND s.model IS NOT NULL AND s.model != ''
    GROUP BY day, s.model, s.billing_provider, s.billing_base_url
"""
AUXILIARY = f"""
    SELECT {DAY} AS day, {AUX_MODEL} AS model,
           u.billing_provider AS provider, COALESCE(u.billing_base_url, '') AS base_url,
           {SUMS.format(p='u.')}
    FROM session_model_usage u JOIN sessions s ON s.id = u.session_id
    WHERE s.started_at > ? AND u.task != ''
    GROUP BY day, {AUX_MODEL}, u.billing_provider, u.billing_base_url
"""


def register(ctx):
    ctx.register_cli_command(
        "talyx-usage", "Talyx: token usage per day, model and provider", _setup, _run
    )


def _setup(parser):
    actions = parser.add_subparsers(dest="talyx_usage_action", required=True)
    days = actions.add_parser("days", help="Usage per day, model and provider, one entry per bot")
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
        key = tuple(row[field] for field in KEY)
        sum_ = by_key.setdefault(
            key, {**dict(zip(KEY, key)), "input_tokens": 0, "output_tokens": 0, "api_calls": 0})
        for field in ("input_tokens", "output_tokens", "api_calls"):
            sum_[field] += row[field] or 0
    return sorted(by_key.values(), key=lambda row: tuple(row[field] or "" for field in KEY))

"""Talyx: each bot's token usage per local day and billing provider, read only.

The engine reports usage per day for all providers together, and per provider for the whole
period, but not both at once. Its own store has both: every API call's tokens land in
``session_model_usage`` with the provider that served them. This reads that table, never writes,
and groups it by the day the session started, the day the engine's own daily view uses.

Talyx installs this plugin and runs it as a CLI command; nothing else calls it.
"""

import json
import sqlite3
import sys
import time
from pathlib import Path

DEFAULT_PROFILE = "default"
SECONDS_PER_DAY = 86400

QUERY = """
    SELECT date(s.started_at, 'unixepoch', 'localtime') AS day,
           u.billing_provider AS provider,
           SUM(u.input_tokens) AS input_tokens,
           SUM(u.output_tokens) AS output_tokens,
           SUM(COALESCE(u.api_call_count, 0)) AS api_calls
    FROM session_model_usage u
    JOIN sessions s ON s.id = u.session_id
    WHERE s.started_at > ? AND u.model IS NOT NULL AND u.model != ''
    GROUP BY day, u.billing_provider
    ORDER BY day
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
        return [dict(row) for row in connection.execute(QUERY, (cutoff,))]
    finally:
        connection.close()

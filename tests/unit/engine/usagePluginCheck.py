"""Checks Talyx's usage plugin against small throwaway stores; run by usagePlugin.test.ts."""

import importlib.util
import sqlite3
import sys
import tempfile
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location("talyx_usage", sys.argv[1])
plugin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plugin)

NOW = time.time()
HOUR = 3600

SESSIONS = """CREATE TABLE sessions(id TEXT, started_at REAL, model TEXT, billing_provider TEXT,
  input_tokens INT, output_tokens INT, api_call_count INT)"""
PER_CALL = """CREATE TABLE session_model_usage(session_id TEXT, model TEXT, billing_provider TEXT,
  task TEXT, input_tokens INT, output_tokens INT, api_call_count INT)"""


def store(home, profile, *, sessions, per_call=None):
    path = plugin.store_of(home, profile)
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.execute(SESSIONS)
    db.executemany("INSERT INTO sessions VALUES (?,?,?,?,?,?,?)", sessions)
    if per_call is not None:
        db.execute(PER_CALL)
        db.executemany("INSERT INTO session_model_usage VALUES (?,?,?,?,?,?,?)", per_call)
    db.commit()
    db.close()


def totals(rows):
    return sorted((r["provider"], r["input_tokens"] + r["output_tokens"], r["api_calls"]) for r in rows)


home = Path(tempfile.mkdtemp())
recent = NOW - HOUR
# Per-call rows win over the session totals; auxiliary rows (a task) add on, any model.
store(home, "default",
      sessions=[("a", recent, "m", "custom", 999, 999, 99), ("old", NOW - 40 * 86400, "m", "custom", 5, 5, 5)],
      per_call=[("a", "m", "custom", "", 10, 5, 1), ("a", "m2", "anthropic", "", 3, 1, 2),
                ("a", "", "custom", "title", 2, 0, 1), ("a", "", "x", "", 100, 100, 1),
                ("old", "m", "custom", "", 9, 9, 9)])
# An older store: no per-call table, so the session totals stand in.
store(home, "older", sessions=[("b", recent, "m", "openai", 100, 20, 1)])
# Per-call table present but empty in the period: the session totals stand in, auxiliary still adds.
store(home, "quiet", sessions=[("c", recent, "m", "openai", 7, 3, 1)],
      per_call=[("c", "", "openai", "compression", 1, 1, 1)])
(home / "profiles" / "broken").mkdir(parents=True)
(home / "profiles" / "broken" / "state.db").write_text("not a store")

bots = plugin.read_bots(home=home, profiles=["default", "older", "quiet", "never", "broken"], days=30)

assert totals(bots["default"]["rows"]) == [("anthropic", 4, 2), ("custom", 17, 2)], bots["default"]
assert totals(bots["older"]["rows"]) == [("openai", 120, 1)], bots["older"]
assert totals(bots["quiet"]["rows"]) == [("openai", 12, 2)], bots["quiet"]
assert bots["never"] == {"rows": []}, bots["never"]
assert "error" in bots["broken"], bots["broken"]
day = bots["default"]["rows"][0]["day"]
assert day == time.strftime("%Y-%m-%d", time.localtime(recent)), day
print("ok")

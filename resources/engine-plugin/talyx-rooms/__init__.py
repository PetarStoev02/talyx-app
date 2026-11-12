"""Talyx: change which bots are in an existing group room, in place.

A room keeps its bots in one row of the engine's room store, and the room's driver reads that row
again on every cycle, so a new list takes effect from the next turn: same room, same id, same
history. The list and a ``room.members_changed`` log event are written in one transaction, the way
the engine's own room rename writes a name and its event.

Talyx installs this plugin and runs it as a CLI command; nothing else calls it.
"""

import json
import sys
import time
import uuid
from pathlib import Path

EVENT_KIND = "room.members_changed"
# Driver task states that are not finished: a member change waits until none is left.
UNFINISHED = ("queued", "running", "indeterminate", "deferred", "stopping")


def register(ctx):
    ctx.register_cli_command(
        "talyx-rooms", "Talyx: change the bots of a group room", _setup, _run
    )


def _setup(parser):
    actions = parser.add_subparsers(dest="talyx_rooms_action", required=True)
    members = actions.add_parser("members", help="Set the bots of an existing room")
    members.add_argument("--db", required=True, help="The room store of the default profile")
    members.add_argument("--home", required=True, help="The engine home, for its profile list")
    members.add_argument("--room", required=True, help="The room id")
    members.add_argument("--members", required=True, help="The new members, as a JSON list")


def _run(args):
    try:
        result = set_members(
            db=Path(args.db),
            home=Path(args.home),
            room_id=args.room,
            members=json.loads(args.members),
        )
    except Exception as error:  # noqa: BLE001 - every failure reaches Talyx as one JSON line
        print(json.dumps({"ok": False, "error": str(error)}))
        sys.exit(1)
    print(json.dumps({"ok": True, **result}))


def set_members(*, db, home, room_id, members, now=None):
    from gateway import hosted_rooms as rooms
    from gateway.hosted_room_discussion import validate_roster

    validate_roster(members, local_profiles=_local_profiles(home))
    _, members_json = rooms._validate_members(members)
    now = time.time() if now is None else now
    with rooms._transaction(db, immediate=True) as conn:
        room = rooms._room_row(conn, rooms._SELECT_ROOM_WITH_BYTES, (room_id,), room_id)
        if room["disbanded_at"] is not None:
            raise rooms.RoomNotFoundError("hosted room not found")
        before = [member.get("member_id") for member in json.loads(room["members_json"])]
        after = [member.get("member_id") for member in members]
        if room["members_json"] == members_json:
            return {"room_id": room_id, "added": [], "removed": [], "changed": False}
        if _busy(conn, room_id):
            raise rooms.HostedRoomError(
                "A bot in this room is answering. Wait until the room is quiet, then try again."
            )
        added = [member for member in after if member not in before]
        removed = [member for member in before if member not in after]
        payload = rooms._payload_json({"added": added, "removed": removed, "members": members})
        actor = rooms._system_actor_json("room-control")
        event_id = f"talyx-members:{uuid.uuid4()}"
        seq = int(room["next_seq"])
        size = rooms._prepare_event(conn, room, event_id, EVENT_KIND, actor, payload)
        conn.execute(
            """UPDATE hosted_rooms SET members_json=?, next_seq=?, event_bytes=event_bytes+?,
               revision=revision+1, updated_at=? WHERE room_id=?""",
            (members_json, seq + 1, size, now, room_id),
        )
        conn.execute(
            rooms._INSERT_EVENT,
            (room_id, seq, event_id, EVENT_KIND, actor, int(room["authority_epoch"]), payload, now),
        )
    return {"room_id": room_id, "added": added, "removed": removed, "changed": True}


def _busy(conn, room_id):
    marks = ",".join("?" * len(UNFINISHED))
    try:
        row = conn.execute(
            f"SELECT 1 FROM hosted_room_driver_tasks WHERE room_id=? AND status IN ({marks}) LIMIT 1",
            (room_id, *UNFINISHED),
        ).fetchone()
    except Exception as error:  # noqa: BLE001 - a store that never ran a turn has no task table
        if "no such table" in str(error):
            return False
        raise
    return row is not None


def _local_profiles(home):
    profiles = home / "profiles"
    named = [
        path.name
        for path in (profiles.iterdir() if profiles.is_dir() else [])
        if path.is_dir() and not path.name.startswith(".")
    ]
    return ["default", *named]

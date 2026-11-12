import { beforeEach, describe, expect, it } from 'vitest'
import {
  PLUGIN_FILES,
  ROOMS_PLUGIN,
  roomMembers
} from '../../../src/main/infrastructure/engine/roomMembers'
import type { RoomMemberRecord } from '../../../src/main/infrastructure/engine/roomMembers'

const HOME = '/engine-home'
const FOLDER = `${HOME}/plugins/${ROOMS_PLUGIN}`
const member = (profile: string): RoomMemberRecord => ({
  member_id: profile,
  profile,
  handle: profile,
  display_name: profile,
  target: { kind: 'local', profile }
})

let files: Map<string, string>
let calls: string[][]
let answer: { code: number; stdout: string; stderr: string }

function setup(): ReturnType<typeof roomMembers> {
  return roomMembers({
    engine: {
      cli: async (args) => {
        calls.push(args)
        const isMembers = args[0] === ROOMS_PLUGIN
        return { ...(isMembers ? answer : { code: 0, stdout: '', stderr: '' }), home: HOME }
      }
    },
    readFile: async (path) => {
      const text = files.get(path)
      if (text === undefined) throw new Error('ENOENT')
      return text
    },
    writeFile: async (path, text) => {
      files.set(path, text)
    },
    mkdir: async () => undefined
  })
}

beforeEach(() => {
  files = new Map()
  calls = []
  answer = {
    code: 0,
    stdout: 'notice\n{"ok": true, "added": ["ledger"], "removed": ["scout"], "changed": true}',
    stderr: ''
  }
})

describe('room members through the engine plugin', () => {
  it('should install and enable the plugin, then change the room in its store', async () => {
    const change = await setup().set('room-1', [member('quill'), member('ledger')])
    expect(change).toEqual({ added: ['ledger'], removed: ['scout'], changed: true })
    for (const [name, text] of Object.entries(PLUGIN_FILES))
      expect(files.get(`${FOLDER}/${name}`)).toBe(text)
    expect(calls).toEqual([
      ['config', 'path'],
      ['plugins', 'enable', ROOMS_PLUGIN],
      [
        ROOMS_PLUGIN,
        'members',
        '--db',
        `${HOME}/state.db`,
        '--home',
        HOME,
        '--room',
        'room-1',
        '--members',
        JSON.stringify([member('quill'), member('ledger')])
      ]
    ])
  })

  it('should install once and leave a current copy alone', async () => {
    for (const [name, text] of Object.entries(PLUGIN_FILES)) files.set(`${FOLDER}/${name}`, text)
    const rooms = setup()
    await rooms.set('room-1', [member('quill'), member('ledger')])
    await rooms.set('room-1', [member('quill'), member('scout')])
    expect(calls.filter((args) => args[0] === 'plugins')).toHaveLength(1)
  })

  it('should replace an older copy of the plugin', async () => {
    files.set(`${FOLDER}/__init__.py`, 'old')
    await setup().set('room-1', [member('quill'), member('ledger')])
    expect(files.get(`${FOLDER}/__init__.py`)).toBe(PLUGIN_FILES['__init__.py'])
  })

  it("should pass on the plugin's own reason when it refuses", async () => {
    answer = {
      code: 1,
      stdout: '{"ok": false, "error": "A bot in this room is answering."}',
      stderr: ''
    }
    await expect(setup().set('room-1', [member('quill'), member('ledger')])).rejects.toThrow(
      'A bot in this room is answering.'
    )
  })

  it('should say what the engine printed when the plugin gave no answer', async () => {
    answer = { code: 2, stdout: '', stderr: 'invalid choice: talyx-rooms' }
    await expect(setup().set('room-1', [member('quill'), member('ledger')])).rejects.toThrow(
      "The room's bots did not change: invalid choice: talyx-rooms"
    )
  })
})

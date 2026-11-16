import { describe, expect, it } from 'vitest'
import { enginePlugin } from '../../../src/main/infrastructure/engine/enginePlugin'

describe("Talyx's engine plugins", () => {
  // The engine refuses an enable while another one is changing its plugin list.
  it('should enable one plugin at a time, even two different plugins starting together', async () => {
    let enabling = 0
    let most = 0
    const deps = {
      engine: {
        cli: async (args: string[]) => {
          if (args[0] === 'plugins') {
            enabling += 1
            most = Math.max(most, enabling)
            await new Promise((resolve) => setTimeout(resolve, 5))
            enabling -= 1
          }
          return { code: 0, stdout: '{"ok": true}', stderr: '' }
        },
        home: async () => '/home'
      },
      readFile: async () => '',
      writeFile: async () => undefined,
      mkdir: async () => undefined
    }
    const rooms = enginePlugin(deps, { name: 'talyx-rooms', files: { 'a.py': 'a' } })
    const usage = enginePlugin(deps, { name: 'talyx-usage', files: { 'b.py': 'b' } })

    await Promise.all([rooms.run(() => []), usage.run(() => [])])

    expect(most).toBe(1)
  })
})

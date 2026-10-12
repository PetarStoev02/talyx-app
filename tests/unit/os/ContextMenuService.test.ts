import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Mock electron app before importing service
const mockHome = mkdtempSync(join(tmpdir(), 'talyx-ctx-test-'))

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key === 'home') return mockHome
      return mockHome
    },
    isPackaged: false
  }
}))

// Must import after mock
const { contextMenuService } =
  await import('../../../src/main/infrastructure/os/ContextMenuService')

describe('ContextMenuService', () => {
  afterEach(() => {
    // Clean up any installed workflows
    const servicesDir = join(mockHome, 'Library', 'Services')
    if (existsSync(servicesDir)) {
      rmSync(servicesDir, { recursive: true, force: true })
    }
  })

  describe('on macOS', () => {
    const originalPlatform = process.platform

    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
    })

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    it('reports not installed initially', () => {
      const status = contextMenuService.status()
      expect(status.installed).toBe(false)
      expect(status.platform).toBe('darwin')
    })

    it('installs workflow bundle', () => {
      contextMenuService.install()

      const workflowPath = join(mockHome, 'Library', 'Services', 'Sort with Talyx.workflow')
      expect(existsSync(workflowPath)).toBe(true)
      expect(existsSync(join(workflowPath, 'Contents', 'document.wflow'))).toBe(true)
      expect(existsSync(join(workflowPath, 'Contents', 'Info.plist'))).toBe(true)

      const status = contextMenuService.status()
      expect(status.installed).toBe(true)
    })
  })
})

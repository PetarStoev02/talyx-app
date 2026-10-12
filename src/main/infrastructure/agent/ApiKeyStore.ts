import { safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { MissingApiKeyError, SecureStorageUnavailableError } from '../../domain/agent/errors'

const FILE = 'anthropic-api-key.bin'

/** Encrypted blob next to settings.json. Construct after app.whenReady(). */
export class ApiKeyStore {
  private readonly path: string

  constructor(userDataDir: string) {
    this.path = join(userDataDir, FILE)
  }

  has(): boolean {
    return existsSync(this.path)
  }

  read(): string {
    if (!this.has()) throw new MissingApiKeyError()
    if (!safeStorage.isEncryptionAvailable()) throw new SecureStorageUnavailableError()
    return safeStorage.decryptString(readFileSync(this.path))
  }

  write(key: string): void {
    if (!safeStorage.isEncryptionAvailable()) throw new SecureStorageUnavailableError()
    mkdirSync(join(this.path, '..'), { recursive: true })
    writeFileSync(this.path, safeStorage.encryptString(key.trim()))
  }

  clear(): void {
    if (this.has()) unlinkSync(this.path)
  }
}

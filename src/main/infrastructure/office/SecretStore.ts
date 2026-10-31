import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface SecretCrypto {
  encrypt(s: string): Buffer
  decrypt(b: Buffer): string
}

export class SecretStore {
  private readonly dir: string

  constructor(
    userDataDir: string,
    private readonly crypto: SecretCrypto
  ) {
    this.dir = join(userDataDir, 'secrets')
  }

  get(name: string): string | null {
    try {
      return this.crypto.decrypt(readFileSync(this.file(name)))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  set(name: string, value: string): void {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 })
    chmodSync(this.dir, 0o700)
    writeFileSync(this.file(name), this.crypto.encrypt(value), { mode: 0o600 })
    chmodSync(this.file(name), 0o600)
  }

  delete(name: string): void {
    rmSync(this.file(name), { force: true })
  }

  private file(name: string): string {
    return join(this.dir, `${encodeURIComponent(name)}.bin`)
  }
}

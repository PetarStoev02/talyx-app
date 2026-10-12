/**
 * One class per failure. A catch-all that flattens them lies exactly when the
 * truth matters (the instruction harness reported "coordinator not loaded" as
 * "I didn't understand you" for two debugging rounds).
 */
export class MissingApiKeyError extends Error {
  readonly key = 'agent_missing_api_key'
  constructor() {
    super('No API key is configured')
    this.name = 'MissingApiKeyError'
  }
}

export class SecureStorageUnavailableError extends Error {
  readonly key = 'agent_secure_storage_unavailable'
  constructor() {
    super('This system cannot store the API key securely')
    this.name = 'SecureStorageUnavailableError'
  }
}

export class ProviderError extends Error {
  readonly key = 'agent_provider_error'
  constructor(
    readonly status: number | null,
    message: string
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

export class ReplyTruncatedError extends Error {
  readonly key = 'agent_reply_truncated'
  constructor() {
    super('The model reply was cut off before it finished')
    this.name = 'ReplyTruncatedError'
  }
}

export class TargetExistsError extends Error {
  readonly key = 'agent_target_exists'
  constructor(readonly targetPath: string) {
    super(`A file already exists at ${targetPath}`)
    this.name = 'TargetExistsError'
  }
}

export class RepoOutsideRootError extends Error {
  readonly key = 'agent_repo_outside_root'
  constructor(readonly repo: string) {
    super(`"${repo}" is not inside the projects folder`)
    this.name = 'RepoOutsideRootError'
  }
}

/** Programmer error: a read-only capability proposed a change. No user-facing key. */
export class ReadOnlyProposedChangeError extends Error {
  constructor(readonly tool: string) {
    super(`Read-only capability "${tool}" returned operations`)
    this.name = 'ReadOnlyProposedChangeError'
  }
}

export class AgentAbortedError extends Error {
  readonly key = 'agent_aborted'
  constructor() {
    super('Stopped')
    this.name = 'AgentAbortedError'
  }
}

export class IterationLimitError extends Error {
  readonly key = 'agent_iteration_limit'
  constructor(readonly limit: number) {
    super(`Gave up after ${limit} steps without finishing`)
    this.name = 'IterationLimitError'
  }
}

export class ClaudeCodeNotFoundError extends Error {
  readonly key = 'agent_claude_code_missing'
  constructor() {
    super('Claude Code is not installed on this computer')
    this.name = 'ClaudeCodeNotFoundError'
  }
}

export class ClaudeCodeNotSignedInError extends Error {
  readonly key = 'agent_claude_code_signed_out'
  constructor() {
    super('Claude Code is not signed in. Run `claude` in a terminal and sign in.')
    this.name = 'ClaudeCodeNotSignedInError'
  }
}

/** Claude Code ended the turn with an error result; `subtype` is the SDK's. */
export class BrainFailedError extends Error {
  readonly key = 'agent_failed'
  constructor(
    readonly subtype: string,
    message: string
  ) {
    super(message)
    this.name = 'BrainFailedError'
  }
}

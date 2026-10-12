import { z } from 'zod/v4'
import { join, sep } from 'path'
import type { Capability, Proposal } from '../model/Capability'
import type { Effect } from '../model/Effect'
import { AgentAbortedError, RepoOutsideRootError } from '../../agent/errors'

export interface DevCapabilityDeps {
  /** Immediate children of `root` that contain a `.git` entry. */
  listRepos(root: string): Promise<string[]>
  /** Resolves symlinks; rejects if the path does not exist. */
  realpath(path: string): Promise<string>
  run(
    command: string,
    cwd: string,
    signal: AbortSignal
  ): Promise<{
    exitCode: number | null
    output: string
    timedOut: boolean
    /** The run ended because the session was aborted; nothing about it is a result. */
    aborted: boolean
  }>
}

export type RunPayload = { command: string; cwd: string }

export const RUN_OUTPUT_CAP = 8000
export const RUN_TIMEOUT_MS = 60_000

const READ_ONLY: Effect = { reversible: false, world: 'reads', discloses: 'nothing' }
/** Command output leaves the machine with the next model call. */
const ONE_WAY_SHELL: Effect = { reversible: false, world: 'mutates', discloses: 'content' }

export function devCapabilities(deps: DevCapabilityDeps): Capability[] {
  const listRepos: Capability<Record<string, never>> = {
    name: 'list_repos',
    description: 'List the code repositories in the projects folder',
    examples: ['what repos do I have', 'list my projects'],
    params: z.object({}),
    effect: READ_ONLY,
    async plan(_params, ctx): Promise<Proposal> {
      const names = await deps.listRepos(ctx.projectsRoot)
      return {
        kind: 'answer',
        summary: `${names.length} repositor${names.length === 1 ? 'y' : 'ies'} in ${ctx.projectsRoot}`,
        evidence: names.map((name) => ({ source: join(ctx.projectsRoot, name), text: name })),
        card: {
          kind: 'paths',
          entries: names.map((name) => ({
            path: join(ctx.projectsRoot, name),
            label: name,
            snippet: null,
            isDirectory: true
          }))
        }
      }
    }
  }

  const runInRepo: Capability<{ repo: string; command: string }> = {
    name: 'run_in_repo',
    description:
      'Run a shell command inside one of the repositories in the projects folder and return its output',
    examples: ['run the tests in talyx', 'git status in tender-app', 'npm run build in talyx'],
    params: z.object({
      repo: z.string().min(1).describe('Repository folder name, as returned by list_repos'),
      command: z
        .string()
        .min(1)
        .describe('The shell command to run, exactly as typed in a terminal')
    }),
    effect: ONE_WAY_SHELL,
    async plan({ repo, command }, ctx): Promise<Proposal> {
      const cwd = await deps.realpath(join(ctx.projectsRoot, repo))
      const root = await deps.realpath(ctx.projectsRoot)
      if (cwd !== root && !cwd.startsWith(root + sep)) throw new RepoOutsideRootError(repo)
      return {
        kind: 'plan',
        summary: `Run "${command}" in ${repo}`,
        operations: [
          {
            label: `$ ${command}  in ${cwd}`,
            reason: `run in ${repo}`,
            payload: { command, cwd } satisfies RunPayload,
            inverse: null
          }
        ]
      }
    },
    async execute(op, ctx): Promise<string> {
      const { command, cwd } = op.payload as RunPayload
      const { exitCode, output, timedOut, aborted } = await deps.run(command, cwd, ctx.signal)
      if (aborted) throw new AgentAbortedError()
      const head = timedOut
        ? `timed out after ${RUN_TIMEOUT_MS / 1000}s\n`
        : `exit ${exitCode ?? 'null'}\n`
      return head + tail(output)
    }
  }

  return [listRepos as Capability, runInRepo as Capability]
}

/** The end of a long run is the part that says what happened. */
function tail(output: string): string {
  if (output.length <= RUN_OUTPUT_CAP) return output
  const marker = '[output truncated]\n'
  return marker + output.slice(output.length - (RUN_OUTPUT_CAP - marker.length))
}

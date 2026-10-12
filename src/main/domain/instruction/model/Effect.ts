/**
 * What a capability does to the world, on the axes a trust policy must reason
 * about. Not a single risk level: a lone enum forces the capability author to
 * pre-judge whether something is auto-approvable, when the policy is the only
 * thing that can decide that.
 *
 * Design credit: cloudflare/cloudflare-os (Apache-2.0),
 * packages/workshop-shared/src/gatekeeper.ts — which shipped a single boolean
 * and recorded in-source why it was the wrong shape.
 */
export interface Effect {
  /** Can the harness put it back automatically, without the user repairing anything? */
  reversible: boolean
  /**
   * reads: changes nothing. creates: adds something new. mutates: alters or
   * removes something that already existed. Escalating consequence, in order.
   */
  world: 'reads' | 'creates' | 'mutates'
  /** What leaves this machine. Read by A2 to decide what a remote model may see. */
  discloses: 'nothing' | 'query' | 'content'
}

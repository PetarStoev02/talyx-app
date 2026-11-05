import { BotAvatar } from './BotAvatar'
import type { Bot, Room } from './types'

// A room shows up to three of its members.
const SHOWN = 3
// In a cluster each member takes this share of the square's side, so three overlap a little.
const CLUSTER_SHARE = 0.62

export function RoomAvatars({
  room,
  bots,
  size = 24,
  cluster = null,
  speaking = []
}: {
  room: Room
  bots: Bot[]
  size?: number
  // The side of a square the members share, so a room takes one avatar's place in a list (a
  // roster row or tile). Null lays them side by side at `size`.
  cluster?: number | null
  // Profiles answering in the open room; their blocks bob.
  speaking?: string[]
}): React.JSX.Element {
  const members = room.members.slice(0, SHOWN)
  const avatar = (profile: string, avatarSize: number): React.JSX.Element => (
    <BotAvatar
      bot={bots.find((bot) => bot.name === profile) ?? { name: profile, meta: {} }}
      place="row"
      size={avatarSize}
      speaking={speaking.includes(profile)}
    />
  )
  if (cluster === null)
    return (
      <span className="flex shrink-0 items-end -space-x-1" aria-hidden="true">
        {members.map((member) => (
          <span key={member.profile}>{avatar(member.profile, size)}</span>
        ))}
      </span>
    )
  const side = members.length === 1 ? cluster : Math.round(cluster * CLUSTER_SHARE)
  const far = cluster - side
  // One fills the square; two sit corner to corner; three make a triangle, two above one.
  const spots =
    members.length === 1
      ? [[0, 0]]
      : members.length === 2
        ? [
            [0, 0],
            [far, far]
          ]
        : [
            [0, 0],
            [far, 0],
            [far / 2, far]
          ]
  return (
    <span
      className="relative shrink-0"
      style={{ width: cluster, height: cluster }}
      aria-hidden="true"
    >
      {members.map((member, index) => (
        <span
          key={member.profile}
          className="absolute"
          style={{ left: spots[index][0], top: spots[index][1] }}
        >
          {avatar(member.profile, side)}
        </span>
      ))}
    </span>
  )
}

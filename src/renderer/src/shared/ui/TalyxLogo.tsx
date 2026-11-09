import { TALYX_CUTS, TALYX_CUTS_SMALL, TALYX_SILHOUETTE, TALYX_SMALL_MAX } from './talyxMark'

interface TalyxLogoProps {
  size?: number
  className?: string
}

export function TalyxLogo({ size = 32, className }: TalyxLogoProps): React.JSX.Element {
  const cuts = size <= TALYX_SMALL_MAX ? TALYX_CUTS_SMALL : TALYX_CUTS
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 226 251"
      width={size}
      height={size}
      className={className}
    >
      <path d={[TALYX_SILHOUETTE, ...cuts].join(' ')} fill="currentColor" fillRule="evenodd" />
    </svg>
  )
}

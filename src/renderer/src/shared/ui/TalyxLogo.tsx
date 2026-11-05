import { useId } from 'react'
import { TALYX_CUTS, TALYX_SILHOUETTE } from './talyxMark'

interface TalyxLogoProps {
  size?: number
  className?: string
}

export function TalyxLogo({ size = 32, className }: TalyxLogoProps): React.JSX.Element {
  const maskId = useId()
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 226 251"
      width={size}
      height={size}
      className={className}
    >
      <mask id={maskId}>
        <path d={TALYX_SILHOUETTE} fill="white" />
        {TALYX_CUTS.map((cut) => (
          <path key={cut} d={cut} fill="black" />
        ))}
      </mask>
      <rect width="226" height="251" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  )
}

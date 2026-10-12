import { AppEmbed } from './AppEmbed'

/** Full Assistant window for the hero — real app UI with macOS traffic-light chrome. */
export function AppWindow() {
  return (
    <AppEmbed
      view="assistant"
      width={1280}
      height={860}
      title="The Talyx Assistant, ready for an instruction"
      chrome="window"
      className="shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)]"
    />
  )
}

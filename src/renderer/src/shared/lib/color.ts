// Colour-space and hash math: a stored colour's hue, and a stable hash of a name.

// Below this oklab chroma a colour reads as grey and has no hue to keep.
const GREY_CHROMA = 0.02

/**
 * The oklch hue (degrees) of an `hsl(...)` or `#hex` colour; undefined for one it cannot read or
 * one too grey to have a hue.
 */
export function oklchHue(color: string): number | undefined {
  const rgb = hslToRgb(color) ?? hexToRgb(color)
  if (!rgb) return undefined
  const [r, g, b] = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  )
  if (r === undefined || g === undefined || b === undefined) return undefined
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  if (Math.hypot(a, bb) < GREY_CHROMA) return undefined
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360
}

function hslToRgb(color: string): number[] | undefined {
  const match = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i.exec(color.trim())
  if (!match) return undefined
  const [h, s, l] = [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100]
  const a = s * Math.min(l, 1 - l)
  const f = (n: number): number => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}

function hexToRgb(color: string): number[] | undefined {
  const [, digits] = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim()) ?? []
  if (digits === undefined) return undefined
  const hex = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits
  return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
}

/** The 32-bit FNV-1a hash of `text`: the same on every client. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { BlockAvatar } from './BlockAvatar'
import type { BlockShape } from './blockGeometry'

// The profile asset other engine surfaces show; large enough to stay crisp anywhere.
const PNG_SIZE = 1024

/** The idle block as a PNG data URL, drawn by the same renderer as the app's avatars. */
export async function blockPng(look: {
  shape: BlockShape
  hue: number
  faces: boolean
}): Promise<string> {
  const holder = document.createElement('div')
  const root = createRoot(holder)
  flushSync(() =>
    root.render(
      createElement(BlockAvatar, {
        shape: look.shape,
        hue: look.hue,
        size: PNG_SIZE,
        face: look.faces
      })
    )
  )
  const svg = holder.innerHTML
  root.unmount()
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = PNG_SIZE
  canvas.height = PNG_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')
  context.drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}

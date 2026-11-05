/// <reference types="vite/client" />

/** The year the site was built, set by vite.config.ts. */
declare const __BUILD_YEAR__: number

declare module '*.md?raw' {
  const content: string
  export default content
}

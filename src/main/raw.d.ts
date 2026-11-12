// A file bundled as its text (Vite's `?raw`), such as the engine plugin Talyx installs.
declare module '*?raw' {
  const text: string
  export default text
}

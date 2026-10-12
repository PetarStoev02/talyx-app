/** The orb draws light dots on dark and dark dots on light; read the app's resolved theme. */
export function orbTheme(): 'dark' | 'light' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** The send/stop button is the page's inverse colour, so its orb is too. */
export function orbThemeOnPrimary(): 'dark' | 'light' {
  return orbTheme() === 'dark' ? 'light' : 'dark'
}

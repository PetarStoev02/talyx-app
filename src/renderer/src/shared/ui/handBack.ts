// Focus a closing dialog hands back is not the user reaching the control: a tooltip it opened
// would take the next Escape, which belongs to the page (Settings and Usage leave on it).
let active = false

/** Focuses `element` as a dialog hands focus back, so its tooltip stays shut. */
export function focusHandedBack(element: HTMLElement): void {
  active = true
  try {
    element.focus()
  } finally {
    active = false
  }
}

/** Whether the focus now arriving is one a dialog hands back. */
export function handingBack(): boolean {
  return active
}

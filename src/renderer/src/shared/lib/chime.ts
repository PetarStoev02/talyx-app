// One context for the window: browsers cap how many can be open at once.
let context: AudioContext | null = null

/** A soft two-note chime, made with WebAudio so there is no sound file to ship or load. */
export function playChime(): void {
  context ??= new AudioContext()
  // Chromium starts a context suspended until the page has had a gesture; resume is a no-op after.
  void context.resume()
  const start = context.currentTime
  note(context, 880, start)
  note(context, 1320, start + 0.12)
}

function note(audio: AudioContext, frequency: number, at: number): void {
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  // A quick rise and a long fade, so the note does not click at either end.
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.15, at + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
  oscillator.connect(gain).connect(audio.destination)
  oscillator.start(at)
  oscillator.stop(at + 0.4)
}

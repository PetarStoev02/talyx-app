// Two rising notes a fifth apart (A5, E6), the second a beat after the first; times in seconds.
const NOTES_HZ = [880, 1320]
const NOTE_GAP_S = 0.12
const PEAK_GAIN = 0.15
const RISE_S = 0.01
const FADE_S = 0.35
const SILENT_GAIN = 0.0001

// One context for the window: browsers cap how many can be open at once.
let context: AudioContext | null = null

/** A soft two-note chime, made with WebAudio so there is no sound file to ship or load. */
export function playChime(): void {
  const audio = (context ??= new AudioContext())
  // Chromium starts a context suspended until the page has had a gesture; resume is a no-op after.
  void audio.resume()
  const start = audio.currentTime
  NOTES_HZ.forEach((frequency, index) => note(audio, frequency, start + index * NOTE_GAP_S))
}

function note(audio: AudioContext, frequency: number, at: number): void {
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  // A quick rise and a long fade, so the note does not click at either end.
  gain.gain.setValueAtTime(SILENT_GAIN, at)
  gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, at + RISE_S)
  gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, at + FADE_S)
  oscillator.connect(gain).connect(audio.destination)
  oscillator.start(at)
  oscillator.stop(at + FADE_S)
}

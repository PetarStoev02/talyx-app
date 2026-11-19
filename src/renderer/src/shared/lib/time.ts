// Clock units, for epoch arithmetic and for times shown in words.
export const SECOND_MS = 1000
export const MINUTES_PER_HOUR = 60
export const HOURS_PER_DAY = 24
export const MINUTE_MS = 60 * SECOND_MS
export const HOUR_MS = MINUTES_PER_HOUR * MINUTE_MS
export const DAY_MS = HOURS_PER_DAY * HOUR_MS
// A clock or date field as shown: two digits, zero-padded ("09:05", "2026-01-02").
export const CLOCK_DIGITS = 2

export const PREF_KEY = 'preferWebSpeech'

export function getPreferWebSpeech(): boolean {
  return localStorage.getItem(PREF_KEY) === 'true'
}

export const WAKE_LOCK_KEY = 'preferWakeLock'

export function getPreferWakeLock(): boolean {
  return localStorage.getItem(WAKE_LOCK_KEY) === 'true'
}

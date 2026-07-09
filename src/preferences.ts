export const PREF_KEY = 'preferWebSpeech'

export function getPreferWebSpeech(): boolean {
  return localStorage.getItem(PREF_KEY) === 'true'
}

export function setPreferWebSpeech(value: boolean): void {
  localStorage.setItem(PREF_KEY, String(value))
}

export const WAKE_LOCK_KEY = 'preferWakeLock'

export function getPreferWakeLock(): boolean {
  return localStorage.getItem(WAKE_LOCK_KEY) === 'true'
}

export function setPreferWakeLock(value: boolean): void {
  localStorage.setItem(WAKE_LOCK_KEY, String(value))
}

export const SOUND_KEY = 'preferSound'

export function getPreferSound(): boolean {
  // Default on — only false when explicitly disabled
  return localStorage.getItem(SOUND_KEY) !== 'false'
}

export function setPreferSound(value: boolean): void {
  localStorage.setItem(SOUND_KEY, String(value))
}

export const PREF_KEY = 'preferWebSpeech'

export function getPreferWebSpeech(): boolean {
  return localStorage.getItem(PREF_KEY) === 'true'
}

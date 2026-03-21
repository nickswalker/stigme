export const PREF_KEY = 'preferKeyboardDictation'

export function getPreferKeyboardDictation(): boolean {
  return localStorage.getItem(PREF_KEY) === 'true'
}

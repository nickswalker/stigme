import { useEffect } from 'react'

// Calls `handler` when Escape is pressed. Pass null to disable (e.g. while a
// child modal should handle Escape instead). Uses a document-level listener
// because the modals don't hold focus, so element-level onKeyDown is
// unreliable.
export function useEscapeKey(handler: (() => void) | null) {
  useEffect(() => {
    if (!handler) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handler!()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handler])
}

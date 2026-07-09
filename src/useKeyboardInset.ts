import { useState, useEffect } from 'react'

// Height in px of the on-screen keyboard overlapping the layout viewport,
// derived from window.visualViewport. 0 when the keyboard is closed or the
// browser doesn't support visualViewport.
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      if (!vv) return
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}

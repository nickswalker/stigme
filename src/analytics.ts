type GoatCounter = {
  count?: (event: { path: string; event: boolean }) => void
}

declare global {
  interface Window {
    goatcounter?: GoatCounter
  }
}

export function trackEvent(path: string): void {
  window.goatcounter?.count?.({ path: `stigme.${path}`, event: true })
}

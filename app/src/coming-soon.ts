import { useEffect } from 'react'

export const FIX_RUNS_NEXT = 'Fix runs and waivers come in the next version.'

// The kit's Fix with ▾ and ⋯ (Waive) take no disabled prop: until fix runs land, they are disabled in place.
const TARGETS = '[aria-label="Fix"], button[aria-label="More actions"]'

/** Disables the kit's Fix and Waive controls wherever they render, with a tooltip saying why. */
export function useFixRunsNext() {
  useEffect(() => {
    const apply = () => {
      for (const target of document.querySelectorAll<HTMLElement>(TARGETS)) {
        target.title = FIX_RUNS_NEXT
        const buttons = target instanceof HTMLButtonElement ? [target] : target.querySelectorAll('button')
        for (const button of buttons) button.disabled = true
      }
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
}

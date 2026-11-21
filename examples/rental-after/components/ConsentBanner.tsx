'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CONSENT_COOKIE, type Choice } from '@/lib/consent'

interface Labels {
  title: string
  text: string
  accept: string
  reject: string
  more: string
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

const SIX_MONTHS = 60 * 60 * 24 * 182

/** Turns the held-back analytics placeholders (`<script type="text/plain" data-category="analytics">`) into scripts. */
function startAnalytics() {
  for (const placeholder of document.querySelectorAll<HTMLScriptElement>('script[type="text/plain"][data-category="analytics"]')) {
    if (placeholder.dataset.started) continue
    placeholder.dataset.started = 'true'
    const script = document.createElement('script')
    script.src = placeholder.dataset.src ?? ''
    script.defer = true
    if (placeholder.dataset.websiteId) script.dataset.websiteId = placeholder.dataset.websiteId
    document.body.appendChild(script)
  }
}

/**
 * Asks once, before any statistics run. Declining is one click, like allowing; nothing but the choice itself is stored.
 * The footer's "Cookie settings" opens it again.
 */
export function ConsentBanner({ initial, labels, policyHref }: { initial?: Choice; labels: Labels; policyHref: string }) {
  const [choice, setChoice] = useState<Choice | undefined>(initial)
  const [open, setOpen] = useState(!initial)

  useEffect(() => {
    if (choice === 'granted') startAnalytics()
  }, [choice])

  useEffect(() => {
    const reopen = () => setOpen(true)
    window.addEventListener('consent:open', reopen)
    return () => window.removeEventListener('consent:open', reopen)
  }, [])

  const decide = useCallback((value: Choice) => {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${SIX_MONTHS}; SameSite=Lax${secure}`
    window.gtag?.('consent', 'update', { analytics_storage: value })
    setChoice(value)
    setOpen(false)
    // a withdrawn consent stops the statistics script that already runs: reload without it
    if (value === 'denied' && document.querySelector('script[data-category="analytics"][data-started]')) window.location.reload()
  }, [])

  if (!open) return null
  const button = 'rounded-md border-2 border-white bg-white px-5 py-2.5 text-base font-semibold text-ink hover:bg-surface'
  return (
    <>
    {/* room at the end of the page, so the banner never hides the footer */}
    <div aria-hidden="true" className="h-48 md:h-32" />
    <section
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-accent bg-brand-deep text-white shadow-2xl"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <h2 id="consent-title" className="text-lg font-semibold">
            {labels.title}
          </h2>
          <p className="mt-1 text-[15px] leading-relaxed text-[#E3EEF6]">
            {labels.text}{' '}
            <Link href={policyHref} className="underline underline-offset-2">
              {labels.more}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <button type="button" className={button} onClick={() => decide('denied')}>
            {labels.reject}
          </button>
          <button type="button" className={button} onClick={() => decide('granted')}>
            {labels.accept}
          </button>
        </div>
      </div>
    </section>
    </>
  )
}

'use client'

/** Opens the consent banner again, so a choice can be changed as easily as it was made. */
export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event('consent:open'))} className="underline underline-offset-2 hover:text-white">
      {label}
    </button>
  )
}

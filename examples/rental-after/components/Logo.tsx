import { company } from '@/content/business'
import { LOGO } from './logo-art'

/** The logo, drawn inline: no request, and sharp at any size. The text is outlined, so it needs no font. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO.width} ${LOGO.height}`}
      className={className}
      role="img"
      aria-label={company.brand}
      // biome-ignore lint: generated, trusted paths from scripts/brand-media.ts
      dangerouslySetInnerHTML={{ __html: LOGO.inner }}
    />
  )
}

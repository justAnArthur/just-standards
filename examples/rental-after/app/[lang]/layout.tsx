import '../globals.css'
import type { Metadata, Viewport } from 'next'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { Analytics } from '@/components/Analytics'
import { ConsentBanner } from '@/components/ConsentBanner'
import { company } from '@/content/business'
import { t } from '@/content/dictionary'
import { CONSENT_COOKIE, CONSENT_DEFAULTS, isChoice } from '@/lib/consent'
import { isLocale, pathOf } from '@/lib/i18n'
import { SITE_URL } from '@/lib/site'
import { inter } from '../fonts'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: company.brand,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#0A3550',
  colorScheme: 'light',
}

export default async function LangLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  // proxy.ts puts a fresh nonce on every request; Next.js adds it to its own scripts, this layout to the inline one
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const stored = (await cookies()).get(CONSENT_COOKIE)?.value
  const d = t(lang)
  return (
    <html lang={lang} className={inter.variable}>
      <body className="flex min-h-screen flex-col">
        <Script id="consent-defaults" strategy="beforeInteractive" nonce={nonce}>
          {CONSENT_DEFAULTS}
        </Script>
        {children}
        <Analytics />
        <ConsentBanner initial={isChoice(stored) ? stored : undefined} labels={d.consent} policyHref={pathOf('cookies', lang)} />
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import { company } from '@/content/business'
import { pageCopy } from '@/content/pages'
import { defaultLocale, type Locale, locales, ogLocale, type PageId, pathOf } from '@/lib/i18n'
import { absolute } from '@/lib/site'

const SUFFIX = ` · ${company.brand}`

export const fullTitle = (page: PageId, lang: Locale) => `${pageCopy[page][lang].title}${SUFFIX}`

/** The share image of a page: the fleet and the branches have their own, the rest share the home page's. */
function shareImage(page: PageId, lang: Locale) {
  const group = page === 'fleet' || page === 'booking' ? 'fleet' : page.startsWith('location') ? 'locations' : 'home'
  return { url: absolute(`/og/${group}-${lang}.png`), width: 1200, height: 630, type: 'image/png', alt: pageCopy[page][lang].h1 }
}

export const shareVideo = {
  url: absolute('/og/loop.mp4'),
  width: 1280,
  height: 720,
  type: 'video/mp4',
}

/** The full metadata of a page: title, description, canonical, hreflang, Open Graph with image and video, the X card. */
export function pageMetadata(page: PageId, lang: Locale): Metadata {
  const copy = pageCopy[page][lang]
  const title = fullTitle(page, lang)
  const url = absolute(pathOf(page, lang))
  const image = shareImage(page, lang)
  return {
    title: { absolute: title },
    description: copy.description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(locales.map(other => [other, absolute(pathOf(page, other))])),
        'x-default': absolute(pathOf(page, defaultLocale)),
      },
    },
    openGraph: {
      type: 'website',
      siteName: company.brand,
      title,
      description: copy.description,
      url,
      locale: ogLocale[lang],
      alternateLocale: locales.filter(other => other !== lang).map(other => ogLocale[other]),
      images: [image],
      videos: [shareVideo],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: copy.description,
      images: [image.url],
    },
  }
}

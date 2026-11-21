// Consent to statistics, kept in one first-party cookie that only records the choice.
export const CONSENT_COOKIE = 'consent'
export type Choice = 'granted' | 'denied'
export const isChoice = (value: string | undefined): value is Choice => value === 'granted' || value === 'denied'

/**
 * Google Consent Mode v2 defaults, set before any tag could load: everything denied until the visitor allows
 * statistics. The site loads no Google tag today; the defaults keep one added later from tracking without consent.
 */
export const CONSENT_DEFAULTS = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});`

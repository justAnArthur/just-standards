import { isHttps } from '@/lib/site'

/**
 * The Content-Security-Policy of every page. Scripts run only with the request's nonce ('strict-dynamic' lets those
 * scripts load the chunks they need), so an injected inline script does not. Styles allow inline: next/font and
 * next/image write style attributes, and a style can't run code.
 */
export function contentSecurityPolicy(nonce: string) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isHttps ? ['upgrade-insecure-requests'] : []),
  ]
  return directives.join('; ')
}

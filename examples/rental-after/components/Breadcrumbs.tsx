import Link from 'next/link'
import { t } from '@/content/dictionary'
import { pageCopy } from '@/content/pages'
import { type Locale, type PageId, pathOf } from '@/lib/i18n'
import { trail } from '@/lib/jsonld'

/** The visible trail; the same one is in the page's BreadcrumbList. */
export function Breadcrumbs({ page, lang }: { page: PageId; lang: Locale }) {
  const steps = trail(page)
  return (
    <nav aria-label={t(lang).breadcrumb} className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {steps.map((id, i) => {
          const name = pageCopy[id][lang].crumb ?? pageCopy[id][lang].h1
          const last = i === steps.length - 1
          return (
            <li key={id} className="flex items-center gap-1">
              {last ? (
                <span aria-current="page">{name}</span>
              ) : (
                <>
                  <Link href={pathOf(id, lang)} className="underline underline-offset-2 hover:text-ink">
                    {name}
                  </Link>
                  <span aria-hidden="true">›</span>
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

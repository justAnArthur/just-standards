import { pageCopy } from '@/content/pages'
import type { Locale, PageId } from '@/lib/i18n'
import { Breadcrumbs } from './Breadcrumbs'

/** An inner page's top: the breadcrumb trail, its one h1, and a lead. */
export function PageHeader({ page, lang, lead }: { page: PageId; lang: Locale; lead?: React.ReactNode }) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Breadcrumbs page={page} lang={lang} />
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{pageCopy[page][lang].h1}</h1>
        {lead ? <p className="mt-3 max-w-3xl text-lg text-muted">{lead}</p> : null}
      </div>
    </div>
  )
}

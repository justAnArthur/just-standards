/** The current year in Bratislava, rendered with each request, so the copyright line never goes stale. */
export function CurrentYear() {
  return <>{new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Bratislava' }).format(new Date())}</>
}

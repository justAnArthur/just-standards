'use client'

// What renders when the root layout itself throws: it replaces the layout, so it brings its own html and body.
// Plain styles only: the app's CSS may be what failed.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="sk">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', color: '#14202B' }}>
        <main style={{ maxWidth: '72rem', margin: '0 auto', padding: '80px 24px' }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 16px' }}>Niečo sa pokazilo</h1>
          <p style={{ margin: '0 0 24px', color: '#4B5966' }}>Stránku sa nepodarilo načítať. Skúste to znova, alebo nám zavolajte.</p>
          <p lang="en" style={{ margin: '0 0 24px', color: '#4B5966' }}>Something went wrong loading this page. Try again, or call us.</p>
          <button type="button" onClick={() => reset()} style={{ padding: '12px 20px', borderRadius: 6, border: 0, background: '#0E5A8A', color: '#fff', fontWeight: 600 }}>
            Skúsiť znova
          </button>
        </main>
      </body>
    </html>
  )
}

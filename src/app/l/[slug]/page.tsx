import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: build } = await supabase
    .from('landing_builds')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'ready')
    .single()

  if (!build?.generated_html) {
    return (
      <html>
        <body style={{ background: '#06070B', color: '#F0ECE3', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Página no encontrada</h1>
            <p style={{ color: '#6b7280' }}>Esta landing page no existe o no está publicada.</p>
          </div>
        </body>
      </html>
    )
  }

  // Track visit
  await supabase.from('landing_builds').update({ visits: (build.visits || 0) + 1 }).eq('id', build.id)

  return <div dangerouslySetInnerHTML={{ __html: build.generated_html }} />
}

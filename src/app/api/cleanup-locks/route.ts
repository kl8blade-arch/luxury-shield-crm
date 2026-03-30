import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('leads')
    .update({ sophia_processing: false })
    .eq('sophia_processing', true)
    .lt('updated_at', fiveMinAgo)
    .select('id')

  return NextResponse.json({ cleaned: data?.length || 0, timestamp: new Date().toISOString() })
}

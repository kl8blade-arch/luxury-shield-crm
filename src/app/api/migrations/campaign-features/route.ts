import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * POST /api/migrations/campaign-features
 * Adds feature toggle columns to meta_campaigns table
 */
export async function POST(req: NextRequest) {
  try {
    // Check if columns already exist
    const { error: checkError } = await supabase
      .from('meta_campaigns')
      .select('notify_on_conversion')
      .limit(1)

    if (!checkError) {
      return NextResponse.json({
        success: true,
        message: 'Columns already exist'
      })
    }

    return NextResponse.json({
      success: false,
      message: 'Columns do not exist. Run this SQL manually in Supabase:\n' +
        'ALTER TABLE meta_campaigns ADD COLUMN IF NOT EXISTS notify_on_conversion BOOLEAN DEFAULT false, ' +
        'ADD COLUMN IF NOT EXISTS export_pdf_enabled BOOLEAN DEFAULT false, ' +
        'ADD COLUMN IF NOT EXISTS growth_prediction_enabled BOOLEAN DEFAULT false;'
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
